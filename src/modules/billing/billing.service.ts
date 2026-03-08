import mongoose, { Document, Mongoose } from "mongoose";
import stripe from "../../lib/stripe";
import User, { IUser } from "../auth/auth.model";
import BillingCustomers, { IBillingCustomer } from "./models/BillingCustomers";
import Plan, { IPlan } from "./models/Plan";
import BillingSubscription from "./models/BillingSubscription";
import BillingInvoice from "./models/BillingInvoice";
import { resendOTPHandler } from "../auth/auth-controller";
import { emailQueue,webhookQueue } from "../../lib/queue";
import WebhookEvent from "./models/WebhookEvent";


export async function createCustomer(authUserId: string,log:any) {
  let userRecord;
  log.info({userId:authUserId},'Customer creation for Stripe Service Called');
  if (authUserId) userRecord = await User.findById(authUserId);
  const email = userRecord?.email;
  const linkUserId = authUserId;

  if (!email) throw new Error("EMAIL_NOT_FOUND");

  // check if locally billing customer exists in the DB
  let local = await BillingCustomers.findOne({ email });
  if (local){
    log.info(
      { userId: authUserId, stripeCustomerId: local.stripeCustomerId },
      'Billing Customer already exists'
    )
  };

  // create stripe customer if customer locally not present
  log.info(
    { userId: authUserId},
    'Creating customer in stripe'
  )
  const stripeCustomer = await stripe.customers.create({
    email,
    metadata: { userId: linkUserId || "unknown" },
  });

  // console.log("STRIPE_CUTSOMER_", stripeCustomer);
  log.info({
    userId: authUserId,
    stripeCustomerId: stripeCustomer.id
  },
    `Stripe Customer Created`)

  local = await BillingCustomers.create({
    userId: linkUserId,
    email,
    stripeCustomerId: stripeCustomer.id,
    status: "inactive",
  });

  log.info({
    userId: authUserId,
    stripeCustomerId: stripeCustomer.id
  },
  'Billing Customer Saved in DB')
  return local;
}

export async function createCheckoutSession(params: {
  priceId: string;
  stripeCustomerId: string;
  successUrl: string;
  cancelUrl: string;
}, log:any) {
  const { priceId, stripeCustomerId, successUrl, cancelUrl } = params;

  if (!priceId) {
    log.error({ stripeCustomerId },'PriceID of Stripe is required for Checkout session creation')
    throw new Error("PRICEID_REQUIRED")
  };

  log.info({ stripeCustomerId,priceId },'Stripe Checkout Session creation API Called');
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer: stripeCustomerId ? stripeCustomerId : undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  log.info({ stripeCustomerId,priceId,
             checkoutSessionId: session.id
   },'Stripe Checkout Session created')

  return { url: session.url, id: session.id };
}

export async function seedPlan(priceId: string,log:any) {

  log.info({priceId},'Stripe API Called For Plan retrieval');
  const price = (await stripe.prices.retrieve(priceId, {
    expand: ["product"],
  })) as any;
  console.log(price);
  if (!price) {
    log.error({priceId},'Plan Not Found in Stripe');
    throw new Error('STRIPE_PLAN_NOT_FOUND');
  }

  const existing = await Plan.findOne({ priceId });
  if (existing){
    log.warn({priceId},'Plan Already Seeded');
    return existing;
  };

  log.info({priceId},'Plan Seeding in DB started')
  const plan = await Plan.create({
    priceId,
    name: price.nickname || (price.product && price.product.name) || "unknown",
    amount: price.currency,
    currency: price.currency,
    interval: price.recurring?.interval,
  });
  log.info({priceId},'Plan seeding is Successfull')
  return plan;
}


export async function billingStatus(userId: string,log:any) {
  if (!userId){
     log.error({userId},'User Not Authenticated`');
     throw new Error("NOT_AUTHENTICATED");
  }
  const user = await User.findById(userId).select("_id email");

  if (!user){
    log.warn({userId},'User Not Found')
    throw new Error("USER_NOT_FOUND")
  };

  const billingCustomer = await BillingCustomers.findOne({ userId: user._id });
  if (!billingCustomer) {
    log.info({userId},'User Not Found in Billing Customer')
    return { hasSubscription: false }
  };

  const sub = await BillingSubscription.findOne({
    customerId: billingCustomer._id,
  });
  if (!sub) {
    log.info({userId},'User not have any Subscription');
    return { hasSubscription: false };
  }

  const now = new Date();
  const active = sub.status === "active";

  log.info(
    {userId, subscriptionStatus: sub.status},
    'Billing Status Fetched Successfully'
  )
  return {
    hasSubscription: active,
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
  };
}

