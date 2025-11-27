import mongoose, { Document, Mongoose } from 'mongoose';
import stripe from '../../lib/stripe';
import User,{IUser} from '../auth/auth.model'
import BillingCustomers,{IBillingCustomer} from './models/BillingCustomers';
import Plan,{IPlan} from './models/Plan';
import BillingSubscription from './models/BillingSubscription';
import { resendOTPHandler } from '../auth/auth-controller';
import { emailQueue } from '../../lib/queue';

export async function createCustomer(authUserId:string) {
    
    let userRecord;
    console.log("AUTH USER ID:",authUserId)
    if(authUserId) userRecord = await User.findById(authUserId)
    console.log('USER_RECORD_IS:',userRecord)
    const email = (userRecord?.email)
    const linkUserId = authUserId 

    if(!email) throw new Error('EMAIL_NOT_FOUND')

    // check if locally billing customer exists in the DB
    let local = await BillingCustomers.findOne({email})
    if(local) return local

    // create stripe customer if customer locally not present
    const stripeCustomer = await stripe.customers.create({
        email,
        metadata: {userId: linkUserId || 'unknown'}
    });

    console.log("STRIPE_CUTSOMER_",stripeCustomer)

    local = await BillingCustomers.create({
        userId: linkUserId,
        email,
        stripeCustomerId: stripeCustomer.id,
        status: 'inactive'
    })
    return local;
}


export async function createCheckoutSession(params:{priceId:string,stripeCustomerId:string,successUrl:string,cancelUrl:string}) {
    const { priceId,stripeCustomerId,successUrl,cancelUrl } = params

    if(!priceId) throw new Error('PRICEID_REQUIRED')
    
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{price: priceId,quantity: 1}],
        customer: stripeCustomerId ? stripeCustomerId : undefined,
        success_url: successUrl,
        cancel_url: cancelUrl
    })

    return {url:session.url,id:session.id}
}


export async function seedPlan(priceId:string) {
    if(!priceId) throw new Error('PRICEID_REQUIRED');

    const price = await stripe.prices.retrieve(priceId,{expand: ['product']}) as any
    console.log(price)
    if(!price) throw new Error('PRICE_NOT_FOUND')

    const existing = await Plan.findOne({ priceId })
    if(existing) return existing

    const plan = await Plan.create({
        priceId,
        name: price.nickname || (price.product && price.product.name) || 'unknown',
        amount: price.currency,
        currency: price.currency,
        interval: price.recurring?.interval,
    })

    return plan
}


export async function billingStatus(userId:string) {
    if(!userId) throw new Error('NOT_AUTHENTICATED')
    const user = await User.findById(userId).select('_id email') ;

    if(!user) throw new Error('USER_NOT_FOUND');

    const billingCustomer = await BillingCustomers.findOne({ userId: user._id })
    if(!billingCustomer) return { hasSubscription: false };

    const sub = await BillingSubscription.findOne({ customerId: billingCustomer._id })
    if(!sub) return { hasSubscription: false }

    const now = new Date();
    const active = sub.status;

    return {
        hasSubscription: !!active,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd
    }
}

export async function getPortal(userId: string){
    const user = await User.findById(userId).select('_id email');

    if(!user) throw new Error('USER_NOT_FOUND');

    // Find billing customer by Id
    const userObjectId = new mongoose.Types.ObjectId(userId);
    let billingCustomer = await BillingCustomers.findOne({ userId: userObjectId });

    // validate for the billing customer if not exist then create a new one
    if(!billingCustomer){
        const email = user.email;
        const stripeCustomer = await stripe.customers.create({
            email: email,
        });

        billingCustomer = await BillingCustomers.create({
            userId: userId,
            email: email,
            stripeCustomerId: stripeCustomer.id,
            status: 'inactive'
        });
    }

    // create Billing Portal Session
    const returnUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
        customer: billingCustomer.stripeCustomerId,
        return_url: `${returnUrl}/account/billing`
    })

    return session.url;
}

export async function resendPaymentUpdate(userId: string){
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const billingCustomer = await BillingCustomers.findOne({ userId: userObjectId });

    if(!billingCustomer) throw new Error('Billing Customer Not found');

    // create a billing portal session using the stripe
    const returnUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
        customer: billingCustomer.stripeCustomerId,
        return_url: `${returnUrl}/account/billing`
    })

    // Enqueue email JOB
    await emailQueue.add('payment_update', {
        type: 'payment_update_link',
        to: billingCustomer.email,
        name: billingCustomer.email,
        portalUrl: session.url
    })

    return {ok:true,portalUrl: session.url}
}