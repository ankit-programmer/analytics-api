import { Request, Response } from "express";
import bigquery, { getQueryResults } from '../database/big-query-service';
import { DateTime } from 'luxon';
import { getDefaultDate, formatDate } from '../services/utility-service';
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const DATA_SET = process.env.MSG91_DATASET_ID;
const REQUEST_TABLE = process.env.REQUEST_DATA_TABLE_ID;
const REPORT_TABLE = process.env.REPORT_DATA_TABLE_ID;
enum INTERVAL {
    DAILY = "daily",
    // HOURLY = "hourly",
    // WEEKLY = "weekly",
    // MONTHLY = "monthly"
}

// GET '/profits/vendors'
const getVendorProfits = async (req: Request, res: Response) => {
    let { vendorId, startDate = getDefaultDate().from, endDate = getDefaultDate().to, interval = INTERVAL.DAILY } = { ...req.query, ...req.params } as any;

    if (vendorId) {
        const result = await getVendorProfit(startDate, endDate, vendorId);
        return res.send(result);
    }

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
    const [rows] = await job.getQueryResults();
    res.send(rows.map(row => {
        return { ...row, "Date": row["Date"].value }
    }))
    return;
}

// GET '/profits/sms'
const getSmsProfits = async (req: Request, res: Response) => {
    let { route = null, companyId, vendorId, startDate = getDefaultDate().from, endDate = getDefaultDate().to, interval = INTERVAL.DAILY } = { ...req.query, ...req.params } as any;

    if (companyId) {
        const result = await getUserProfit(startDate, endDate, companyId, route);
        return res.send(result);
    } else if (vendorId) {
        const result = await getVendorProfit(startDate, endDate, vendorId, route);
        return res.send(result);
    } else {
        const result = await getOverallProfit(startDate, endDate, route);
        return res.send(result);
    }
}

async function getUserProfit(startDate: DateTime, endDate: DateTime, userId: string, route?: number) {
    const defaultQuery = `SELECT DATE(sentTime) as Date, user_pid as Company, SUM(credit) as Credit,
    SUM(oppri) as Cost,
    (SUM(credit) - SUM(oppri)) as Profit
    FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\`
    WHERE (sentTime BETWEEN "${startDate}" AND "${endDate}") AND user_pid = "${userId}"
    GROUP BY DATE(sentTime), user_pid;`

    const routeQuery = `SELECT DATE(report.sentTime) as Date, report.user_pid as Company, SUM(report.credit) as Credit,
    SUM(report.oppri) as Cost,
    (SUM(report.credit) - SUM(report.oppri)) as Profit 
    FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\` AS report
    INNER JOIN \`${PROJECT_ID}.${DATA_SET}.${REQUEST_TABLE}\` AS request
    ON report.requestID = request._id
    WHERE (report.sentTime BETWEEN "${startDate}" AND "${endDate}") AND (request.requestDate BETWEEN "${startDate}" AND "${endDate}")
    AND report.user_pid = "${userId}" AND request.requestUserid = "${userId}"
    AND request.curRoute = "${route}"
    GROUP BY DATE(report.sentTime),report.user_pid;`
    const query = route != null ? routeQuery : defaultQuery;
    let rows = await getQueryResults(query);
    rows = rows.map((row: any) => {
        return { ...row, "Date": row["Date"].value }
    });
    rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
    return rows;
}

async function getVendorProfit(startDate: DateTime, endDate: DateTime, vendorId: string, route?: number) {
    const defaultQuery = `SELECT DATE(sentTime) as Date, smsc as Vendor,
    crcy as Currency,
    SUM(credit) as Credit,
    SUM(oppri) as Cost,
    (SUM(credit) - SUM(oppri)) as Profit
    FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\`
    WHERE (sentTime BETWEEN "${startDate}" AND "${endDate}") AND smsc = "${vendorId}"
    GROUP BY DATE(sentTime), smsc, crcy;`;
    const routeQuery = `SELECT DATE(report.sentTime) as Date, report.smsc as Vendor,
    report.crcy as Currency,
    SUM(report.credit) as Credit,
    SUM(report.oppri) as Cost,
    (SUM(report.credit) - SUM(report.oppri)) as Profit
    FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\` AS report
    INNER JOIN \`${PROJECT_ID}.${DATA_SET}.${REQUEST_TABLE}\` AS request
    ON report.requestID = request._id
    WHERE (report.sentTime BETWEEN "${startDate}" AND "${endDate}") AND (request.requestDate BETWEEN "${startDate}" AND "${endDate}")
    AND report.smsc = "${vendorId}" AND request.smsc = "${vendorId}"
    AND request.curRoute = "${route}"
    GROUP BY DATE(report.sentTime),report.smsc,report.crcy;`
    const query = route != null ? routeQuery : defaultQuery;
    let rows = await getQueryResults(query);
    rows = rows.map((row: any) => {
        return { ...row, "Date": row["Date"].value }
    });
    rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
    return rows;
}

async function getOverallProfit(startDate: DateTime, endDate: DateTime, route?: number) {
    const defaultQuery = `SELECT DATE(sentTime) as Date, crcy as Currency, SUM(credit) as Credit,
    SUM(oppri) as Cost,
    (SUM(credit) - SUM(oppri)) as Profit
    FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\`
    WHERE (sentTime BETWEEN "${startDate}" AND "${endDate}")
    GROUP BY DATE(sentTime), crcy;`
    const routeQuery = defaultQuery;
    const query = route != null ? routeQuery : defaultQuery;
    let rows = await getQueryResults(query);
    rows = rows.map((row: any) => {
        return { ...row, "Date": row["Date"].value }
    });
    rows = rows.sort((a: any, b: any) => new Date(a['Date']).getTime() - new Date(b['Date']).getTime());
    return rows;
}

export {
    getVendorProfits,
    getSmsProfits
};