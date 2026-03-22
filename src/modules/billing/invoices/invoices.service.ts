import mongoose from "mongoose";
import BillingInvoice from "../models/BillingInvoice";

// ─────────────────────────────────────────────
//  GET /billing/invoices
// ─────────────────────────────────────────────
export async function listInvoices(
  params: {
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  },
  log: any
) {
  const { status, search, page = 1, pageSize = 8 } = params;
  const skip = (page - 1) * pageSize;

  log.info({ status, search, page, pageSize }, "Invoice list fetch started");

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
  ];

  const match: Record<string, unknown> = {};
  if (status && status !== "all") match["status"] = status;
  if (search) match["customerId.email"] = { $regex: search, $options: "i" };
  if (Object.keys(match).length) pipeline.push({ $match: match });

  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, { $limit: pageSize }],
      total: [{ $count: "count" }],
    },
  });

  const [result] = await BillingInvoice.aggregate(pipeline);

  const total = result?.total?.[0]?.count ?? 0;
  const data  = result?.data ?? [];

  log.info(
    { status, search, page, pageSize, total, returned: data.length },
    "Invoice list fetched successfully"
  );

  return { data, total, page, pageSize };
}

// ─────────────────────────────────────────────
//  GET /billing/invoices/:id
// ─────────────────────────────────────────────
export async function getInvoiceById(id: string, log: any) {
  log.info({ invoiceId: id }, "Invoice detail fetch started");

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

  if (!invoice) {
    log.warn({ invoiceId: id }, "Invoice not found");
    return null;
  }

  log.info(
    { invoiceId: id, stripeInvoiceId: invoice.stripeInvoiceId },
    "Invoice detail fetched successfully"
  );

  return invoice;
}

// ─────────────────────────────────────────────
//  PATCH /billing/invoices/:id/status
// ─────────────────────────────────────────────
export async function updateInvoiceStatus(
  id: string,
  status: string,
  log: any
) {
  log.info({ invoiceId: id, newStatus: status }, "Invoice status update started");

  const invoice = await BillingInvoice.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  );

  if (!invoice) {
    log.warn({ invoiceId: id }, "Invoice not found for status update");
    throw new Error("INVOICE_NOT_FOUND");
  }

  log.info(
    { invoiceId: id, stripeInvoiceId: invoice.stripeInvoiceId, status },
    "Invoice status updated successfully"
  );

  return invoice;
}

// ─────────────────────────────────────────────
//  POST /billing/invoices/:id/remind
// ─────────────────────────────────────────────
export async function sendInvoiceReminder(id: string, log: any) {
  log.info({ invoiceId: id }, "Invoice reminder request started");

  const invoice = await BillingInvoice.findById(id);

  if (!invoice) {
    log.warn({ invoiceId: id }, "Invoice not found for reminder");
    throw new Error("INVOICE_NOT_FOUND");
  }

  if (invoice.status !== "open") {
    log.warn(
      { invoiceId: id, status: invoice.status },
      "Reminder blocked — invoice is not open"
    );
    throw new Error("INVOICE_NOT_OPEN");
  }

  // TODO: await stripe.invoices.sendInvoice(invoice.stripeInvoiceId)
  // TODO: or enqueue email via emailQueue

  log.info(
    { invoiceId: id, stripeInvoiceId: invoice.stripeInvoiceId },
    "Invoice reminder sent successfully"
  );

  return { message: "Reminder sent successfully" };
}

// ─────────────────────────────────────────────
//  POST /billing/invoices/:id/void
// ─────────────────────────────────────────────
export async function voidInvoice(id: string, log: any) {
  log.info({ invoiceId: id }, "Invoice void request started");

  const invoice = await BillingInvoice.findById(id);

  if (!invoice) {
    log.warn({ invoiceId: id }, "Invoice not found for void");
    throw new Error("INVOICE_NOT_FOUND");
  }

  if (!["open", "draft"].includes(invoice.status ?? "")) {
    log.warn(
      { invoiceId: id, status: invoice.status },
      "Void blocked — invoice is not open or draft"
    );
    throw new Error("INVOICE_NOT_VOIDABLE");
  }

  // TODO: await stripe.invoices.voidInvoice(invoice.stripeInvoiceId)

  invoice.status = "void";
  await invoice.save();

  log.info(
    { invoiceId: id, stripeInvoiceId: invoice.stripeInvoiceId },
    "Invoice voided successfully"
  );

  return invoice;
}