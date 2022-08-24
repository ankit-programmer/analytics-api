import { Table } from '@google-cloud/bigquery';
import msg91Dataset, { MAIL_REP_TABLE_ID } from '../database/big-query-service';
import { getHashCode } from "../services/utility-service";

const mailReportTable: Table = msg91Dataset.table(MAIL_REP_TABLE_ID);

export default class MailReport {
    requestId: string; //Request Id of this mail (Not unique in this table)
    eventId: number; //Events that occurred while processing this mail. (2,3,4,8,9)	
    statusCode: number; //Standard Response Code of SMTP Protocol	
    enhancedStatusCode: string; //Standard Response Code of SMTP Protocol	
    reason: string; //Description of Response Status	
    resultState: string;
    remoteMX: string;
    remoteIP: string; //MX Server IP of Client	
    contentSize: number;
    senderDedicatedIPId: number; //Unique id of Dedicated IP used to send this mail.
    hostname: string;
    recipientEmail: string; //Recipient Email Address
    outboundEmailId: number; //Unique Id is generated for each request (All recipients, cc, bcc of that mail will have same id) in MySQL.
    companyId: string; //Id of the company which requested this mail.
    requestTime: Date; //Timestamp when this mail was requested to be sent.	
    createdAt: Date; //Time when this specific event happened

    constructor(attr: any) {
        this.eventId = parseInt(attr['eid']);
        this.statusCode = parseInt(attr['stc']);
        this.enhancedStatusCode = attr['esc'];
        this.reason = attr['rsn'];
        this.resultState = attr['rst'];
        this.remoteMX = attr['rmx'];
        this.remoteIP = attr['rip'];
        this.contentSize = parseInt(attr['csz']);
        this.senderDedicatedIPId = parseInt(attr['sid']);
        this.hostname = attr['hnm'];

        //common in all three email models
        this.recipientEmail = attr['rem']?.toLowerCase();
        this.outboundEmailId = parseInt(attr['oid']);
        this.requestId = getHashCode(`${this.outboundEmailId}-${this.recipientEmail}`);
        this.companyId = attr['cid'];
        this.requestTime = attr['mct'] && new Date(attr['mct']);
        this.createdAt = attr['created_at'] && new Date(attr['created_at']);
    }

    public static insertMany(rows: Array<MailReport>) {
        const insertOptions = { skipInvalidRows: true, ignoreUnknownValues: true };
        return mailReportTable.insert(rows, insertOptions);
    }
}