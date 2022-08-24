import { Request, Response } from "express";
import logger from '../logger/logger';

// GET '/'
const healthcheck = async (_req: Request, res: Response) => {
    return res.send({ "healthy": true });
}

// POST '/'
const test = async (req: Request, res: Response) => {
    try {
        const result: any = req.body.data;

        return res.send(result);
    } catch (err) {
        logger.error(err);
        return res.status(500).send(err);
    }
}

export { healthcheck, test };