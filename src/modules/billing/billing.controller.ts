
import express, {Request,Response} from 'express'
import { z } from 'zod'
import { 
    createCustomer,
    createCheckoutSession,
    seedPlan,
    billingStatus,
    getPortal,
    resendPaymentUpdate,
    getSubscriptions,
    getInvoices,
    getWebhooks,
    replayWebhook,
    cancelSubscription
 } from './billing.service'
import { tryCatch } from 'bullmq';
import mongoose from 'mongoose';
import BillingInvoice from './models/BillingInvoice';

export async function createCustomerController(req:any,res:Response) {
    const authUserId = (req as any).user.id as string | undefined;    
    try {
        req.log.info('Creation of Customer Started for Stripe Customer Creation')
        const customer = await createCustomer(authUserId as string,req.log)
        req.log.info('Customer Created Successfully for the Stripe')
        return res.status(201).json({message:'Customer Created',customer})
    } catch (error:any) {
        req.log.error(
            { error , userId: authUserId },
            'Stripe customer creation failed'
        )
        return res
               .status(400)
               .json({error:{code:'CUST_BILLING_CREATION_ERR',message:error.message}})
    }
}

export async function createCheckoutSessionController(req:any,res:Response) {
    const { priceId,stripeCustomerId,successUrl,cancelUrl } = req.body
    try {

        if(!priceId || !stripeCustomerId || !successUrl || !cancelUrl) {
            req.log.error('All Fields required in Checkout session creation')
            return res.status(400).json({
                message: 'ALL_FIELDS_REQUIRED'
            })
        }

        req.log.info({ stripeCustomerId, priceId } ,'Checkout Session creation Service Called')
        const {url,id} = await createCheckoutSession(req.body,req.log)
        return res.status(200).json({
            url,
            id
        })
    } catch (err:any) {
        req.log.error({ stripeCustomerId, priceId, error: err.message },'Stripe Checkout Session creation Failed')
        return res.status(500).json({ error:err.message })
    }
}


export async function seedPlanController(req:any,res:Response) {
    const { priceId } = req.body
    try {
        if(!priceId) {
            req.log.info('PriceID is required');
            throw new Error('PRICEID_NOT_EXIST');
        }
        req.log.info({priceId},'Plan Seeding Service Called');
        const plan = await seedPlan(priceId,req.log);
        return res.status(200).json({
            message: "Plan Seeded Successfully",
            plan
        })
    } catch (err:any) {
        req.log.error({priceId,error: err.message},'Plan Seeding Failed')
        return res.status(500).json({ error:err.message })
    }
}

export async function billingStatusController(req: Request,res: Response) {
    const userId = (req as any).user.id as string
    try {
        req.log.info({userId},'Billing Status Service Called')
        const status = await billingStatus(userId,req.log);
        return res.status(200).json({
            status
        })
    } catch (err: any) {
        req.log.error({userId, error: err.message},'Billing Status Fetching Failed');
        return res.status(500).json({ error: err.message })
    }
}

export async function getCustomerPortal(req: Request,res: Response) {
    const userId = (req as any).user.id as string;
    try {

        if(!userId) {
            req.log.warn({ userId },'Unauthenticated User');
            return res.status(401).json({ error: 'Unauthorized' })
        }
        
        req.log.info({userId},'Billing Portal Service Called');
        const result = await getPortal(userId,req.log);
        return res.json({url: result});

    } catch (err: any) {
        req.log.error({userId},'Billing Portal Url Getting Failed')
        return res.status(500).json({ error: err.message || 'Failed to create portal session' })
    }
}

