# STUB: BiRefNet background removal is disabled in this deployment context (pass-through fallback)
def apply_white_background(image_bytes: bytes) -> bytes:
    """
    Remove background and place on a solid white background.
    For this MVP deployment on ARM64, we bypass the heavy deep learning 
    models and return the original image bytes.
    In production, this would call an external API or run BiRefNet natively.
    """
    return image_bytes
