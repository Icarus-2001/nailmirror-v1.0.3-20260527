from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class StyleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: Optional[str] = None
    design: Optional[str] = None
    shape: Optional[str] = None
    style: Optional[str] = None
    image_url: Optional[str] = None
    rank_weight: float
    is_active: bool
    created_at: Optional[datetime] = None


class HotStyleOut(BaseModel):
    style_id: int
    name: str
    try_count: int
    color: Optional[str] = None
    design: Optional[str] = None
    shape: Optional[str] = None
    style: Optional[str] = None
    image_url: Optional[str] = None
    rank_weight: float
