from typing import Literal
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.config import settings

def get_client():
    return genai.Client(api_key=settings.gemini_api_key)

class ComposerGarmentInfo(BaseModel):
    category: str
    color: str
    pattern: str
    fit: str
    material_guess: str
    formality: str

class OutfitComposerInput(BaseModel):
    avatar_description: str
    garments: list[ComposerGarmentInfo]
    pose: Literal["studio_front", "studio_3q", "studio_casual", "outdoor_walk", "seated"]

class OutfitPromptResult(BaseModel):
    scene_description: str
    image_prompt: str
    layer_reasoning: str

async def describe_avatar(avatar_bytes: bytes) -> str:
    """Extract physical description from avatar image."""
    prompt = "Briefly describe the physical characteristics of the person in this image: gender, build, approximate age, skin tone, hair color/style. Return ONLY the description, e.g. 'Athletic build male, ~30yo, fair skin, dark hair'."
    
    client = get_client()
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[
            types.Part.from_bytes(data=avatar_bytes, mime_type="image/jpeg"),
            prompt
        ],
        config=types.GenerateContentConfig(temperature=0.1)
    )
    return response.text.strip()

async def compose_outfit_prompt(input_data: OutfitComposerInput, garment_bytes: list[bytes]) -> OutfitPromptResult:
    """Compose final image prompt using gemini-2.5-flash structured output."""
    
    # Generate tag mapping documentation for the prompt
    tag_mapping = "  {@avatar}     — the person/model to dress\n"
    for i, garment in enumerate(input_data.garments):
        tag_mapping += f"  {{@garment_{i+1}}}  — garment reference image (category: {garment.category})\n"
        
    prompt = f"""
    You are an expert fashion photo director and prompt engineer.
    Given a list of garments and an avatar description, compose a precise image generation prompt.
    
    Your task:
    1. Determine the logical layering order (e.g. t-shirt under jacket, socks under shoes)
    2. Describe how each garment sits on the body
    3. Output a final image_prompt that will be sent to a photorealistic image generation model
    
    TAG RULES (mandatory):
    You MUST use these exact tags inline where the object is mentioned:
{tag_mapping}
    For EACH garment tag in your prompt, immediately after the tag write:
    "— take ONLY the [category], ignore any other clothing visible in that image"
    
    Tags must appear inline in the sentence, not at the end.
    
    Image prompt rules:
    - Start with pose and setting description
    - Describe clothing in layering order (innermost first)
    - Use precise fashion terminology
    - Keep the avatar's physical characteristics
    - Studio lighting unless pose is outdoor_walk
    - End with quality tags: "photorealistic, 4K, sharp focus, professional fashion photography"
    
    Pose mapping:
    - studio_front: "standing, facing camera directly, arms relaxed at sides, full body shot"
    - studio_3q: "standing at 3/4 angle to camera, full body shot, studio backdrop"
    - studio_casual: "casual relaxed stance, hands in pockets, slight hip lean"
    - outdoor_walk: "walking on urban street, natural daylight, candid fashion shot"
    - seated: "seated on minimal white chair, legs crossed, three-quarter body visible"
    """
    
    client = get_client()
    
    contents = []
    # Add garment images first
    for gb in garment_bytes:
        contents.append(types.Part.from_bytes(data=gb, mime_type="image/jpeg"))
        
    # Add system prompt and structured text
    contents.append(types.Part.from_text(text=prompt))
    contents.append(types.Part.from_text(text=f"Avatar: {input_data.avatar_description}"))
    contents.append(types.Part.from_text(text=f"Garments: {input_data.model_dump_json()}"))
    
    response = await client.aio.models.generate_content(
        model="gemini-3-flash-preview",
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=OutfitPromptResult,
            temperature=0.7,
        )
    )
    
    return OutfitPromptResult.model_validate_json(response.text)
