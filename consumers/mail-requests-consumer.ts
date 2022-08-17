import rabbitmqService, { Connection, Channel } from '../database/rabbitmq-service';
import logger from "../logger/logger";
import MailRequest from '../models/mail-request.model';

const BUFFER_SIZE = parseInt(process.env.RABBIT_MAIL_REQ_BUFFER_SIZE || '50');
const QUEUE_NAME = process.env.RABBIT_MAIL_REQ_QUEUE_NAME || 'email-request-logs';
let rabbitConnection: Connection;
let rabbitChannel: Channel;

async function start() {
    try {
        logger.info(`[CONSUMER](Mail Requests) Creating channel...`);
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
    logger.info(`[CONSUMER](Mail Requests) Buffer is empty, waiting for messages...`);

    rabbitChannel.consume(QUEUE_NAME, async (msg: any) => {
        logger.info(`[CONSUMER](Mail Requests) New message received, pushing to buffer...`);
        buffer.push(JSON.parse(msg.content.toString()));

        if (buffer.length === BUFFER_SIZE) {
            await processMsgs(buffer);
            logger.info(`[CONSUMER](Mail Requests) Messages processed, send ackowledgement...`);
            rabbitChannel.ack(msg, true); // true: Multiple Ack
            buffer = [];
            logger.info(`[CONSUMER](Mail Requests) Buffer is empty, waiting for messages...`);
        }
    }, { noAck: false }); // Auto Ack Off
}

async function processMsgs(msgs: any[]) {
    logger.info(`[CONSUMER](Mail Requests) Buffer full, processing ${msgs.length} messages...`);

    try {
        const mailRequests: Array<MailRequest> = [];
        msgs.map(msg => msg.map((mailReq: any) => mailRequests.push(new MailRequest(mailReq))));
        if (mailRequests.length) await MailRequest.insertMany(mailRequests);
    } catch (err: any) {
        if (err.name !== 'PartialFailureError') throw err;
        logger.error(`[CONSUMER](Mail Requests) PartialFailureError`);
        logger.error(JSON.stringify(err));
    }
}

const mailRequestsConsumer = () => {
    logger.info(`[CONSUMER](Mail Requests) Initiated...`);

    rabbitmqService().on("connect", (connection) => {
        rabbitConnection = connection;
        start();
    });
}

export {
    mailRequestsConsumer
};