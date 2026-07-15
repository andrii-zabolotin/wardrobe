from app.agents.image_gen import assemble_render_payload


def test_assemble_render_payload_basic():
    prompt = "A photo of {@avatar} wearing a cool {@garment_1} outside."
    avatar = b"avatar_binary_data"
    garments = [b"garment_1_binary_data"]
    
    parts = assemble_render_payload(prompt, avatar, garments)
    
    # We expect 5 parts:
    # 1. Text: "A photo of "
    # 2. Image: avatar
    # 3. Text: " wearing a cool "
    # 4. Image: garment_1
    # 5. Text: " outside."
    assert len(parts) == 5
    
    assert parts[0].text == "A photo of "
    assert parts[1].inline_data.data == avatar
    assert parts[2].text == " wearing a cool "
    assert parts[3].inline_data.data == garments[0]
    assert parts[4].text == " outside."

def test_assemble_render_payload_fallback():
    # Prompt does not contain the garment tag
    prompt = "A photo of {@avatar} looking happy."
    avatar = b"avatar_binary_data"
    garments = [b"garment_1_binary_data"]
    
    parts = assemble_render_payload(prompt, avatar, garments)
    
    # We expect the prompt text, the avatar image, and the unused garment image appended as fallback
    # 1. Text: "A photo of "
    # 2. Image: avatar
    # 3. Text: " looking happy."
    # 4. Fallback Image: garment_1
    assert len(parts) == 4
    assert parts[0].text == "A photo of "
    assert parts[1].inline_data.data == avatar
    assert parts[2].text == " looking happy."
    assert parts[3].inline_data.data == garments[0]
