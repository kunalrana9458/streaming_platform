import { Worker, Job, tryCatch } from "bullmq";
import {
  connection,
  emailQueue,
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
import logger from "../../../observability/logger";




async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session,eventId: string) {

   

    logger.info({stripeCustomerId: session.customer,
                 stripeSubscriptionId: session.subscription,
                 eventId},
                'Checkout Session Completed Function Called')

    const stripeCustomerId = session.customer as string | undefined;
    const stripeSubscriptionId = session.subscription as string | undefined;

    const longContext = {
        eventId,
        stripeCustomerId,
        stripeSubscriptionId
    }

    // ensure the billing customer must be exist
    logger.info(longContext,
                'checkout.session.completed event received');

    logger.info(longContext,'Checking Billing customer in DB');

    let bCustomer = stripeCustomerId ? await BillingCustomers.findOne({ stripeCustomerId }) : null;

    if(!bCustomer) {
        const email = session.customer_details?.email || session.customer_email;
        logger.info({longContext,email},
                    'Billing Customer not Found, creating new customer'
        );

        bCustomer = await BillingCustomers.create({
            email: email || 'unknown',
            stripeCustomerId: stripeCustomerId || 'unknown',
            status: 'inactive'
        });

        logger.info(
            {longContext,billingCustomerId: bCustomer._id},
            'Billing customer created'
        );
    }

    if(stripeSubscriptionId) {

        logger.info(longContext,'Fetching stripe subscription');
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId,{ expand: ['items.data.price'] }) as any;

        const price = stripeSub.items.data[0].price;

        let plan = await Plan.findOne({ priceId: price.id });

        if(!plan) {

            logger.info(
                {...longContext,priceId: price.id},
                'Plan not Found, creating new plan'
            );

            plan = await Plan.create({  
                priceId: price.id,
                name: price.nickname || (price.product && price.product.name) || 'unknown',
                amount: price.unit_amount,
                currency: price.currency,
                interval: price.recurring?.interval 
            });

            logger.info(
                { ...longContext,planId: plan._id },
                'Plan created'
            );
        }

        // IMPORTANT: RELY ON INVOICE.PAYMENT_SUCCEEDED FOR ACCESS DATES.
        // This event handles ALL subscription renewals, while checkout.session.completed  
        // only handles the initial purchase. Update access_expires_at here.

        logger.info(
            { ...longContext, planId: plan._id },
            "Updating billing subscription"
        );

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

        logger.info(
            {...longContext, subscriptionId: stripeSub.id},
            'Billing subscription updated successfully'
        )
    }
}

async function handleInvoicePaymentSucceeded(inv: any,eventId: string) {

    
    const stripeInvoiceId = inv.id;
    const stripeSubscriptionId = inv.subscription;  // inv.parent.subscription_details.subscription

    const logContext = {
        eventId,
        stripeInvoiceId,
        stripeSubscriptionId
    }
    logger.info(logContext,'invoice.payment_succeeded event received');

    try {

        logger.info(
            {...logContext},
            'Fetching local subscription'
        )

        const localSub = await BillingSubscription.findOne({ stripeSubscriptionId }); 
        const customerId = localSub?.customerId || null;

        logger.info(
            { ...logContext,customerId },
            'Subscription lookup completed'
        );

        const billingCustomer = customerId ? await BillingCustomers.findById(customerId) : null;

        if(billingCustomer) {

            logger.info(
                {...logContext,email: billingCustomer.email},
                'Adding payment success email job to queue'
            )

            await emailQueue.add('payment_succeeded',{
                type: 'payment_succeeded',
                to: billingCustomer.email,
                name: billingCustomer.email,
                amount_due: inv.amount_paid,
                currency: inv.currency || 'INR',
                invoice_id: inv.id
            })

            logger.info(
                { ...logContext, email: billingCustomer.email },
                "Payment success email job queued"
            );
        }

        logger.info(logContext,'Upserting billing Invoice');

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

        logger.info(logContext,'Billing invoice stored successfully');
        

        if(localSub) {

            logger.info(
                {...logContext,subscriptionId: localSub?._id},
                'Updating subscription status to active'
            );

            await BillingSubscription.updateOne({ _id: localSub._id},{ status: 'active'});

            if (customerId) {

                logger.info(
                { ...logContext, customerId },
                "Updating billing customer status to active"
                );

                await BillingCustomers.updateOne(
                { _id: customerId },
                { status: "active" }
                );
            }
        }

        logger.info(logContext,"invoice.payment_succeeded processing completed");
    } catch (error: any) {
        logger.error(
            {
                ...logContext,
                error: error.message,
                stack: error.stack
            },
            'Failed processing invoice.payment_succeeded event'
        );
        throw error;
    }
}

