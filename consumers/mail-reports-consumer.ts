import rabbitmqService, { Connection, Channel } from '../database/rabbitmq-service';
import logger from "../logger/logger";
import MailReport from '../models/mail-report.model';
import mailReportsService from "../services/email/mail-reports-service";

const BUFFER_SIZE = parseInt(process.env.RABBIT_MAIL_REP_BUFFER_SIZE || '50');
const QUEUE_NAME = process.env.RABBIT_MAIL_REP_QUEUE_NAME || 'email-response-logs';
let rabbitConnection: Connection;
let rabbitChannel: Channel;

async function start() {
    try {
        logger.info(`[CONSUMER](Mail Reports) Creating channel...`);
        rabbitChannel = await rabbitConnection.createChannel();
        rabbitChannel.prefetch(BUFFER_SIZE);
        rabbitChannel.assertQueue(QUEUE_NAME, { durable: true });
        startConsumption();
    } catch (error: any) {
        logger.error(error);
    }
}

function startConsumption() {
    let buffer: any[] = [];
    logger.info(`[CONSUMER](Mail Reports) Buffer is empty, waiting for messages...`);

    rabbitChannel.consume(QUEUE_NAME, async (msg: any) => {
        logger.info(`[CONSUMER](Mail Reports) New message received, pushing to buffer...`);
        buffer.push(JSON.parse(msg.content.toString()));

        if (buffer.length === BUFFER_SIZE) {
            await processMsgs(buffer);
            logger.info(`[CONSUMER](Mail Reports) Messages processed, send ackowledgement...`);
            rabbitChannel.ack(msg, true); // true: Multiple Ack
            buffer = [];
            logger.info(`[CONSUMER](Mail Reports) Buffer is empty, waiting for messages...`);
        }
    }, { noAck: false }); // Auto Ack Off
}

async function processMsgs(msgs: any[]) {
    logger.info(`[CONSUMER](Mail Reports) Buffer full, processing ${msgs.length} messages...`);

    try {
        const mailReports: Array<MailReport> = [];
        msgs.map(msg => msg.map((mailRep: any) => mailReports.push(new MailReport(mailRep))));
        if (mailReports.length) await mailReportsService.insertMany(mailReports);
    } catch (err: any) {
        if (err.name !== 'PartialFailureError') throw err;
        logger.error(`[CONSUMER](Mail Reports) PartialFailureError`);
        logger.error(JSON.stringify(err));
    }
}

const mailReportsConsumer = () => {
    logger.info(`[CONSUMER](Mail Reports) Initiated...`);

    rabbitmqService().on("connect", (connection) => {
        rabbitConnection = connection;
        start();
    });
}

export {
    mailReportsConsumer
};