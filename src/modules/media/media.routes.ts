
import {Router} from 'express'
import { presignUpload,
         uploadComplete,
         getStreamingUrl,
         getMediaById,
         getThumbnailAndWebVttData } from './media.controller'
import { requireAuth,requireRole, } from '../../middleware/authMiddleware'
import requireActiveSubscription from '../../middleware/requireActiveSubscription.middleware'

const router = Router()

// admin-only upload
router.post('/presign',
            //  requireAuth,
            //  requireRole('admin'),
             presignUpload)
router.post('/:id/complete',
            // requireAuth,
            // requireRole('admin'),
            uploadComplete)
router.get('/:id/url',
            // requireAuth,
            // requireActiveSubscription,
            getStreamingUrl)
router.get('/:id',
    // requireAuth,
    getMediaById)

router.get('/:id/thumbnails',
    getThumbnailAndWebVttData
)

export default router