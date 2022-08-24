import { getQuotedStrings, getValidFields } from "../utility-service";
import { getQueryResults, MSG91_DATASET_ID, MSG91_PROJECT_ID, OTP_TABLE_ID } from '../../database/big-query-service';
import { DateTime } from 'luxon';
import logger from '../../logger/logger';

const DEFAULT_TIMEZONE: string = '+05:30';
const DEFAULT_GROUP_BY = 'date';
const PERMITTED_GROUPINGS: { [key: string]: string } = {
    country: 'otpData.countryCode',
    date: 'STRING(DATE(otpData.requestDate))',
    vendorId: 'otpData.smsc'
};

class OtpAnalyticsService {
    private static instance: OtpAnalyticsService;

    public static getSingletonInstance(): OtpAnalyticsService {
        return OtpAnalyticsService.instance ||= new OtpAnalyticsService();
    }

    public async getAnalytics(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string = DEFAULT_TIMEZONE, filters: { [key: string]: string } = {}, groupBy?: string) {
        if (filters.vendorIds?.length) groupBy = `vendorId,${groupBy?.length ? groupBy : 'date'}`;
        const query: string = this.getAnalyticsQuery(companyId, startDate, endDate, timeZone, filters, groupBy);
        const data = await getQueryResults(query);
        const total = this.calculateTotalAggr(data);
        return { data, total };
    }

    private getAnalyticsQuery(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string, filters: { [key: string]: string } = {}, groupings: string = DEFAULT_GROUP_BY) {
        const whereClause = this.getWhereClause(companyId, startDate, endDate, timeZone, filters);
        const validFields = getValidFields(PERMITTED_GROUPINGS, groupings.splitAndTrim(','));
        const groupBy = validFields.onlyAlias.join(',');
        const groupByAttribs = validFields.withAlias.join(',');

        const query = `SELECT ${groupByAttribs}, ${this.aggregateAttribs()}
            FROM \`${MSG91_PROJECT_ID}.${MSG91_DATASET_ID}.${OTP_TABLE_ID}\` AS otpData
            WHERE ${whereClause}
            GROUP BY ${groupBy}
            ORDER BY ${groupBy};`;

        logger.info(query);
        return query;
    }

    private getWhereClause(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string, filters: { [field: string]: string }) {
        // mandatory conditions
        let conditions = `(DATETIME(otpData.requestDate, '${timeZone}') BETWEEN DATETIME("${startDate.toFormat('yyyy-MM-dd')}", '${timeZone}') AND DATETIME("${endDate.toFormat('yyyy-MM-dd')}", '${timeZone}'))`;

        // optional conditions
        if (companyId) conditions += `AND otpData.requestUserid = "${companyId}"`;
        if (filters.vendorIds) conditions += `AND otpData.smsc in (${getQuotedStrings(filters.vendorIds.splitAndTrim(','))})`;

        return conditions;
    }

    private aggregateAttribs() {
        // Don't add credit if request gets blocked or NDNC

        return `COUNT(otpData.id) as sent,
            ROUND(SUM(IF(otpData.status in (17, 9), 0, otpData.credits)), 2) as balanceDeducted,
            COUNTIF(otpData.status in (1, 3, 26)) as delivered,
            COUNTIF(otpData.status in (2, 13, 7)) as failed,
            COUNTIF(otpData.status in (25, 16)) as rejected,
            COUNTIF(otpData.status = 9) as ndnc,
            COUNTIF(otpData.status = 17) as blocked,
            COUNTIF(otpData.status = 7) as autoFailed,
            ROUND(SUM(IF(otpData.status = 1, TIMESTAMP_DIFF(otpData.deliveryTime, otpData.sentTime, SECOND), NULL))/COUNTIF(otpData.status = 1), 0) as deliveryTime`;
    }

    private calculateTotalAggr(data: any) {
        let totalDeliveryTime = 0;
        const total = {
            "message": 0,
            "delivered": 0,
            "totalCredits": 0,
            "filtered": 0,
            "avgDeliveryTime": 0
        }

        data.forEach((row: any) => {
            total["message"] += row["sent"] || 0;
            total["delivered"] += row["delivered"] || 0;
            total["totalCredits"] += row["balanceDeducted"] || 0;
            totalDeliveryTime += row["deliveryTime"] || 0;
        })

        total["filtered"] = total["message"] - total["delivered"];
        total["totalCredits"] = Number(total["totalCredits"].toFixed(3));
        total["avgDeliveryTime"] = Number((totalDeliveryTime / data.length).toFixed(3));
        return total;
    }
}

export default OtpAnalyticsService.getSingletonInstance();
