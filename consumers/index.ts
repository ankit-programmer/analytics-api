import "../startup/dotenv";
import logger from "./../logger/logger";
import { has } from 'lodash';
import { mailRequestsConsumer } from './mail-requests-consumer';
import { mailReportsConsumer } from './mail-reports-consumer';
import { mailEventsConsumer } from './mail-events-consumer';

// Register your consumers here
const Consumers: any = {
    mailRequestsConsumer,
    mailReportsConsumer,
    mailEventsConsumer
};

function invalidConsumerName(consumerName: string): Boolean {
    return !has(Consumers, consumerName)
}

function getAvailableConsumers() {
    const consumerNames = Object.keys(Consumers);
    const numberedConsumerNames = consumerNames.map((consumer, idx) => `${idx + 1}. ${consumer}`);
    return numberedConsumerNames.join('\n');
}

function main() {
    const consumerName = process.argv[2];

    if (invalidConsumerName(consumerName))
        return logger.error(`Valid consumer name is required\n\nAvailable consumers: \n${getAvailableConsumers()}`);

    Consumers[consumerName]();
}

main();
