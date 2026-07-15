import uuid
import json
import logging
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.outfit import Outfit, OutfitGarment
from app.services.vector_store import search_garments
from sqlalchemy import select

def get_client():
    return genai.Client(api_key=settings.gemini_api_key)

logger = logging.getLogger(__name__)

STYLIST_SYSTEM_PROMPT = """
You are a personal fashion stylist assistant with access to the user's wardrobe.
You help them decide what to wear using their actual clothes.

Rules:
- ALWAYS search the wardrobe before making suggestions
- If wardrobe lacks items for a request, honestly say what's missing using get_wardrobe_gaps
- NEVER suggest items the user doesn't own
- When proposing an outfit, always call create_outfit and then trigger_render
- If the user asks to change or replace a specific item in the outfit you just suggested, you MUST keep the other items from the previous outfit exactly the same, and only replace the requested item in your next create_outfit call.
- IMPORTANT: After calling trigger_render, you MUST reply with a friendly text message describing the outfit you chose and why it fits the occasion.
- Be concise, friendly, and fashion-forward
- Respond in the same language the user writes in
"""

STYLIST_TOOLS = [
    {
        "name": "search_wardrobe",
        "description": "Search user's wardrobe by semantic query. Returns matching garments.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural language search, e.g. 'warm casual jacket'"},
                "category": {"type": "string", "enum": ["top","bottom","dress","outerwear","shoes","accessory"]},
                "min_warmth": {"type": "string", "enum": ["very_light","light","medium","warm","very_warm"]},
                "occasion": {"type": "string", "description": "e.g. 'office', 'gym', 'date'"},
                "limit": {"type": "integer"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_wardrobe_gaps",
        "description": "Analyze what's missing in the wardrobe for given criteria.",
        "parameters": {
            "type": "object",
            "properties": {
                "criteria": {"type": "string", "description": "e.g. 'formal occasions', 'cold weather'"}
            },
            "required": ["criteria"]
        }
    },
    {
        "name": "create_outfit",
        "description": "Assemble an outfit from specific garment IDs.",
        "parameters": {
            "type": "object",
            "properties": {
                "garment_ids": {"type": "array", "items": {"type": "string"}, "description": "UUIDs of garments"},
                "pose": {"type": "string", "enum": ["studio_front","studio_3q","studio_casual","outdoor_walk","seated"]}
            },
            "required": ["garment_ids"]
        }
    },
    {
        "name": "trigger_render",
        "description": "Propose a render to the user. Returns outfit_id for user to confirm.",
        "parameters": {
            "type": "object",
            "properties": {
                "outfit_id": {"type": "string"},
                "pose": {"type": "string"}
            },
            "required": ["outfit_id"]
        }
    }
]

