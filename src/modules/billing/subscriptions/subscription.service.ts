import mongoose from "mongoose";
import stripe from "../../lib/stripe";
import BillingSubscription from "../models/BillingSubscription";

// ─────────────────────────────────────────────
//  GET /billing/subscriptions
// ─────────────────────────────────────────────
export async function listSubscriptions(
  params: {
    status?: string;
    page?: number;
    pageSize?: number;
  },
  log: any
) {
  const { status, page = 1, pageSize = 10 } = params;
  const skip = (page - 1) * pageSize;

  log.info({ status, page, pageSize }, "Subscription list fetch started");

  const pipeline: mongoose.PipelineStage[] = [
    {
      $lookup: {
        from: "billingcustomers",
        localField: "customerId",
        foreignField: "_id",
        as: "customerId",
      },
    },
    { $unwind: { path: "$customerId", preserveNullAndEmpty: true } },
    {
      $lookup: {
        from: "plans",
        localField: "planId",
        foreignField: "_id",
        as: "planId",
      },
    },
    { $unwind: { path: "$planId", preserveNullAndEmpty: true } },
  ];

  if (status && status !== "all") {
    pipeline.push({ $match: { status } });
  }

  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, { $limit: pageSize }],
      total: [{ $count: "count" }],
    },
  });

  const [result] = await BillingSubscription.aggregate(pipeline);

  const total = result?.total?.[0]?.count ?? 0;
  const data  = result?.data ?? [];

  log.info(
    { status, page, pageSize, total, returned: data.length },
    "Subscription list fetched successfully"
  );

  return { data, total, page, pageSize };
}

// ─────────────────────────────────────────────
//  GET /billing/subscriptions/:id
// ─────────────────────────────────────────────
export async function getSubscriptionById(id: string, log: any) {
  log.info({ subscriptionId: id }, "Subscription detail fetch started");

  const [sub] = await BillingSubscription.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: "billingcustomers",
        localField: "customerId",
        foreignField: "_id",
        as: "customerId",
      },
    },
    { $unwind: { path: "$customerId", preserveNullAndEmpty: true } },
    {
      $lookup: {
        from: "plans",
        localField: "planId",
        foreignField: "_id",
        as: "planId",
      },
    },
    { $unwind: { path: "$planId", preserveNullAndEmpty: true } },
  ]);

  if (!sub) {
    log.warn({ subscriptionId: id }, "Subscription not found");
    return null;
  }

  log.info(
    { subscriptionId: id, stripeSubscriptionId: sub.stripeSubscriptionId },
    "Subscription detail fetched successfully"
  );

  return sub;
}

// ─────────────────────────────────────────────
//  PATCH /billing/subscriptions/:id/cancel
// ─────────────────────────────────────────────
export async function cancelSubscription(id: string, log: any) {
  log.info({ subscriptionId: id }, "Subscription cancel request started");

  const sub = await BillingSubscription.findById(id);

  if (!sub) {
    log.warn({ subscriptionId: id }, "Subscription not found for cancel");
    throw new Error("SUBSCRIPTION_NOT_FOUND");
  }

  if (sub.status === "canceled") {
    log.warn(
      { subscriptionId: id, stripeSubscriptionId: sub.stripeSubscriptionId },
      "Cancel blocked — subscription already canceled"
    );
    throw new Error("SUBSCRIPTION_ALREADY_CANCELED");
  }

  log.info(
    { subscriptionId: id, stripeSubscriptionId: sub.stripeSubscriptionId },
    "Stripe API called for subscription cancel"
  );

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await BillingSubscription.updateOne(
    { _id: id },
    { $set: { cancelAtPeriodEnd: true } }
  );

  log.info(
    { subscriptionId: id, stripeSubscriptionId: sub.stripeSubscriptionId },
    "Subscription cancel at period end set successfully"
  );

  return { ...sub.toObject(), cancelAtPeriodEnd: true };
}

// ─────────────────────────────────────────────
//  PATCH /billing/subscriptions/:id/reactivate
// ─────────────────────────────────────────────
export async function reactivateSubscription(id: string, log: any) {
  log.info({ subscriptionId: id }, "Subscription reactivate request started");

  const sub = await BillingSubscription.findById(id);

  if (!sub) {
    log.warn({ subscriptionId: id }, "Subscription not found for reactivation");
    throw new Error("SUBSCRIPTION_NOT_FOUND");
  }

  if (!sub.cancelAtPeriodEnd && sub.status !== "canceled") {
    log.warn(
      { subscriptionId: id, status: sub.status, cancelAtPeriodEnd: sub.cancelAtPeriodEnd },
      "Reactivate blocked — subscription is not pending cancellation"
    );
    throw new Error("SUBSCRIPTION_NOT_CANCELING");
  }

  log.info(
    { subscriptionId: id, stripeSubscriptionId: sub.stripeSubscriptionId },
    "Stripe API called for subscription reactivation"
  );

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  sub.cancelAtPeriodEnd = false;
  if (sub.status === "canceled") sub.status = "active";
  await sub.save();

  log.info(
    { subscriptionId: id, stripeSubscriptionId: sub.stripeSubscriptionId },
    "Subscription reactivated successfully"
  );

  return sub;
}