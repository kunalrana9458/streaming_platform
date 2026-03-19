import { Request, Response } from "express";
import * as SubService from "../services/subscription.service";

// GET /billing/subscriptions
export async function getSubscriptions(req: Request, res: Response) {
  try {
    const { status, page, pageSize } = req.query;

    const result = await SubService.listSubscriptions({
      status:   status   as string | undefined,
      page:     page     ? Number(page)     : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// GET /billing/subscriptions/:id
export async function getSubscription(req: Request, res: Response) {
  try {
    const sub = await SubService.getSubscriptionById(req.params.id);
    if (!sub) return res.status(404).json({ message: "Subscription not found" });
    res.json(sub);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// PATCH /billing/subscriptions/:id/cancel
export async function cancelSubscription(req: Request, res: Response) {
  try {
    const sub = await SubService.cancelSubscription(req.params.id);
    res.json(sub);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// PATCH /billing/subscriptions/:id/reactivate
export async function reactivateSubscription(req: Request, res: Response) {
  try {
    const sub = await SubService.reactivateSubscription(req.params.id);
    res.json(sub);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}