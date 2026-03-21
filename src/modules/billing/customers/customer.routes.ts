import { Router } from "express";
import * as CustomerController from "./customer.controller";

const router = Router();

router.get("/",    CustomerController.getCustomers);
router.get("/:id", CustomerController.getCustomer);

export default router;