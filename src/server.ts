import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import authRoutes from './modules/auth/auth.routes'
import catalogRoutes from './modules/catalog/catalog.routes'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())


// Mongo connect
mongoose
     .connect(process.env.MONGO_URL as string)
     .then(() => console.log("MongoDB Connected"))
     .catch((e) => {
      console.error('Mongo connection error:',e)
      process.exit(1)
     })

app.get('/', (_req, res) => { res.send('StreamSphere backend running !')})
app.use('/auth',authRoutes)
app.use('/catalog',catalogRoutes)

const PORT = process.env.PORT || 5000   

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

