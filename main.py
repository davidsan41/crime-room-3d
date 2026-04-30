import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Crime Room Game")

DATA_DIR = Path("/data") if os.path.isdir("/data") else Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
RESULTS_FILE = DATA_DIR / "results.json"
PLAYERS_INFO_FILE = DATA_DIR / "players_info.json"


def load_results() -> list[dict]:
    if RESULTS_FILE.exists():
        try:
            return json.loads(RESULTS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_results(results: list[dict]) -> None:
    RESULTS_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


def load_players_info() -> list[dict]:
    if PLAYERS_INFO_FILE.exists():
        try:
            return json.loads(PLAYERS_INFO_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_players_info(info: list[dict]) -> None:
    PLAYERS_INFO_FILE.write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")


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
    isp: Optional[str] = None


@app.post("/api/results")
async def create_result(result: ResultIn):
    results = load_results()
    results.append(
        {
            "name": result.name,
            "room": result.room,
            "time": result.time,
            "elapsed_ms": result.elapsed_ms,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        }
    )
    save_results(results)
    return {"ok": True}


@app.get("/api/results")
async def get_results():
    return JSONResponse({"results": load_results()})


@app.post("/api/pinfo")
async def save_player_info(info: PlayerInfoIn, request: Request):
    players = load_players_info()
    forwarded = request.headers.get("x-forwarded-for", "")
    server_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")
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
            "isp": info.isp or "",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        }
    )
    save_players_info(players)
    return {"ok": True}


@app.get("/api/pinfo")
async def get_players_info():
    return JSONResponse({"players": load_players_info()})


@app.get("/")
async def index():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
