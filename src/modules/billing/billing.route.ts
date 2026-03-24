import { Router } from "express";
import {
  createCustomerController,
  createCheckoutSessionController,
  seedPlanController,
  billingStatusController,
  getCustomerPortal,
  resendPaymentUpdateController,
  getSubscriptionsController,
  getInvoicesController,
  getWebhooksController,
  replayWebhookController,
  reprocessSubscription,
  cancelSubscriptionController
} from "./billing.controller";
import { requireAuth, requireRole } from "../../middleware/authMiddleware";
import invoiceRoutes from "./invoices/invoice.route";
import subscriptionRoutes from "./subscriptions/subscription.routes";
import customerRoutes from "./customers/customer.routes";

const router = Router();

// customer creation post api
router.post('/create-customer',requireAuth,createCustomerController)

// create checkout session route
router.post('/create-checkout-session',createCheckoutSessionController)

// seed the plan in the Plan model
router.post('/seed-plan',seedPlanController)

// used to get the status
router.get('/status',requireAuth,billingStatusController)

// Portal access for managing subscription for the customer
router.get('/portal',requireAuth,getCustomerPortal)

// generate and resend portal access utl
router.get('/resend-payment-portal',resendPaymentUpdateController)

// route to cancel the subscription plan
router.post('/cancel-subscription',requireAuth,cancelSubscriptionController)

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

router.get('/admin/webhooks',
  requireAuth,
  getWebhooksController
)

router.post('/admin/replay-webhook',
  requireAuth,
  requireRole('admin'),
  replayWebhookController
)

router.post('/reprocess-subscription',
  requireAuth,
  requireRole('admin'),
  reprocessSubscription
)

router.use("/invoices",invoiceRoutes);
router.use("/subscriptions",subscriptionRoutes);
router.use("/customers",customerRoutes)

export default router;
