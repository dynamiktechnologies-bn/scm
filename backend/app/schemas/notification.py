from datetime import datetime
from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    message: str
    document_type: str | None
    document_id: int | None
    document_number: str | None
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class NotificationMarkReadRequest(BaseModel):
    is_read: bool = True
