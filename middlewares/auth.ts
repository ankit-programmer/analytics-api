import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import admin from '../firebase';
import logger from '../logger/logger';
class Cache {
    private jwtSecret: string = "";
    private secretInvalidator: any = null;
    private adminList: Array<string> = [];
    private adminListInvalidator: any = null;
    getSecret(): string {
        return this.jwtSecret;
    }
    setSecret(secret: string, ttl: number = 900000) {
        this.jwtSecret = secret;
        clearTimeout(this.secretInvalidator);
        this.secretInvalidator = setTimeout(() => {
            this.jwtSecret = "";
        }, ttl);
    }
    getAdminList(): Array<string> {
        return this.adminList;
    }
    setAdminList(list: Array<string>, ttl: number = 900000) {
        this.adminList = list;
        clearTimeout(this.adminListInvalidator);
        this.adminListInvalidator = setTimeout(() => {
            this.adminList = [];
        }, ttl);
    }
    invalidate() {
        this.jwtSecret = "";
        this.adminList = [];
    }
}
const cache = new Cache();
export async function authenticate(req: Request, res: Response, next: NextFunction) {
    console.log(req.header("Authorization"));
    let token = req.header('Authorization')?.replace('Bearer ', '');
    console.log(token);
    if (!token) {
        logger.error("Token not found");
        return res.status(401).send("Token not found");
    }
    try {
        const secret = await getJWTSecret();
        const decoded: any = jwt.verify(token, secret);
        let companyId = decoded?.companyId as string;
        if (!companyId) {
            companyId = decoded?.company?.id;
        }
        logger.info(`companyId : ${companyId}`);
        req.query.companyId = companyId;
    } catch (error) {
        const email = await getFirebaseEmail(token);
        if (!email) {
            return res.status(401).send("Invalid Token");
        }
        if (!await isAdmin(email)) {
            return res.status(403).send("Forbidden");
        }
    }
    next();

}
async function getFirebaseEmail(token: string) {
    try {
        const payload = await admin.auth().verifyIdToken(token, false);
        return payload?.email;
    } catch (error) {
        logger.error(error);
        return null;
    }
}
async function getJWTSecret() {
    try {
        const ref = admin.database().ref("/jwt_secret");
        let jwtSecret = cache.getSecret();
        if (!jwtSecret) {
            jwtSecret = (await ref.get()).val();
            cache.setSecret(jwtSecret);
        }
        return jwtSecret;
    } catch (error) {
        logger.error(error);
        return "";
    }

}
async function isAdmin(email?: string) {
    if (!email) {
        return false;
    }
    const ref = admin.database().ref("/users");
    let admins = cache.getAdminList();
    if (!admins.length) {
        admins = (await ref.get()).val();
        cache.setAdminList(admins, 1000);
    }
    if (Array.isArray(admins)) {
        return admins.includes(email) ? true : false;
    } else {
        return false;
    }
}

