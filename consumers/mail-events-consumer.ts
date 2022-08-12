import rabbitmqService, { Connection, Channel } from '../database/rabbitmq-service';
import logger from "../logger/logger";
import MailEvent from '../models/mail-event.model';
import mailEventsService from "../services/email/mail-events-service";

const BUFFER_SIZE = parseInt(process.env.RABBIT_MAIL_EVENTS_BUFFER_SIZE || '50');
const QUEUE_NAME = process.env.RABBIT_MAIL_EVENTS_QUEUE_NAME || 'email-event-logs';
let rabbitConnection: Connection;
let rabbitChannel: Channel;

async function start() {
    try {
        logger.info(`[CONSUMER](Mail Events) Creating channel...`);
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
    logger.info(`[CONSUMER](Mail Events) Buffer is empty, waiting for messages...`);

    rabbitChannel.consume(QUEUE_NAME, async (msg: any) => {
        logger.info(`[CONSUMER](Mail Events) New message received, pushing to buffer...`);
        buffer.push(JSON.parse(msg.content.toString()));

        if (buffer.length === BUFFER_SIZE) {
            await processMsgs(buffer);
            logger.info(`[CONSUMER](Mail Events) Messages processed, send ackowledgement...`);
            rabbitChannel.ack(msg, true); // true: Multiple Ack
            buffer = [];
            logger.info(`[CONSUMER](Mail Events) Buffer is empty, waiting for messages...`);
        }
    }, { noAck: false }); // Auto Ack Off
}

async function processMsgs(msgs: any[]) {
    logger.info(`[CONSUMER](Mail Events) Buffer full, processing ${msgs.length} messages...`);

    try {
        const mailEvents: Array<MailEvent> = [];
        msgs.map((mailEvent: any) => mailEvents.push(new MailEvent(mailEvent)));
        if (mailEvents.length) await mailEventsService.insertMany(mailEvents);
    } catch (err: any) {
        if (err.name !== 'PartialFailureError') throw err;
        logger.error(`[CONSUMER](Mail Events) PartialFailureError`);
        logger.error(JSON.stringify(err));
    }
}

const mailEventsConsumer = () => {
    logger.info(`[CONSUMER](Mail Events) Initiated...`);

    rabbitmqService().on("connect", (connection) => {
        rabbitConnection = connection;
        start();
    });
}

export {
    mailEventsConsumer
};