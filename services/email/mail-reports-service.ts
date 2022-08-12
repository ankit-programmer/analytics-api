import { Table } from '@google-cloud/bigquery';
import msg91Dataset from '../../database/big-query-service';
import MailReport from '../../models/mail-report.model';

export const MAIL_REP_TABLE_ID = process.env.MAIL_REP_TABLE_ID || 'mail_report'

class MailReportsService {
    private static instance: MailReportsService;
    private mailReportTable: Table;

    constructor() {
        this.mailReportTable = msg91Dataset.table(MAIL_REP_TABLE_ID);
    }

    public static getSingletonInstance(): MailReportsService {
        return MailReportsService.instance ||= new MailReportsService();
    }

    public insertMany(rows: Array<MailReport>) {
        const insertOptions = { skipInvalidRows: true, ignoreUnknownValues: true };
        return this.mailReportTable.insert(rows, insertOptions);
    }
}

export default MailReportsService.getSingletonInstance();
