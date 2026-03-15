import { Request,Response } from "express"
import { BillingAnalyticsService } from "./billing.analytics.service"

const analyticsService = new BillingAnalyticsService();

export const getBillingSummmary = async (req:Request,res:Response) => {
    try {
        const stats = await analyticsService.getSummaryStats();

        // stats[0] because aggregation return an array
        const data = stats[0] || { activeUsers: 0, mrr: 0, churningUsers: 0, canceledTotal: 0 };

        return res.status(200).json({
            ok: true,
            message: "Billing summary fetched successfully",
            data: {
                totalActiveSubscription: data.activeUsers || 0,
                monthlyRecurringRevenue: data.mrr || 0,
                usersPendingCancellation: data.churningUsers || 0,
                totalLostCustomers: data.cancelTotal || 0
            }
        })
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message })
    }
}

export const getBillingTrends = async (req: Request, res: Response) {
    try {
        // Get 'days' from query params, default to 30
        const days = parseInt(req.query.days as string) || 30;
        const trends = await analyticsService.getDailyTrends(days);

        return res.status(200).json({
            ok: true,
            message: `Daily subscription trends for the last ${days} days fetched`,
            data: trends
        })
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
}