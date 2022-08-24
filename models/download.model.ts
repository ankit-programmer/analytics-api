
import msg91Dataset from '../database/big-query-service';
import { DateTime } from 'luxon';
import { db } from '../firebase';
import logger from '../logger/logger';
import smsLogsService from '../services/sms/sms-logs-service';
import mailLogsService from '../services/email/mail-logs-service';
import { CollectionReference } from 'firebase-admin/firestore';

export enum DOWNLOAD_STATUS {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR'
}

export enum RESOURCE_TYPE {
    SMS = 'sms',
    EMAIL = 'mail'
}

const DOWNLOADS_COLLECTION = process.env.DOWNLOADS_COLLECTION || 'downloads'
const GCS_BASE_URL = process.env.GCS_BASE_URL || 'https://storage.googleapis.com';
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'msg91-analytics';
const GCS_FOLDER_NAME = process.env.GCS_SMS_EXPORTS_FOLDER || 'sms-exports';
const DEFAULT_TIMEZONE: string = '+05:30';
const collection: CollectionReference = db.collection(DOWNLOADS_COLLECTION);

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

    public static index(resourceType: string, companyId?: string) {
        if (companyId) {
            return collection.where('companyId', '==', companyId).where('resourceType', '==', resourceType).get();
        }

        return collection.get();
    }

    public save() {
        logger.info('[DOWNLOAD] Creating entry in firestore...');
        return collection.add(JSON.parse(JSON.stringify(this)));
    }

    public update(params: any) {
        if (!this.id) return;
        let { status, file, err } = params;
        const data: any = {};

        if (status) {
            data.status = status;
            logger.info(`[DOWNLOAD] Updating status to ${status}...`);
        }

        if (file) data.file = file;
        if (err) data.err = err;
        data.updatedAt = new Date().toISOString();
        return collection.doc(this.id).update(data);
    }

    public createJob(format: string = 'CSV') {
        logger.info('[DOWNLOAD] Creating job...');
        const filePath = `${GCS_BUCKET_NAME}/${GCS_FOLDER_NAME}/${this.id}`;
        const exportFilePath = `gs://${filePath}_ *.csv`;
        this.file = `${GCS_BASE_URL}/${filePath}_%20000000000000.csv`;
        let queryStatement = this.getQueryStatement();
        logger.info(`Query: ${queryStatement}`);
        return msg91Dataset.createQueryJob({ query: this.getExportQuery(this.id, queryStatement, exportFilePath, format) });
    }

    private getQueryStatement() {
        switch (this.resourceType) {
            case RESOURCE_TYPE.EMAIL:
                return mailLogsService.getQuery(this.companyId, this.startDate, this.endDate, this.timezone, this.query, this.fields);
            default:
                return smsLogsService.getQuery(this.companyId, this.startDate, this.endDate, this.timezone, this.query, this.fields);
        }
    }

    private getExportQuery(downloadId: string = '', query: string, exportPath: string, format: string) {
        return `
            BEGIN
                CREATE TEMP TABLE _SESSION.${downloadId} AS (
                    WITH temptable AS (${query})
                    SELECT * FROM temptable
                );
                
                EXPORT DATA OPTIONS(
                    uri='${exportPath}',
                    format='${format}',
                    overwrite=true,
                    header=true,
                    field_delimiter=';'
                ) AS
                SELECT * FROM _SESSION.${downloadId};
            END;
        `;
    }
}