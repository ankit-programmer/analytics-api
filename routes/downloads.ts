import express, { Request, Response } from 'express';
import logger from '../logger/logger';
import downloadsService from '../services/downloads-service';
import Download, { DOWNLOAD_STATUS } from '../models/download.model';
import { formatDate } from '../services/utility-service';

const router = express.Router();


router.route(/^\/(sms|email)/).post(async (req: Request, res: Response) => {
    try {
        let { companyId, fields, timezone } = req.query;
        let resourceType = req.params[0];
        let startDate = formatDate(req.query.startDate as string);
        let endDate = formatDate(req.query.endDate as string);
        if (!companyId) throw 'Company Id is mandatory';
        const download = new Download(resourceType as string, companyId as string, startDate, endDate, timezone as string, fields as string, req.query);
        const downloadDoc = await downloadsService.insert(download);
        download.id = downloadDoc.id;
        res.send(download);

        try {
            const [exportJob] = await downloadsService.createJob(download);
            downloadsService.update(download.id, { status: DOWNLOAD_STATUS.PROCESSING });
            await exportJob.getQueryResults();
            downloadsService.update(download.id, { status: DOWNLOAD_STATUS.SUCCESS, file: download.file });
        } catch (err: any) {
            downloadsService.update(download.id, { status: DOWNLOAD_STATUS.ERROR, err: err.message });
            logger.error(err);
        }
    } catch (error: any) {
        logger.error(error);
        res.status(400).send({ error });
    }
});

router.route('/:resourceType').get(async (req: Request, res: Response) => {
    try {
        let { companyId } = req.query;
        logger.info(`[DOWNLOAD](companyId: ${companyId}) Fetching records...`);
        const snapshot = await downloadsService.index(companyId as string);
        const docs = snapshot.docs;
        const results = docs.map(doc => {
            const document = doc.data();
            document.id = doc.id;
            return document;
        });
        res.send(results);
    } catch (err: any) {
        logger.error(err);
        res.status(500).send({ "error": err.message });
    }
});
export default router;