import mongoose from "mongoose";
import BillingCustomer from "../models/BillingCustomers";

// ─────────────────────────────────────────────
//  GET /billing/customers
// ─────────────────────────────────────────────
export async function listCustomers(
  params: {
    status?: string;
    page?: number;
    pageSize?: number;
  },
  log: any
) {
  const { status, page = 1, pageSize = 10 } = params;
  const skip = (page - 1) * pageSize;

  log.info({ status, page, pageSize }, "Customer list fetch started");

  const pipeline: mongoose.PipelineStage[] = [
    // join all subscriptions for this customer
    {
      $lookup: {
        from: "billingsubscriptions",
        localField: "_id",
        foreignField: "customerId",
        as: "subscriptions",
      },
    },
    // pull only the most recent subscription
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
    // join plan for that subscription
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
    // join invoices and compute totals inline
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
    // drop raw arrays — keep only computed summaries
    { $unset: ["invoices", "subscriptions"] },
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

  const [result] = await BillingCustomer.aggregate(pipeline);

  const total = result?.total?.[0]?.count ?? 0;
  const data  = result?.data ?? [];

  log.info(
    { status, page, pageSize, total, returned: data.length },
    "Customer list fetched successfully"
  );

  return { data, total, page, pageSize };
}

// ─────────────────────────────────────────────
//  GET /billing/customers/:id
// ─────────────────────────────────────────────
export async function getCustomerById(id: string, log: any) {
  log.info({ customerId: id }, "Customer detail fetch started");

  const [customer] = await BillingCustomer.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    {
      $lookup: {
        from: "billingsubscriptions",
        localField: "_id",
        foreignField: "customerId",
        as: "subscriptions",
        pipeline: [
          {
            $lookup: {
              from: "plans",
              localField: "planId",
              foreignField: "_id",
              as: "planId",
            },
          },
          { $unwind: { path: "$planId", preserveNullAndEmpty: true } },
          { $sort: { createdAt: -1 } },
        ],
      },
    },
    {
      $lookup: {
        from: "billinginvoices",
        localField: "_id",
        foreignField: "customerId",
        as: "invoices",
        pipeline: [
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
        ],
      },
    },
  ]);

  if (!customer) {
    log.warn({ customerId: id }, "Customer not found");
    return null;
  }

  log.info(
    {
      customerId: id,
      stripeCustomerId: customer.stripeCustomerId,
      subscriptionCount: customer.subscriptions?.length ?? 0,
    },
    "Customer detail fetched successfully"
  );

  return customer;
}