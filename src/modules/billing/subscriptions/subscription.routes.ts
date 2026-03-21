import { Router } from "express";
import * as SubController from "./subscription.controller";

const router = Router();

router.get   ("/",                SubController.getSubscriptions);
router.get   ("/:id",             SubController.getSubscription);
router.patch ("/:id/cancel",      SubController.cancelSubscription);
router.patch ("/:id/reactivate",  SubController.reactivateSubscription);

export default router;