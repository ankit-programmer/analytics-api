import { getQueryResults, MSG91_PROJECT_ID, MSG91_DATASET_ID, MAIL_REQ_TABLE_ID, MAIL_REP_TABLE_ID } from '../../database/big-query-service';
import { DateTime } from 'luxon';
import logger from '../../logger/logger';
import { getValidFields } from '../utility-service';

const DEFAULT_TIMEZONE: string = '+05:30';
const DEFAULT_GROUP_BY = 'date';
const PERMITTED_GROUPINGS: { [key: string]: string } = {
    // from request
    date: 'STRING(DATE(request.createdAt))',
    nodeId: 'request.nodeId'
};

class MailAnalyticsService {
    private static instance: MailAnalyticsService;

    public static getSingletonInstance(): MailAnalyticsService {
        return MailAnalyticsService.instance ||= new MailAnalyticsService();
    }

    public async getAnalytics(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string = DEFAULT_TIMEZONE, filters: { [key: string]: string } = {}, groupBy?: string) {
        if (filters.emailNodeIds?.length) groupBy = `nodeId,${groupBy?.length ? groupBy : 'date'}`;
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
        const responseSubQuery = this.getResponseSubQuery(companyId, startDate, endDate, timeZone, filters);

        const query = `SELECT ${groupByAttribs}, ${this.aggregateAttribs()}
            FROM \`${MSG91_PROJECT_ID}.${MSG91_DATASET_ID}.${MAIL_REQ_TABLE_ID}\` AS request
            JOIN (${responseSubQuery}) AS response
            ON request.requestId = response.requestId
            WHERE ${whereClause}
            GROUP BY ${groupBy}
            ORDER BY ${groupBy};`;

        logger.info(query);
        return query;
    }

    private getResponseSubQuery(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string, filters: { [field: string]: string }) {
        return `SELECT
                    requestId,
                    ARRAY_AGG(eventId ORDER BY createdAt DESC)[OFFSET(0)] as eventId
                FROM \`${MSG91_PROJECT_ID}.${MSG91_DATASET_ID}.${MAIL_REP_TABLE_ID}\`
                WHERE
                    (DATETIME(requestTime, '${timeZone}') BETWEEN DATETIME("${startDate.toFormat('yyyy-MM-dd')}", '${timeZone}') AND DATETIME("${endDate.toFormat('yyyy-MM-dd')}", '${timeZone}'))
                    AND companyId = "${companyId}"
                GROUP BY requestId`;
    }

    private getWhereClause(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string, filters: { [field: string]: string }) {
        let conditions = `(DATETIME(request.createdAt, '${timeZone}') BETWEEN DATETIME("${startDate.toFormat('yyyy-MM-dd')}", '${timeZone}') AND DATETIME("${endDate.toFormat('yyyy-MM-dd')}", '${timeZone}'))`;
        conditions += ` AND request.companyId = "${companyId}"`;

        // optional conditions
        if (filters.emailNodeIds) conditions += ` AND request.nodeId in (${filters.emailNodeIds.splitAndTrim(',')})`;

        return conditions;
    }

    private aggregateAttribs() {
        return `COUNT(request.requestId) AS total,
            COUNTIF(eventId = 2) AS accepted,
            COUNTIF(eventId = 3) AS rejected,
            COUNTIF(eventId = 4) AS delivered,
            COUNTIF(eventId = 9) AS failed,
            COUNTIF(eventId = 8) AS bounced`;
    }

    private calculateTotalAggr(data: any) {
        const total = {
            "total": 0,
            "accepted": 0,
            "rejected": 0,
            "delivered": 0,
            "failed": 0,
            "bounced": 0
        }

        data.forEach((row: any) => {
            total["total"] += row["total"] || 0;
            total["accepted"] += row["accepted"] || 0;
            total["rejected"] += row["rejected"] || 0;
            total["delivered"] += row["delivered"] || 0;
            total["failed"] += row["failed"] || 0;
            total["bounced"] += row["bounced"] || 0;
        })

        return total;
    }
}

export default MailAnalyticsService.getSingletonInstance();
