
import Download from '../../models/download.model';
import { getQuotedStrings, getValidFields } from '../utility-service';

const REPORT_DATA_TABLE_ID = process.env.REPORT_DATA_TABLE_ID || 'report_data'
const REQUEST_DATA_TABLE_ID = process.env.REQUEST_DATA_TABLE_ID || 'request_data'
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

class SmsExportService {
    private static instance: SmsExportService;


    public static getSingletonInstance(): SmsExportService {
        return SmsExportService.instance ||= new SmsExportService();
    }

    public getQuery(download: Download) {
        const fields = getValidFields(PERMITTED_FIELDS, download.fields).withAlias.join(',');
        const whereClause = this.getWhereClause(download);
        return `select ${fields} from ${REPORT_DATA_TABLE_ID} as reportData right join ${REQUEST_DATA_TABLE_ID} as requestData on reportData.requestId = requestData.requestId WHERE ${whereClause}`;
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

export default SmsExportService.getSingletonInstance();
