/**
 * Reconciliation script:
 * - Fetch live subscriptions from Stripe
 * - Compare with local BillingSubscription collection (MongoDB)
 * - Log/make report for mismatches
 */
import { connectDB, disconnectDB } from '../../lib/db'
import stripe from '../../lib/stripe'
import BillingSubscription from './models/BillingSubscription'
import BillingCustomers from './models/BillingCustomers'

// Helper function to introduce a controlled delay (throttle)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    try {
        // Connect to the database
        await connectDB();
        console.log('Connected to DB for reconciliation');

        const mismatches: any[] = [];
        // Use a Set to store all IDs fetched from Stripe for efficient lookup in Phase 2
        const stripeIdSet = new Set<string>();

        console.log('--- Phase 1: Checking Stripe (Source of Truth) -> Local Consistency ---');
        
        let hasMore = true;
        let startAfter: string | undefined;
        let batchCount = 0;

        // 1. Iterate through Stripe subscriptions - paginated
        while(hasMore) {
            // Add a small throttle delay between batches to mitigate rate limits
            if (batchCount > 0) {
                console.log('Throttling... waiting 500ms before next Stripe batch.');
                await sleep(500);
            }

            const res = await stripe.subscriptions.list({ 
                limit: 100, 
                starting_after: startAfter,
                status: 'all' 
            });

            for(const s of res.data) {
                // Store the ID for the efficient check in Phase 2
                stripeIdSet.add(s.id); 
                
                // Find local record
                const local = await BillingSubscription.findOne({ stripeSubscriptionId: s.id });
                
                // Check A: Stripe subscription is missing locally
                if(!local) {
                    mismatches.push({ type: 'missing_local_subscription', stripeId: s.id, stripeStatus: s.status });
                    continue ;
                }
                
                // Compare the status (FIXED BUG HERE)
                const stripeStatus = s.status;
                const localStatus = local.status; 

                // Check B: Status mismatch
                if(stripeStatus !== localStatus) {
                    mismatches.push({
                        type: 'status_mismatch', 
                        stripeId: s.id, 
                        stripeStatus,
                        localStatus
                    });
                }
                // You can add checks for current_period_end, amount, etc., here
            }

            hasMore = res.has_more;
            if(hasMore) startAfter = res.data[res.data.length -1].id
            batchCount++;
            console.log(`Processed Stripe batch #${batchCount}. Total unique Stripe IDs collected: ${stripeIdSet.size}`);
        }

        // ---

        console.log('\n--- Phase 2: Checking Local -> Stripe Consistency (Optimized) ---');
        // 2. Check local subscriptions that Stripe no longer knows about
        // Fetch only local subscriptions in a non-terminal state for an effective check
        const localSubs = await BillingSubscription.find({ 
            status: { $in: ['active', 'trialing', 'past_due', 'incomplete'] } 
        });

        for(const local of localSubs) {
            // Check C: Local subscription is missing on Stripe
            // This is O(1) complexity because we check against the Set collected in Phase 1
            if(!stripeIdSet.has(local.stripeSubscriptionId)) {
                mismatches.push({
                    type: 'missing_stripe_subscription',
                    localId: local._id, 
                    stripeId: local.stripeSubscriptionId,
                    localStatus: local.status
                });
            }
        }
        
        // ---

        console.log('\n--- Reconciliation Report ---');
        console.log(`Total mismatches found: ${mismatches.length}`);
        console.log(JSON.stringify(mismatches,null,2));

        // ---

        console.log('\n--- Phase 3: Attempting Automated Fixes ---');
        let autoFixedCount = 0;
        // Attempt automated fix for trivial mismatch (eg. local.status != stripe.status)
        for (const m of mismatches) {
            if (m.type === 'status_mismatch') {
                // Fetch the subscription one more time to get the latest details
                // This is the only place we make extra retrieve calls, only for mismatches
                const s = await stripe.subscriptions.retrieve(m.stripeId) as any;
                
                await BillingSubscription.updateOne({ stripeSubscriptionId: m.stripeId }, {
                    $set: {
                        status: s.status,
                        currentPeriodStart: s.current_period_start ? new Date(s.current_period_start * 1000) : undefined,
                        currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000) : undefined
                    }
                });
                console.log('Auto-fixed status for', m.stripeId, `(${m.localStatus} -> ${s.status})`);
                autoFixedCount++;
            }
        }
        console.log(`Successfully auto-fixed ${autoFixedCount} status mismatches.`);

    } catch (err) {
        console.error('An error occurred during reconciliation:', err);
        process.exit(1);
    } finally {
        await disconnectDB();
        console.log('Reconciliation finished and DB disconnected');
    }
}

main().catch(err => { console.error('Unhandled error:', err); process.exit(1) });