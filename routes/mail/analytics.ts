import express, { Request, Response } from 'express';
import bigquery from '../../database/big-query-service';
import { getDefaultDate } from '../../utility';
import { DateTime } from 'luxon';
import logger from "../../logger/logger";
import { formatDate, getQuotedStrings, getValidFields } from '../../services/utility-service';

const router = express.Router();
const DEFAULT_TIMEZONE: string = '+05:30';
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const DATA_SET = process.env.MSG91_DATASET_ID;
const REQUEST_TABLE = process.env.MAIL_REQ_TABLE_ID;
const REPORT_TABLE = process.env.MAIL_REP_TABLE_ID;
const EVENT_TABLE = process.env.MAIL_EVENTS_TABLE_ID;
const DEFAULT_GROUP_BY = 'Date';
const PERMITTED_GROUPINGS: { [key: string]: string } = {
    // from report-data
    country: 'reportData.countryCode',

    // from request-data
    Date: 'STRING(DATE(requestData.requestDate))',
    nodeId: 'requestData.node_id'
};

router.route(`/`)
    .get(async (req: Request, res: Response) => {
        try {
            const params = { ...req.query, ...req.params } as any;
            let { companyId, vendorIds, startDate = getDefaultDate().end, endDate = getDefaultDate().start } = params;
            if (!companyId && !vendorIds) throw "vendorIds or companyId is required";
            const fromDate = formatDate(startDate);
            const toDate = formatDate(endDate);
            return res.send(await getCompanyAnalytics(companyId, fromDate, toDate));
        } catch (error) {
            logger.error(error);
            res.status(400).send({ error });
        }
    });

async function getCompanyAnalytics(companyId: string, startDate: DateTime, endDate: DateTime, opts: { [key: string]: string } = {}) {
    const query = `SELECT 
    DATE(request.createdAt) AS Date,
    COUNT(request.requestId) AS Total,
    COUNTIF(eventId = 2) AS Accepted,
    COUNTIF(eventId = 3) AS Rejected,
    COUNTIF(eventId = 4) AS Delivered,
    COUNTIF(eventId = 9) AS Failed,
    COUNTIF(eventId = 8) AS Bounced
   FROM \`msg91-reports.msg91_test.mail_request\` as request
  JOIN (
    SELECT requestId, ARRAY_AGG(eventId ORDER BY createdAt DESC)[OFFSET(0)] as eventId FROM \`msg91-reports.msg91_test.mail_report\` 
    WHERE (requestTime BETWEEN "${startDate}" AND "${endDate}") AND companyId = "${companyId}"
    GROUP BY requestId
    ) AS response
  ON request.requestId = response.requestId
  WHERE request.createdAt BETWEEN "${endDate}" AND "${endDate}" AND companyId = "${companyId}"
  GROUP BY Date
  ORDER BY Date;`
    const data = await runQuery(query);
    return { data };
}


// async function getCompanyAnalytics(companyId: string, startDate: DateTime, endDate: DateTime, opts: { [key: string]: string } = {}) {
//     let groupBy = opts.groupBy?.length ? opts.groupBy : DEFAULT_GROUP_BY;
//     const query: string = getAnalyticsQuery(companyId, startDate, endDate, groupBy.splitAndTrim(','), opts);
//     const data = await runQuery(query);
//     const total = calculateTotalAggr(data);
//     return { data, total };
// }




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







export enum INTERVAL {
    // HOURLY = "hourly",
    DAILY = "daily",
    // WEEKLY = "weekly",
    // MONTHLY = "monthly"
}


function getAnalyticsQuery(companyId: string, startDate: DateTime, endDate: DateTime, groupings: string[], opts: { [key: string]: string } = {}) {
    const { timeZone = DEFAULT_TIMEZONE } = opts;
    const whereClause = getWhereClause(companyId, startDate, endDate, timeZone, opts);
    const validFields = getValidFields(PERMITTED_GROUPINGS, groupings);
    const groupBy = validFields.onlyAlias.join(',');
    const groupByAttribs = validFields.withAlias.join(',');

    const query = `SELECT ${groupByAttribs}, ${aggregateAttribs()}
    FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\` AS reportData
    INNER JOIN \`${PROJECT_ID}.${DATA_SET}.${REQUEST_TABLE}\` AS requestData
    ON reportData.requestID = requestData._id
    WHERE ${whereClause}
    GROUP BY ${groupBy}
    ORDER BY ${groupBy};`;

    logger.info(query);
    return query;
}

function getWhereClause(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string, filters: { [field: string]: string }) {
    // mandatory conditions
    let conditions = `reportData.user_pid = "${companyId}" AND requestData.requestUserid = "${companyId}"`;
    conditions += ` AND (reportData.sentTime BETWEEN "${startDate.toFormat('yyyy-MM-dd')}" AND "${endDate.plus({ days: 3 }).toFormat('yyyy-MM-dd')}")`;
    conditions += ` AND (DATETIME(requestData.requestDate, '${timeZone}') BETWEEN DATETIME("${startDate.toFormat('yyyy-MM-dd')}", '${timeZone}') AND DATETIME("${endDate.toFormat('yyyy-MM-dd')}", '${timeZone}'))`;

    // optional conditions
    if (filters.route) conditions += ` AND requestData.curRoute in (${getQuotedStrings(filters.route.splitAndTrim(','))})`;

    return conditions;
}

function aggregateAttribs() {
    // Don't add credit if request gets blocked or NDNC

    return `COUNT(reportData._id) as Sent,
    ROUND(SUM(IF(reportData.status in (17, 9), 0, reportData.credit)), 2) as BalanceDeducted,
    COUNTIF(reportData.status in (1, 3, 26)) as Delivered,
    COUNTIF(reportData.status in (2, 13, 7)) as Failed,
    COUNTIF(reportData.status in (25, 16)) as Rejected,
    COUNTIF(reportData.status = 9) as NDNC,
    COUNTIF(reportData.status = 17) as Blocked,
    COUNTIF(reportData.status = 7) as AutoFailed,
    ROUND(SUM(IF(reportData.status = 1, TIMESTAMP_DIFF(reportData.deliveryTime, reportData.sentTime, SECOND), NULL))/COUNTIF(reportData.status = 1), 0) as DeliveryTime`;
}

function calculateTotalAggr(data: any) {
    let totalDeliveryTime = 0;
    const total = {
        "Message": 0,
        "Delivered": 0,
        "TotalCredits": 0,
        "Filtered": 0,
        "AvgDeliveryTime": 0
    }

    data.forEach((row: any) => {
        total["Message"] += row["Sent"] || 0;
        total["Delivered"] += row["Delivered"] || 0;
        total["TotalCredits"] += row["BalanceDeducted"] || 0;
        totalDeliveryTime += row["DeliveryTime"] || 0;
    })

    total["Filtered"] = total["Message"] - total["Delivered"];
    total["TotalCredits"] = Number(total["TotalCredits"].toFixed(3));
    total["AvgDeliveryTime"] = Number((totalDeliveryTime / data.length).toFixed(3));
    return total;
}

export default router;