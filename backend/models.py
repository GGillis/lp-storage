from datetime import datetime, timezone
from sqlalchemy import Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class RecordTag(Base):
    __tablename__ = "record_tags"

    record_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("records.id", ondelete="CASCADE"), primary_key=True
    )
    tag: Mapped[str] = mapped_column(String, primary_key=True)


class Record(Base):
    __tablename__ = "records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    discogs_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    artist: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    genre: Mapped[str | None] = mapped_column(String, nullable=True)
    styles: Mapped[str | None] = mapped_column(String, nullable=True)  # comma-separated
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    catalog_number: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    format: Mapped[str | None] = mapped_column(String, nullable=True)
    tracklist: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    cover_path: Mapped[str | None] = mapped_column(String, nullable=True)
    lowest_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_currency: Mapped[str | None] = mapped_column(String, nullable=True)
    price_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_added: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    tag_objects: Mapped[list[RecordTag]] = relationship(
        "RecordTag", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def tags(self) -> list[str]:
        return sorted(t.tag for t in self.tag_objects)
