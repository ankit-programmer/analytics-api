import { Request, Response } from "express";
import logger from '../logger/logger';
import mailLogsService from "../services/email/mail-logs-service";
import smsLogsService from "../services/sms/sms-logs-service";
import { formatDate, getDefaultDate } from "../services/utility-service";
import MailEvent from '../models/mail-event.model';

// GET '/logs/sms'
const getSmsLogs = async (req: Request, res: Response) => {
    try {
        const params = { ...req.query, ...req.params } as any;
        let { companyId, timeZone, fields, startDate = getDefaultDate().from, endDate = getDefaultDate().to } = params;
        const fromDate = formatDate(startDate);
        const toDate = formatDate(endDate);
        const attributes = fields?.length ? fields.splitAndTrim(',') : [];

        const logs = await smsLogsService.getLogs(companyId, fromDate, toDate, timeZone, params, attributes);
        res.send(logs);
    } catch (error: any) {
        logger.error(error);
        res.status(400).send({ error: error?.message || error });
    }
}

// GET '/logs/mail'
const getMailLogs = async (req: Request, res: Response) => {
    try {
        const params = { ...req.query, ...req.params } as any;
        let { companyId, timeZone, fields, startDate = getDefaultDate().from, endDate = getDefaultDate().to } = params;
        const fromDate = formatDate(startDate);
        const toDate = formatDate(endDate);
        const attributes = fields?.length ? fields.splitAndTrim(',') : [];

        const logs = await mailLogsService.getLogs(companyId, fromDate, toDate, timeZone, params, attributes);
        res.send(logs);
    } catch (error: any) {
        logger.error(error);
        res.status(400).send({ error: error?.message || error });
    }
}

// GET '/logs/mail/:requestId'
const getMailLogDetails = async (req: Request, res: Response) => {
    try {
        const params = { ...req.query, ...req.params } as any;
        let { companyId, requestId, fields } = params;
        const attributes = fields?.length ? fields.splitAndTrim(',') : [];
        if (!requestId) throw "requestId required";

        const logs = await MailEvent.index(companyId, requestId, params, attributes);
        res.send({ data: logs });
    } catch (error: any) {
        logger.error(error);
        res.status(400).send({ error: error?.message || error });
    }
}

export {
    getSmsLogs,
    getMailLogs,
    getMailLogDetails
};