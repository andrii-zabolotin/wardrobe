import uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Boolean
from .base import Base, UUIDMixin, TimestampMixin

class Render(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "renders"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    outfit_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("outfits.id", ondelete="CASCADE"))
    
    status: Mapped[str] = mapped_column(String, default="pending")  # pending, processing, done, failed
    result_url: Mapped[str | None] = mapped_column(String, nullable=True)
    prompt_used: Mapped[str | None] = mapped_column(String, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    user = relationship("User", back_populates="renders")
    outfit = relationship("Outfit", back_populates="renders")
