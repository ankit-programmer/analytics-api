import { sequelize, DataTypes } from '../database/sequelize-service';
import { isValidObjectId } from '../services/utility-service';

export enum jobType {
    REQUEST_DATA = 'requestData',
    REPORT_DATA = 'reportData',
    OTP_REPORT = 'otpReport'
};

const Tracker = sequelize.define("Tracker", {
    jobType: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
        set(value: string) {
            const types: string[] = Object.keys(jobType).map(key => jobType[key as keyof typeof jobType]);

            if (!types.includes(value)) {
                throw new Error(`Valid jobType is required - ${types.join(' | ')}`);
            }

            this.setDataValue('jobType', value);
        }
    },
    lastDocumentId: {
        type: DataTypes.STRING,
        allowNull: false,
        set(value: string) {
            if (!isValidObjectId(value)) {
                throw new Error('Invalid lastDocumentId');
            }

            this.setDataValue('lastDocumentId', value);
        }
    }
});

export default Tracker;