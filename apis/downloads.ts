import express from 'express';
import * as downloadsController from '../controllers/downloads';

const router = express.Router();

router.post(/^\/(sms|mail)/, downloadsController.downloadCsv);

router.get(/^\/(sms|mail)/, downloadsController.getDownloadLinks);

export default router;