from dataclasses import dataclass, field
from google import genai
from google.genai import types
from app.core.config import settings
from app.core.dev_mode import is_dev_mode
from app.services.file_storage import read_file_bytes
import logging
from app.core.dev_mode import append_prompt_log

logger = logging.getLogger(__name__)

@dataclass
class DevMockResult:
    is_dev_mock: bool = True
    model: str = ""
    parts_summary: list[dict] = field(default_factory=list)
    assembled_prompt: str = ""
    config_summary: dict = field(default_factory=dict)

def get_client():
    return genai.Client(api_key=settings.gemini_api_key)

async def generate_avatar(reference_paths: list[str], custom_prompt: str | None = None, height: int | None = None, weight: int | None = None) -> bytes | DevMockResult:
    """Generate avatar image using gemini-3.1-flash-image."""
    AVATAR_SYSTEM_PROMPT = """Professional photorealistic studio character sheet created from the provided reference images.

CRITICAL: Preserve the exact identity and appearance of the same adult character across all views, including facial structure, skull shape, hairstyle, skin tone, distinctive features, and body proportions. Do not redesign, beautify, stylize, age, or alter the character.

Create a clean horizontal 3-view layout on a seamless white background:

LEFT: Large front-facing facial close-up, eye-level camera, neutral expression, entire head, ears, neck, and upper shoulders visible.

CENTER: Large strict 90-degree side-profile facial close-up of the same character, eye-level camera, neutral expression, entire head silhouette, ear, neck, and upper shoulders visible. No three-quarter angle.

RIGHT: Front-facing full-body view of the same character, standing upright in a neutral anatomical pose, entire body visible from head to feet, arms slightly away from the torso, realistic proportions matching the references.

WARDROBE: Minimal plain neutral underwear only. Male: fitted briefs. Female: non-transparent bra and briefs. No shoes, accessories, jewelry, or additional clothing.

Exactly three views, one character only, clear separation between views, no overlap. Maintain identical facial identity, hairstyle, skin tone, physique, and proportions across all views.

Professional neutral studio lighting, minimal shadows, sharp focus, natural skin texture, realistic anatomy, no perspective distortion, no depth of field, no dramatic lighting, no text, labels, borders, props, or additional poses.

Identity consistency and accurate anatomical reference are the highest priority.
"""

    prompt = AVATAR_SYSTEM_PROMPT
    
    if height or weight:
        prompt += "\nBODY PARAMETERS:\n"
        if height:
            prompt += f"Height: {height} cm.\n"
        if weight:
            prompt += f"Weight: {weight} kg.\n"
        prompt += "\nUse these measurements together with the provided reference images to reconstruct realistic body proportions and physique. The character's apparent height, body mass, shoulder width, torso length, waist, hips, limb thickness, and overall body silhouette should be physically plausible for the specified height and weight.\n\nDo not exaggerate muscularity, thinness, curves, or body fat. Prioritize the visible body features from the reference images; use height and weight only as supporting information.\n"
    
    if custom_prompt:
        prompt += f"\nAdditional instructions: {custom_prompt}"

    parts = []
    for path in reference_paths:
        file_bytes = read_file_bytes(path)
        parts.append(types.Part.from_bytes(data=file_bytes, mime_type="image/jpeg"))
        
    parts.append(types.Part.from_text(text=prompt))
    
    if is_dev_mode():
        dev_result = DevMockResult(
            model="gemini-3.1-flash-image",
            assembled_prompt=prompt,
            parts_summary=[{"type": "image", "path": p} for p in reference_paths] + [{"type": "text", "content": prompt}],
            config_summary={"aspect_ratio": "16:9", "modalities": ["IMAGE", "TEXT"]}
        )
        logger.info(f"\n=== DEV PROMPT [avatar_gen] ===\nMODEL: {dev_result.model}\nPARTS: image x {len(reference_paths)}, text x 1\nPROMPT:\n{prompt}\n===============================\n")
        append_prompt_log({
            "agent": "avatar_gen",
            **dev_result.__dict__
        })
        return dev_result
    
    client = get_client()
    response = await client.aio.models.generate_content(
        model="gemini-3.1-flash-image",
        contents=parts,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
            image_config=types.ImageConfig(
                aspect_ratio="16:9",
            )
        )
    )
    
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            return part.inline_data.data
            
    raise ValueError("No image generated")

async def generate_outfit_render(avatar_path: str, garment_paths: list[str], image_prompt: str) -> bytes | DevMockResult:
    """Generate final outfit render using gemini-3.1-flash-image."""
    parts = []
    
    avatar_bytes = read_file_bytes(avatar_path)
    parts.append(types.Part.from_bytes(data=avatar_bytes, mime_type="image/jpeg"))
    
    for path in garment_paths:
        file_bytes = read_file_bytes(path)
        parts.append(types.Part.from_bytes(data=file_bytes, mime_type="image/jpeg"))
        
    parts.append(types.Part.from_text(text=image_prompt))
    
    if is_dev_mode():
        dev_result = DevMockResult(
            model="gemini-3.1-flash-image",
            assembled_prompt=image_prompt,
            parts_summary=[{"type": "image", "path": avatar_path}] + [{"type": "image", "path": p} for p in garment_paths] + [{"type": "text", "content": image_prompt}],
            config_summary={"aspect_ratio": "3:4", "modalities": ["IMAGE", "TEXT"]}
        )
        logger.info(f"\n=== DEV PROMPT [outfit_render] ===\nMODEL: {dev_result.model}\nPARTS: image x {len(garment_paths) + 1}, text x 1\nPROMPT:\n{image_prompt}\n==================================\n")
        append_prompt_log({
            "agent": "outfit_render",
            **dev_result.__dict__
        })
        return dev_result
    
    client = get_client()
    response = await client.aio.models.generate_content(
        model="gemini-3.1-flash-image",
        contents=parts,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
            image_config=types.ImageConfig(
                aspect_ratio="3:4",
            )
        )
    )
    
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            return part.inline_data.data
            
    raise ValueError("No image generated")
