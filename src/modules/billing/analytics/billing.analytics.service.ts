import BillingSubscription from "../models/BillingSubscription";
import moment from "moment";

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
                        { $unwind: "$plan" },
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
                    activeUsers: { $arrayElemAt: ["$activeStats.count",0] },
                    mrr: { $arrayElemAt: ["$activeStats.mrr",0] },
                    churningUsers: { $arrayElemAt: ["$churningCount.count",0] },
                    canceledTotal: { $arrayElemAt: ["$totalCanceled.count",0] }
                }
            }
        ])
    }

    public async getDailyTrends(days: number=30) {
        // calculate the cutoff date
        const startDate = moment().subtract(days,'days').startOf('day').toDate();

        return await BillingSubscription.aggregate([
            {
                // 1. filter: only get records from the last X days
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $project: {
                    day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    status: 1
                }
            },
            {
                // 3. Group: Count how many per day
                $group: {
                    _id: "$day",
                    count: { $sum: 1 }
                }
            },
            {
                // 4. Sort: Make sure the chart goes from oldest to newest
                $sort: { _id: 1 }
            }
        ]);
    }
}