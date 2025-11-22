import express from 'express'
import { webhookHandler } from './billing_webhook.controller'
import bodyParser from "body-parser";


const router = express.Router()


// Important: Use raw parser for this route only so Stripe signature can be validated.
// When mounting in app, ensure this route is registered after any global JSON middleware if that middleware
// would otherwise consume the body. Using router-level bodyParser.raw ensures the route receives a Buffer.

router.post('/webhook', bodyParser.raw({ type: 'application/json' }), webhookHandler);

export default router