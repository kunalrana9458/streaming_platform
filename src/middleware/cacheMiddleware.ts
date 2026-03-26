import { NextFunction } from "express";
import Redis from "ioredis";
const redis = new Redis();

export const cache = (key: string,ttl =60) => async (req,res,next) => {
    const data = await redis.get(key);

    if(data){
        return res.json(JSON.parse(data)); // Cache hit
    }

    res.sendResponse = res.json;
    res.json = (body: any) => {
        redis.setex(key,ttl,JSON.stringify(body));
        return res.sendResponse(body);
    }

    next();
}