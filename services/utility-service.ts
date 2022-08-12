import { DateTime } from 'luxon';
import { ObjectId } from 'mongodb';
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
        const result = DateTime.fromFormat(date, 'yyyy-MM-dd');
        if (result?.isValid) return result;
        throw 'Date must be provided in yyyy-MM-dd format';
    } catch (err) {
        throw 'Date must be provided in yyyy-MM-dd format';
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

    attrbs.forEach(key => {
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
    let country, countryCode = '0';

    try {
        const parsedNum = phoneUtil.parseAndKeepRawInput(`+${mobileNumber}`);
        if (!phoneUtil.isValidNumber(parsedNum)) throw 'INVALID';
        country = phoneUtil.getRegionCodeForNumber(parsedNum);
        countryCode = parsedNum.getCountryCode();
    } catch (err) {
        country = 'INVALID';
        countryCode = '0';
    }

    return { country, countryCode };
}

export {
    delay,
    formatDate,
    getQuotedStrings,
    getValidFields,
    isValidObjectId,
    extractCountryCode,
    getHashCode
}
