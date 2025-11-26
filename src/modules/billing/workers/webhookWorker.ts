import { Worker, Job } from "bullmq";
import {
  connection,
  WEBHOOK_QUEUE_NAME,
} from "../../../lib/queue";
import stripe from "../../../lib/stripe";
import { connectDB, disconnectDB } from "../../../lib/db";
import WebhookEvent from "../models/WebhookEvent";
import Stripe from 'stripe'
import BillingCustomers from "../models/BillingCustomers";
import Plan from "../models/Plan";
import BillingSubscription from "../models/BillingSubscription";
import BillingInvoice from "../models/BillingInvoice";


async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {

    const stripeCustomerId = session.customer as string | undefined;
    const stripeSubscriptionId = session.subscription as string | undefined;

    // ensure the billing customer must be exist
    let bCustomer = stripeCustomerId ? await BillingCustomers.findOne({ stripeCustomerId }) : null;

    if(!bCustomer) {
        const email = session.customer_details?.email || session.customer_email;
        bCustomer = await BillingCustomers.create({
            email: email || 'unknown',
            stripeCustomerId: stripeCustomerId || 'unknown',
            status: 'inactive'
        })
    }

    if(stripeSubscriptionId) {
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId,{ expand: ['items.data.price'] }) as any;

        console.log("Stripe Subscription Object is:",stripeSub);

        const price = stripeSub.items.data[0].price;

        let plan = await Plan.findOne({ priceId: price.id });

        if(!plan) {
            plan = await Plan.create({  
                priceId: price.id,
                name: price.nickname || (price.product && price.product.name) || 'unknown',
                amount: price.unit_amount,
                currency: price.currency,
                interval: price.recurring?.interval 
            })
        }

        // IMPORTANT: RELY ON INVOICE.PAYMENT_SUCCEEDED FOR ACCESS DATES.
        // This event handles ALL subscription renewals, while checkout.session.completed  
        // only handles the initial purchase. Update access_expires_at here.

        await BillingSubscription.updateOne(
            { stripeSubscriptionId: stripeSub.id },
            {
                $set: {
                    customerId: bCustomer._id,
                    stripeSubscriptionId: stripeSub.id,
                    planId: plan._id,
                    status: stripeSub.status, 
                    currentPeriodStart: stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000) : undefined,
                    currentPeriodEnd: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000) : undefined
                }
            },
            { upsert: true }
        );
    }
}

async function handleInvoicePaymentSucceeded(inv: any) {

    console.log("INVOICE DETAILS ARE:",inv)

    const stripeInvoiceId = inv.id;
    const stripeSubscriptionId = inv.subscription;  // inv.parent.subscription_details.subscription

    const localSub = await BillingSubscription.findOne({ stripeSubscriptionId }); 
    const customerId = localSub?.customerId || null;

    await BillingInvoice.updateOne(
        { stripeInvoiceId },
        {
            $set: {
                stripeInvoiceId,
                customerId,
                subscriptionId: localSub?._id || null,
                amountDue: inv.amount_due,
                amountPaid: inv.amount_paid,
                status: inv.status,
                hostedInvoiceUrl: inv.hosted_invoice_url || '',
            }
        },
        { upsert: true }
    );

    if(localSub) {
        await BillingSubscription.updateOne({ _id: localSub._id},{ status: 'active'});
        if(customerId) await BillingCustomers.updateOne({ _id: customerId},{ status: 'active'})
    }
}

async function handleInvoicePaymentFailed(inv: any) {
    const stripeSubscriptionId = inv.subscription;
    const localSub = await BillingSubscription.findOne({ stripeSubscriptionId });

    if(localSub) {
        await BillingSubscription.updateOne({ _id: localSub._id },{ status: 'past_due' });
        if(localSub.customerId) await BillingCustomers.updateOne({_id: localSub.customerId},{ status: 'past_due'})
    }
}

async function handleSubscriptionUpdatedOrDeleted(sub: any) {
    await BillingSubscription.updateOne(
        { stripeSubscriptionId: sub.id },
        {
            $set: {
                status: sub.status,
                currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start*1000) : undefined,
                currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : undefined
            }
        }
    )
}


async function processJob(job: Job) {
    const { eventId,type,payload } = job.data

    // check job is previously processed
    const alreadyProcessed = await WebhookEvent.findOne({ stripeEventId:eventId,processed:true })

    if(alreadyProcessed) {
        console.log('Event is already processed',eventId);
        return;
    }

    try {

        switch(type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(payload as Stripe.Checkout.Session)
                break;

            case 'invoice.payment_succeeded':
                await handleInvoicePaymentSucceeded(payload as any)
                break;
                
            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(payload as any)
                break;

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                await handleSubscriptionUpdatedOrDeleted(payload as any)
            
            default:
                console.log('Unhandled stripe Event Type :',type)
        }
    } catch (error) {
        
    }
}

async function start() {
  // connect to the Database
  connectDB();

  // create the worker for webhook processing
  const worker = new Worker(
    WEBHOOK_QUEUE_NAME,
    async (job: Job) => {
      try {
        console.log(`[worker] started job ${job.id} of type ${job.name}`);
        await processJob(job);
      } catch (error) {
        console.error(`[worker] error processing job ${job.id}:`, error);
        throw error;
      }
    },
    { connection }
  );
}

start().catch((err) => {
  console.error("[worker] failed to start:", err);
  process.exit(1);
});
