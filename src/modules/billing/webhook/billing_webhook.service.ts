import Stripe from "stripe";
import WebhookEvent from "../models/WebhookEvent";
import BillingCustomers from "../models/BillingCustomers";
import Plan from "../models/Plan";
import BillingSubscription from "../models/BillingSubscription";
import BillingInvoice from "../models/BillingInvoice";
import { webhookQueue } from '../../../lib/queue'

export class BillingWebhookService {
  private stripe: Stripe;

  constructor(stripeInstance: Stripe) {
    this.stripe = stripeInstance;
  }

  /**
   * Main dispatcher for the stripe event
   * events like - ['checkout.sessions.completed'] - for the successfull completion of the event
   */
  public async handleEvent(
    event: Stripe.Event
  ): Promise<{ ok: boolean; message?: string }> {
    // idempotency check  persist raw event for audit -> so the same evevnt is not triggered more than once
    const exists = await WebhookEvent.findOne({ stripeEventId: event.id });
    if (exists) {
      return { ok: true, message: "event already processed" };
    }

    // store raw event for the processing and itially mark as false until whole thing processed
    await WebhookEvent.create({
      stripeEventId: event.id,
      type: event.type,
      payload: event.data.object,
      processed: false,
    });

    // light-weight processes use switch case statement for handling the events
    // try {
    //   const obj = event.data.object as any;

    //   switch (event.type) {
    //     case "checkout.session.completed":
    //       await this.handleCheckoutSessionCompleted(
    //         obj as Stripe.Checkout.Session
    //       );
    //       break;

    //     case "invoice.payment_succeeded":
    //       await this.handleInvoicePaymentSucceeded(obj);
    //       break;

    //     case "invoice.payment_failed":
    //       await this.handleInvoicePaymentFailed(obj);

    //     case "customer.subscription.updated":
    //     case "customer.subscription.deleted":
    //       await this.handleSubscriptionUpdatedOrDeleted(obj);

    //     default:
    //       // unhandled events are fine - we keep them store for manual reviews
    //       console.log("unhandled stripe event type:", event.type);
    //   }

    //   // now mark the event processed on our DB
    //   await WebhookEvent.updateOne(
    //     { stripeEventId: event.id },
    //     { processed: true }
    //   );

    //   return { ok: true };
    // } catch (err: any) {
    //   console.error("billing webhook service error", err);
    //   return { ok: false, message: err.message };
    // }

    try {
      // Enqueue the event for background processing
      await webhookQueue.add(event.type, {
        eventId: event.id,
        type: event.type,
        payload: event.data.object
      })

      // Acknowledge quickly to the stripe
      return { ok:true }
    } catch (err: any) {
      console.error('Error Queuing webhook',err)
      // Still ack so stripe won't retry too fast; worker will handle failures
      return { ok: false, message: err.message }
    }
  }

  // private async handleCheckoutSessionCompleted(
  //   session: Stripe.Checkout.Session
  // ) {
  //   console.log("HANDLE_CHECKOUT_SESSION_COMPLETED_CALLED");

  //   const stripeCustomerId = session.customer as string | undefined;
  //   const stripeSubscriptionId = session.subscription as string | undefined;

  //   // ensure the Billing Customer must be exists
  //   let bCustomer = stripeCustomerId
  //     ? await BillingCustomers.findOne({ stripeCustomerId })
  //     : null;
  //   if (!bCustomer) {
  //     const email =
  //       session.customer_details?.email || session.customer_email || "unknown";
  //     bCustomer = await BillingCustomers.create({
  //       email,
  //       stripeCustomerId: stripeCustomerId || "unknown",
  //       status: "inactive",
  //     });
  //   }

  //   if (!stripeSubscriptionId) return;

  //   // access the full subscription to get price item
  //   const stripeSub = (await this.stripe.subscriptions.retrieve(
  //     stripeSubscriptionId,
  //     {
  //       expand: ["items.data.price"],
  //     }
  //   )) as any;

  //   console.log("STRIPE_SUB_IS:",stripeSub)

  //   // determine the price of the subscription
  //   const price = stripeSub.items?.data?.[0]?.price;

  //   // upsert plan if missing
  //   let plan = await Plan.findOne({ priceId: price.id });
  //   if (!plan) {
  //     plan = await Plan.create({
  //       priceId: price.id,
  //       name:
  //         price.nickname || (price.product && price.product.name) || "unknown",
  //       amount: price.unit_amount,
  //       currency: price.currency,
  //       interval: price.recurring?.interval,
  //     });
  //   }

  //   // upsert of the Subscripition in our DB
  //   await BillingSubscription.updateOne(
  //     { stripeSubscriptionId: stripeSub.id },
  //     {
  //       $set: {
  //         customerId: bCustomer._id,
  //         stripeSubscriptionId: stripeSub.id,
  //         planId: plan._id,
  //         status: stripeSub.status,
  //         currentPeriodStart: stripeSub.current_period_start
  //           ? new Date(stripeSub.current_period_start * 1000)
  //           : undefined,
  //         currentPeriodEnd: stripeSub.current_period_end
  //           ? new Date(stripeSub.current_period_end * 1000)
  //           : undefined,
  //       },
  //     },
  //     { upsert: true }
  //   );
  // }

  // private async handleInvoicePaymentSucceeded(inv: any) {
  //   const stripeInvoiceId = inv.id;
  //   const stripeSubscriptionId = inv.subscription;

  //   const localSub = await BillingSubscription.findOne({
  //     stripeSubscriptionId,
  //   });
  //   const customerId = localSub?.customerId || null;

  //   await BillingInvoice.updateOne(
  //     { stripeInvoiceId },
  //     {
  //       $set: {
  //         stripeInvoiceId,
  //         customerId,
  //         subscriptionId: localSub?._id || null,
  //         amountDue: inv.amount_due,
  //         amountPaid: inv.amount_paid,
  //         status: inv.status,
  //         hostedInvoiceUrl: inv.hosted_invoice_url || "",
  //       },
  //     },
  //     { upsert: true }
  //   );

  //   if (localSub) {
  //     await BillingSubscription.updateOne(
  //       { _id: localSub._id },
  //       { status: "active" }
  //     );
  //     if (customerId)
  //       await BillingCustomers.updateOne(
  //         { _id: customerId },
  //         { status: "active" }
  //       );
  //   }
  // }

  // private async handleInvoicePaymentFailed(inv: any) {
  //   const stripeSubscriptionId = inv.subscription;
  //   const localSub = await BillingSubscription.findOne({ stripeSubscriptionId });

  //   if(localSub) {
  //       await BillingSubscription.updateOne({ _id: localSub._id }, { status: 'past_due'})
  //       if(localSub.customerId) await BillingCustomers.updateOne({_id: localSub.customerId},{ status: 'past_due'});
  //   }
  // }

  // private async handleSubscriptionUpdatedOrDeleted(sub: any) {
  //    await BillingSubscription.updateOne(
  //     { stripeSubscriptionId: sub.id },
  //     {
  //       $set: {
  //         status: sub.status,
  //         currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
  //         currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined
  //       }
  //     }
  //   );
  // }
}
