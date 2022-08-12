import { extractCountryCode } from "../services/utility-service";

export default class ReportData {
    _id: string;
    requestID: string;
    telNum: string;
    countryCode: string;
    status: number;
    sentTime: Date;
    providerSMSID: string;
    user_pid: string;
    senderID: string;
    smsc: string;
    deliveryTime: Date;
    route: string;
    credit: number;
    retryCount: number;
    sentTimePeriod: Date;
    crcy: string;
    node_id: string;
    oppri: number;
    isSingleRequest: string;

    constructor(attr: any) {
        this._id = attr['_id']?.toString();
        this.requestID = attr['requestID'];
        this.telNum = attr['telNum'];
        this.countryCode = extractCountryCode(this.telNum)?.countryCode || '0';
        this.status = parseInt(attr['status']);
        this.sentTime = attr['sentTime'] || null;
        this.providerSMSID = attr['providerSMSID'];
        this.user_pid = attr['user_pid'];
        this.senderID = attr['senderID'];
        this.smsc = attr['smsc'];
        this.deliveryTime = attr['deliveryTime'] || null;
        this.route = attr['route'];
        this.credit = parseFloat(attr['credit']);
        this.retryCount = parseInt(attr['retryCount']);
        this.sentTimePeriod = attr['sentTimePeriod'] || null;
        this.crcy = attr['crcy'];
        this.node_id = attr['node_id'];
        this.oppri = parseFloat(attr['oppri'] || 0);
        this.isSingleRequest = attr['isSingleRequest'];
    }
}