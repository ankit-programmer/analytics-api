import logger from "../logger/logger";
import firebaseLogger from '../logger/firebase-logger';
import { MongoClient, ObjectId } from 'mongodb';
import mongoService from '../database/mongo-service';
import { delay } from "../services/utility-service";
import { DateTime } from 'luxon';
import ReportData from '../models/report-data.model';
import RequestData from '../models/request-data.model';
import Tracker, { jobType } from "../models/trackers.model";

let mongoConnection: MongoClient;
const REQUEST_DATA_COLLECTION = process.env.REQUEST_DATA_COLLECTION || '';
const REPORT_DATA_COLLECTION = process.env.REPORT_DATA_COLLECTION || '';
const DELAY_INTERVAL = 30 * 1000; // in secs
const MONGO_DOCS_LIMIT = 10000;
const BATCH_SIZE = 1000;
const LAG = 15;  // Minutes

async function initSynching(job: jobType) {
    logger.info(`MONGO_DOCS_LIMIT: ${MONGO_DOCS_LIMIT} | BATCH_SIZE: ${BATCH_SIZE} | DELAY_INTERVAL: ${DELAY_INTERVAL}`);

    while (true) {
        try {
            const mongoDocs = await fetchDocsFromMongo(job);
            await syncDataToBigQuery(job, mongoDocs);

            if (mongoDocs.length < MONGO_DOCS_LIMIT) {
                logger.info(`Insufficient records to create a batch, going to wait for ${DELAY_INTERVAL / 1000}sec`);
                await delay(DELAY_INTERVAL);
            }
        } catch (error) {
            logger.error(error);
            await delay(10000);
        }
    }
}

async function syncDataToBigQuery(job: jobType, mongoDocs: any[]) {
    logger.info(`[BATCH PROCESSING](Total Records: ${mongoDocs.length}) Initiating...`);

    for (let i = 0; i < mongoDocs.length; i += BATCH_SIZE) {
        const batch = mongoDocs.slice(i, i + BATCH_SIZE);
        logger.info(`[BATCH PROCESSING] ${i}-${(i + BATCH_SIZE) - 1} records synching to big query...`);
        await insertBatchInBigQuery(job, batch);
        logger.info('[BATCH PROCESSING] Batch synched.');
        const lastDocumentId = batch.pop()?._id?.toString();

        logger.info(`[UPDATE TRACKERS] Updating lastDocumentId to ${lastDocumentId}...`);
        await Tracker.upsert({ jobType: job, lastDocumentId }).catch(err => {
            logger.error(err);
            process.exit(1);
        });
    }
}

async function insertBatchInBigQuery(job: jobType, batch: any[]) {
    try {
        if (job === jobType.REQUEST_DATA) await RequestData.insertMany(batch.map(doc => new RequestData(doc)));
        if (job === jobType.REPORT_DATA) await ReportData.insertMany(batch.map(doc => new ReportData(doc)));
    } catch (err: any) {
        if (err.name !== 'PartialFailureError') throw err;
        logger.error(`[JOB](insertBatchInBigQuery) PartialFailureError`);
        logger.error(JSON.stringify(err.errors));
        firebaseLogger.log(err.errors, `${job}SyncErrors`);
    }
}

async function fetchDocsFromMongo(job: jobType): Promise<any[]> {
    try {
        const tracker: any = await Tracker.findByPk(job);
        if (!tracker?.lastDocumentId) throw 'lastDocumentId is required.';
        if (job === jobType.REQUEST_DATA) return fetchRequestDataDocs(maxEndTime(), tracker.lastDocumentId);
        if (job === jobType.REPORT_DATA) return fetchReportDataDocs(maxEndTime(), tracker.lastDocumentId);
        return Promise.resolve([]);
    } catch (err: any) {
        logger.error(err);
        process.exit(1);
    }
}

function fetchRequestDataDocs(maxEndTime: DateTime, lastDocumentId: string) {
    const query = {
        _id: { $gt: new ObjectId(lastDocumentId) },
        $or: [
            { isSingleRequest: { $ne: 1 }, requestDate: { $lte: maxEndTime } },
            { isSingleRequest: 1, reportStatus: { $in: [1, 2] }, sentTimeReport: { $lte: maxEndTime } }
        ]
    }

    logger.info(`[MONGO] Fetching docs...`);
    logger.info(JSON.stringify(query));
    const collection = mongoConnection.db().collection(REQUEST_DATA_COLLECTION);
    return collection.find(query).limit(MONGO_DOCS_LIMIT).sort({ requestDate: 1 }).toArray();
}

function fetchReportDataDocs(maxEndTime: DateTime, lastDocumentId: string) {
    const query = {
        _id: { $gt: new ObjectId(lastDocumentId) },
        status: { $in: [1, 2] },
        sentTime: { $lte: maxEndTime }
    }

    logger.info(`[MONGO] Fetching docs...`);
    logger.info(`[MONGO] Query - ${JSON.stringify(query)}`);
    const collection = mongoConnection.db().collection(REPORT_DATA_COLLECTION);
    return collection.find(query).limit(MONGO_DOCS_LIMIT).sort({ requestDate: 1 }).toArray();
}

function maxEndTime() {
    return DateTime.now().minus({ minutes: LAG });
}

function initTrackers(job: jobType, lastDocumentId: string, forceReplace: boolean) {
    if (!lastDocumentId) return;
    logger.info(`[UPDATE TRACKERS] Updating lastDocumentId to ${lastDocumentId}...`);
    if (forceReplace) return Tracker.upsert({ jobType: job, lastDocumentId });
    logger.info(`[INIT TRACKERS] Updating lastDocumentId to ${lastDocumentId}...`);
    return Tracker.create({ jobType: job, lastDocumentId });
}

async function start(job: jobType, args: any) {
    try {
        logger.info(`[JOB](${job}SyncJob) Initiated...`);
        await initTrackers(job, args.ldi, args.f)

        mongoService().on("connect", (connection: MongoClient) => {
            mongoConnection = connection;
            initSynching(job);
        });
    } catch (err: any) {
        if (err.message === 'Validation error') logger.error('lastDocumentId already exists. Use -f to force replace the current id');
        else logger.error(err);
    }
}

const requestDataSyncJob = (args: any) => start(jobType.REQUEST_DATA, args);
const reportDataSyncJob = (args: any) => start(jobType.REPORT_DATA, args);

export {
    requestDataSyncJob,
    reportDataSyncJob
};
