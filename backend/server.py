"""DÇK-EÖS Fiyat Endeksi — FastAPI backend.

Read-only API over a swappable Repository. Binds to 127.0.0.1 only; no
auth, no network calls, no telemetry, single machine.

Data source selection:
  --fixtures (CLI flag) or DCK_EOS_FIXTURES=1  -> FixtureRepository (JSON)
  --db <path> or DCK_EOS_DB=<path>             -> SqliteRepository on that file
  otherwise                                    -> SqliteRepository(config/config.json: db_path)
If the SQLite file does not exist the server falls back to fixtures and says so.
"""
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, FastAPI, File, Form, Query, UploadFile
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware

from fastapi import HTTPException

from app import models as M
from app import baskets_store
from app.data.repository import FixtureRepository, Repository, SqliteRepository, load_config
from app.exports import build_excel, build_pdf, tuik_compare

ROOT_DIR = Path(__file__).parent

FIXTURES_DIR = ROOT_DIR / "fixtures"
CONFIG_DIR = ROOT_DIR.parent / "config"
METHOD_FILE = ROOT_DIR.parent / "METODOLOJI.md"

HOST = "127.0.0.1"
PORT = 8001
# Only the local dev server and the Tauri shell may call the API.
CORS_ORIGINS = ["http://localhost:3000", "tauri://localhost"]

USE_FIXTURES = "--fixtures" in sys.argv or os.environ.get("DCK_EOS_FIXTURES") == "1"


def _db_path_from_args() -> Optional[str]:
    if "--db" in sys.argv and sys.argv.index("--db") + 1 < len(sys.argv):
        return sys.argv[sys.argv.index("--db") + 1]
    return os.environ.get("DCK_EOS_DB") or load_config(CONFIG_DIR, "config").get("db_path")


def _select_repository(use_fixtures: bool) -> Repository:
    if use_fixtures:
        return FixtureRepository(FIXTURES_DIR)
    db = _db_path_from_args()
    if db and Path(db).exists():
        cfg = load_config(CONFIG_DIR, "config")
        try:
            repo_ = SqliteRepository(db, CONFIG_DIR, app_version=cfg.get("app_version", "1.0.0"))
        except Exception as e:  # noqa: BLE001 — tablolar henuz yoksa uygulama yine acilsin
            print(f"[server] UYARI: SQLite acilamadi ({db}): {e}; fikstur verisiyle basliyor.")
            return FixtureRepository(FIXTURES_DIR)
        print(f"[server] SQLite (salt-okunur): {db}")
        return repo_
    print(f"[server] UYARI: SQLite bulunamadi ({db}); fikstur verisiyle basliyor. --db <yol> ya da config/config.json: db_path")
    return FixtureRepository(FIXTURES_DIR)


repo: Repository = _select_repository(USE_FIXTURES)


def _or_404(value, what: str):
    if not value:
        raise HTTPException(status_code=404, detail=f"{what} bulunamadı")
    return value

app = FastAPI(title="DÇK-EÖS Fiyat Endeksi")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"message": "DÇK-EÖS Fiyat Endeksi API"}


@api.get("/meta", response_model=M.Meta)
async def get_meta():
    return repo.meta()


@api.get("/index", response_model=M.IndexResponse)
async def get_index(level: str = "TOPLAM", kod: Optional[str] = None,
                    from_: Optional[str] = Query(None, alias="from"),
                    to: Optional[str] = None):
    return _or_404(repo.index(level, kod, from_, to), "seri")


@api.get("/index/multi", response_model=List[M.IndexResponse])
async def get_index_multi(kodlar: str = "",
                          from_: Optional[str] = Query(None, alias="from"),
                          to: Optional[str] = None):
    kods = [k.strip() for k in kodlar.split(",") if k.strip()]
    return repo.index_multi(kods, from_, to)


@api.get("/tree", response_model=List[M.TreeNode])
async def get_tree():
    return repo.tree()


@api.get("/contrib", response_model=List[M.Contrib])
async def get_contrib(from_: Optional[str] = Query(None, alias="from"),
                      to: Optional[str] = None, level: str = "bolum"):
    return repo.contrib(from_, to, level)


@api.get("/sources/{kod}", response_model=List[M.SourceSeries])
async def get_sources(kod: str, from_: Optional[str] = Query(None, alias="from"),
                      to: Optional[str] = None):
    return repo.sources(kod, from_, to)


@api.get("/items/{kod}", response_model=M.ItemsResponse)
async def get_items(kod: str, from_: Optional[str] = Query(None, alias="from"),
                    to: Optional[str] = None, page: int = 1, sort: str = "urun_adi"):
    return repo.items(kod, from_, to, page, sort)


@api.get("/item/{kimlik:path}", response_model=M.ItemDetail)
async def get_item(kimlik: str, from_: Optional[str] = Query(None, alias="from"),
                   to: Optional[str] = None):
    return _or_404(repo.item(kimlik, from_, to), "kalem")


@api.get("/quality", response_model=M.QualityResponse)
async def get_quality(days: int = 14):
    return repo.quality(days)


@api.get("/baskets", response_model=M.Baskets)
async def get_baskets():
    return repo.baskets()


@api.get("/baskets/sabit", response_model=List[str])
async def get_baskets_sabit():
    """Preset names that cannot be deleted or overwritten (config/sepetler.json: _sabit)."""
    return baskets_store.sabit()


@api.post("/baskets", response_model=M.Baskets)
async def post_baskets(body: M.BasketSave):
    """Save custom weights under a name into config/sepetler.json (the only file the app writes)."""
    try:
        return baskets_store.kaydet(body.ad, body.agirliklar)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@api.delete("/baskets/{ad}", response_model=M.Baskets)
async def delete_baskets(ad: str):
    try:
        return baskets_store.sil(ad)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except KeyError:
        raise HTTPException(status_code=404, detail="sepet bulunamadı")


@api.get("/search", response_model=List[M.SearchHit])
async def get_search(q: str = ""):
    if not q:
        return []
    return repo.search(q)


@api.get("/method")
async def get_method():
    text = METHOD_FILE.read_text(encoding="utf-8") if METHOD_FILE.exists() else "# Yöntem\n"
    return {"markdown": text}


@api.post("/basket/compute", response_model=M.BasketResult)
async def post_basket(body: Dict[str, Any]):
    weights = body.get("weights", {})
    frm = body.get("from")
    to = body.get("to")
    return repo.basket_compute(weights, frm, to)


@api.post("/tuik/compare")
async def post_tuik(file: UploadFile = File(...),
                    from_: Optional[str] = Form(None, alias="from"),
                    to: Optional[str] = Form(None)):
    content = await file.read()
    return tuik_compare(repo, content, from_, to)


@api.post("/export/excel")
async def post_excel(body: Dict[str, Any]):
    data = build_excel(body.get("screen", "veri"), body.get("payload", {}))
    screen = body.get("screen", "veri")
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{screen}.xlsx"'},
    )


@api.post("/export/pdf")
async def post_pdf(body: Dict[str, Any]):
    data = build_pdf(repo, body.get("from"), body.get("to"))
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="bulten.pdf"'},
    )


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    import uvicorn

    # `python server.py [--fixtures | --db <yol>]` — the sidecar entry point; never 0.0.0.0.
    uvicorn.run(app, host=HOST, port=PORT)
