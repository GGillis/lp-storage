import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from database import init_db
from routes import records, lookup, explore, stats, games, games_lookup, ai_tags


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="LP Storage", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server (dev only)
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(records.router, prefix="/api/records")
app.include_router(lookup.router, prefix="/api/lookup")
app.include_router(explore.router, prefix="/api/explore")
app.include_router(stats.router, prefix="/api/stats")
app.include_router(games.router, prefix="/api/games")
app.include_router(games_lookup.router, prefix="/api/games/lookup")
app.include_router(ai_tags.router, prefix="/api/ai")


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve the built React app in production.
# StaticFiles serves actual assets (JS, CSS, images).
# The 404 handler catches any path that StaticFiles can't resolve (e.g. /games,
# /admin) and returns index.html so React Router handles the route client-side.
_static = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static):
    app.mount("/", StaticFiles(directory=_static, html=True), name="spa")

    @app.exception_handler(StarletteHTTPException)
    async def spa_fallback(request, exc):
        if exc.status_code == 404:
            index = os.path.join(_static, "index.html")
            if os.path.isfile(index):
                return FileResponse(index)
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
