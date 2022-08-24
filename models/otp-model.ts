import { Table } from '@google-cloud/bigquery';
import msg91Dataset, { OTP_TABLE_ID } from "../database/big-query-service";

const otpReportTable: Table = msg91Dataset.table(OTP_TABLE_ID);

export default class OtpModel {
    id: string;
    telNum: string;
    oppri: number;
    crcy: string;
    reportStatus: number;
    sentTimeReport: Date;
    providerSmsid: string;
    smsc: string;
    description: string;
    requestRoute: string;
    campaignName: string;
    campaignPid: string;
    credits: number;
    expiry: string;
    mobiles: string;
    requestDate: Date;
    msgData: string;
    countryCode: string;
    pauseReason: string;
    requestDateString: Date;
    noOfSms: number;
    requestUserid: string;
    otp: string;
    requestSender: string;
    sentTime: Date;
    unicode: number;
    status: number;
    userCredit: number;
    templateId: string;
    extraParam: string;
    dcc: string;
    peId: string;
    dltTeId: string;
    otpRetry: number;
    verified: number;
    otpVerCount: number;
    deliveryTime: Date;
    dts: number;
    route: string;
    credit: number;
    retryCount: string;
    voiceReportTime: string;
    voiceResponse: string;
    voiceRetryCount: number;
    voiceService: string;
    voiceStatus: number;
    demoAccount: number;
    source: number;

    constructor(attr: any) {
        this.id = attr['_id'].toString();
        this.telNum = attr['telNum'];
        this.oppri = parseFloat(attr['oppri'] || 0);
        this.crcy = attr['crcy'];
        this.reportStatus = +attr['reportStatus'];
        this.sentTimeReport = attr['sentTimeReport'] && new Date(attr['sentTimeReport']);
        this.providerSmsid = attr['providerSMSID'];
        this.smsc = attr['smsc'];
        this.description = attr['description'];
        this.requestRoute = attr['requestRoute'];
        this.campaignName = attr['campaign_name'];
        this.campaignPid = attr['campaign_pid'];
        this.credits = +attr['credits'];
        this.expiry = attr['expiry'];
        this.mobiles = attr['mobiles'];
        this.requestDate = attr['requestDate'] && new Date(attr['requestDate']);
        this.msgData = attr['msgData'];
        this.countryCode = attr['userCountryCode'];
        this.pauseReason = attr['pauseReason'];
        this.requestDateString = attr['requestDateString'] && new Date(attr['requestDateString']);
        this.noOfSms = +attr['noOfSMS'];
        this.requestUserid = attr['requestUserid']; //company id
        this.otp = attr['otp'];
        this.requestSender = attr['requestSender'];
        this.sentTime = attr['sentTime'] && new Date(attr['sentTime']);
        this.unicode = +attr['unicode'];
        this.status = +attr['status'];
        this.userCredit = +attr['userCredit'];
        this.templateId = attr['template_id'];
        this.extraParam = attr['extra_param'];
        this.dcc = attr['DCC'];
        this.peId = attr['PE_ID'];
        this.dltTeId = attr['DLT_TE_ID'];
        this.otpRetry = +attr['otpRetry'];
        this.verified = +attr['verified'];
        this.otpVerCount = +attr['otpVerCount'];
        this.deliveryTime = attr['deliveryTime'] && new Date(attr['deliveryTime']);
        this.dts = +attr['DTS'];
        this.route = attr['route'];
        this.credit = parseFloat(attr['credit']);
        this.retryCount = attr['retryCount'];
        this.voiceReportTime = attr['voice_report_time'];
        this.voiceResponse = attr['voice_response'];
        this.voiceRetryCount = +attr['voice_retry_count'];
        this.voiceService = attr['voice_service'];
        this.voiceStatus = +attr['voice_status'];
        this.demoAccount = +attr['demo_account'];
        this.source = +attr['source'];
    }

    public static insertMany(rows: Array<OtpModel>) {
        const insertOptions = { skipInvalidRows: true, ignoreUnknownValues: true };
        return otpReportTable.insert(rows, insertOptions);
    }
}