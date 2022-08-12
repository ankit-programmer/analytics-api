import { getHashCode } from "../services/utility-service";

export default class MailRequest {
    requestId: string; //Unique for each mail request. (outboundEmailId + recipientEmail)
    companyId: string; //Id of the company which requested this mail.
    subject: string; //Email Subject
    domain: string; //Email Domain: walkover.in
    senderEmail: string; //Sender Email Address
    recipientEmail: string; //Recipient Email Address
    outboundEmailId: number; //Unique Id is generated for each request (All recipients, cc, bcc of that mail will have same id) in MySQL.
    mailTypeId: number; //1 =>Transactional, 2 =>Notification, 3 =>Promotional
    templateSlug: string; //Id of email template
    mailerRequestId: string;
    nodeId: number; //Node Id used in campaign
    clientRequestIP: string; //Client IP
    createdAt: Date; //Timestamp when this mail was requested to be sent.

    constructor(attr: any) {
        this.subject = attr['sub'];
        this.domain = attr['dmn'];
        this.senderEmail = attr['sem'];
        this.mailTypeId = parseInt(attr['mti']);
        this.templateSlug = attr['tnm'];
        this.mailerRequestId = attr['mri'];
        this.nodeId = parseInt(attr['cmp']);
        this.clientRequestIP = attr['cri'];

        //common in all three email models
        this.recipientEmail = attr['rem']?.toLowerCase();
        this.outboundEmailId = parseInt(attr['oid']);
        this.requestId = getHashCode(`${this.outboundEmailId}-${this.recipientEmail}`);
        this.companyId = attr['cid'];
        this.createdAt = attr['created_at'] && new Date(attr['created_at']);
    }
}