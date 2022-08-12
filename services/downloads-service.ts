import { CollectionReference } from 'firebase-admin/firestore';
import { db } from '../firebase';
import logger from '../logger/logger';
import Download, { RESOURCE_TYPE } from '../models/download.model';
import mailRequestsService from './email/mail-requests-service';
import reportDataService from './sms/report-data-service';

const DOWNLOADS_COLLECTION = process.env.DOWNLOADS_COLLECTION || 'downloads'

class DownloadsFsService {
    private static instance: DownloadsFsService;
    private collection: CollectionReference;

    constructor() {
        this.collection = db.collection(DOWNLOADS_COLLECTION);
    }

    public static getSingletonInstance(): DownloadsFsService {
        return DownloadsFsService.instance ||= new DownloadsFsService();
    }

    public insert(doc: Download) {
        logger.info('[DOWNLOAD] Creating entry in firestore...');
        return this.collection.add(JSON.parse(JSON.stringify(doc)));
    }

    public update(docId: string, params: any) {
        let { status, file, err } = params;
        const data: any = {};

        if (status) {
            data.status = status;
            logger.info(`[DOWNLOAD] Updating status to ${status}...`);
        }

        if (file) data.file = file;
        if (err) data.err = err;
        data.updatedAt = new Date().toISOString();
        return this.collection.doc(docId).update(data);
    }

    public index(companyId?: string) {
        if (companyId) {
            return this.collection.where('companyId', '==', companyId).get();
        }

        return this.collection.get();
    }

    public createJob(download: Download) {
        switch (download.resourceType) {
            case RESOURCE_TYPE.EMAIL:
                return mailRequestsService.download(download);
            default:
                return reportDataService.download(download);
        }
    }

    public getExportQuery(downloadId: string = '', query: string, exportPath: string, format: string) {
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

export default DownloadsFsService.getSingletonInstance();
