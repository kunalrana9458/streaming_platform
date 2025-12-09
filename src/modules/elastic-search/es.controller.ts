

import { Request,Response } from 'express'
import { catalogIndex } from './es.service'

export const createCatalogIndex= async(req: Request,res: Response) => {
    try {
        const indexName = 'catalog-index';

        const result = await catalogIndex(indexName);

        return res.status(201).json({
            ok: result.acknowledged,
            message: result.message || 'Catalog index created successfully',
            result
        })

    } catch (err: any) {
        console.error('Error creating catalog index:', err);
        return res.status(500).json({
            error: {
                code: 'INDEX_CREATION_FAILED',
                message: err.message
            }
        })
    }
}