import json
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Crime Room Game")

DATA_DIR = Path("/data") if os.path.isdir("/data") else Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
RESULTS_FILE = DATA_DIR / "results.json"


def load_results() -> list[dict]:
    if RESULTS_FILE.exists():
        try:
            return json.loads(RESULTS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_results(results: list[dict]) -> None:
    RESULTS_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


class ResultIn(BaseModel):
    name: str
    room: str
    time: str
    elapsed_ms: int


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


@app.get("/")
async def index():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
