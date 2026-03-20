import mongoose from "mongoose";
import BillingCustomer from "../models/BillingCustomers";

// ─────────────────────────────────────────────
//  GET /billing/customers
//  Aggregation: joins latest subscription + plan per customer
// ─────────────────────────────────────────────
export async function listCustomers({
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
    // ── Join their subscriptions ──────────────
    {
      $lookup: {
        from: "billingsubscriptions",
        localField: "_id",
        foreignField: "customerId",
        as: "subscriptions",
      },
    },

    // ── Pull the most recent subscription ─────
    {
      $addFields: {
        latestSubscription: {
          $arrayElemAt: [
            {
              $sortArray: {
                input: "$subscriptions",
                sortBy: { createdAt: -1 },
              },
            },
            0,
          ],
        },
      },
    },

    // ── Join Plan for that subscription ───────
    {
      $lookup: {
        from: "plans",
        localField: "latestSubscription.planId",
        foreignField: "_id",
        as: "latestSubscription.planId",
      },
    },
    {
      $unwind: {
        path: "$latestSubscription.planId",
        preserveNullAndEmpty: true,
      },
    },

    // ── Count their invoices in same pipeline ─
    {
      $lookup: {
        from: "billinginvoices",
        localField: "_id",
        foreignField: "customerId",
        as: "invoices",
      },
    },
    {
      $addFields: {
        totalInvoices: { $size: "$invoices" },
        totalPaid: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: "$invoices",
                  as: "inv",
                  cond: { $eq: ["$$inv.status", "paid"] },
                },
              },
              as: "inv",
              in: "$$inv.amountPaid",
            },
          },
        },
      },
    },

    // ── Drop raw arrays — keep only summaries ─
    { $unset: ["invoices", "subscriptions"] },
  ];

  // ── Filter by customer status ─────────────
  if (status && status !== "all") {
    pipeline.push({ $match: { status } });
  }

  pipeline.push({ $sort: { createdAt: -1 } });

  // ── Paginate + count ──────────────────────
  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, { $limit: pageSize }],
      total: [{ $count: "count" }],
    },
  });

  const [result] = await BillingCustomer.aggregate(pipeline);

  return {
    data: result?.data ?? [],
    total: result?.total?.[0]?.count ?? 0,
    page,
    pageSize,
  };
}

// ─────────────────────────────────────────────
//  GET /billing/customers/:id
// ─────────────────────────────────────────────
export async function getCustomerById(id: string) {
  const [customer] = await BillingCustomer.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: "billingsubscriptions",
        localField: "_id",
        foreignField: "customerId",
        as: "subscriptions",
      },
    },
    {
      $lookup: {
        from: "billinginvoices",
        localField: "_id",
        foreignField: "customerId",
        as: "invoices",
        pipeline: [{ $sort: { createdAt: -1 } }, { $limit: 10 }],
      },
    },
  ]);

  return customer ?? null;
}