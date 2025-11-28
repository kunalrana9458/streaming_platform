import { Router } from "express";
import {
  createCustomerController,
  createCheckoutSessionController,
  seedPlanController,
  billingStatusController,
  getCustomerPortal,
  resendPaymentUpdateController,
  getSubscriptionsController,
  getInvoicesController
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

// Portal access for managing subscription for the customer
router.get('/portal',requireAuth,getCustomerPortal)

// generate and resend portal access utl
router.get('/resend-payment-portal',resendPaymentUpdateController)

/**
 * Admin Routes for the subscription invoices
 */
router.get('/admin/subscriptions',
  requireAuth,
  // requireAuth('admin'),
  getSubscriptionsController
)

router.get('/admin/invoices',
  requireAuth,
  getInvoicesController
)

export default router;
