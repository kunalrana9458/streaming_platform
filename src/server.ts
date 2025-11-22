import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { initSentry } from './observability/sentry'
import logger from './observability/logger'
import { getMetrics } from './observability/metrics'
import authRoutes from './modules/auth/auth.routes'
import catalogRoutes from './modules/catalog/catalog.routes'
import mediaRoutes from './modules/media/media.routes'
import billingRoutes from './modules/billing/billing.route'
import billingWebhookRoute from './modules/billing/webhook/billing_webhook.routes'
import { health,ready } from './observability/health'

dotenv.config()

initSentry()
const app = express()
app.use(cors())

app.use('/billing',billingWebhookRoute)

app.use(express.json())


// Mongo connect
mongoose
     .connect(process.env.MONGO_URL as string)
     .then(() => console.log("MongoDB Connected"))
     .catch((e) => {
      console.error('Mongo connection error:',e)
      process.exit(1)
     })

// request logging middleware (minimal)
app.use((req,res,next) => {
  logger.info({req:{method:req.method,url:req.url,headers:req.headers}},'http_request')
  next()
})

app.get('/health',health)
app.get('/ready',ready)

// metrics endpoint
app.get('/metrics',async(req,res) => {
  try {
    res.set('Content-Type','text/plain; version=0.0.4')
    res.send(await getMetrics())
  } catch (error) {
    res.status(500).send('error')
  }
})

app.get('/', (_req, res) => { res.send('StreamSphere backend running !')})



app.use('/auth',authRoutes)
app.use('/catalog',catalogRoutes)
app.use('/media',mediaRoutes)
app.use('/billing',billingRoutes)

const PORT = process.env.PORT || 5000   

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

