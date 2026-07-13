import uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey
from .base import Base, UUIDMixin, TimestampMixin

class Outfit(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "outfits"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    avatar_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("avatars.id", ondelete="RESTRICT"))
    
    pose: Mapped[str] = mapped_column(String, default="studio_front")
    name: Mapped[str | None] = mapped_column(String, nullable=True)

    user = relationship("User", back_populates="outfits")
    avatar = relationship("Avatar", back_populates="outfits")
    garments = relationship("OutfitGarment", back_populates="outfit", cascade="all, delete-orphan")
    renders = relationship("Render", back_populates="outfit", cascade="all, delete-orphan")

class OutfitGarment(Base):
    __tablename__ = "outfit_garments"

    outfit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("outfits.id", ondelete="CASCADE"), primary_key=True)
    garment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("garments.id", ondelete="CASCADE"), primary_key=True)

    outfit = relationship("Outfit", back_populates="garments")
    garment = relationship("Garment", back_populates="outfits")
