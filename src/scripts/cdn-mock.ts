
import { tryCatch } from 'bullmq';
import express from 'express'
import fetch from 'node-fetch'

const app = express();
const PORT = process.env.CDN_MOCK_PORT || 4000;

function validateToken(token: string | undefined) {
    if(!token) return false;
    try {
        const decoded = Buffer.from(token,'base64').toString('utf8')
        const [userId,assestId,expiresStr] = decoded.split(':');
        const expires = Number(expiresStr);
        return Date.now() / 1000 < expires;
    } catch (error) {
        return false;
    }
}

app.get('/cdn/:assestId/*',async(req,res) => {
    const token = req.cookies?.cdn_token || req.headers['x-cdn-token'] as string
    if(!validateToken(token)) return res.status(403).send('forbidden');

    // Map to minio object path; for dev we expect query param `object` or infer
    const object = req.query.object as string | undefined
    if(!object) return res.status(400).send('object query missing');

    try {
        // proxy to presigned GET
        const minioPresigned = object;
        const upstream = await fetch(minioPresigned);
        res.status(upstream.status);
        upstream.body?.pipe(res);
    } catch (error) {
        console.error('cdn-mock proxy error',error)
        res.status(500).send('upstream_error');
    }
})

app.listen(PORT,() => console.log(`CDN Mock listening on ${PORT}`))

