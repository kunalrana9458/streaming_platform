
import {Request,Response} from 'express'
import { MediaService } from './media.service'
import Media from './media.model'
import { presignGet } from '../../lib/minio.client'


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
export async function getStreamingUrl(req:any,res:Response) {
    try {
        const {id} = req.params

        const mode = (req.query.mode as string) || 'stream';
        const variantQuery = (req.query.variant as string) || undefined;
        const region = (req.header('x-region') || req.query.region) as string | undefined
        const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) as string | undefined;
        const cookie = (req.query.cookie as any) || 'false'
        const userId = (req?.user?.id as string)

        const {url} = await MediaService.getStreamingUrl(id,mode,variantQuery,region,clientIp,cookie,userId)
        return res.json({url})
    } catch (err:any) {
        return res.status(400).json({message:err.message})
    }
}

// GET /media/:id   (metadata)
export async function getMediaById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const doc = await Media.findById(id).lean();
    if (!doc) return res.status(404).json({ message: 'Media not found' });
    return res.json({ media: doc });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
}   


// GET /:id/thumbnails
export async function getThumbnailAndWebVttData(req: Request, res: Response) {
    try {
         const media = await Media.findById(req.params.id);
  if (!media) return res.status(404).json({ message: 'not found' });

  const expires = 60 * 60; // 1 hour

  const thumbs = (media.thumbnails || []).map((key: string) => presignGet(key, expires));
  const sprite = media.spriteKey ? presignGet(media.spriteKey, expires) : null;
  const vtt = media.vttKey ? presignGet(media.vttKey, expires) : null;

  // presignGet may return Promise or string depending on your client; adapt accordingly
  res.json({ thumbnails: await Promise.all(thumbs), sprite: await sprite, vtt: await vtt })
    } catch (error) {
        
    }
}