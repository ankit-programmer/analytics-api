import { RowBatch } from '@google-cloud/bigquery';
import express, { Request, Response } from 'express';
import bigquery from '../database/big-query-service';
import { getDefaultDate } from '../utility';
import { DateTime } from 'luxon';
import logger from "../logger/logger";
const router = express.Router();
const reportQueryMap = new Map();
const requestQueryMap = new Map();
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const DATA_SET = process.env.MSG91_DATASET_ID;
const REQUEST_TABLE = process.env.REQUEST_DATA_TABLE_ID;
const REPORT_TABLE = process.env.REPORT_DATA_TABLE_ID;
type options = {
    route?: number,
    timeZone?: string
}
router.route(`/`)
    .get(async (req: Request, res: Response) => {
        let { companyId, nodeIds, vendorIds, route, startDate = getDefaultDate().end, endDate = getDefaultDate().start, interval = INTERVAL.DAILY } = { ...req.query, ...req.params } as any;
        console.log(companyId);
        if (!companyId && !vendorIds) {
            return res.status(400).send("nodeIds or companyId is required");
        }
        if (companyId) {
            // Handle request for company Id
            return res.send(await getCompanyAnalytics(companyId, startDate, endDate, { route }));
        }
        if (vendorIds) {
            return res.send(await getVendorAnalytics(idsToArray(vendorIds), startDate, endDate, route));
        }
    });

async function getCompanyAnalytics(companyId: string, startDate: DateTime, endDate: DateTime, opt?: options) {
    try {
        startDate = DateTime.fromISO(startDate as any);
        endDate = DateTime.fromISO(endDate as any);
    } catch (error) {
        throw error;
    }
    const { route, timeZone = "Asia/Kolkata" } = opt || {};
    const query = `SELECT COUNT(report._id) as Sent, DATE(request.requestDate) as Date,
    report.user_pid as Company, 
    ROUND(SUM(report.credit),2) as BalanceDeducted, 
    COUNTIF(report.status = 1 OR report.status = 3 OR report.status = 26) as Delivered, 
    COUNTIF(report.status = 2 OR report.status = 13 OR report.status = 7) as Failed,
    COUNTIF(report.status = 9) as NDNC, 
    COUNTIF(report.status = 17) as Blocked, 
    COUNTIF(report.status = 7) as AutoFailed,
    COUNTIF(report.status = 25 OR report.status = 16) as Rejected,
    ROUND(SUM(IF(report.status = 1,TIMESTAMP_DIFF(report.deliveryTime, report.sentTime, SECOND),NULL))/COUNTIF(report.status = 1),0) as DeliveryTime FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\` AS report
    INNER JOIN \`${PROJECT_ID}.${DATA_SET}.${REQUEST_TABLE}\` AS request
    ON report.requestID = request._id
    WHERE (report.sentTime BETWEEN "${startDate.toFormat('yyyy-MM-dd')}" AND "${endDate.plus({ days: 3 }).toFormat('yyyy-MM-dd')}") 
    AND (DATETIME(request.requestDate,"${timeZone}") BETWEEN DATETIME("${startDate.toFormat('yyyy-MM-dd')}","${timeZone}") AND DATETIME("${endDate.plus({ days: 1 }).toFormat('yyyy-MM-dd')}","${timeZone}"))
    AND report.user_pid = "${companyId}" AND request.requestUserid = "${companyId}"
    ${route != null ? `AND request.curRoute = "${route}"` : ""}
    GROUP BY DATE(request.requestDate),report.user_pid;`
    console.log(query);
    let result = await runQuery(query);
    result = result.map(row => {
        row['Date'] = row['Date']?.value;
        return row;
    });
    // Sort the result
    result = result.sort((leftRow: any, rightRow: any) => new Date(leftRow['Date']).getTime() - new Date(rightRow['Date']).getTime());
    const total = {
        "Message": 0,
        "Delivered": 0,
        "TotalCredits": 0,
        "Filtered": 0,
        "AvgDeliveryTime": 0
    }
    try {
        let totalDeliveryTime = 0;
        result = result.map((row: any, index: any) => {
            total["Message"] += row["Sent"];
            total["Delivered"] += row["Delivered"];
            total["TotalCredits"] += parseFloat(row["BalanceDeducted"]);
            total["Filtered"] = total["Message"] - total["Delivered"];
            totalDeliveryTime += row["DeliveryTime"] || 0;
            total["AvgDeliveryTime"] = parseFloat(Number(totalDeliveryTime / (index + 1)).toString());
            return row;
        })
        total["TotalCredits"] = Number(parseFloat(total["TotalCredits"].toString()).toFixed(3));
        total["AvgDeliveryTime"] = Number(parseFloat(total["AvgDeliveryTime"].toString()).toFixed(3));
    } catch (error) {
        logger.error(error);
    }

    return { data: result, total };
}
async function getVendorAnalytics(vendors: string[], startDate: DateTime, endDate: DateTime, route?: number) {
    const query = `SELECT DATE(sentTime) as Date, SMSC, COUNT(_id) as Total,
    SUM(credit) as BalanceDeducted, 
    COUNTIF(status = 1) as Delivered,
    COUNTIF(status = 2) as Failed,
    COUNTIF(status = 1) + COUNTIF(status= 2) as Sent, 
    COUNTIF(status = 9) as NDNC, 
    COUNTIF(status = 17) as Blocked, 
    COUNTIF(status = 7) as AutoFailed,
    COUNTIF(status = 25) as Rejected,
    ROUND(SUM(IF(status = 1,TIMESTAMP_DIFF(deliveryTime, sentTime, SECOND),NULL))/COUNTIF(status = 1),0) as DeliveryTime
    FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\`
    WHERE (sentTime BETWEEN "${startDate}" AND "${endDate}")
    AND smsc IN (${vendors.join()})
    ${route ? "AND route = " + route : ""}
    GROUP BY DATE(sentTime), smsc;`
    let result = await runQuery(query);
    result = result.map(row => {
        row['Date'] = row['Date']?.value;
        return row;
    });
    // Sort the result
    result = result.sort((leftRow: any, rightRow: any) => new Date(leftRow['Date']).getTime() - new Date(rightRow['Date']).getTime());
    return result;
}
export async function runQuery(query: string) {
    try {
        const [job] = await bigquery.createQueryJob({
            query: query,
            location: process.env.DATA_SET_LOCATION,
            // maximumBytesBilled: "1000"
        });
        let [rows] = await job.getQueryResults();
        return rows;
    } catch (error) {
        throw error;
    }

}
function idsToArray(ids: string) {
    const idArray = ids.split(",");
    return idArray.map(id => id.trim());
}

