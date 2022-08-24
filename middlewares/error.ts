import { ErrorRequestHandler } from "express";
import logger from "../logger/logger";

const errorRequestHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error(err);
  res.status(500).send({ error: 'Something failed.' });
}

export default errorRequestHandler; 