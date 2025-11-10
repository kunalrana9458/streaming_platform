
import {Request,Response} from 'express'
import { MediaService } from './media.service'
import { tryCatch } from 'bullmq'


// POST - /media/presign
export async function presignUpload(req:any,res:Response){
    try{
        // do basic validation
        console.log("REQUEST BODY IS:",req.body)
        const {filename,titleId} = req.body
        const uploaderId = (req as any).user?.id 
        
        if(!filename || !titleId) return res.status(400).json({message:'Filename and titleId is required'})
        
        const { media,presignedUrl,objectKey } = await MediaService.createPresignedUpload({filename,titleId,uploaderId})

        return res.json({mediaId: media._id,presignedUrl,objectKey,expiresInSec:6000})

    } catch(err:any) {
        console.log(err)
        return res.status(500).json({
            message:err.message || 'failed'
        })
    }
}


// POST /media/:id/complete {Client calls after successful PUT}
export async function uploadComplete(req:Request,res:Response) {
    try {
        const {id} = req.params
        await MediaService.markUploadedAndEnqueue(id)
        return res.json({message:'upload acknowledge; processing queued'})
    } catch (err:any) {
        return res.status(500).json({message:err.message})
    }
}


// GET /media/:id/url
export async function getStreamingUrl(req:Request,res:Response) {
    try {
        const {id} = req.params
        const {url} = await MediaService.getStreamingUrl(id)
        return res.json({url})
    } catch (err:any) {
        return res.status(400).json({message:err.message})
    }
}