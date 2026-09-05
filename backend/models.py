import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, DateTime, Uuid
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Watchlist(Base):
    __tablename__ = "watchlists"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(String, default="user_vaishnavi_demo", index=True)
    name = Column(String, nullable=False, default="My Watchlist")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="watchlist", cascade="all, delete-orphan")

class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    watchlist_id = Column(Uuid, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    symbol = Column(String, nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    watchlist = relationship("Watchlist", back_populates="items")

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    watchlist_id = Column(Uuid, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)

    watchlist = relationship("Watchlist", back_populates="sessions")
