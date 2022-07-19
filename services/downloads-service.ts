import { CollectionReference } from 'firebase-admin/firestore';
import { db } from '../firebase';
import logger from '../logger/logger';
import Download, { RESOURCE_TYPE } from '../models/download.model';
import dlrLogsService from './email/dlr-logs-service';
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
        let { status, files, err } = params;
        const data: any = {};

        if (status) {
            data.status = status;
            logger.info(`[DOWNLOAD] Updating status to ${status}...`);
        }

        if (files) data.files = files;
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
                return dlrLogsService.download(download);
            default:
                return reportDataService.download(download);
        }
    }
}

export default DownloadsFsService.getSingletonInstance();
