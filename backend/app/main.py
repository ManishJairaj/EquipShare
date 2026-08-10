from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth_router, equipment_router

# Auto-create tables if they do not exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="EquipShare API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(equipment_router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "EquipShare API is running"}
