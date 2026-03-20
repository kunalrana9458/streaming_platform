import { Request, Response } from "express";
import * as CustomerService from "../customers/customer.service";

// GET /billing/customers
export async function getCustomers(req: Request, res: Response) {
  try {
    const { status, page, pageSize } = req.query;

    const result = await CustomerService.listCustomers({
      status:   status   as string | undefined,
      page:     page     ? Number(page)     : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// GET /billing/customers/:id
export async function getCustomer(req: Request, res: Response) {
  try {
    const customer = await CustomerService.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}