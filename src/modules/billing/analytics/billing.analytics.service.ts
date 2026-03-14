import BillingSubscription from "../models/BillingSubscription";

export class BillingAnalyticsService {
    public async getSummaryStats() {
        return await BillingSubscription.aggregate([
            {
                $facet: {
                    // Task-1: calculate total active users & MRR
                    "activeStats": [
                        { $match: { status: 'active' } },
                        {
                            $lookup: {
                                from: "plans",
                                localField: "planId",
                                foreignField: "_id",
                                as: "plan"
                            }
                        },
                        { $unwind: "$plam" },
                        {
                            $group: {
                                _id: null,
                                count: { $sum: 1 },
                                mrr: { $sum: "$plan.price" }
                            }
                        }
                    ],
                    // Task 2 : count users scheduled to cancel
                    "churningCount": [
                        { $match: { status: "active", cancelAtPeriodEnd: true } },
                        { $count: "count" }
                    ],
                    // Task 3 : count total canceled users
                    "totalCanceled": [
                        { $match: { status: "canceled" } },
                        { $count: "count" }
                    ]
                }
            },
            {
                // clean up the ouput so it's not a messy nested array
                $project: {
                    activeUsers: { $arrayEleAt: ["$activeStats.count",0] },
                    mrr: { $arrayEleAt: ["$activeStats.mrr",0] },
                    churningUsers: { $arrayEleAt: ["$churningCount.count",0] },
                    canceledTotal: { $arrayEleAt: ["$totalCanceled.count",0] }
                }
            }
        ])
    }
}