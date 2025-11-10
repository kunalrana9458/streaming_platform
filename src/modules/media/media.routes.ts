
import {Router} from 'express'
import multer from 'multer'
import { presignUpload,uploadComplete,getStreamingUrl } from './media.controller'
import { requireAuth,requireRole } from '../../middleware/authMiddleware'

const upload = multer({dest:'uploads/'})
const router = Router()

// admin-only upload
router.post('/presign',requireAuth,requireRole('admin'),presignUpload)
router.post('/:id/complete',requireAuth,requireRole('admin'),uploadComplete)
router.get('/:id/url',requireAuth,getStreamingUrl)

export default router