
import express from 'express'
import esClient from './elasticsearch'
import { version } from 'os';

const router = express.Router();

router.get('/health',async(req,res) => {
    try {
        const info = await esClient.info();
        res.json({
            ok:true,
            name:info.name,
            cluster:info.cluster_name,
            version: info.version 
        })
    } catch (err: any) {
        console.error('Elasticsearch health error:',err)
        res.status(500).json({
            ok: false,
            error: err.message
        })
    }
})

export default router