class StylistSession:
    def __init__(self, user_id: str, active_avatar_id: str | None = None):
        self.user_id = user_id
        self.active_avatar_id = active_avatar_id
        self.client = get_client()
        self.chat = self.client.aio.chats.create(
            model="gemini-3-flash-preview",
            config=types.GenerateContentConfig(
                system_instruction=STYLIST_SYSTEM_PROMPT,
                tools=[{"function_declarations": STYLIST_TOOLS}],
                temperature=0.5,
            )
        )
        self.garments_cache = {}
        self.outfit_garments = {}

    async def handle_search_wardrobe(self, args: dict) -> tuple[str, list[dict]]:
        filters = {}
        if "category" in args:
            filters["category"] = args["category"]
            
        results = await search_garments(
            user_id=self.user_id,
            query=args["query"],
            limit=args.get("limit", 5),
            filters=filters if filters else None
        )
        
        garment_cards = []
        if results:
            garment_ids = [r["garment_id"] for r in results]
            async with AsyncSessionLocal() as session:
                from app.models.garment import Garment
                from sqlalchemy.orm import joinedload
                stmt = select(Garment).options(joinedload(Garment.source_image)).where(Garment.id.in_(garment_ids))
                db_results = await session.execute(stmt)
                db_garments = {str(g.id): g for g in db_results.scalars().all()}
                
                for r in results:
                    g_id = r["garment_id"]
                    if g_id in db_garments:
                        g = db_garments[g_id]
                        card = {
                            "id": str(g.id),
                            "title": g.title,
                            "category": g.category,
                            "crop_url": g.crop_url,
                            "source_image_id": str(g.source_image_id) if g.source_image_id else None,
                            "source_image_url": g.source_image_url,
                            "bounding_box": g.bounding_box,
                            "attributes": g.attributes,
                            "style_attributes": g.style_attributes
                        }
                        self.garments_cache[card["id"]] = card
                        garment_cards.append(card)
                        # optionally add to result for Gemini to know context
                        r["bounding_box"] = g.bounding_box
        
        return results, garment_cards

    async def handle_get_wardrobe_gaps(self, args: dict) -> dict:
        # Simplistic implementation for MVP: just say nothing is missing or generic advice
        # Real implementation would query all categories and check counts
        return {"gaps": f"Based on '{args['criteria']}', you might need more diverse options."}

    async def handle_create_outfit(self, args: dict) -> dict:
        if not self.active_avatar_id:
            return {"error": "No active avatar set by user. Ask them to set one first."}
            
        async with AsyncSessionLocal() as session:
            outfit = Outfit(
                user_id=uuid.UUID(self.user_id),
                avatar_id=uuid.UUID(self.active_avatar_id),
                pose=args.get("pose", "studio_front"),
                name="Stylist Suggestion"
            )
            session.add(outfit)
            await session.flush()
            
            for gid in args["garment_ids"]:
                og = OutfitGarment(outfit_id=outfit.id, garment_id=uuid.UUID(gid))
                session.add(og)
                
            await session.commit()
            
            # Cache the outfit's garments for the frontend event
            garments = []
            for gid in args.get("garment_ids", []):
                if str(gid) in self.garments_cache:
                    garments.append(self.garments_cache[str(gid)])
            self.outfit_garments[str(outfit.id)] = garments
            
            return {"outfit_id": str(outfit.id)}

    async def handle_trigger_render(self, args: dict) -> dict:
        return {"status": "prompted_user_for_render", "outfit_id": args["outfit_id"]}

    async def send_message(self, text: str):
        try:
            response = await self.chat.send_message(text)
            
            while response.function_calls:
                function_responses = []
                for fn_call in response.function_calls:
                    name = fn_call.name
                    args = fn_call.args
                    
                    logger.info("[Stylist] function call: %s args=%s", name, args)
                    result = {}
                    if name == "search_wardrobe":
                        result, garment_cards = await self.handle_search_wardrobe(args)
                        if garment_cards:
                            yield {
                                "type": "garment_cards",
                                "garments": garment_cards
                            }
                    elif name == "get_wardrobe_gaps":
                        result = await self.handle_get_wardrobe_gaps(args)
                    elif name == "create_outfit":
                        result = await self.handle_create_outfit(args)
                    elif name == "trigger_render":
                        result = await self.handle_trigger_render(args)
                        outfit_id = args.get("outfit_id")
                        yield {
                            "type": "render_suggestion",
                            "outfit_id": outfit_id,
                            "garments": self.outfit_garments.get(str(outfit_id), [])
                        }
                        
                    function_responses.append(
                        types.Part.from_function_response(
                            name=name,
                            response=result if isinstance(result, dict) else {"result": result}
                        )
                    )

                logger.info("[Stylist] sending %d function response(s) back to model", len(function_responses))
                response = await self.chat.send_message(function_responses)
                logger.info("[Stylist] model replied: has_fn_calls=%s", bool(response.function_calls))
                    
            final_text = response.text.strip() if response.text else ""
            if not final_text:
                final_text = "Here is what I picked out for you! Let me know what you think."
                
            logger.info("[Stylist] yielding final text message")
            yield {
                "type": "message",
                "text": final_text
            }
                
        except Exception as e:
            logger.exception("[Stylist] error in send_message: %s", e)
            yield {
                "type": "error",
                "text": f"Stylist error: {e}"
            }
