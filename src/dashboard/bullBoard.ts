import express from 'express';
import { createBullBoard } from "@bull-board/api"
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express"

// import the queue which have to monitor
import { mediaQueue,webhookQueue,emailQueue } from '../lib/queue';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

// register all queue for monitoring
createBullBoard({
    queues: [
        new BullMQAdapter(mediaQueue),
        new BullMQAdapter(webhookQueue),
        new BullMQAdapter(emailQueue)
    ],
    serverAdapter
});

const app = express();

app.use("/admin/queues",serverAdapter.getRouter());

app.listen(5001,() => {
    console.log("Bull Board running at http://localhost:3000/admin/queues")
})