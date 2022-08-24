import { uniq } from 'lodash';
import { DateTime } from 'luxon';
import { ObjectId } from 'mongodb';

const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
const Hashes = require('jshashes');
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

function delay(time = 1000) {
    return new Promise((resolve) => {
        setTimeout(() => {
            return resolve(true);
        }, time)
    });
}

function formatDate(date: string) {
    try {
        const result = DateTime.fromFormat(date, DEFAULT_DATE_FORMAT);
        if (result?.isValid) return result;
        throw `Date must be provided in '${DEFAULT_DATE_FORMAT}' format`;
    } catch (err) {
        throw `Date must be provided in '${DEFAULT_DATE_FORMAT}' format`;
    }
}

function getQuotedStrings(data: string[] | undefined) {
    if (!data || !data.length) return null;
    return "'" + data.join("','") + "'";
}

function getValidFields(permittedFields: { [key: string]: string } = {}, fields: Array<string> = []) {
    const result: { withoutAlias: string[], withAlias: string[], onlyAlias: string[] } = { withoutAlias: [], withAlias: [], onlyAlias: [] };
    let attrbs = fields.filter(field => field in permittedFields);
    if (!attrbs.length) attrbs = Object.keys(permittedFields);

    uniq(attrbs).forEach(key => {
        result.withAlias.push(`${permittedFields[key]} as ${key}`);
        result.withoutAlias.push(permittedFields[key]);
        result.onlyAlias.push(key);
    });

    return result;
}

function getHashCode(str: string) {
    return new Hashes.SHA1().hex(str);
}

function isValidObjectId(id: string) {
    try {
        return new ObjectId(id).toString() === id;
    } catch {
        return false;
    }
}

function extractCountryCode(mobileNumber: string) {
    let regionCode, countryCode = '0';

    try {
        const parsedNum = phoneUtil.parseAndKeepRawInput(`+${mobileNumber}`);
        if (!phoneUtil.isValidNumber(parsedNum)) throw '0';
        regionCode = phoneUtil.getRegionCodeForNumber(parsedNum);
        countryCode = parsedNum.getCountryCode();
    } catch (err) {
        regionCode = null;
        countryCode = '0';
    }

    return { regionCode, countryCode };
}

function getDefaultDate(dayDiff: number = 7): { from: string, to: string } {
    const today = DateTime.now();

    return {
        from: today.minus({ days: dayDiff }).toFormat(DEFAULT_DATE_FORMAT),
        to: today.toFormat(DEFAULT_DATE_FORMAT)
    };
}

export {
    delay,
    formatDate,
    getQuotedStrings,
    getValidFields,
    isValidObjectId,
    extractCountryCode,
    getHashCode,
    getDefaultDate
}
