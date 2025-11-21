import { Router } from "express";
import {
  createCustomerController
} from "./billing.controller";
import { requireAuth, requireRole } from "../../middleware/authMiddleware";

const router = Router();

// customer creation post api
router.post('/create-customer',requireAuth,createCustomerController)

export default router;
