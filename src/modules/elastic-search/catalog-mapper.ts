
function mapCatalogtoEsDocument(catalogItem: any) {
    if(!catalogItem) return null;

    return {
        id: catalogItem._id.toString(),
        type: catalogItem.type,
        name: catalogItem.name,
        description: catalogItem.description,
        genres: catalogItem.genres,
        releaseYear: catalogItem.releaseYear,
        thumbnailUrl: catalogItem.thumbnailUrl,
        language: catalogItem.language,
        isLive: catalogItem.isLive,
        createdAt: catalogItem.createdAt,
        updatedAt: catalogItem.updatedAt
    }
}

export {mapCatalogtoEsDocument};