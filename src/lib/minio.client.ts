
import { Client } from 'minio'
import dotenv from 'dotenv'

dotenv.config() 

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost'
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000')
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true'
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'admin'
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'admin123'
export const BUCKET = process.env.MINIO_BUCKET || 'videos'

const minioClient = new Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY
})


// ensure the bucket must exist
export async function ensureBucketExists() {
    const exists = await minioClient.bucketExists(BUCKET)
    if(!exists) {
        await minioClient.makeBucket(BUCKET,'us-east-1')
        console.log(`[minio] created bucket ${BUCKET}`)
    } else {
        console.log(`[minio] bucket ${BUCKET} already exists`)
    }
}

/**
 * creation of presigned URL for uploading object
 */
export async function presignPut(objectName:string,expirySeconds=600):Promise<string> {
    return await minioClient.presignedPutObject(BUCKET,objectName,expirySeconds)    
}



/**
 * create presigned GET url 
 */
export async function presignGet(objectName:string,expirySeconds=600):Promise<string> {
    return await minioClient.presignedGetObject(BUCKET,objectName,expirySeconds)    
}