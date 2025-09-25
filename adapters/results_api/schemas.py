from datetime import datetime
from typing import Optional, Tuple
from pydantic import BaseModel, Field

class DetectionEvent(BaseModel):
    camera_id: str
    ts: datetime
    bbox: Tuple[float, float, float, float]
    score: float = Field(ge=0, le=1)
    class_name: str
    frame_id: Optional[str] = None
    model_ver: Optional[str] = None
    run_id: Optional[str] = None
    sha256: Optional[str] = None

class WorkOrderLink(BaseModel):
    work_order_id: str
    step: Optional[str] = None