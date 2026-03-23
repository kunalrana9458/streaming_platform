import { Request, Response } from "express";
import * as CustomerService from "./customer.service";

// GET /billing/customers
export async function getCustomers(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const { status, page, pageSize } = req.query;

    const result = await CustomerService.listCustomers(
      {
        status:   status   as string | undefined,
        page:     page     ? Number(page)     : 1,
        pageSize: pageSize ? Number(pageSize) : 10,
      },
      log
    );

    res.json(result);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch customers");
    res.status(500).json({ message: err.message });
  }
}

// GET /billing/customers/:id
export async function getCustomer(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const customer = await CustomerService.getCustomerById(req.params.id, log);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customer);
  } catch (err: any) {
    log.error({ customerId: req.params.id, err: err.message }, "Failed to fetch customer");
    res.status(500).json({ message: err.message });
  }
}