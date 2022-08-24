import { getQueryResults, MAIL_REP_TABLE_ID, MAIL_REQ_TABLE_ID } from '../../database/big-query-service';
import { getQuotedStrings, getValidFields } from '../utility-service';
import { DateTime } from 'luxon';
import logger from '../../logger/logger';

const DEFAULT_TIMEZONE: string = '+05:30';
const PERMITTED_FIELDS: { [key: string]: string } = {
    // Mail Request
    requestId: 'mailRequest.requestId',
    companyId: 'mailRequest.companyId',
    subject: 'mailRequest.subject',
    domain: 'mailRequest.domain',
    senderEmail: 'mailRequest.senderEmail',
    recipientEmail: 'mailRequest.recipientEmail',
    outboundEmailId: 'mailRequest.outboundEmailId',
    mailTypeId: 'mailRequest.mailTypeId',
    templateSlug: 'mailRequest.templateSlug',
    mailerRequestId: 'mailRequest.mailerRequestId',
    nodeId: 'mailRequest.nodeId',
    clientRequestIP: 'mailRequest.clientRequestIP',
    createdAt: 'STRING(mailRequest.createdAt)',

    // Mail Report
    eventId: 'mailReport.eventId',
    senderDedicatedIPId: 'mailReport.senderDedicatedIPId',
    statusCode: 'mailReport.statusCode',
    enhancedStatusCode: 'mailReport.enhancedStatusCode',
    resultState: 'mailReport.resultState',
    reason: 'mailReport.reason',
    remoteMX: 'mailReport.remoteMX',
    remoteIP: 'mailReport.remoteIP',
    contentSize: 'mailReport.contentSize',
    hostname: 'mailReport.hostname'
};

class MailLogsService {
    private static instance: MailLogsService;

    public static getSingletonInstance(): MailLogsService {
        return MailLogsService.instance ||= new MailLogsService();
    }

    public getQuery(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string = DEFAULT_TIMEZONE, filters: { [key: string]: string } = {}, fields: string[] = []) {
        const attributes = getValidFields(PERMITTED_FIELDS, fields).withAlias.join(',');
        const whereClause = this.getWhereClause(companyId, startDate, endDate, timeZone, filters);
        const query = `SELECT ${attributes}
            FROM ${MAIL_REQ_TABLE_ID} AS mailRequest 
            JOIN ${MAIL_REP_TABLE_ID} as mailReport 
            ON mailRequest.requestId = mailReport.requestId 
            WHERE ${whereClause}`;
        logger.info(query);
        return query;
    }

    private getWhereClause(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: String, filters: { [key: string]: string }) {
        const query: { [key: string]: string } = filters;

        // mandatory conditions
        let conditions = `(DATETIME(mailRequest.createdAt, '${timeZone}') BETWEEN "${startDate.toFormat('yyyy-MM-dd')}" AND "${endDate.toFormat('yyyy-MM-dd')}")`;
        conditions += ` AND (DATETIME(mailReport.requestTime, '${timeZone}') BETWEEN "${startDate.toFormat('yyyy-MM-dd')}" AND "${endDate.toFormat('yyyy-MM-dd')}")`;

        // optional conditions
        if (query.subject) conditions += ` AND UPPER(mailRequest.subject) LIKE '%${query.subject.toUpperCase()}%'`;
        if (query.domain) conditions += ` AND mailRequest.domain in (${getQuotedStrings(query.domain.splitAndTrim(','))})`;
        if (query.senderEmail) conditions += ` AND UPPER(mailRequest.senderEmail) LIKE '%${query.senderEmail.toUpperCase()}%'`;
        if (query.recipientEmail) conditions += ` AND UPPER(mailRequest.recipientEmail) LIKE '%${query.recipientEmail.toUpperCase()}%'`;
        if (query.mailTypeId) conditions += ` AND mailRequest.mailTypeId in (${query.mailTypeId.splitAndTrim(',')})`;
        if (query.templateSlug) conditions += ` AND mailRequest.templateSlug in (${getQuotedStrings(query.templateSlug.splitAndTrim(','))})`;
        if (query.mailerRequestId) conditions += ` AND mailRequest.mailerRequestId in (${getQuotedStrings(query.mailerRequestId.splitAndTrim(','))})`;
        if (query.nodeId) conditions += ` AND mailRequest.nodeId in (${query.nodeId.splitAndTrim(',')})`;
        if (companyId) conditions += ` AND mailRequest.companyId = '${companyId}'`;

        if (companyId) conditions += ` AND mailReport.companyId = '${companyId}'`;
        if (query.senderDedicatedIPId) conditions += ` AND mailReport.senderDedicatedIPId in (${query.senderDedicatedIPId.splitAndTrim(',')})`;
        if (query.eventId) conditions += ` AND mailReport.eventId in (${query.eventId.splitAndTrim(',')})`;
        if (query.remoteMX) conditions += ` AND mailReport.remoteMX in (${getQuotedStrings(query.remoteMX.splitAndTrim(','))})`;
        if (query.remoteIP) conditions += ` AND mailReport.remoteIP in (${getQuotedStrings(query.remoteIP.splitAndTrim(','))})`;
        if (query.hostname) conditions += ` AND mailReport.hostname in (${getQuotedStrings(query.hostname.splitAndTrim(','))})`;

        return conditions;
    }

    public async getLogs(companyId: string, startDate: DateTime, endDate: DateTime, timeZone: string = DEFAULT_TIMEZONE, filters: { [key: string]: string } = {}, fields: string[] = []) {
        const query: string = this.getQuery(companyId, startDate, endDate, timeZone, filters, fields);
        const data = await getQueryResults(query);
        return { data };
    }
}

export default MailLogsService.getSingletonInstance();
