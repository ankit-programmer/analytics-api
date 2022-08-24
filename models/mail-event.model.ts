import { getHashCode, getValidFields } from "../services/utility-service";
import { Table } from '@google-cloud/bigquery';
import msg91Dataset, { getQueryResults, MAIL_EVENTS_TABLE_ID } from '../database/big-query-service';
import logger from '../logger/logger';

const mailEventsTable: Table = msg91Dataset.table(MAIL_EVENTS_TABLE_ID);
const PERMITTED_FIELDS: { [key: string]: string } = {
    requestId: 'mailEvent.requestId',
    eventId: 'mailEvent.eventId',
    recipientEmail: 'mailEvent.recipientEmail',
    outboundEmailId: 'mailEvent.outboundEmailId',
    companyId: 'mailEvent.companyId',
    requestTime: 'STRING(mailEvent.requestTime)',
    createdAt: 'STRING(mailEvent.createdAt)',
};

export default class MailEvent {
    requestId: string; //requestId of the mail. (Not unique in this table)	
    eventId: number; //Events that are initiated by the recipient of the mail. (5,6,7,10)	
    recipientEmail: string; //Recipient Email Address
    outboundEmailId: number; //Unique Id is generated for each request (All recipients, cc, bcc of that mail will have same id) in MySQL.
    companyId: string; //Id of the company which requested this mail.	
    requestTime: Date; //Timestamp when this mail was requested to be sent.	
    createdAt: Date; //Timestamp when event occurred.	

    constructor(attr: any) {
        this.eventId = parseInt(attr['eid']);

        //common in all three email models
        this.recipientEmail = attr['rem']?.toLowerCase();
        this.outboundEmailId = parseInt(attr['oid']);
        this.requestId = getHashCode(`${this.outboundEmailId}-${this.recipientEmail}`);
        this.companyId = attr['cid'];
        this.requestTime = attr['mct'] && new Date(attr['mct']);
        this.createdAt = attr['created_at'] && new Date(attr['created_at']);
    }

    public static insertMany(rows: Array<MailEvent>) {
        const insertOptions = { skipInvalidRows: true, ignoreUnknownValues: true };
        return mailEventsTable.insert(rows, insertOptions);
    }

    public static index(companyId: string, requestId: string, filters: { [key: string]: string } = {}, fields: string[] = []) {
        const attributes = getValidFields(PERMITTED_FIELDS, fields).withAlias.join(',');
        let conditions = `mailEvent.requestId = '${requestId}'`;
        if (companyId) conditions += ` AND mailEvent.companyId = '${companyId}'`;
        if (filters.eventId) conditions += ` AND mailEvent.eventId in (${filters.eventId.splitAndTrim(',')})`;

        const query = `SELECT ${attributes}
            FROM ${MAIL_EVENTS_TABLE_ID} AS mailEvent 
            WHERE ${conditions}`;

        logger.info(query);
        return getQueryResults(query);
    }
}