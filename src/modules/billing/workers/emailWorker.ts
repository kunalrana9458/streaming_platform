import { Worker, Job } from 'bullmq';
import dotenv from 'dotenv'
import transporter from '../../../lib/email.config';
import { EMAIL_QUEUE_NAME,connection } from '../../../lib/queue'
import paymentFailed from '../templates/payment.failed';
import paymentSucceed from '../templates/payment.succeed';
import paymentUpdate from '../templates/payment.update';

dotenv.config()

type EmailPayload = {
    type: 'payment_failed' | 'payment_succeeded' | 'payment_update_link';
    to: string;
    name?: string ;
    amount_due?: number;
    currency?: string;
    portalUrl?: string;
    extra?: Record<string,any>
}

const worker = new Worker(EMAIL_QUEUE_NAME,async (job:Job<EmailPayload>) => {
    const payload = job.data;
    let subject = 'Notification from Streamsphere';
    let html = '';

    switch(payload.type) {
        case 'payment_failed':
            subject = 'Payment Failed - Please update your payment method';
            html = paymentFailed(payload.name || 'Customer',
                                 payload.amount_due ? (payload.amount_due/100).toFixed(2): '',
                                 (payload.currency || '') ,
                                 payload.portalUrl || '');
            break;
        
        case 'payment_succeeded':
            subject = 'Payment Received - thank you!';
            html = paymentSucceed(payload.name || 'Customer',
                                  payload.amount_due ? (payload.amount_due/100).toFixed(2): '',
                                  (payload.currency || ''));
            break ;

        case 'payment_update_link':
            subject = 'Update your payment method';
            html = paymentUpdate(payload.name || 'Customer',payload.portalUrl || '');
            break ;
        
        default:
            throw new Error('Unknown email job type:' + (payload as any).type)
    }

    // send the mail to the customer
    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: payload.to,
        subject,
        html
    });

    return { sent: true };
}, { connection });



worker.on('completed',job => {
    console.log('Email Job Completed',job.id,job.name)
});

worker.on('failed',(job,err) => {
    console.error('Email Job failed',job?.id,err?.message);
})


console.log('Email worker started')