import { Table } from '@google-cloud/bigquery';
import msg91Dataset from '../../database/big-query-service';
import ReportData from '../../models/report-data.model';
import Download from '../../models/download.model';
import { getQuotedStrings } from '../utility-service';
import logger from '../../logger/logger';

const REPORT_DATA_TABLE_ID = process.env.REPORT_DATA_TABLE_ID || 'report_data'
const REQUEST_DATA_TABLE_ID = process.env.REQUEST_DATA_TABLE_ID || 'request_data'
const GCS_BUCKET_NAME = 'msg91-analytics';
const GCS_FOLDER_NAME = 'report-data-exports';

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
        const exportFilePath = `gs://${GCS_BUCKET_NAME}/${GCS_FOLDER_NAME}/${download.id}_*.csv`;
        const overwrite = true;
        const header = true;
        const fieldDelimiter = ';';
        const fields = download.fields;
        const route = getQuotedStrings(download.route);
        const queryStatement = `select ${fields.join(',')} from ${REPORT_DATA_TABLE_ID} as reportData left join ${REQUEST_DATA_TABLE_ID} as requestData  on reportData.requestId = requestData.requestId WHERE reportData.user_pid = "${download.companyId}" AND (DATE(reportData.sentTime) BETWEEN "${download.startDate.toFormat('yyyy-MM-dd')}" AND "${download.endDate.toFormat('yyyy-MM-dd')}") ${route ? `AND reportData.route in (${route})` : ''}`;
        logger.info(`Query: ${queryStatement}`);
        const query = `EXPORT DATA OPTIONS(uri='${exportFilePath}', format='${format}', overwrite=${overwrite}, header=${header}, field_delimiter='${fieldDelimiter}') AS ${queryStatement}`;

        return msg91Dataset.createQueryJob({ query });
    }
}

export default ReportDataService.getSingletonInstance();