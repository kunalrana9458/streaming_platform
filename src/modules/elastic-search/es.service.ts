
import esClient from "../../lib/esClient"
import catalogModel from "../catalog/catalog.model";
import { mapCatalogtoEsDocument } from "./catalog-mapper";


export const catalogIndex = async(indexName:string) => {

    if(!indexName) throw new Error('Index name is required');
    const exists = await esClient.indices.exists({index:indexName});

    if(exists) {
        return {acknowledged:true, message:`${indexName} Index already exists`};
    }

    await esClient.indices.create({
        index: indexName,
        mappings: {
                properties: {
                    type: {type: 'keyword'},
                    name: {type: 'text'},
                    description: {type: 'text'},   
                    genres: {type: 'keyword'},
                    releaseYear: {type: 'integer'},
                    thumbnailUrl: {type: 'keyword'},
                    createdAt: {type: 'date'},
                    updatedAt: {type: 'date'}
                }
            }
    })

    return {acknowledged:true, message:`Index created ${indexName} successfully`};
    
}

export const catalogIndexById = async(indexName:string,id:string) => {
    if(!indexName) throw new Error('Index name is required');
    if(!id) throw new Error('Catalog ID is required');

    // Fetch catalog item from your data source -> MongoDB database
    const catalogDoc = await catalogModel.findById(id);

    if(!catalogDoc) {
        throw new Error('No Catalog item found with that ID')
    }

    // map to the ES Doc mappr function
    const esDoc = mapCatalogtoEsDocument(catalogDoc)
    if(!esDoc) {
        throw new Error('Error mapping catalog item to ES document');
    }

    // Index the document into the Elasticsearch
    await esClient.index({
        index: indexName,
        id: String(catalogDoc._id),
        body: esDoc,
        refresh: true
    })

    return { ok:true, message:'Catalog item indexed successfully', esDoc  };
}