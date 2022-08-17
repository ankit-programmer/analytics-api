import { Request, Response } from "express";
import { bigQuery } from '../database/big-query-service';
import logger from '../logger/logger';
import { extractCountryCode } from "../services/utility-service";

// GET '/'
const index = async (_req: Request, res: Response) => {
    try {
        const datasets = await bigQuery.getDatasets();
        if (datasets?.length) return res.send({ "healthy": true });
    } catch (err) {
        logger.error(err);
    }

    res.status(500).send('Couldn\'t load Datasets');
}

// POST '/'
const test = async (req: Request, res: Response) => {
    try {
        const result: any = req.body.data.map((num: string) => {
            const codes = extractCountryCode(num);

            return {
                num,
                regionCode: codes.regionCode,
                countryCode: codes.countryCode,
            };
        });

        return res.send(result);
    } catch (err) {
        logger.error(err);
        return res.status(500).send(err);
    }
}

export { index, test };