import os from 'os'
import fs from 'fs'
import path from 'path'
import { Client } from 'minio'
import dotenv from 'dotenv'
import {pipeline} from 'stream'
import {promisify} from 'util'

dotenv.config() 

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost'
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000')
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true'
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'admin'
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'admin123'
export const BUCKET = process.env.MINIO_BUCKET || 'videos'

export const minioClient = new Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY
})

const pipe = promisify(pipeline)


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


/** Download an object from MINIO to a temp file and return the file path */
export async function downloadObjectToTemp(objectKey:string): Promise<string> {
    const tmpDir = path.join(os.tmpdir(),'streamsphere')
    await fs.promises.mkdir(tmpDir,{recursive:true})

    // create a safe file name derived from the object key
    const safeName = objectKey.replace(/[^\w.-]/g,'_')
    const tmpPath = path.join(tmpDir,safeName)

    const readStream = await minioClient.getObject(BUCKET,objectKey)
    await pipe(readStream,fs.createWriteStream(tmpPath))
    return tmpPath
}


function guessContentType(file:string) {
    const ext = path.extname(file).toLowerCase()
    if(ext === '.m3u8') return 'application/vnd.apple.mpegurl';
    if(ext === '.ts') return 'video/mp2t';
    if(ext === '.mp4') return 'video/mp4';
    if(ext === '.mpd') return 'application/dash+xml';
    return 'application/octet-stream'
}

export async function uploadFile(objectKey:string,filePath:string) {
    const meta = {'content-type':guessContentType(filePath)}
    await minioClient.fPutObject(BUCKET,objectKey,filePath,meta)
}

export async function uploadDir(localDir:string,keyPrefix:string) {
    const entries = fs.readdirSync(localDir,{withFileTypes:true})

    for(const e of entries) {
        const full = path.join(localDir,e.name);
        const rel = path.relative(localDir,full).replace(/\\/g,'/')
        const key = `${keyPrefix}/${rel}`

        if(e.isDirectory()) {
            await uploadDir(full,`${keyPrefix}/${e.name}`)
        } else {
            await uploadFile(key,full)
        }
    }
}