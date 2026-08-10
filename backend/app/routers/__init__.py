from app.routers.auth import router as auth_router
from app.routers.equipment import router as equipment_router
from app.routers.rentals import router as rentals_router

__all__ = ["auth_router", "equipment_router", "rentals_router"]
