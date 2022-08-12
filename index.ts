import express from "express";
import "./startup/dotenv";
import logger from "./logger/logger";
import helmet from './startup/helmet';
import cors from './startup/cors';
import './startup/string.extensions';
import responseTime from './startup/response-time';
import routes from './startup/routes';
import sequelize from './database/sequelize-service';

const app = express();
helmet(app);
cors(app);
responseTime(app);
routes(app);
sequelize();

const port = process.env.PORT || 3000;
const server = app.listen(port, () =>
    logger.info(`Listening on port ${port}. Environment: ${app.get("env")}...`)
);

module.exports = server;