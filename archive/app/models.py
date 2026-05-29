from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Style(Base):
    __tablename__ = "styles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    color = Column(String)  # 颜色标签，如「冰透粉」
    design = Column(String)  # 图案/工艺，如「猫眼」
    shape = Column(String)  # 甲形，如「杏仁形」
    style = Column(String)  # 风格/气质，如「甜美少女」
    image_url = Column(String)
    rank_weight = Column(Float, default=1.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    try_on_logs = relationship("TryOnLog", back_populates="style")
    favorites = relationship("Favorite", back_populates="style")
    operation_logs = relationship("OperationLog", back_populates="style")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nickname = Column(String)
    avatar_url = Column(String)
    is_member = Column(Boolean, default=False)
    member_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    try_on_logs = relationship("TryOnLog", back_populates="user")
    favorites = relationship("Favorite", back_populates="user")


class TryOnLog(Base):
    __tablename__ = "try_on_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    style_id = Column(Integer, ForeignKey("styles.id"), nullable=False)
    tried_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="try_on_logs")
    style = relationship("Style", back_populates="try_on_logs")


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "style_id", name="uq_user_style"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    style_id = Column(Integer, ForeignKey("styles.id"), nullable=False)
    saved_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    style = relationship("Style", back_populates="favorites")


class ExternalTrend(Base):
    __tablename__ = "external_trends"

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String)
    post_url = Column(String, unique=True)
    engagement = Column(Integer)
    color = Column(String)  # 颜色标签，如「冰透粉」
    design = Column(String)  # 图案/工艺，如「猫眼」
    shape = Column(String)  # 甲形，如「杏仁形」
    style = Column(String)  # 风格/气质，如「甜美少女」
    posted_at = Column(DateTime, nullable=True)
    # 帖子在平台的原始发布时间（区别于 scraped_at 爬取时间）
    scraped_at = Column(DateTime, default=datetime.utcnow)


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_date = Column(Date, unique=True)
    content_md = Column(Text)
    strategy_json = Column(Text)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    operation_logs = relationship("OperationLog", back_populates="report")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(Integer, ForeignKey("daily_reports.id"), nullable=True)
    style_id = Column(Integer, ForeignKey("styles.id"), nullable=False)
    weight_before = Column(Float)
    weight_after = Column(Float)
    source = Column(String)
    executed_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("DailyReport", back_populates="operation_logs")
    style = relationship("Style", back_populates="operation_logs")