async function handleInvoicePaymentFailed(inv: any,eventId: string) {
    const stripeSubscriptionId = inv.subscription;
    const localSub = await BillingSubscription.findOne({ stripeSubscriptionId });
    const customerId = localSub?.customerId || null;
    const billingCustomer = customerId ? await BillingCustomers.findById(customerId) : null;

    const logContext = {
        customerId,
        stripeSubscriptionId
    };

    logger.info(logContext,'invoice.payment_failed event received');

    if(billingCustomer) {
        // create the billing portal session to send with the email
        logger.info(logContext,'Billing Portal Creation and send via email');
        const session = await stripe.billingPortal.sessions.create({
            customer: billingCustomer.stripeCustomerId,
            return_url: `${process.env.FRONTEND_URL}/account/billing`
        })

        logger.info(logContext,'Adding Payment Failed Job to the Queue');
        await emailQueue.add('payment_failed', {
            type: 'payment_failed',
            to: billingCustomer.email,
            name: billingCustomer.email,
            amount_due: inv.amount_due,
            currency: inv.currency || 'INR',
            invoiceId: inv.id,
            portalUrl: session.url
        })

    }

    if(localSub) {
        logger.info(logContext,'Update the Status in Billing Subscription');
        await BillingSubscription.updateOne({ _id: localSub._id },{ status: 'past_due' });
        if(localSub.customerId) await BillingCustomers.updateOne({_id: localSub.customerId},{ status: 'past_due'})
    }
}

async function handleSubscriptionUpdatedOrDeleted(sub: any) {
    try {
        logger.info({subscriptionId:sub.id},
                    'customer.subscription.updated or .deleted event received');

        logger.info({subscriptionId:sub.id},'Update the Subscription Status in DB');
        await BillingSubscription.updateOne(
            { stripeSubscriptionId: sub.id },
            {
                $set: {
                    status: sub.status,
                    currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start*1000) : undefined,
                    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : undefined
                }
            }
        );
    } catch (error) {
        logger.error({subscriptionId:sub.id},'Updation or Deletion of Subscrption Failed');
        throw error;
    }
}


async function processJob(job: Job) {
    const { eventId,type,payload } = job.data;

    // check job is previously processed
    logger.info({eventId,type},'Check is Webhook event already processed');
    const alreadyProcessed = await WebhookEvent.findOne({ stripeEventId:eventId,processed:true })

    if(alreadyProcessed) {
        logger.info({eventId,type},'Webhook Event is already Processed');
        return;
    }

    try {

        switch(type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(payload as Stripe.Checkout.Session,eventId)
                break;

            case 'invoice.payment_succeeded':
                await handleInvoicePaymentSucceeded(payload as any,eventId)
                break;
                
            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(payload as any,eventId)
                break;

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                await handleSubscriptionUpdatedOrDeleted(payload as any)
            
            default:
                logger.warn({
                    stripeEventId: eventId
                },'Unhandled Stripe event type');
        }


        // Mark webhook event as processed
        await WebhookEvent.updateOne(
            { stripeEventId: eventId },
            {processed: true}
        );

        logger.info({stripeEventId: eventId},'Webhook event marked as processed');
    } catch (error: any) {

        logger.error(
            {stripeEventId: eventId},
            'Webhook processing Failed'
        );

        throw error;
    }
}

async function start() {
  // connect to the Database
  connectDB();

  // create the worker for webhook processing
  const worker = new Worker(
    WEBHOOK_QUEUE_NAME,
    async (job: Job) => {
      const { eventId,type } = job.data;
      try {

        logger.info({jobId:job.id,jobName:job.name,eventId,type},
                    'Webhook worker started processing job');
        await processJob(job);

        logger.info(
            { jobId: job.id, eventId, type },
            "Webhook worker completed job"
        )
      } catch (error: any) {

        logger.error(
            {
                jobId: job.id,
                eventId,
                type,
                error: error.message
            }
        );

        throw error;
      }
    },
    { connection }
  );
}

start().catch((err) => {
  console.error("[worker] failed to start:", err);
  logger.error({err},'Worker failed to start')
  process.exit(1);
});