// Old Version

router.route('/users/:userId')
    .get(async (req: Request, res: Response) => {
        let { userId = 100079, startDate = getDefaultDate().end, endDate = getDefaultDate().start, interval = INTERVAL.DAILY } = { ...req.query, ...req.params } as any;
        if (!isValidInterval(interval)) {
            res.status(400).send({
                message: "Invalid interval provided",
                validIntervals: Object.values(INTERVAL)
            });
            return;
        }
        logger.info(startDate);
        logger.info(endDate);
        // const query = `SELECT DATE(sentTime) as Date, EXTRACT(HOUR FROM sentTime) as Hour,
        // user_pid as Company, senderID as ID, SUM(credit) as Credit, 
        // COUNTIF(status = 1) as Delivered, COUNTIF(status = 2) as Failed,
        // COUNTIF(status = 1) + COUNTIF(status= 2) as Sent
        // FROM \`msg91-reports.msg91_production.report_data\`
        // WHERE (sentTime BETWEEN "${endDate}" AND "${startDate}") AND
        // user_pid = "${userId}"
        // GROUP BY DATE(sentTime), EXTRACT(HOUR FROM sentTime), user_pid, senderID;`
        let reportDataQuery = null;
        let requestDataQuery = null;
        try {
            interval = interval.replace(/['"]+/g, '') as any;
            reportDataQuery = getQuery(reportQueryMap.get(interval), { startDate, endDate, userId });
            requestDataQuery = getQuery(requestQueryMap.get(interval), { startDate, endDate, userId });
        } catch (error: any) {
            logger.info(error);
            res.send(error && error.message);
            return [];
        }


        if (userId) {
            // Handle request for company Id
            return res.send(await getCompanyAnalytics(userId, startDate, endDate));
        }
        // const [reportDataJob] = await bigquery.createQueryJob({
        //     query: reportDataQuery,
        //     location: process.env.DATA_SET_LOCATION,
        //     // maximumBytesBilled: "1000"
        // });
        // const [requestDataJob] = await bigquery.createQueryJob({
        //     query: requestDataQuery,
        //     location: process.env.DATA_SET_LOCATION,
        //     // maximumBytesBilled: "1000"
        // });
        const [[reportDataJob], [requestDataJob]] = await Promise.all([
            bigquery.createQueryJob({
                query: reportDataQuery,
                location: process.env.DATA_SET_LOCATION,
                // maximumBytesBilled: "1000"
            }),
            bigquery.createQueryJob({
                query: requestDataQuery,
                location: process.env.DATA_SET_LOCATION,
                // maximumBytesBilled: "1000"
            })
        ]).catch(reason => {
            logger.error(reason);
            return [[], []];
        });


        logger.info(getDefaultDate());
        const [[reportRows], [requestRows]] = await Promise.all([reportDataJob.getQueryResults(), requestDataJob.getQueryResults()]).catch(reason => {
            logger.error(reason)
            return [[], []];
        });
        let rows: any = mergeRows([...reportRows, ...requestRows].map((row: any) => { return { ...row, "Date": row["Date"].value } }), 'Date');
        rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
        const total = {
            "Message": 0,
            "Delivered": 0,
            "TotalCredits": 0,
            "Filtered": 0,
            "AvgDeliveryTime": 0
        }
        let totalDeliveryTime = 0;
        const data = rows.map((row: any, index: any) => {
            total["Message"] += row["Sent"];
            total["Delivered"] += row["Delivered"];
            total["TotalCredits"] += Number((row["BalanceDeducted"]).toFixed(3));
            total["Filtered"] = total["Message"] - total["Delivered"];
            totalDeliveryTime += row["DeliveryTime"] || 0;
            total["AvgDeliveryTime"] = Number((totalDeliveryTime / (index + 1)).toFixed(3));
            return row;
        })
        res.send({
            data,
            total
        });
    });

router.route('/users/:userId/campaigns/:campaignId')
    .get(async (req: Request, res: Response) => {
        const { userId, campaignId, startDate = getDefaultDate().start, endDate = getDefaultDate().end } = { ...req.query, ...req.params } as any;
        const query = `SELECT DATE(requestDate) as Date,
        user_pid as Company, 
        campaign_pid as Campaign,
        COUNT(_id) as Sent, 
        SUM(credit) as BalanceDeducted, 
        COUNTIF(reportStatus = 1) as Delivered, 
        COUNTIF(reportStatus = 2) as Failed,
        COUNTIF(reportStatus = 9) as NDNC, 
        COUNTIF(reportStatus = 17) as Blocked, 
        COUNTIF(reportStatus = 7) as AutoFailed,
        COUNTIF(reportStatus = 25) as Rejected,
        ROUND(SUM(IF(reportStatus = 1,TIMESTAMP_DIFF(deliveryTime, requestDate, SECOND),NULL))/COUNTIF(reportStatus = 1),0) as DeliveryTime
        FROM \`${PROJECT_ID}.${DATA_SET}.${REQUEST_TABLE}\`
        WHERE (requestDate BETWEEN "${startDate}" AND "${endDate}") AND user_pid = "${userId}" AND campaign_pid = "${campaignId}"
        GROUP BY DATE(requestDate), user_pid, campaign_pid;`;
        const [job] = await bigquery.createQueryJob({
            query: query,
            location: process.env.DATA_SET_LOCATION,
            // maximumBytesBilled: "1000"
        });
        let [rows] = await job.getQueryResults();
        rows = rows.map(row => {
            return { ...row, "Date": row["Date"].value }
        });
        rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
        res.send(rows);
    });
router.route('/users/:userId/campaigns')
    .get(async (req: Request, res: Response) => {
        const { userId, campaignId, startDate = getDefaultDate().start, endDate = getDefaultDate().end } = { ...req.query, ...req.params } as any;
        const query = `SELECT DATE(requestDate) as Date,
        user_pid as Company, 
        campaign_pid as Campaign,
        COUNT(_id) as Sent, 
        SUM(credit) as BalanceDeducted, 
        COUNTIF(reportStatus = 1) as Delivered, 
        COUNTIF(reportStatus = 2) as Failed,
        COUNTIF(reportStatus = 9) as NDNC, 
        COUNTIF(reportStatus = 17) as Blocked, 
        COUNTIF(reportStatus = 7) as AutoFailed,
        COUNTIF(reportStatus = 25) as Rejected,
        ROUND(SUM(IF(reportStatus = 1,TIMESTAMP_DIFF(deliveryTime, requestDate, SECOND),NULL))/COUNTIF(reportStatus = 1),0) as DeliveryTime
        FROM \`${PROJECT_ID}.${DATA_SET}.${REQUEST_TABLE}\`
        WHERE (requestDate BETWEEN "${startDate}" AND "${endDate}") AND user_pid = "${userId}"
        GROUP BY DATE(requestDate), user_pid, campaign_pid;`;
        const [job] = await bigquery.createQueryJob({
            query: query,
            location: process.env.DATA_SET_LOCATION,
            // maximumBytesBilled: "1000"
        });
        let [rows] = await job.getQueryResults();
        rows = rows.map(row => {
            return { ...row, "Date": row["Date"].value }
        });
        rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
        res.send(rows);
    });
router.route('/vendors')
    .get(async (req: Request, res: Response) => {
        let { id, startDate = getDefaultDate().end, endDate = getDefaultDate().start, interval = INTERVAL.DAILY } = { ...req.query, ...req.params } as any;
        const reportQuery = `SELECT DATE(sentTime) as Date, smsc as SMSC, COUNT(_id) as Total,
        SUM(credit) as BalanceDeducted, 
        COUNTIF(status = 1) as Delivered, 
        COUNTIF(status = 2) as Failed,
        COUNTIF(status = 1) + COUNTIF(status= 2) as Sent, 
        COUNTIF(status = 9) as NDNC, 
        COUNTIF(status = 17) as Blocked, 
        COUNTIF(status = 7) as AutoFailed,
        COUNTIF(status = 25) as Rejected,
        ROUND(SUM(IF(status = 1,TIMESTAMP_DIFF(deliveryTime, sentTime, SECOND),NULL))/COUNTIF(status = 1),0) as DeliveryTime
        FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\`
        WHERE (sentTime BETWEEN "${startDate}" AND "${endDate}")
        GROUP BY DATE(sentTime), smsc;`
        const requestQuery = `SELECT DATE(requestDate) as Date, smsc as SMSC, COUNT(_id) as Total,
        SUM(credit) as BalanceDeducted, 
        COUNTIF(reportStatus = 1) as Delivered, 
        COUNTIF(reportStatus = 2) as Failed,
        COUNTIF(reportStatus = 1) + COUNTIF(reportStatus= 2) as Sent, 
        COUNTIF(reportStatus = 9) as NDNC, 
        COUNTIF(reportStatus = 17) as Blocked, 
        COUNTIF(reportStatus = 7) as AutoFailed,
        COUNTIF(reportStatus = 25) as Rejected,
        ROUND(SUM(IF(reportStatus = 1,TIMESTAMP_DIFF(deliveryTime, requestDate, SECOND),NULL))/COUNTIF(reportStatus = 1),0) as DeliveryTime
        FROM \`${PROJECT_ID}.${DATA_SET}.${REQUEST_TABLE}\`
        WHERE (requestDate BETWEEN "${startDate}" AND "${endDate}") AND isSingleRequest = "1"
        GROUP BY DATE(requestDate), smsc;`
        // return;
        const [[reportDataJob], [requestDataJob]] = await Promise.all([
            bigquery.createQueryJob({
                query: reportQuery,
                location: process.env.DATA_SET_LOCATION,
                // maximumBytesBilled: "1000"
            }),
            bigquery.createQueryJob({
                query: requestQuery,
                location: process.env.DATA_SET_LOCATION,
                // maximumBytesBilled: "1000"
            })
        ]).catch(reason => {
            logger.error(reason);
            return [[], []];
        });
        const [[reportRows], [requestRows]] = await Promise.all([reportDataJob.getQueryResults(), requestDataJob.getQueryResults()]).catch(reason => {
            logger.error(reason)
            return [[], []];
        });
        let rows: any = mergeRows([...reportRows, ...requestRows].map((row: any) => { return { ...row, "Date": row["Date"].value, "mergeKey": `${row["Date"].value}-${row["SMSC"]}` } }), 'mergeKey');
        rows = rows.map((row: any) => {
            delete row["mergeKey"];
            return row;
        });
        rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
        res.send(rows);
        return;
    })
router.route('/profit')
    .get(async (req: Request, res: Response) => {
        let { id, startDate = getDefaultDate().end, endDate = getDefaultDate().start, interval = INTERVAL.DAILY } = { ...req.query, ...req.params } as any;
        const query = `SELECT DATE(sentTime) as Date, crcy as Currency, SUM(credit) as Credit,
        SUM(oppri) as Cost,
        (SUM(credit) - SUM(oppri)) as Profit
        FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\`
        WHERE (sentTime BETWEEN "${startDate}" AND "${endDate}")
        GROUP BY DATE(sentTime), crcy;`
        const [job] = await bigquery.createQueryJob({
            query: query,
            location: process.env.DATA_SET_LOCATION,
            // maximumBytesBilled: "1000"
        });
        let [rows] = await job.getQueryResults();
        rows = rows.map(row => {
            return { ...row, "Date": row["Date"].value }
        })
        rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
        res.send(rows);
        return;
    });
router.route('/profit/users/:userId')
    .get(async (req: Request, res: Response) => {
        let { userId, startDate = getDefaultDate().end, endDate = getDefaultDate().start, interval = INTERVAL.DAILY } = { ...req.query, ...req.params } as any;
        const query = `SELECT DATE(sentTime) as Date, user_pid as Company, SUM(credit) as Credit,
        SUM(oppri) as Cost,
        (SUM(credit) - SUM(oppri)) as Profit
        FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\`
        WHERE (sentTime BETWEEN "${startDate}" AND "${endDate}") AND user_pid = "${userId}"
        GROUP BY DATE(sentTime), user_pid;`
        const [job] = await bigquery.createQueryJob({
            query: query,
            location: process.env.DATA_SET_LOCATION,
            // maximumBytesBilled: "1000"
        });
        let [rows] = await job.getQueryResults();
        rows.map(row => {
            return { ...row, "Date": row["Date"].value }
        })
        rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
        res.send(rows);
        return;
    });
router.route('/profit/vendors')
    .get(async (req: Request, res: Response) => {
        let { userId, startDate = getDefaultDate().end, endDate = getDefaultDate().start, interval = INTERVAL.DAILY } = { ...req.query, ...req.params } as any;
        const query = `SELECT DATE(sentTime) as Date, smsc as Vendor,
        crcy as Currency,
        SUM(credit) as Credit,
        SUM(oppri) as Cost,
        (SUM(credit) - SUM(oppri)) as Profit
        FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\`
        WHERE (sentTime BETWEEN "${startDate}" AND "${endDate}")
        GROUP BY DATE(sentTime), smsc, crcy;`
        const [job] = await bigquery.createQueryJob({
            query: query,
            location: process.env.DATA_SET_LOCATION,
            // maximumBytesBilled: "1000"
        });
        let [rows] = await job.getQueryResults();
        rows = rows.map(row => {
            return { ...row, "Date": row["Date"].value }
        });
        rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
        res.send(rows);
        return;
    });
function isValidInterval(interval: string) {
    return Object.values(INTERVAL).some(value => value == interval.replace(/['"]+/g, ''));
}
function getQuery(sqlQuery: string, options: any) {
    sqlQuery = sqlQuery.replace(/{\w+}/g, (placeholder: any) => {
        const key = placeholder.substring(1, placeholder.length - 1);
        const value = options[key];
        if (value) {
            return value;
        }
        throw new Error(`${key} is not provided`)
    });


    return sqlQuery;
}
function mergeRows(rows: any[], mergeKey: string) {
    const map = new Map();
    rows.forEach(row => {
        let key = row[mergeKey];
        if (map.has(key)) {
            map.set(key, mergeObject(row, map.get(key)));
        } else {
            map.set(key, row);
        }
    })
    return Array.from(map.values());
}
function mergeObject(one: any, two: any) {
    Object.keys(one).forEach(currKey => {

        if (currKey == "DeliveryTime") {
            if (one[currKey] && two[currKey]) {
                one[currKey] = ((one[currKey] + two[currKey]) / 2);
            } else {
                one[currKey] ||= two[currKey];
            }
            delete two[currKey];
            return;
        };
        let value = one[currKey];
        switch (typeof value) {
            case 'number':
                one[currKey] += two[currKey] || 0;
                delete two[currKey];
                break;
            case 'string':
                one[currKey] = two[currKey] || one[currKey];
                delete two[currKey];
                break;
            case 'boolean':
                one[currKey] = one[currKey] && two[currKey];
                delete two[currKey];
                break;
            default:
                one = { ...one, ...two };
                break;
        }
    })
    return one;
}
export enum INTERVAL {
    // HOURLY = "hourly",
    DAILY = "daily",
    // WEEKLY = "weekly",
    // MONTHLY = "monthly"
}
// reportQueryMap.set(INTERVAL.HOURLY, `SELECT COUNT(_id) as Sent, DATE(sentTime) as Date, EXTRACT(HOUR FROM sentTime) as Hour,
// user_pid as Company,
// SUM(credit) as BalanceDeducted, 
// COUNTIF(status = 1) as Delivered, 
// COUNTIF(status = 2) as Failed,
// COUNTIF(status = 1) + COUNTIF(status= 2) as Sent, 
// COUNTIF(status = 9) as NDNC, 
// COUNTIF(status = 25) as Rejected,
// COUNTIF(status = 17) as Blocked, 
// COUNTIF(status = 7) as AutoFailed,
// ROUND(SUM(IF(status = 1,TIMESTAMP_DIFF(deliveryTime, sentTime, SECOND),NULL))/COUNTIF(status = 1),0) as DeliveryTime
// FROM \`msg91-reports.msg91_production.report_data\`
// WHERE (sentTime BETWEEN "{startDate}" AND "{endDate}") AND
// user_pid = "{userId}"
// GROUP BY DATE(sentTime), EXTRACT(HOUR FROM sentTime), user_pid;`)

reportQueryMap.set(INTERVAL.DAILY, `SELECT COUNT(_id) as Sent, DATE(sentTime) as Date,
user_pid as Company, 
SUM(credit) as BalanceDeducted, 
COUNTIF(status = 1) as Delivered, 
COUNTIF(status = 2) as Failed,
-- COUNTIF(status = 1) + COUNTIF(status= 2) as Sent, 
COUNTIF(status = 9) as NDNC, 
COUNTIF(status = 17) as Blocked, 
COUNTIF(status = 7) as AutoFailed,
COUNTIF(status = 25) as Rejected,
ROUND(SUM(IF(status = 1,TIMESTAMP_DIFF(deliveryTime, sentTime, SECOND),NULL))/COUNTIF(status = 1),0) as DeliveryTime
FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\`
WHERE (sentTime BETWEEN "{startDate}" AND "{endDate}") AND
user_pid = "{userId}"
GROUP BY DATE(sentTime), user_pid;`);

requestQueryMap.set(INTERVAL.DAILY, `SELECT COUNT(_id) as Sent, DATE(requestDate) as Date,
user_pid as Company, 
SUM(credit) as BalanceDeducted, 
COUNTIF(reportStatus = 1) as Delivered, 
COUNTIF(reportStatus = 2) as Failed,
-- COUNTIF(reportStatus = 1) + COUNTIF(status= '2') as Sent, 
COUNTIF(reportStatus = 9) as NDNC, 
COUNTIF(reportStatus = 17) as Blocked, 
COUNTIF(reportStatus = 7) as AutoFailed,
COUNTIF(reportStatus = 25) as Rejected,
ROUND(SUM(IF(reportStatus = 1,TIMESTAMP_DIFF(deliveryTime, requestDate, SECOND),NULL))/COUNTIF(reportStatus = 1),0) as DeliveryTime
FROM \`${PROJECT_ID}.${DATA_SET}.${REQUEST_TABLE}\`
WHERE (requestDate BETWEEN "{startDate}" AND "{endDate}") AND isSingleRequest = "1" AND
user_pid = "{userId}"
GROUP BY DATE(requestDate), user_pid;`)
export default router;