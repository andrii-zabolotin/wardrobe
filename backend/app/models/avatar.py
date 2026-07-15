import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDMixin


class Avatar(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "avatars"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    canonical_url: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending, processing, ready, failed
    physical_description: Mapped[str | None] = mapped_column(String, nullable=True)

    user = relationship("User", back_populates="avatars")
    source_images = relationship("AvatarSourceImage", back_populates="avatar", cascade="all, delete-orphan")
    outfits = relationship("Outfit", back_populates="avatar", cascade="all, delete-orphan")

class AvatarSourceImage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "avatar_source_images"

    avatar_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("avatars.id", ondelete="CASCADE"))
    file_url: Mapped[str] = mapped_column(String)

    avatar = relationship("Avatar", back_populates="source_images")
