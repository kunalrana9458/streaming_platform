
import { Request,Response,NextFunction } from 'express'
import mongoose from 'mongoose'
import BillingCustomers from '../modules/billing/models/BillingCustomers'
import BillingSubscription from '../modules/billing/models/BillingSubscription'
import User from '../modules/auth/auth.model'

export default async function requireActiveSubscription(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const userId = (req as any).userId as string | undefined;

        if(!userId) {
            return res.status(401).json({error: 'Not authenticated'})
        }

        // try to find the existing user (extra check safety)
        const user = await User.findById(userId).select('_id email');
        if(!user) return res.status(401).json({ error: 'USER_NOT_FOUND' })

        // Find billing customer linking to this user
        const billingCustomer = await BillingCustomers.findOne({userId: user._id});
        if(!billingCustomer) {
            // No Biling Customer -> not subscribed
            return res.status(402).json({
                error: 'subscription_required',
                message: 'You must have an active subscription to access this content',
                help: 'Create a subscription at /account/subscribe or call /api/billing/create-checkout-session'
            })
        }

        // find any active subscription for this billing customer (most recent)
        const now = new Date();

        const subs = await BillingSubscription.find({
            customerId: billingCustomer._id
        }).sort({createdAt: -1}).limit(5);

        if(!subs || subs.length === 0) {
            return res.status(402).json({
                error: 'SUBSCRIBTION_REQURIED',
                message: 'No subscription found for this account'
            })
        }

        // Decide if any subscription grand access
        const hasAccess = subs.some((sub:any) => {
            if(!sub) return false;
            const status = (sub.status || '').toLowerCase();
            if(status === 'active' || status === 'trialing' || status === 'incomplete') return true;
            if(status === 'canceled' || status === 'unpaid' || status === 'past_due'){
                return sub.currentPeriodEnd.getTime() > now.getTime();
            }
            return false;
        })

        if(!hasAccess) {
            return res.status(402).json({
                error : 'SUBSCRIPTION_REQUIRED',
                message: 'You need an active subscription to access this resource',
                next: {
                    info: 'Create a subscription via the pricing page or call the create-session endpoint',
                    createCheckout: '/api/billing/create-checkout/session'
                }
            })
        }

        (req as any).billing = {
            billingCustomer,
            subsription: subs[0]
        }

        return next()
    } catch (err: any) {
        console.error('requireActiveSubscription error:',err)
        return res.status(500).json({ error: 'INTERNAL_ERROR',message: err.message})
    }
}