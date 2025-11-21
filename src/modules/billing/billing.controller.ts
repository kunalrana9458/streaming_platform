
import express, {Request,Response} from 'express'
import { z } from 'zod'
import { 
    createCustomer,
    createCheckoutSession,
    seedPlan
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