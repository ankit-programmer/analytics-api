import { Table } from '@google-cloud/bigquery';
import msg91Dataset from '../../database/big-query-service';
import MailEvent from '../../models/mail-event.model';

const MAIL_EVENTS_TABLE_ID = process.env.MAIL_EVENTS_TABLE_ID || 'mail_event'

class MailEventsService {
    private static instance: MailEventsService;
    private mailEventsTable: Table;

    constructor() {
        this.mailEventsTable = msg91Dataset.table(MAIL_EVENTS_TABLE_ID);
    }

    public static getSingletonInstance(): MailEventsService {
        return MailEventsService.instance ||= new MailEventsService();
    }

    public insertMany(rows: Array<MailEvent>) {
        const insertOptions = { skipInvalidRows: true, ignoreUnknownValues: true };
        return this.mailEventsTable.insert(rows, insertOptions);
    }
}

export default MailEventsService.getSingletonInstance();
