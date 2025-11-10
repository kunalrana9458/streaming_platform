
import Media,{IMedia} from './media.model'
import {presignGet,presignPut} from '../../lib/minio.client'
import { mediaQueue } from '../../lib/queue'
import { randomBytes } from 'crypto'


function makeObjectKey(filename: string) {
  // keep original extension, add random prefix for uniqueness
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  const prefix = Date.now().toString(36) + '-' + randomBytes(4).toString('hex');
  return `${prefix}${ext}`;
}

export const MediaService = {

  async createPresignedUpload({ filename, titleId, uploaderId }: { filename: string; titleId: string; uploaderId?: string }) {
    const objectKey = makeObjectKey(filename);
    const media = await Media.create({
      titleId,
      filename,
      objectKey,
      uploaderId,
      status: 'upload_pending',
    });

    const url = await presignPut(objectKey, 600); // 10 minutes
    return { media, presignedUrl: url, objectKey };
  },

  async markUploadedAndEnqueue(mediaId:string){
    const media = await Media.findById(mediaId)
    if(!media) throw new Error('Media not found')
    media.status = 'uploaded'
    await media.save()

    // add job to processing queue
    await mediaQueue.add('process-media',{mediaId},{attempts:3,backoff:{type:'exponential',delay:5000}})
    return media
  },
  
  async getStreamingUrl(mediaId:string) {
    const media = await Media.findById(mediaId)
    if(!media) throw new Error('Media Not Found')
    if(media.status !== 'ready') throw new Error('Media not ready for streaming')
    const url = await presignGet(media.objectKey,600)
    return {media,url}
  },

  async updateStatus(mediaId:string,status:IMedia['status']){
    const m = await Media.findByIdAndUpdate(mediaId,{status},{new:true})
    return m
  }

}