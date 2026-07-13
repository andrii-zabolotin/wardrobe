import uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .base import Base, UUIDMixin, TimestampMixin

class SourceImage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "source_images"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    original_url: Mapped[str] = mapped_column(String)

class Garment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "garments"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_image_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("source_images.id", ondelete="SET NULL"), nullable=True)
    
    bounding_box: Mapped[dict] = mapped_column(JSONB) # [x1, y1, x2, y2]
    crop_url: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String, index=True)
    
    attributes: Mapped[dict] = mapped_column(JSONB, default=dict)
    style_attributes: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    embedding_id: Mapped[str | None] = mapped_column(String, nullable=True)
    
    user = relationship("User", back_populates="garments")
    outfits = relationship("OutfitGarment", back_populates="garment", cascade="all, delete-orphan")
