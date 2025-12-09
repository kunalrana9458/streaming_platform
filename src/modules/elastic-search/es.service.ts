
import esClient from "../../lib/esClient"


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