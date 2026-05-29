from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Style
from app.schemas import StyleOut

router = APIRouter()


@router.get("", response_model=List[StyleOut])
def list_styles(db: Session = Depends(get_db)):
    """返回全部款式列表。"""
    return db.query(Style).order_by(Style.rank_weight.desc(), Style.id).all()
