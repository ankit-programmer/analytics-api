import { Table } from '@google-cloud/bigquery';
import msg91Dataset from '../../database/big-query-service';
import ReportData from '../../models/report-data.model';
import Download from '../../models/download.model';
import { getQuotedStrings, getValidFields } from '../utility-service';
import logger from '../../logger/logger';
import downloadsService from '../downloads-service';

const REPORT_DATA_TABLE_ID = process.env.REPORT_DATA_TABLE_ID || 'report_data'
const REQUEST_DATA_TABLE_ID = process.env.REQUEST_DATA_TABLE_ID || 'request_data'
const GCS_BASE_URL = process.env.GCS_BASE_URL || 'https://storage.googleapis.com';
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'msg91-analytics';
const GCS_FOLDER_NAME = process.env.GCS_SMS_EXPORTS_FOLDER || 'sms-exports';
const PERMITTED_FIELDS: { [key: string]: string } = {
    // from report-data
    status: 'reportData.status',
    sentTime: 'reportData.sentTime',
    deliveryTime: 'reportData.deliveryTime',
    requestId: 'reportData.requestID',
    telNum: 'reportData.telNum',
    credit: 'reportData.credit',
    senderId: 'reportData.senderID',

    // from request-data
    campaignName: 'requestData.campaign_name',
    scheduleDateTime: 'requestData.scheduleDateTime',
    msgData: 'requestData.msgData',
    route: 'requestData.curRoute'
};

class ReportDataService {
    private static instance: ReportDataService;
    private reportDataTable: Table;

    constructor() {
        this.reportDataTable = msg91Dataset.table(REPORT_DATA_TABLE_ID);
    }

    public static getSingletonInstance(): ReportDataService {
        return ReportDataService.instance ||= new ReportDataService();
    }

    public insertMany(rows: Array<ReportData>) {
        const insertOptions = { skipInvalidRows: true, ignoreUnknownValues: true };
        return this.reportDataTable.insert(rows, insertOptions);
    }

    public download(download: Download, format: string = 'CSV') {
        logger.info('[DOWNLOAD] Creating job...');
        const filePath = `${GCS_BUCKET_NAME}/${GCS_FOLDER_NAME}/${download.id}`;
        const exportFilePath = `gs://${filePath}_ *.csv`;
        download.file = `${GCS_BASE_URL}/${filePath}_%20000000000000.csv`;
        const fields = getValidFields(PERMITTED_FIELDS, download.fields).withAlias.join(',');
        const whereClause = this.getWhereClause(download);
        const queryStatement = `select ${fields} from ${REPORT_DATA_TABLE_ID} as reportData right join ${REQUEST_DATA_TABLE_ID} as requestData on reportData.requestId = requestData.requestId WHERE ${whereClause}`;
        logger.info(`Query: ${queryStatement}`);
        return msg91Dataset.createQueryJob({ query: downloadsService.getExportQuery(download.id, queryStatement, exportFilePath, format) });
    }

    private getWhereClause(download: Download) {
        const query: { [key: string]: string } = download.query || {};

        // mandatory conditions
        let conditions = `reportData.user_pid = "${download.companyId}"`;
        conditions += ` AND requestData.requestUserid = "${download.companyId}"`;
        conditions += ` AND (DATETIME(reportData.sentTime, '${download.timezone}') BETWEEN "${download.startDate.toFormat('yyyy-MM-dd')}" AND "${download.endDate.plus({ days: 3 }).toFormat('yyyy-MM-dd')}")`;
        conditions += ` AND (DATETIME(requestData.requestDate, '${download.timezone}') BETWEEN "${download.startDate.toFormat('yyyy-MM-dd')}" AND "${download.endDate.toFormat('yyyy-MM-dd')}")`;

        // optional conditions
        if (query.route) conditions += ` AND reportData.route in (${getQuotedStrings(query.route.splitAndTrim(','))})`;

        return conditions;
    }
}

export default ReportDataService.getSingletonInstance();
