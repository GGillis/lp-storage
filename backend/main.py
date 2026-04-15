from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routes import records, lookup, explore


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="LP Storage", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(records.router, prefix="/api/records")
app.include_router(lookup.router, prefix="/api/lookup")
app.include_router(explore.router, prefix="/api/explore")


@app.get("/health")
def health():
    return {"status": "ok"}
