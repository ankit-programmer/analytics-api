import express from 'express';
import * as analyticsController from '../controllers/analytics';

const router = express.Router();

router.get('/sms', analyticsController.getSmsAnalytics);

router.get('/campaigns', analyticsController.getCampaignAnalytics);

export default router;