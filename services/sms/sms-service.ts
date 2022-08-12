import { getQuotedStrings, getValidFields } from "../utility-service";
import bigquery from '../../database/big-query-service';
import { DateTime } from 'luxon';
import logger from '../../logger/logger';

const DEFAULT_TIMEZONE: string = '+05:30';
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const DATA_SET = process.env.MSG91_DATASET_ID;
const REQUEST_TABLE = process.env.REQUEST_DATA_TABLE_ID;
const REPORT_TABLE = process.env.REPORT_DATA_TABLE_ID;
const DEFAULT_GROUP_BY = 'Date';
const PERMITTED_GROUPINGS: { [key: string]: string } = {
    // from report-data
    country: 'reportData.countryCode',

    // from request-data
    Date: 'STRING(DATE(requestData.requestDate))',
    nodeId: 'requestData.node_id'
};

class SmsService {
    private static instance: SmsService;

    public static getSingletonInstance(): SmsService {
        return SmsService.instance ||= new SmsService();
    }

    async getCompanyAnalytics(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string = DEFAULT_TIMEZONE, filters: { [key: string]: string } = {}, groupBy: string = DEFAULT_GROUP_BY) {
        const query: string = this.getAnalyticsQuery(companyId, startDate, endDate, timeZone, filters, groupBy.splitAndTrim(','));
        const data = await this.runQuery(query);
        const total = this.calculateTotalAggr(data);
        return { data, total };
    }

    getAnalyticsQuery(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string, filters: { [key: string]: string } = {}, groupings: string[]) {
        const whereClause = this.getWhereClause(companyId, startDate, endDate, timeZone, filters);
        const validFields = getValidFields(PERMITTED_GROUPINGS, groupings);
        const groupBy = validFields.onlyAlias.join(',');
        const groupByAttribs = validFields.withAlias.join(',');

        const query = `SELECT ${groupByAttribs}, ${this.aggregateAttribs()}
            FROM \`${PROJECT_ID}.${DATA_SET}.${REPORT_TABLE}\` AS reportData
            INNER JOIN \`${PROJECT_ID}.${DATA_SET}.${REQUEST_TABLE}\` AS requestData
            ON reportData.requestID = requestData._id
            WHERE ${whereClause}
            GROUP BY ${groupBy}
            ORDER BY ${groupBy};`;

        logger.info(query);
        return query;
    }

    getWhereClause(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string, filters: { [field: string]: string }) {
        // mandatory conditions
        let conditions = `reportData.user_pid = "${companyId}" AND requestData.requestUserid = "${companyId}"`;
        conditions += ` AND (reportData.sentTime BETWEEN "${startDate.toFormat('yyyy-MM-dd')}" AND "${endDate.plus({ days: 3 }).toFormat('yyyy-MM-dd')}")`;
        conditions += ` AND (DATETIME(requestData.requestDate, '${timeZone}') BETWEEN DATETIME("${startDate.toFormat('yyyy-MM-dd')}", '${timeZone}') AND DATETIME("${endDate.toFormat('yyyy-MM-dd')}", '${timeZone}'))`;

        // optional conditions
        if (filters.route) conditions += ` AND requestData.curRoute in (${getQuotedStrings(filters.route.splitAndTrim(','))})`;
        if (filters.smsNodeIds) conditions += ` AND requestData.node_id in (${getQuotedStrings(filters.smsNodeIds.splitAndTrim(','))})`;

        return conditions;
    }

    aggregateAttribs() {
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

    calculateTotalAggr(data: any) {
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

    async runQuery(query: string) {
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

}

export default SmsService.getSingletonInstance();
