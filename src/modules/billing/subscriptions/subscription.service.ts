import mongoose from "mongoose";
import BillingSubscription from "../models/BillingSubscription";

// ─────────────────────────────────────────────
//  GET /billing/subscriptions
//  Aggregation: joins customer + plan in one query
// ─────────────────────────────────────────────
export async function listSubscriptions({
  status,
  page = 1,
  pageSize = 10,
}: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const skip = (page - 1) * pageSize;

  const pipeline: mongoose.PipelineStage[] = [
    // ── Join BillingCustomer ──────────────────
    {
      $lookup: {
        from: "billingcustomers",
        localField: "customerId",
        foreignField: "_id",
        as: "customerId",
      },
    },
    { $unwind: { path: "$customerId", preserveNullAndEmpty: true } },

    // ── Join Plan ─────────────────────────────
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

  // ── Filter ────────────────────────────────
  if (status && status !== "all") {
    pipeline.push({ $match: { status } });
  }

  pipeline.push({ $sort: { createdAt: -1 } });

  // ── Paginate + count in one shot ──────────
  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, { $limit: pageSize }],
      total: [{ $count: "count" }],
    },
  });

  const [result] = await BillingSubscription.aggregate(pipeline);

  return {
    data: result?.data ?? [],
    total: result?.total?.[0]?.count ?? 0,
    page,
    pageSize,
  };
}

// ─────────────────────────────────────────────
//  GET /billing/subscriptions/:id
// ─────────────────────────────────────────────
export async function getSubscriptionById(id: string) {
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

  return sub ?? null;
}

// ─────────────────────────────────────────────
//  PATCH /billing/subscriptions/:id/cancel
//  Sets cancelAtPeriodEnd = true (Stripe-style soft cancel)
// ─────────────────────────────────────────────
export async function cancelSubscription(id: string) {
  const sub = await BillingSubscription.findById(id);
  if (!sub) throw new Error("Subscription not found");
  if (sub.status === "canceled") throw new Error("Already canceled");

  // TODO: also call stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true })
  sub.cancelAtPeriodEnd = true;
  await sub.save();

  return sub;
}

// ─────────────────────────────────────────────
//  PATCH /billing/subscriptions/:id/reactivate
//  Reverses a soft cancel
// ─────────────────────────────────────────────
export async function reactivateSubscription(id: string) {
  const sub = await BillingSubscription.findById(id);
  if (!sub) throw new Error("Subscription not found");
  if (!sub.cancelAtPeriodEnd && sub.status !== "canceled") {
    throw new Error("Subscription is not pending cancellation");
  }

  // TODO: also call stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false })
  sub.cancelAtPeriodEnd = false;
  if (sub.status === "canceled") sub.status = "active";
  await sub.save();

  return sub;
}