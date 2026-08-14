from app.routers.auth import router as auth_router
from app.routers.chats import router as chats_router
from app.routers.equipment import router as equipment_router
from app.routers.notifications import router as notifications_router
from app.routers.rentals import router as rentals_router

__all__ = [
    "auth_router",
    "chats_router",
    "equipment_router",
    "notifications_router",
    "rentals_router",
]
