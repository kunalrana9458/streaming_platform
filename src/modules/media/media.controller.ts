
import {Request,Response} from 'express'
import { uploadToMinio } from './media.service'

export async function uploadMediaController(req:any,res:Response){
    try {
        const file = req.file
        const {titleId} = req.body

        console.log("File is:",file)
        console.log('TItle Id is:',titleId)

        if(!file || !titleId){
            return res.status(400).json({error:{message:"Missing File or titleId"}})
        }

        const media = await uploadToMinio(file,titleId)
        return res.status(201).json({message:'File Uploaded Successfully',media})
    } catch (err:any) {
        console.error('Upload file failed:',err) 
        return res.status(500).json({error:{message:"Upload Failed",detail:err.message}}) 
    }
}