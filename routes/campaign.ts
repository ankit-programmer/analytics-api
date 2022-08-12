import express, { Request, Response } from 'express';
import { getDefaultDate } from '../utility';
import logger from "../logger/logger";
import smsService from "../services/sms/sms-service";
import { formatDate } from '../services/utility-service';

const router = express.Router();

router.route(`/`)
    .get(async (req: Request, res: Response) => {
        try {
            const params = { ...req.query, ...req.params } as any;
            let { companyId, smsNodeIds, timeZone, groupBy, startDate = getDefaultDate().end, endDate = getDefaultDate().start } = params;
            if (!companyId) throw "companyId required";
            if (!smsNodeIds?.length) throw "smsNodeIds required";
            const fromDate = formatDate(startDate);
            const toDate = formatDate(endDate);
            groupBy = `nodeId,${groupBy?.length ? groupBy : 'Date'}`;
            const smsAnalytics = await smsService.getCompanyAnalytics(companyId, fromDate, toDate, timeZone, params, groupBy);
            res.send({ sms: smsAnalytics });
        } catch (error) {
            logger.error(error);
            res.status(400).send({ error });
        }
    });

export default router;