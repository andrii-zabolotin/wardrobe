from google import genai
from google.genai import types
from app.core.config import settings
from app.services.file_storage import read_file_bytes

def get_client():
    return genai.Client(api_key=settings.gemini_api_key)

async def generate_avatar(reference_paths: list[str], custom_prompt: str | None = None) -> bytes:
    """Generate avatar image using gemini-3.1-flash-image."""
    AVATAR_SYSTEM_PROMPT = """
    Professional studio portrait photography. Plain white background.
    Cinematic lighting, softbox setup, sharp focus, 4K resolution.
    CRITICAL: Maintain exact facial identity, likeness, and proportions
    from the provided reference images. Standing upright, front-facing,
    natural posture, neutral expression, full body framing (head to toe).
    Correct anatomy, symmetrical features, photorealistic quality.
    """
    
    prompt = AVATAR_SYSTEM_PROMPT
    if custom_prompt:
        prompt += f"\nAdditional instructions: {custom_prompt}"

    parts = []
    for path in reference_paths:
        file_bytes = read_file_bytes(path)
        parts.append(types.Part.from_bytes(data=file_bytes, mime_type="image/jpeg"))
        
    parts.append(types.Part.from_text(text=prompt))
    
    client = get_client()
    response = await client.aio.models.generate_content(
        model="gemini-3.1-flash-image",
        contents=parts,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
            image_config=types.ImageConfig(
                aspect_ratio="3:4",
                number_of_images=1,
            )
        )
    )
    
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            return part.inline_data.data
            
    raise ValueError("No image generated")

async def generate_outfit_render(avatar_path: str, garment_paths: list[str], image_prompt: str) -> bytes:
    """Generate final outfit render using gemini-3.1-flash-image."""
    parts = []
    
    avatar_bytes = read_file_bytes(avatar_path)
    parts.append(types.Part.from_bytes(data=avatar_bytes, mime_type="image/jpeg"))
    
    for path in garment_paths:
        file_bytes = read_file_bytes(path)
        parts.append(types.Part.from_bytes(data=file_bytes, mime_type="image/jpeg"))
        
    parts.append(types.Part.from_text(text=image_prompt))
    
    client = get_client()
    response = await client.aio.models.generate_content(
        model="gemini-3.1-flash-image",
        contents=parts,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
            image_config=types.ImageConfig(
                aspect_ratio="3:4",
                number_of_images=1,
            )
        )
    )
    
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            return part.inline_data.data
            
    raise ValueError("No image generated")
