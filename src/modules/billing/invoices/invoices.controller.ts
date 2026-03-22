import { Request, Response } from "express";
import * as InvoiceService from "./invoice.service";

// GET /billing/invoices
export async function getInvoices(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const { status, search, page, pageSize } = req.query;

    const result = await InvoiceService.listInvoices(
      {
        status:   status   as string | undefined,
        search:   search   as string | undefined,
        page:     page     ? Number(page)     : 1,
        pageSize: pageSize ? Number(pageSize) : 8,
      },
      log
    );

    res.json(result);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch invoices");
    res.status(500).json({ message: err.message });
  }
}

// GET /billing/invoices/:id
export async function getInvoice(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const invoice = await InvoiceService.getInvoiceById(req.params.id, log);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json(invoice);
  } catch (err: any) {
    log.error({ invoiceId: req.params.id, err: err.message }, "Failed to fetch invoice");
    res.status(500).json({ message: err.message });
  }
}

// PATCH /billing/invoices/:id/status
export async function patchInvoiceStatus(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const { status } = req.body;

    if (!status) {
      log.warn({ invoiceId: req.params.id }, "Status field missing in request body");
      return res.status(400).json({ message: "status is required" });
    }

    const invoice = await InvoiceService.updateInvoiceStatus(
      req.params.id,
      status,
      log
    );

    res.json(invoice);
  } catch (err: any) {
    if (err.message === "INVOICE_NOT_FOUND") {
      return res.status(404).json({ message: "Invoice not found" });
    }
    log.error({ invoiceId: req.params.id, err: err.message }, "Failed to update invoice status");
    res.status(500).json({ message: err.message });
  }
}

// POST /billing/invoices/:id/remind
export async function remindInvoice(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const result = await InvoiceService.sendInvoiceReminder(req.params.id, log);
    res.json(result);
  } catch (err: any) {
    if (err.message === "INVOICE_NOT_FOUND") {
      return res.status(404).json({ message: "Invoice not found" });
    }
    if (err.message === "INVOICE_NOT_OPEN") {
      return res.status(400).json({ message: "Reminders can only be sent for open invoices" });
    }
    log.error({ invoiceId: req.params.id, err: err.message }, "Failed to send invoice reminder");
    res.status(500).json({ message: err.message });
  }
}

// POST /billing/invoices/:id/void
export async function voidInvoice(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const invoice = await InvoiceService.voidInvoice(req.params.id, log);
    res.json(invoice);
  } catch (err: any) {
    if (err.message === "INVOICE_NOT_FOUND") {
      return res.status(404).json({ message: "Invoice not found" });
    }
    if (err.message === "INVOICE_NOT_VOIDABLE") {
      return res.status(400).json({ message: "Only open or draft invoices can be voided" });
    }
    log.error({ invoiceId: req.params.id, err: err.message }, "Failed to void invoice");
    res.status(500).json({ message: err.message });
  }
}