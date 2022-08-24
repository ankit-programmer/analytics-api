import { CollectionReference } from 'firebase-admin/firestore';
import { db } from '../firebase';
import logger from './logger';

class FirebaseLogger {
    private static instance: FirebaseLogger;

    constructor() {
        //
    }

    public static getSingletonInstance(): FirebaseLogger {
        return FirebaseLogger.instance ||= new FirebaseLogger();
    }

    public log(errors: Array<Object>, collectionName: string = 'genericErrors') {
        logger.error('[ERROR] Logging errors in firestore...');
        const batch = db.batch();
        const collection: CollectionReference = db.collection(collectionName);
        errors.forEach((error: any) => batch.set(collection.doc(), JSON.parse(JSON.stringify(error))));
        return batch.commit();
    }
}

export default FirebaseLogger.getSingletonInstance();
