import mongoose from 'mongoose';
import stripe from '../../lib/stripe';
import User,{IUser} from '../auth/auth.model'
import BillingCustomers,{IBillingCustomer} from './models/BillingCustomers';
import Plan,{IPlan} from './models/Plan';

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