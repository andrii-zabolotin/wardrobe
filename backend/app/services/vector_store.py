from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from google import genai
from app.core.config import settings

qdrant = AsyncQdrantClient(url=settings.qdrant_url)
genai_client = genai.Client(api_key=settings.gemini_api_key)

async def init_collection() -> None:
    """Create collection if it doesn't exist."""
    collections = await qdrant.get_collections()
    if not any(c.name == settings.qdrant_collection for c in collections.collections):
        await qdrant.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=768, distance=Distance.COSINE),
        )

async def embed_text(text: str) -> list[float]:
    """Get embedding from Gemini text-embedding-004."""
    response = genai_client.models.embed_content(
        model="text-embedding-004",
        contents=text
    )
    return response.embeddings[0].values

async def upsert_garment(garment_id: str, user_id: str, embedding_summary: str, payload: dict) -> None:
    """Vectorize summary and upsert to Qdrant."""
    vector = await embed_text(embedding_summary)
    
    point = PointStruct(
        id=garment_id,
        vector=vector,
        payload={
            "user_id": str(user_id),
            "garment_id": str(garment_id),
            **payload
        }
    )
    
    await qdrant.upsert(
        collection_name=settings.qdrant_collection,
        points=[point]
    )

async def delete_garment(garment_id: str) -> None:
    """Delete point from Qdrant."""
    await qdrant.delete(
        collection_name=settings.qdrant_collection,
        points_selector=[garment_id]
    )

async def search_garments(user_id: str, query: str, limit: int = 5, filters: dict = None) -> list[dict]:
    """Semantic search for user's garments."""
    vector = await embed_text(query)
    
    must_conditions = [
        FieldCondition(key="user_id", match=MatchValue(value=str(user_id)))
    ]
    
    if filters:
        for k, v in filters.items():
            must_conditions.append(
                FieldCondition(key=k, match=MatchValue(value=v))
            )
            
    search_filter = Filter(must=must_conditions)
    
    results = await qdrant.search(
        collection_name=settings.qdrant_collection,
        query_vector=vector,
        query_filter=search_filter,
        limit=limit
    )
    
    return [hit.payload for hit in results]
