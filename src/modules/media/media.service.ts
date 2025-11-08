
import {Client} from 'minio'
import fs from 'fs'
import path from 'path'
import Media from './media.model'
import dotenv from 'dotenv'

dotenv.config()



const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER || "admin",
  secretKey: process.env.MINIO_ROOT_PASSWORD || "admin123",
});


const bucket = "videos"

export async function uploadToMinio(file: Express.Multer.File,titleId:string){

    await ensureBucketExists(bucket)

    const storageKey = `${Date.now()}-${file.originalname}`
    const filePath = path.resolve(file.path)

    await minioClient.fPutObject(bucket,storageKey,filePath)
    const fileUrl = `${process.env.MINIO_PUBLIC_URL || "http://localhost:9000"}/${bucket}/${storageKey}`

    const media = await Media.create({
      titleId,
      originalName: file.originalname,
      storageKey,
      url: fileUrl,
      type: file.mimetype,
      size: file.size,
      status: 'uploaded'
    })

    fs.unlinkSync(filePath)
    return media
    
}

async function ensureBucketExists(bucket:string) {
    const exists = await minioClient.bucketExists(bucket).catch(() => false)
    if(!exists) {
      await minioClient.makeBucket(bucket, 'us-east-1')
    }
}