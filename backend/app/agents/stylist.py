import uuid
import json
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.outfit import Outfit, OutfitGarment
from app.services.vector_store import search_garments
from sqlalchemy import select

client = genai.Client(api_key=settings.gemini_api_key)

STYLIST_SYSTEM_PROMPT = """
You are a personal fashion stylist assistant with access to the user's wardrobe.
You help them decide what to wear using their actual clothes.

Rules:
- ALWAYS search the wardrobe before making suggestions
- If wardrobe lacks items for a request, honestly say what's missing using get_wardrobe_gaps
- NEVER suggest items the user doesn't own
- When proposing an outfit, always call create_outfit and then trigger_render
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
        self.chat = client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=STYLIST_SYSTEM_PROMPT,
                tools=[STYLIST_TOOLS],
                temperature=0.7,
            )
        )

    async def handle_search_wardrobe(self, args: dict) -> str:
        filters = {}
        if "category" in args:
            filters["category"] = args["category"]
            
        results = await search_garments(
            user_id=self.user_id,
            query=args["query"],
            limit=args.get("limit", 5),
            filters=filters if filters else None
        )
        return json.dumps(results)

    async def handle_get_wardrobe_gaps(self, args: dict) -> str:
        # Simplistic implementation for MVP: just say nothing is missing or generic advice
        # Real implementation would query all categories and check counts
        return json.dumps({"gaps": f"Based on '{args['criteria']}', you might need more diverse options."})

    async def handle_create_outfit(self, args: dict) -> str:
        if not self.active_avatar_id:
            return json.dumps({"error": "No active avatar set by user. Ask them to set one first."})
            
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
            return json.dumps({"outfit_id": str(outfit.id)})

    async def handle_trigger_render(self, args: dict) -> str:
        return json.dumps({"status": "prompted_user_for_render", "outfit_id": args["outfit_id"]})

    async def send_message(self, text: str):
        response = self.chat.send_message(text)
        
        while response.function_calls:
            for fn_call in response.function_calls:
                name = fn_call.name
                args = fn_call.args
                
                result = "{}"
                if name == "search_wardrobe":
                    result = await self.handle_search_wardrobe(args)
                elif name == "get_wardrobe_gaps":
                    result = await self.handle_get_wardrobe_gaps(args)
                elif name == "create_outfit":
                    result = await self.handle_create_outfit(args)
                elif name == "trigger_render":
                    result = await self.handle_trigger_render(args)
                    # Yield special event
                    yield {
                        "type": "render_suggestion",
                        "outfit_id": args.get("outfit_id")
                    }
                    
                response = self.chat.send_message(
                    types.Part.from_function_response(
                        name=name,
                        response={"result": result}
                    )
                )
                
        if response.text:
            yield {
                "type": "message",
                "text": response.text
            }
