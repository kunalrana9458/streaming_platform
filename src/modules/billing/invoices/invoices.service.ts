import mongoose from "mongoose";
import BillingInvoice from "../models/BillingInvoice";

// ─────────────────────────────────────────────
//  GET /billing/invoices
//  Aggregation: joins customer + subscription + plan in one query
// ─────────────────────────────────────────────
export async function listInvoices({
  status,
  search,
  page = 1,
  pageSize = 8,
}: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const skip = (page - 1) * pageSize;

  // ── Stage 1: join BillingCustomer ──────────
  const pipeline: mongoose.PipelineStage[] = [
    {
      $lookup: {
        from: "billingcustomers",
        localField: "customerId",
        foreignField: "_id",
        as: "customerId",
      },
    },
    { $unwind: { path: "$customerId", preserveNullAndEmpty: false } },

    // ── Stage 2: join BillingSubscription ─────
    {
      $lookup: {
        from: "billingsubscriptions",
        localField: "subscriptionId",
        foreignField: "_id",
        as: "subscriptionId",
      },
    },
    { $unwind: { path: "$subscriptionId", preserveNullAndEmpty: true } },

    // ── Stage 3: join Plan inside subscription ─
    {
      $lookup: {
        from: "plans",
        localField: "subscriptionId.planId",
        foreignField: "_id",
        as: "subscriptionId.planId",
      },
    },
    {
      $unwind: {
        path: "$subscriptionId.planId",
        preserveNullAndEmpty: true,
      },
    },
  ];

  // ── Stage 4: filter ────────────────────────
  const match: Record<string, unknown> = {};
  if (status && status !== "all") match["status"] = status;
  if (search) {
    // search on customer email
    match["customerId.email"] = { $regex: search, $options: "i" };
  }
  if (Object.keys(match).length) pipeline.push({ $match: match });

  // ── Stage 5: sort newest first ─────────────
  pipeline.push({ $sort: { createdAt: -1 } });

  // ── Stage 6: run count + paginated data in parallel ──
  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, { $limit: pageSize }],
      total: [{ $count: "count" }],
    },
  });

  const [result] = await BillingInvoice.aggregate(pipeline);

  return {
    data: result?.data ?? [],
    total: result?.total?.[0]?.count ?? 0,
    page,
    pageSize,
  };
}

// ─────────────────────────────────────────────
//  GET /billing/invoices/:id
// ─────────────────────────────────────────────
export async function getInvoiceById(id: string) {
  const [invoice] = await BillingInvoice.aggregate([
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
        from: "billingsubscriptions",
        localField: "subscriptionId",
        foreignField: "_id",
        as: "subscriptionId",
      },
    },
    { $unwind: { path: "$subscriptionId", preserveNullAndEmpty: true } },
    {
      $lookup: {
        from: "plans",
        localField: "subscriptionId.planId",
        foreignField: "_id",
        as: "subscriptionId.planId",
      },
    },
    {
      $unwind: {
        path: "$subscriptionId.planId",
        preserveNullAndEmpty: true,
      },
    },
  ]);

  return invoice ?? null;
}

// ─────────────────────────────────────────────
//  PATCH /billing/invoices/:id/status
// ─────────────────────────────────────────────
export async function updateInvoiceStatus(id: string, status: string) {
  const invoice = await BillingInvoice.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  );
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}

// ─────────────────────────────────────────────
//  POST /billing/invoices/:id/remind
//  Plug in your email/Stripe reminder logic here
// ─────────────────────────────────────────────
export async function sendInvoiceReminder(id: string) {
  const invoice = await BillingInvoice.findById(id);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "open") {
    throw new Error("Reminders can only be sent for open invoices");
  }
  // TODO: call Stripe or your mailer here
  // await stripe.invoices.sendInvoice(invoice.stripeInvoiceId)
  return { message: "Reminder sent successfully" };
}

// ─────────────────────────────────────────────
//  POST /billing/invoices/:id/void
// ─────────────────────────────────────────────
export async function voidInvoice(id: string) {
  const invoice = await BillingInvoice.findById(id);
  if (!invoice) throw new Error("Invoice not found");
  if (!["open", "draft"].includes(invoice.status ?? "")) {
    throw new Error("Only open or draft invoices can be voided");
  }
  // TODO: also call stripe.invoices.voidInvoice(invoice.stripeInvoiceId)
  invoice.status = "void";
  await invoice.save();
  return invoice;
}