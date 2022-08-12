import express, { Request, Response } from "express";
import logger from "../logger/logger";

const router = express.Router();

router.post("/", async (req: Request, res: Response) => {
    try {
        const result: any = req.body.data.splitAndTrim(',');
        return res.send(result);
    } catch (err) {
        logger.error(err);
        return res.status(500).send(err);
    }
});

export default router;