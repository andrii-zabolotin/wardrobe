from jose import jwt

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password


def test_hash_and_verify_password():
    password = "supersecretpassword123"
    hashed = hash_password(password)
    
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_create_access_token():
    subject = "user-12345"
    token = create_access_token(subject)
    
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    assert payload.get("sub") == subject
    assert "exp" in payload
