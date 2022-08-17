import express from 'express';
import * as profitsController from '../controllers/profits';

const router = express.Router();

router.get('/vendors', profitsController.getVendorProfits);

router.get('/sms', profitsController.getSmsProfits);

export default router;