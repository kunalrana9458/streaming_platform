import { Router } from "express";
import {
  createCustomerController,
  createCheckoutSessionController
} from "./billing.controller";
import { requireAuth, requireRole } from "../../middleware/authMiddleware";

const router = Router();

// customer creation post api
router.post('/create-customer',requireAuth,createCustomerController)

// create checkout session route
router.post('/create-checkout-session',createCheckoutSessionController)

export default router;
