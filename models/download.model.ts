
import { DateTime } from 'luxon';

export enum DOWNLOAD_STATUS {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR'
}

export enum RESOURCE_TYPE {
    SMS = 'sms',
    EMAIL = 'email'
}

const DEFAULT_TIMEZONE: string = '+05:30';

export default class Download {
    id?: string;
    resourceType: RESOURCE_TYPE;
    companyId: string;
    startDate: DateTime;
    endDate: DateTime;
    status: DOWNLOAD_STATUS = DOWNLOAD_STATUS.PENDING;
    timezone: string = DEFAULT_TIMEZONE;
    fields?: Array<string>;
    file?: string;
    query?: { [key: string]: string };
    err?: string;
    createdAt: Date = new Date();
    updatedAt: Date = new Date();

    constructor(resourceType: string, companyId: string, startDate: DateTime, endDate: DateTime, timezone: string, fields: string = '', query: any) {
        this.resourceType = resourceType === RESOURCE_TYPE.EMAIL ? RESOURCE_TYPE.EMAIL : RESOURCE_TYPE.SMS;
        this.companyId = companyId;
        this.startDate = startDate;
        this.endDate = endDate;
        this.query = query;
        if (timezone) this.timezone = timezone;
        if (fields && fields.length) this.fields = fields.splitAndTrim(',');
    }
}