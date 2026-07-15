import io
from typing import Literal

from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel

from app.core.config import settings


def get_client():
    return genai.Client(api_key=settings.gemini_api_key)

class GarmentStyleAttributes(BaseModel):
    warmth_level: Literal["very_light", "light", "medium", "warm", "very_warm"]
    formality: Literal["sport", "casual", "smart_casual", "formal", "evening"]
    occasion_tags: list[str]
    season_suitability: list[Literal["spring", "summer", "autumn", "winter"]]

class DetectedGarment(BaseModel):
    bounding_box: list[float]
    title: str
    category: Literal["top", "bottom", "dress", "outerwear", "shoes", "accessory"]
    color: str
    pattern: str
    sleeve_length: str | None
    fit: str
    material_guess: str
    style_attributes: GarmentStyleAttributes
    embedding_summary: str

class DetectionResult(BaseModel):
    garments: list[DetectedGarment]

async def detect_garments(image_bytes: bytes) -> DetectionResult:
    """Analyze image and detect garments using gemini-2.5-flash structured output."""
    prompt = """
    You are a professional fashion detection expert.
    Analyze the provided image and identify ALL clothing items and accessories visible.
    For each item return a DetectionResult with every garment described precisely.
    
    Rules:
    - title must be a concise, user-friendly name (e.g., "Green Graphic Hoodie", "Classic Blue Jeans")
    - bounding_box coordinates must be normalized (0.0 to 1.0 relative to image dimensions: [ymin, xmin, ymax, xmax])
    - If the same item appears from multiple angles, report it once
    - Do NOT hallucinate items that are not clearly visible
    - For embedding_summary: write 2-3 sentences in English combining all attributes, optimized for semantic similarity search
    - If no garments are found, return {"garments": []}
    """
    
    response = await get_client().aio.models.generate_content(
        model=settings.model_detection,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DetectionResult,
            temperature=0.1,
        )
    )
    
    return DetectionResult.model_validate_json(response.text)

def crop_garment(image_bytes: bytes, bbox: list[float]) -> bytes:
    """
    Crop garment from original image using normalized bounding box [ymin, xmin, ymax, xmax].
    Returns JPEG bytes.
    """
    img = Image.open(io.BytesIO(image_bytes))
    img_rgb = img.convert("RGB") if img.mode != "RGB" else img
        
    width, height = img_rgb.size
    ymin, xmin, ymax, xmax = bbox
    
    # Gemini sometimes returns 0-1000 coordinates instead of 0-1
    if max(bbox) > 1.0:
        ymin /= 1000.0
        xmin /= 1000.0
        ymax /= 1000.0
        xmax /= 1000.0
    
    # Denormalize
    left = int(xmin * width)
    top = int(ymin * height)
    right = int(xmax * width)
    bottom = int(ymax * height)
    
    # Ensure within bounds
    left = max(0, min(left, width - 1))
    right = max(left + 1, min(right, width))
    top = max(0, min(top, height - 1))
    bottom = max(top + 1, min(bottom, height))
    
    cropped = img_rgb.crop((left, top, right, bottom))
    
    out_io = io.BytesIO()
    cropped.save(out_io, format="JPEG", quality=90)
    return out_io.getvalue()
