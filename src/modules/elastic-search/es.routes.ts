
import express from 'express'
import { createCatalogIndex } from './es.controller'

const router = express.Router()

router.post('/create-catalog-index',createCatalogIndex);

export default router