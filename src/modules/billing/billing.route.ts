import { Router } from "express";
import {
  createCustomerController,
  createCheckoutSessionController,
  seedPlanController,
  billingStatusController
} from "./billing.controller";
import { requireAuth, requireRole } from "../../middleware/authMiddleware";

const router = Router();

// customer creation post api
router.post('/create-customer',requireAuth,createCustomerController)

// create checkout session route
router.post('/create-checkout-session',createCheckoutSessionController)

// seed the plan in the Plan model
router.post('/seed-plan',seedPlanController)

// used to get the status
router.get('/status',billingStatusController)

export default router;
