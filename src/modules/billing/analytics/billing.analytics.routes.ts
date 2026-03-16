import express from 'express';
const router = express.Router();

import { getBillingSummmary,getBillingTrends } from './billing.analytics.controller';

router.get('/summary',getBillingSummmary);
router.get('/trends',getBillingTrends)

export default router;