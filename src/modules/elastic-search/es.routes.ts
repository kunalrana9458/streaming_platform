
import express from 'express'
import { createCatalogIndex ,createCatalogIndexById} from './es.controller'

const router = express.Router()

router.post('/create-catalog-index',createCatalogIndex);
router.post('/catalog-index-one/:id',createCatalogIndexById)

export default router