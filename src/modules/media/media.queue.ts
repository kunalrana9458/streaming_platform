
import {Queue} from 'bullmq'

const mediaQueue = new Queue('media-processing',{
    connection: {host:'localhost',port:6397}
})

export async function addMediaProcessingJob(mediaId:string){
    await mediaQueue.add('processingMedia',{mediaId})
    console.log(`Queue media job for ID: ${mediaId}`)
}

