
import { Job } from 'bullmq';
import { webhookQueue } from '../../../lib/queue'
import logger from '../../../observability/logger';


async function inspectFailed() {
    const failedJobs = await webhookQueue.getFailed();
    
    logger.info({count: failedJobs.length},"Inspecting failed webhook jobs");

    for(const job of failedJobs) {
        
        const {eventId,type} = job.data || {};

        // montitor the failed jobs of webhook queue
        logger.error(
            {
                jobId: job.id,
                name: job.name,
                attemptsMade: job.attemptsMade,
                failedReason: job.failedReason,
                eventId,
                type
            },
            'Webhook job failed permanently'
        );      
    }
    process.exit(0);
}

inspectFailed().catch((err) => {
    logger.error({error: err.message},'Failed job inspector crashed');
    process.exit(1);
})