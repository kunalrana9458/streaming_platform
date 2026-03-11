
import { Request,Response } from 'express'
import stripe from '../../../lib/stripe'
import { BillingWebhookService } from './billing_webhook.service'
import Stripe from 'stripe'

const service = new BillingWebhookService(stripe)



/**
 * Controller Recieves the raw body -> Verifies signature -> Constructs Stripe.Event -> Delegates to BillingWebhookService
 * 
 */

export async function webhookHandler(req:Request,res:Response) {
    const sig = req.headers['stripe-signature'] as string | undefined
    let event: Stripe.Event

    try {
        req.log.info('Constructing Web Hook Event');
        event = stripe.webhooks.constructEvent(req.body as Buffer,sig as string,process.env.STRIPE_WEBHOOK_SECRET as string);

    } catch (err: any) {
        req.log.info('Verification of Webhook Signature failed');
        return res.status(400).send(`Webhook Error: ${err?.message}`)
    }

    try {
        req.log.info('Billing Webhook Service Called');
        const result = await service.handleEvent(event,req.log);
        if(!result.ok) {
            // Logging error but return 200/ack to avoid infinite retries depending on your strategy
            // In production we may return 500 for transient errors to allow stripe retry
            req.log.error({error: result.message},'Webhook processed with error:');
            return res.status(200).json({received: true,ok: false,message: result.message})
        }
        return res.json({received: true})
    } catch (err: any) {
        req.log.error({err},'Webhook Controller error');
        // To avoid retry storms you may acknowledge, but it's better to return 500 for transient errors.
        return res.status(200).json({received:true});
    }
}