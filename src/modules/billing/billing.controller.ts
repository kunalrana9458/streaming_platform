
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
    replayWebhook
 } from './billing.service'
import { tryCatch } from 'bullmq';
import mongoose from 'mongoose';
import BillingInvoice from './models/BillingInvoice';

export async function createCustomerController(req:any,res:Response) {
    try {
        const authUserId = (req as any).user.id as string | undefined;    
        const customer = await createCustomer(authUserId as string)

        return res.status(201).json({message:'Customer Created',customer})
    } catch (error:any) {
        return res
               .status(400)
               .json({error:{code:'CUST_BILLING_CREATION_ERR',message:error.message}})
    }
}

export async function createCheckoutSessionController(req:any,res:Response) {
    try {
        const { priceId,stripeCustomerId,successUrl,cancelUrl } = req.body

        if(!priceId || !stripeCustomerId || !successUrl || !cancelUrl) {
            return res.status(400).json({
                message: 'ALL_FIELDS_REQUIRED'
            })
        }

        const {url,id} = await createCheckoutSession(req.body)
        return res.status(200).json({
            url,
            id
        })
    } catch (err:any) {
        console.error('create-checkout-session err',err);
        return res.status(500).json({ error:err.message })
    }
}


export async function seedPlanController(req:any,res:Response) {
    try {
        const { priceId } = req.body
        console.log("PRICE_ID_IS:",typeof priceId)
        const plan = await seedPlan(priceId);
        return res.status(200).json({
            message: "Plan Seeded Successfully",
            plan
        })
    } catch (err:any) {
        console.error('seed-plan err:',err)
        return res.status(500).json({ error:err.message })
    }
}

export async function billingStatusController(req: Request,res: Response) {
    try {
        const userId = (req as any).userId as string
        const status = await billingStatus(userId);
        return res.status(200).json({
            status
        })
    } catch (err: any) {
        console.error('illing Status Error',err);
        return res.status(500).json({ error: err.message })
    }
}

export async function getCustomerPortal(req: Request,res: Response) {
    try {
        const userId = (req as any).user.id as string;

        console.log("USER_ID IS:",userId)

        if(!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }
        
        const result = await getPortal(userId);
        return res.json({url: result});

    } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Failed to create portal session' })
    }
}

export async function resendPaymentUpdateController(req: Request,res: Response) {
    try {
        const userId = (req as any).user.id as string;

        if(!userId) {
            return res.status(404).json({ error: 'USER_ID_REQUIRED' })
        }

        const { ok,portalUrl } = await resendPaymentUpdate(userId)
        return res.json({ok:ok, portalUrl:portalUrl})
    } catch (err:any) {
        return res.status(500).json({ error: err.message })
    }
}

export async function getSubscriptionsController(req: Request,res: Response) {
    try {
        const page = Math.max(1,parseInt(String(req.query.page || '1')));
        const limit = Math.min(200,Math.max(1,parseInt(String(req.query.limit || '5'))));
        const status = req.query.status as string | undefined;
        const email = req.query.email as string | undefined

        console.log("BEFORE GET SUBSCRIPTION SERVICE CALLED")
        const { subs,total } = await getSubscriptions({page,limit,status,email});
        console.log("AFTER GET SUBSCRIPTION SERVICE CALLED")

        return res.json({ page,limit,total,data:subs });

    } catch (err: any) {
        console.error('admin list subscription err',err);
        return res.status(500).json({ error:err.message })
    }
}

export async function getInvoicesController(req: Request,res: Response) {
    try {
        const page = Math.max(1,parseInt(String(req.query.page || '1')));
        const limit = Math.min(200,Math.max(1,parseInt(String(req.query.limit || '5'))));
        const userId = req.query.userId as string | undefined;
        const email = req.query.email as string | undefined;
        
        const { total,invoices } = await getInvoices({page,limit,userId,email})

        return res.json({ page,limit,total,data: invoices});
    } catch (err: any) {
        console.error('admin list invoices err',err);
        return res.status(500).json({ error: err.message })
    }
}

export async function getWebhooksController(req: Request,res: Response) {
    try {
        const page = Math.max(1,parseInt(String(req.query.page || '1')));
        const limit = Math.min(200,Math.max(1,parseInt(String(req.query.limit || '5'))));
        const processedFilter = req.query.processed as string | undefined

        const {total,events} = await getWebhooks({page,limit,processedFilter});
        return res.json({ page,limit,total,data: events })
    } catch (err:any) {
        return res.status(500).json({ error:err.message })
    }
}

export async function replayWebhookController(req: Request,res: Response) {
    try {
        const { eventId } = req.body

        if(!eventId) return res.status(400).json({ error: 'eventId required' });
        const webEvent = await replayWebhook(eventId);

        return res.json({ ok:webEvent.ok, message: webEvent.message})
    } catch (err: any) {
        console.error('admin replay webhook err',err);
        return res.status(500).json({ error:err.message })
    }
}

export async function reprocessSubscription(req: Request,res: Response) {

}