export async function getPortal(userId: string) {
  const user = await User.findById(userId).select("_id email");

  if (!user) throw new Error("USER_NOT_FOUND");

  // Find billing customer by Id
  const userObjectId = new mongoose.Types.ObjectId(userId);
  let billingCustomer = await BillingCustomers.findOne({
    userId: userObjectId,
  });

  // validate for the billing customer if not exist then create a new one
  if (!billingCustomer) {
    const email = user.email;
    const stripeCustomer = await stripe.customers.create({
      email: email,
    });

    billingCustomer = await BillingCustomers.create({
      userId: userId,
      email: email,
      stripeCustomerId: stripeCustomer.id,
      status: "inactive",
    });
  }

  // create Billing Portal Session
  const returnUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const session = await stripe.billingPortal.sessions.create({
    customer: billingCustomer.stripeCustomerId,
    return_url: `${returnUrl}/account/billing`,
  });

  return session.url;
}

export async function resendPaymentUpdate(userId: string) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const billingCustomer = await BillingCustomers.findOne({
    userId: userObjectId,
  });

  if (!billingCustomer) throw new Error("Billing Customer Not found");

  // create a billing portal session using the stripe
  const returnUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: billingCustomer.stripeCustomerId,
    return_url: `${returnUrl}/account/billing`,
  });

  // Enqueue email JOB
  await emailQueue.add("payment_update", {
    type: "payment_update_link",
    to: billingCustomer.email,
    name: billingCustomer.email,
    portalUrl: session.url,
  });

  return { ok: true, portalUrl: session.url };
}

export async function getSubscriptions(params: {
  page: number;
  limit: number;
  status: any;
  email: any;
}) {
  const { page, limit, status, email } = params;
  const filter: any = {};

  if (status) filter.status = status;

  // if email providedd then first that in the BillingCustomer Model
  if (email) {
    const customers = await BillingCustomers.find({
      email: { $regex: `${email}`, $options: "i" },
    }).select("_id");
    const ids = customers.map((c) => c._id);
    filter.customerId = { $in: ids };
  }

  const total = await BillingSubscription.countDocuments(filter);
  const subs = await BillingSubscription.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("customerId", "email stripeCustomerId")
    .populate("planId", "priceId name amount interval");

  return { total, subs };
}

export async function getInvoices(params: {
  page: number;
  limit: number;
  userId: any;
  email: any;
}) {
  const { page, limit, userId, email } = params;
  const filter: any = {};

  if (userId) filter.customerId = new mongoose.Types.ObjectId(userId);

  if (email) {
    const customers = await BillingCustomers.find({
      email: { $regex: `^{email}`, $options: "i" },
    });
    const ids = customers.map((c) => c._id);
    filter.customerId = { $in: ids };
  }

  const total = await BillingInvoice.countDocuments(filter);
  const invoices = await BillingInvoice.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("customerId", "email stripeCustomerId");

    return { total,invoices }
}

export async function getWebhooks(params: {page:number,limit:number,processedFilter:any}){

    const { page,limit,processedFilter } = params
    const filter: any = {};

    if(processedFilter === 'true') filter.processed = true;
    if(processedFilter === 'false') filter.processed = false;

    const total = await WebhookEvent.countDocuments(filter);
    const events = await WebhookEvent.find(filter)
            .sort({ receivedAt: -1,createdAt: -1 })
            .skip((page-1)*limit)
            .limit(limit)

    return { total,events }
}

export async function replayWebhook(eventId: string) {
  if(!eventId) throw new Error('EVENT_ID_REQUIRED');

  const webEvent = await WebhookEvent.findOne({ stripeEventId: eventId });
  if(!webEvent) throw new Error('WEBHOOK_EVENT_NOT_FOUND');

  await webhookQueue.add(`replay-${eventId}`,{
    eventId: webEvent.stripeEventId,
    type: webEvent.type,
    payload: webEvent.payload
  },{removeOnComplete: true})

  return {ok:true,message:'Webhook Replay enqueued'}
}