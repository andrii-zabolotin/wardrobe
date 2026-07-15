from google import genai
from typing import Any
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.core.config import settings


def get_qdrant() -> AsyncQdrantClient:
    return AsyncQdrantClient(url=settings.qdrant_url)

def get_genai_client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)

async def init_collection() -> None:
    """Create collection if it doesn't exist."""
    qdrant = get_qdrant()
    try:
        collections = await qdrant.get_collections()
        if not any(c.name == settings.qdrant_collection for c in collections.collections):
            await qdrant.create_collection(
                collection_name=settings.qdrant_collection,
                vectors_config=VectorParams(size=3072, distance=Distance.COSINE),
            )
    finally:
        await qdrant.close()

async def embed_text(text: str) -> list[float]:
    """Get embedding from Gemini."""
    client = get_genai_client()
    response = await client.aio.models.embed_content(
        model=settings.model_embeddings,
        contents=text
    )
    embeddings = response.embeddings
    if not embeddings or not embeddings[0].values:
        raise ValueError("No embeddings returned from API")
    return embeddings[0].values

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
    
    client = get_qdrant()
    try:
        await client.upsert(
            collection_name=settings.qdrant_collection,
            points=[point]
        )
    finally:
        await client.close()

async def delete_garment(garment_id: str) -> None:
    """Delete point from Qdrant."""
    client = get_qdrant()
    try:
        await client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=[garment_id]
        )
    finally:
        await client.close()

async def search_garments(user_id: str, query: str, limit: int = 5, filters: dict | None = None) -> list[dict]:
    """Semantic search for user's garments."""
    vector = await embed_text(query)
    
    must_conditions: list[Any] = [
        FieldCondition(key="user_id", match=MatchValue(value=str(user_id)))
    ]
    
    if filters:
        for k, v in filters.items():
            must_conditions.append(
                FieldCondition(key=k, match=MatchValue(value=v))
            )
            
    search_filter = Filter(must=must_conditions)
    
    client = get_qdrant()
    try:
        results = await client.query_points(
            collection_name=settings.qdrant_collection,
            query=vector,
            query_filter=search_filter,
            limit=limit
        )
        return [hit.payload for hit in results.points if hit.payload is not None]
    finally:
        await client.close()
