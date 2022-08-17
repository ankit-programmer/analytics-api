import { Request, Response } from "express";
import logger from '../logger/logger';
import smsAnalyticsService from "../services/sms/sms-analytics-service";
import { formatDate, getDefaultDate } from "../services/utility-service";

// GET '/analytics/sms'
const getSmsAnalytics = async (req: Request, res: Response) => {
    try {
        const params = { ...req.query, ...req.params } as any;
        let { companyId, timeZone, groupBy, startDate = getDefaultDate().from, endDate = getDefaultDate().to } = params;
        const fromDate = formatDate(startDate);
        const toDate = formatDate(endDate);

        const smsAnalytics = await smsAnalyticsService.getAnalytics(companyId, fromDate, toDate, timeZone, params, groupBy);
        res.send(smsAnalytics);
    } catch (error) {
        logger.error(error);
        res.status(400).send({ error });
    }
}

// GET '/analytics/campaigns'
const getCampaignAnalytics = async (req: Request, res: Response) => {
    try {
        const params = { ...req.query, ...req.params } as any;
        let { companyId, smsNodeIds, timeZone, groupBy, startDate = getDefaultDate().from, endDate = getDefaultDate().to } = params;
        const fromDate = formatDate(startDate);
        const toDate = formatDate(endDate);
        if (!companyId) throw "companyId required";
        if (!smsNodeIds?.length) throw "smsNodeIds required";

        const smsAnalytics = await smsAnalyticsService.getAnalytics(companyId, fromDate, toDate, timeZone, params, groupBy);
        res.send({ sms: smsAnalytics });
    } catch (error) {
        logger.error(error);
        res.status(400).send({ error });
    }
}

export {
    getSmsAnalytics,
    getCampaignAnalytics
};