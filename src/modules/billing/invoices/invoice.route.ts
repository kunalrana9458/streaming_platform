import { Router } from "express";
import * as InvoiceController from "./invoices.controller";

const router = Router();

router.get   ("/",           InvoiceController.getInvoices);
router.get   ("/:id",        InvoiceController.getInvoice);
router.patch ("/:id/status", InvoiceController.patchInvoiceStatus);
router.post  ("/:id/remind", InvoiceController.remindInvoice);
router.post  ("/:id/void",   InvoiceController.voidInvoice);

export default router;
