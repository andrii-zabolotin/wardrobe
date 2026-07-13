import io
from PIL import Image
from birefnet import BiRefNet

# Lazy load the model only when needed
_model = None

def get_birefnet_model():
    global _model
    if _model is None:
        _model = BiRefNet(device="cpu")
    return _model

def apply_white_background(image_bytes: bytes) -> bytes:
    """
    Remove background and place on a solid white background using BiRefNet.
    """
    model = get_birefnet_model()
    
    # Read image
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
        
    # Get mask
    mask = model(img)
    
    # Create white background
    white_bg = Image.new("RGB", img.size, (255, 255, 255))
    
    # Composite
    result = Image.composite(img, white_bg, mask)
    
    # Convert to bytes
    out_io = io.BytesIO()
    result.save(out_io, format="JPEG", quality=90)
    return out_io.getvalue()
