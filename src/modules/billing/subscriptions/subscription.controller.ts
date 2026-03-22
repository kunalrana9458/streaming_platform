import { Request, Response } from "express";
import * as SubService from "./subscription.service";

// GET /billing/subscriptions
export async function getSubscriptions(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const { status, page, pageSize } = req.query;

    const result = await SubService.listSubscriptions(
      {
        status:   status   as string | undefined,
        page:     page     ? Number(page)     : 1,
        pageSize: pageSize ? Number(pageSize) : 10,
      },
      log
    );

    res.json(result);
  } catch (err: any) {
    log.error({ err: err.message }, "Failed to fetch subscriptions");
    res.status(500).json({ message: err.message });
  }
}

// GET /billing/subscriptions/:id
export async function getSubscription(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const sub = await SubService.getSubscriptionById(req.params.id, log);

    if (!sub) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    res.json(sub);
  } catch (err: any) {
    log.error({ subscriptionId: req.params.id, err: err.message }, "Failed to fetch subscription");
    res.status(500).json({ message: err.message });
  }
}

// PATCH /billing/subscriptions/:id/cancel
export async function cancelSubscription(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const sub = await SubService.cancelSubscription(req.params.id, log);
    res.json(sub);
  } catch (err: any) {
    if (err.message === "SUBSCRIPTION_NOT_FOUND") {
      return res.status(404).json({ message: "Subscription not found" });
    }
    if (err.message === "SUBSCRIPTION_ALREADY_CANCELED") {
      return res.status(400).json({ message: "Subscription is already canceled" });
    }
    log.error({ subscriptionId: req.params.id, err: err.message }, "Failed to cancel subscription");
    res.status(500).json({ message: err.message });
  }
}

// PATCH /billing/subscriptions/:id/reactivate
export async function reactivateSubscription(req: Request, res: Response) {
  const log = (req as any).log;
  try {
    const sub = await SubService.reactivateSubscription(req.params.id, log);
    res.json(sub);
  } catch (err: any) {
    if (err.message === "SUBSCRIPTION_NOT_FOUND") {
      return res.status(404).json({ message: "Subscription not found" });
    }
    if (err.message === "SUBSCRIPTION_NOT_CANCELING") {
      return res.status(400).json({ message: "Subscription is not pending cancellation" });
    }
    log.error({ subscriptionId: req.params.id, err: err.message }, "Failed to reactivate subscription");
    res.status(500).json({ message: err.message });
  }
}