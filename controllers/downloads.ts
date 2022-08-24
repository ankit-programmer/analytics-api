import { Request, Response } from "express";
import logger from '../logger/logger';
import { formatDate } from "../services/utility-service";
import Download, { DOWNLOAD_STATUS } from '../models/download.model';

// POST '/exports/sms' | '/exports/mail'
const downloadCsv = async (req: Request, res: Response) => {
    try {
        const { companyId, fields, timezone } = req.query;
        const resourceType = req.params[0]; // sms or mail
        const startDate = formatDate(req.query.startDate as string);
        const endDate = formatDate(req.query.endDate as string);
        if (!companyId) throw 'Company Id is mandatory';
        const download = new Download(resourceType as string, companyId as string, startDate, endDate, timezone as string, fields as string, req.query);
        const downloadDoc = await download.save();
        download.id = downloadDoc.id;
        res.send(download);

        try {
            const [exportJob] = await download.createJob();
            download.update({ status: DOWNLOAD_STATUS.PROCESSING });
            await exportJob.getQueryResults();
            download.update({ status: DOWNLOAD_STATUS.SUCCESS, file: download.file });
        } catch (err: any) {
            download.update({ status: DOWNLOAD_STATUS.ERROR, err: err.message });
            logger.error(err);
        }
    } catch (error: any) {
        logger.error(error);
        res.status(400).send({ error });
    }
}

// GET '/exports/sms' | '/exports/mail'
const getDownloadLinks = async (req: Request, res: Response) => {
    try {
        let { companyId } = req.query;
        let resourceType = req.params[0]; // sms or mail
        logger.info(`[DOWNLOAD](companyId: ${companyId}) Fetching records...`);
        const snapshot = await Download.index(resourceType, companyId as string);
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
}

export {
    downloadCsv,
    getDownloadLinks
};