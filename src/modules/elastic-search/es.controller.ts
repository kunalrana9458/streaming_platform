

import { Request,Response } from 'express'
import { catalogIndex,
        catalogIndexById
 } from './es.service'

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


export const createCatalogIndexById = async(req: Request,res: Response) => {
    try {
        const indexName = 'catalog-index';
        const { id } = req.params

        const result = await catalogIndexById(indexName,id)
        return res.status(200).json({
            ok: result.ok,
            message: result.message || 'Catalog item indexed successfully',
            esDoc: result.esDoc
        })
    } catch (err: any) {
        console.error('Elasticsearch catalog-index-one error:',err);
        res.status(500).json({
            ok: false,
            error: err.message || 'Internal Server Error'
        })
    }
}