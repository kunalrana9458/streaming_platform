import Stripe from 'stripe'
import dotenv from 'dotenv'

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_API_SECRET as string)


export default stripe

