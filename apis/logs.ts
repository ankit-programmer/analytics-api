import express from 'express';
import * as logsController from '../controllers/logs';

const router = express.Router();

router.get('/sms', logsController.getSmsLogs);

router.get('/mail', logsController.getMailLogs);
router.get('/mail/:requestId', logsController.getMailLogDetails);

export default router;