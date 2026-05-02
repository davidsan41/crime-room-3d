import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Escape Room 3D")

DATA_DIR = Path("/data") if os.path.isdir("/data") else Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
RESULTS_FILE = DATA_DIR / "results.json"
PLAYERS_INFO_FILE = DATA_DIR / "players_info.json"


def _load(path: Path) -> list[dict]:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            return []
    return []


def _save(path: Path, data: list[dict]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class ResultIn(BaseModel):
    name: str
    room: str
    time: str
    elapsed_ms: int


class PlayerInfoIn(BaseModel):
    name: str
    room: str
    device: str
    platform: str
    language: str
    screenWidth: int
    screenHeight: int
    ip: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


@app.post("/api/results")
async def create_result(result: ResultIn):
    results = _load(RESULTS_FILE)
    results.append(
        {
            "name": result.name,
            "room": result.room,
            "time": result.time,
            "elapsed_ms": result.elapsed_ms,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        }
    )
    _save(RESULTS_FILE, results)
    return {"ok": True}


@app.get("/api/results")
async def get_results():
    return JSONResponse({"results": _load(RESULTS_FILE)})


@app.post("/api/pinfo")
async def save_player_info(info: PlayerInfoIn, request: Request):
    players = _load(PLAYERS_INFO_FILE)
    forwarded = request.headers.get("x-forwarded-for", "")
    server_ip = (
        forwarded.split(",")[0].strip()
        if forwarded
        else (request.client.host if request.client else "")
    )
    players.append(
        {
            "name": info.name,
            "room": info.room,
            "device": info.device,
            "platform": info.platform,
            "language": info.language,
            "screen": f"{info.screenWidth}x{info.screenHeight}",
            "ip": info.ip or server_ip,
            "city": info.city or "",
            "country": info.country or "",
            "joinTime": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        }
    )
    _save(PLAYERS_INFO_FILE, players)
    return {"ok": True}


@app.get("/api/pinfo")
async def get_players_info():
    return JSONResponse({"players": _load(PLAYERS_INFO_FILE)})


@app.get("/")
async def index():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
