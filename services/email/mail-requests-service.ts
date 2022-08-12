import { Table } from '@google-cloud/bigquery';
import msg91Dataset from '../../database/big-query-service';
import logger from '../../logger/logger';
import MailRequest from '../../models/mail-request.model';
import Download from '../../models/download.model';
import downloadsService from '../downloads-service';
import { getQuotedStrings, getValidFields } from '../utility-service';
import { MAIL_REP_TABLE_ID } from './mail-reports-service';

const MAIL_REQ_TABLE_ID = process.env.MAIL_REQ_TABLE_ID || 'mail_request'
const GCS_BASE_URL = process.env.GCS_BASE_URL || 'https://storage.googleapis.com';
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'msg91-analytics';
const GCS_FOLDER_NAME = process.env.GCS_EMAIL_EXPORTS_FOLDER || 'email-exports';
const PERMITTED_FIELDS: { [key: string]: string } = {
    // Mail Request
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
    createdAt: 'mailRequest.createdAt',

    // Mail Report
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

class MailRequestsService {
    private static instance: MailRequestsService;
    private mailRequestTable: Table;

    constructor() {
        this.mailRequestTable = msg91Dataset.table(MAIL_REQ_TABLE_ID);
    }

    public static getSingletonInstance(): MailRequestsService {
        return MailRequestsService.instance ||= new MailRequestsService();
    }

    public insertMany(rows: Array<MailRequest>) {
        const insertOptions = { skipInvalidRows: true, ignoreUnknownValues: true };
        return this.mailRequestTable.insert(rows, insertOptions);
    }

    public download(download: Download, format: string = 'CSV') {
        logger.info('[DOWNLOAD] Creating job...');
        const filePath = `${GCS_BUCKET_NAME}/${GCS_FOLDER_NAME}/${download.id}`;
        const exportFilePath = `gs://${filePath}_ *.csv`;
        download.file = `${GCS_BASE_URL}/${filePath}_%20000000000000.csv`;
        const fields = getValidFields(PERMITTED_FIELDS, download.fields).withAlias.join(',');
        const whereClause = this.getWhereClause(download);
        const queryStatement = `select ${fields} from ${MAIL_REQ_TABLE_ID} as mailRequest right join ${MAIL_REP_TABLE_ID} as mailReport ON mailRequest.requestId = mailReport.requestId WHERE ${whereClause}`;
        logger.info(`Query: ${queryStatement}`);
        return msg91Dataset.createQueryJob({ query: downloadsService.getExportQuery(download.id, queryStatement, exportFilePath, format) });
    }

    private getWhereClause(download: Download) {
        const query: { [key: string]: string } = download.query || {};

        // mandatory conditions
        let conditions = `mailRequest.companyId = '${download.companyId}'`;
        conditions += ` AND mailReport.companyId = '${download.companyId}'`;
        conditions += ` AND (DATETIME(mailRequest.createdAt, '${download.timezone}') BETWEEN "${download.startDate.toFormat('yyyy-MM-dd')}" AND "${download.endDate.toFormat('yyyy-MM-dd')}")`;
        conditions += ` AND (DATETIME(mailReport.requestTime, '${download.timezone}') BETWEEN "${download.startDate.toFormat('yyyy-MM-dd')}" AND "${download.endDate.toFormat('yyyy-MM-dd')}")`;

        // optional conditions
        if (query.subject) conditions += ` AND UPPER(mailRequest.subject) LIKE '%${query.subject.toUpperCase()}%'`;
        if (query.domain) conditions += ` AND mailRequest.domain in (${getQuotedStrings(query.domain.splitAndTrim(','))})`;
        if (query.senderEmail) conditions += ` AND mailRequest.senderEmail in (${getQuotedStrings(query.senderEmail.splitAndTrim(','))})`;
        if (query.recipientEmail) conditions += ` AND mailRequest.recipientEmail in (${getQuotedStrings(query.recipientEmail.splitAndTrim(','))})`;
        if (query.mailTypeId) conditions += ` AND mailRequest.mailTypeId in (${query.mailTypeId.splitAndTrim(',')})`;
        if (query.templateSlug) conditions += ` AND mailRequest.templateSlug in (${getQuotedStrings(query.templateSlug.splitAndTrim(','))})`;
        if (query.mailerRequestId) conditions += ` AND mailRequest.mailerRequestId in (${getQuotedStrings(query.mailerRequestId.splitAndTrim(','))})`;
        if (query.nodeId) conditions += ` AND mailRequest.nodeId in (${query.nodeId.splitAndTrim(',')})`;

        if (query.senderDedicatedIPId) conditions += ` AND mailReport.senderDedicatedIPId in (${query.senderDedicatedIPId.splitAndTrim(',')})`;
        if (query.eventId) conditions += ` AND mailReport.eventId in (${query.eventId.splitAndTrim(',')})`;
        if (query.remoteMX) conditions += ` AND mailReport.remoteMX in (${getQuotedStrings(query.remoteMX.splitAndTrim(','))})`;
        if (query.remoteIP) conditions += ` AND mailReport.remoteIP in (${getQuotedStrings(query.remoteIP.splitAndTrim(','))})`;
        if (query.hostname) conditions += ` AND mailReport.hostname in (${getQuotedStrings(query.hostname.splitAndTrim(','))})`;

        return conditions;
    }
}

export default MailRequestsService.getSingletonInstance();
