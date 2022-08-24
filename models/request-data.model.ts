import { Table } from '@google-cloud/bigquery';
import msg91Dataset, { REQUEST_DATA_TABLE_ID } from '../database/big-query-service';

const requestDataTable: Table = msg91Dataset.table(REQUEST_DATA_TABLE_ID);

export default class RequestData {
    _id: string;
    requestID: string;
    telNum: string;
    reportStatus: number;
    sentTimeReport: Date;
    providerSMSID: string;
    user_pid: string;
    senderID: string;
    smsc: string;
    requestRoute: string;
    campaign_name: string;
    campaign_pid: string;
    curRoute: string;
    expiry: string;
    isCopied: string;
    requestDate: Date;
    userCountryCode: string;
    requestUserid: string;
    status: string;
    userCredit: string;
    isSingleRequest: string;
    deliveryTime: Date;
    route: string;
    credit: number;
    oppri: number;
    crcy: string;
    node_id: string;
    scheduleDateTime: Date;
    msgData: string;

    constructor(attr: any) {
        this._id = attr['_id'].toString();
        this.requestID = attr['requestID'];
        this.telNum = attr['telNum'];
        this.reportStatus = attr['reportStatus'];
        this.sentTimeReport = attr['sentTimeReport'] || null;
        this.providerSMSID = attr['providerSMSID'];
        this.user_pid = attr['user_pid'];
        this.senderID = attr['senderID'];
        this.smsc = attr['smsc'];
        this.requestRoute = attr['requestRoute'];
        this.campaign_name = attr['campaign_name'];
        this.campaign_pid = attr['campaign_pid'];
        this.curRoute = attr['curRoute'];
        this.expiry = attr['expiry'];
        this.isCopied = attr['isCopied'];
        this.requestDate = attr['requestDate'] || null;
        this.userCountryCode = attr['userCountryCode'];
        this.requestUserid = attr['requestUserid'];
        this.status = attr['status'];
        this.userCredit = attr['userCredit'];
        this.isSingleRequest = attr['isSingleRequest'];
        this.deliveryTime = attr['deliveryTime'] || null;
        this.route = attr['route'];
        this.credit = parseFloat(attr['credit']);
        this.oppri = parseFloat(attr['oppri'] || 0);
        this.crcy = attr['crcy'];
        this.node_id = attr['node_id'];
        this.scheduleDateTime = attr['scheduleDateTime'] || null;
        this.msgData = attr['msgData'];
    }

    public static insertMany(rows: Array<RequestData>) {
        const insertOptions = { skipInvalidRows: true, ignoreUnknownValues: true };
        return requestDataTable.insert(rows, insertOptions);
    }
}