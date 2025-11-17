import { Request,Response } from 'express'
import mongoose from 'mongoose'
import { minioClient,BUCKET } from '../lib/minio.client'
import { connection as redisConnection } from '../lib/queue'

export async function health(req:Request,res:Response) {
    const mongoOk = mongoose.connection.readyState === 1;
    // Minio quick check : listbuckets (fast) or stateObject for bucket
    let minioOk = false;
    try {
        await minioClient.bucketExists(BUCKET)
        minioOk = true;
    } catch (error) {
        minioOk = false;
    }

    let redisOk = false;
    try {
        // connection is ioredis instance exported as 'connection' in queue.ts
        const r = (redisConnection as any).redisClient || (redisConnection as any);
        if(r && typeof r.ping === 'function') {
            const pong = await r.ping();
            redisOk = pong === 'PONG';
        }
    } catch (error) {
        redisOk = false
    }
    const ok = mongoOk && minioOk && redisOk;
    res.status(ok ? 200 : 503).json({mongoOk,minioOk,redisOk});
}

export async function ready(req:Request,res:Response) {
    const mongoOk = mongoose.connection.readyState === 1;
    res.status(mongoOk ? 200 : 503).send(mongoOk ? 'ok' : 'not ready');
}