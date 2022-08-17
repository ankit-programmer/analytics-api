import dotenv from 'dotenv';
dotenv.config();
import { MongoClient } from 'mongodb';
import logger from "../../logger/logger";
import fs from 'fs';
import { DateTime } from 'luxon';
import { delay } from '../../services/utility-service';
import { dirname } from 'path';
import ReportData from '../../models/report-data.model';

const appDir = dirname(require.main?.filename || '');
const BATCH_SIZE = 1000;
const LAG = 48 * 60;  // Hours * Minutes
const INTERVAL = 5   // Minutes
// Connection URL
const url = process.env.MONGO_CONNECTION_STRING || "";
const client = new MongoClient(url);
const timestampPointerFile = `${appDir}/timestamp.txt`;
const lastDocumentProcessed = `${appDir}/last-document.txt`;
const dbName = process.env.MONGO_DB_NAME;

export async function main() {
    // Use connect method to connect to the server
    let connection = await client.connect();
    logger.info('Connected successfully to server');
    const db = client.db(dbName);
    const collection = db.collection(process.env.REPORT_DATA_COLLECTION || "");
    while (true) {
        try {
            // Read the timestamp from file and set it as startTime
            const startTime = DateTime.fromISO(getLastTimestamp());
            if (!startTime.isValid) {
                throw new Error("Invalid startTime");
            }
            // Add Interval to startTime and set it as end Time
            const endTime = startTime.plus({
                minutes: INTERVAL
            });
            // Subtract the LAG from currentTime and set it as timeLimit
            const timeLimit = DateTime.now().minus({
                minutes: LAG
            });
            logger.info(`Time Limit : ${timeLimit}, End Time : ${endTime}, Diff : ${timeLimit.diff(endTime, 'minute').minutes}`)
            if (timeLimit.diff(endTime, 'minute').minutes <= 0) {
                await delay((INTERVAL * 1000));
            } else {
                logger.info("Syncing Data...");
                let start = performance.now();
                const { timestamp, documentId } = await syncData(collection, startTime, endTime, getLastDocument());
                let end = performance.now();
                logger.info(`Processing Time : ${parseInt((end - start).toString())}ms`)
                logger.info(`Last Processed Document : ${documentId}`);
                updatePointer(timestamp.toString(), documentId || undefined);
                await delay(100);
            }
        } catch (error) {
            logger.error(error);
            await delay(10000);
        }

    }
}

main()
    .then(logger.info)
    .catch(logger.error)
    .finally(() => client.close());

async function syncData(collection: any, startTime: DateTime, endTime: DateTime, docuemntId?: string) {
    const output = {
        documentId: null,
        timestamp: endTime
    }
    const query = {
        sentTime: {
            $gte: startTime,
            $lte: endTime
        }
    }
    const docs = await collection.find(query).sort({ sentTime: 1 }).toArray();
    logger.info(`Processing ${docs?.length} documents...`)
    // logger.info(apps);
    let skip = !!docuemntId;
    let batch = new Array();
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        // Skip documents that have already been processed
        if (skip) {
            if (doc?._id == docuemntId) {
                skip = false;
            } else {
                skip = true;
            }
            continue;
        }
        batch.push(new ReportData(doc));

        if (batch.length > 0 && (batch.length >= BATCH_SIZE || i == (docs.length - 1))) {
            await ReportData.insertMany(batch);
            batch = [];
        } else {
            continue;
        }

        // Update the pointer to the last processed document
        let timestamp = DateTime.fromJSDate(doc.sentTime);
        if (timestamp?.isValid) {
            output.timestamp = timestamp;
        }
        output.documentId = doc["_id"]?.toString();
        try {
            updatePointer(output.timestamp.toString(), output.documentId || undefined);

        } catch (error) {
            logger.error(error);
            break;
        }
    }
    return output;
}

function updatePointer(timestamp: string, documentId: string = 'null') {
    try {
        fs.writeFileSync(timestampPointerFile, timestamp);
        fs.writeFileSync(lastDocumentProcessed, documentId || 'null');
    } catch (error) {
        throw error;
    }
}
function getLastTimestamp() {
    try {
        let data = fs.readFileSync(timestampPointerFile, 'utf-8');
        return data.trim();
    } catch (error) {
        logger.error(error);
        throw new Error("Please set the initial timestamp to sync data from in timestamp.txt file");
    }
}
/**
 * 
 * @returns Returns the last processed document
 */
function getLastDocument() {
    try {
        let data = fs.readFileSync(lastDocumentProcessed, 'utf-8');
        if (data && data != 'null') {
            return data.trim();
        } else {
            return undefined;
        }
    } catch (error) {
        return undefined;
    }
}