export async function cancelSubscriptionController(req: Request,res: Response) {
    const { subscriptionId } = req.body;

    if(!subscriptionId) {
        req.log.info({subscriptionId},'Subscription ID is required');
        return res.status(400).json({
            ok: false,
            message: "Subscription ID is required"
        });
    }

    try {
        req.log.info({subscriptionId},'Cancel Subscription Service called');
        const result = await cancelSubscription(subscriptionId,req.log);
    
        return res.status(200).json({
            ok: true,
            message: 'Subscription scheduled for cancellation',
            data: {
                expiresAt: new Date(result?.cancel_at*1000),
                cancelAtPeriodEnd: result.cancel_at_period_end
            }
        });
    } catch (error: any) {
        req.log.error({subscriptionId},'Subscription Cancellation Failed');
        return res.status(500).json({
            ok: false,
            message: error.message
        });
    }
}

export async function resendPaymentUpdateController(req: Request,res: Response) {
    const userId = (req as any).user.id as string;
    try {

        if(!userId) {
            req.log.warn({userId},'Unauthenticated User')
            return res.status(404).json({ error: 'USER_ID_REQUIRED' })
        }

        req.log.info({userId},'Resend Payment Update Service called')
        const { ok,portalUrl } = await resendPaymentUpdate(userId,req.log)
        return res.json({ok:ok, portalUrl:portalUrl});

    } catch (err:any) {
        req.log.error({userId,error:err},'Resend Payment Billing Failed')
        return res.status(500).json({ error: err.message })
    }
}

export async function getSubscriptionsController(req: Request,res: Response) {
    try {
        const page = Math.max(1,parseInt(String(req.query.page || '1')));
        const limit = Math.min(200,Math.max(1,parseInt(String(req.query.limit || '5'))));
        const status = req.query.status as string | undefined;
        const email = req.query.email as string | undefined

        req.log.info('Subscription Fetching Service Called');
        const { subs,total } = await getSubscriptions({page,limit,status,email},req.log);
        console.log("AFTER GET SUBSCRIPTION SERVICE CALLED")

        return res.json({ page,limit,total,data:subs });

    } catch (err: any) {
        req.log.error({error:err},'Subscription Fetching Failed');
        return res.status(500).json({ error:err.message })
    }
}

export async function getInvoicesController(req: Request,res: Response) {
    try {
        const page = Math.max(1,parseInt(String(req.query.page || '1')));
        const limit = Math.min(200,Math.max(1,parseInt(String(req.query.limit || '5'))));
        const userId = req.query.userId as string | undefined;
        const email = req.query.email as string | undefined;
        
        req.log.info('Invoice Fetching Service Called');
        const { total,invoices } = await getInvoices({page,limit,userId,email},req.log)

        return res.json({ page,limit,total,data: invoices});
    } catch (err: any) {
        req.log.error({error: err},'Invoice Fetching Failed');
        return res.status(500).json({ error: err.message });
    }
}

export async function getWebhooksController(req: Request,res: Response) {
    try {
        const page = Math.max(1,parseInt(String(req.query.page || '1')));
        const limit = Math.min(200,Math.max(1,parseInt(String(req.query.limit || '5'))));
        const processedFilter = req.query.processed as string | undefined

        req.log.info('Webhooks Fetching Service Called');
        const {total,events} = await getWebhooks({page,limit,processedFilter},req.log);
        return res.json({ page,limit,total,data: events })
    } catch (err:any) {
        req.log.error({error:err},'Webhook Fetching Failed');
        return res.status(500).json({ error:err.message })
    }
}

export async function replayWebhookController(req: Request,res: Response) {
    const { eventId } = req.body
    try {

        if(!eventId) {
            req.log.warn({eventId},'EventID not Found');
            return res.status(400).json({ error: 'eventId required' });
        }

        req.log.info({eventId},'Replay Webhook Service Called');
        const webEvent = await replayWebhook(eventId,req.log);

        return res.json({ ok:webEvent.ok, message: webEvent.message})
    } catch (err: any) {
        req.log.error({eventId},'Replay Webhook Failed');
        return res.status(500).json({ error:err.message })
    }
}

export async function reprocessSubscription(req: Request,res: Response) {

}