
import { Job } from 'bullmq';
import { webhookQueue } from '../../../lib/queue'

async function inspectFailed() {
    const failed = await webhookQueue.getFailed();
    console.log('Failed job count:',failed.length);

    for(const job of failed) {
        console.log('Failed Job:',job.id,job.name,job.failedReason);
        // future enhancement : export to sentry / email / Slack
    }
    process.exit(0);
}

inspectFailed().catch(err => { console.error(err); process.exit(1) })