
import {Router} from 'express'
import multer from 'multer'
import { uploadMediaController } from './media.controller'
import { requireAuth,requireRole } from '../../middleware/authMiddleware'

const upload = multer({dest:'uploads/'})
const router = Router()

// admin-only upload
router.post(
    '/upload',
    requireAuth,
    requireRole('admin'),
    (req,res,next) => {
        console.log("Before Single file Upload")
        next()
    },
    upload.single('file'),
    (req,res,next) => {
        console.log("After single file upload")
        next()
    },
    uploadMediaController
)

export default router