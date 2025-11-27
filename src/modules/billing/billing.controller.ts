
import express, {Request,Response} from 'express'
import { z } from 'zod'
import { 
    createCustomer,
    createCheckoutSession,
    seedPlan,
    billingStatus,
    getPortal,
    resendPaymentUpdate
 } from './billing.service'
import { tryCatch } from 'bullmq';

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