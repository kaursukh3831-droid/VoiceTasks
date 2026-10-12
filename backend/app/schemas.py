from typing import Optional
from pydantic import BaseModel, Field

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    date: Optional[str] = None
    time: Optional[str] = None
    priority: str = "Medium"
    category: str = "General"
    completed: bool = False

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=180)
    date: Optional[str] = None
    time: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    completed: Optional[bool] = None
