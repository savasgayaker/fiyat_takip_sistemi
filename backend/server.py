"""DÇK-EÖS Fiyat Endeksi — FastAPI backend.

Serves the price-index API from static JSON fixtures via a swappable
Repository. Runs on localhost (0.0.0.0:8001 inside the container). No auth,
no external calls, single machine.
"""
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, Form, Query, UploadFile
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware

from app.data.repository import FixtureRepository
from app.exports import build_excel, build_pdf, tuik_compare

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

FIXTURES_DIR = ROOT_DIR / "fixtures"
METHOD_FILE = ROOT_DIR.parent / "METODOLOJI.md"

# Single construction site — swap FixtureRepository for SqliteRepository later.
repo = FixtureRepository(FIXTURES_DIR)

app = FastAPI(title="DÇK-EÖS Fiyat Endeksi")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"message": "DÇK-EÖS Fiyat Endeksi API"}


@api.get("/meta")
async def get_meta():
    return repo.meta()


@api.get("/index")
async def get_index(level: str = "TOPLAM", kod: Optional[str] = None,
                    from_: Optional[str] = Query(None, alias="from"),
                    to: Optional[str] = None):
    return repo.index(level, kod, from_, to)


@api.get("/index/multi")
async def get_index_multi(kodlar: str = "",
                          from_: Optional[str] = Query(None, alias="from"),
                          to: Optional[str] = None):
    kods = [k.strip() for k in kodlar.split(",") if k.strip()]
    return repo.index_multi(kods, from_, to)


@api.get("/tree")
async def get_tree():
    return repo.tree()


@api.get("/contrib")
async def get_contrib(from_: Optional[str] = Query(None, alias="from"),
                      to: Optional[str] = None, level: str = "bolum"):
    return repo.contrib(from_, to, level)


@api.get("/sources/{kod}")
async def get_sources(kod: str, from_: Optional[str] = Query(None, alias="from"),
                      to: Optional[str] = None):
    return repo.sources(kod, from_, to)


@api.get("/items/{kod}")
async def get_items(kod: str, from_: Optional[str] = Query(None, alias="from"),
                    to: Optional[str] = None, page: int = 1, sort: str = "urun_adi"):
    return repo.items(kod, from_, to, page, sort)


@api.get("/item/{kimlik}")
async def get_item(kimlik: str, from_: Optional[str] = Query(None, alias="from"),
                   to: Optional[str] = None):
    return repo.item(kimlik, from_, to)


@api.get("/quality")
async def get_quality(days: int = 14):
    return repo.quality(days)


@api.get("/baskets")
async def get_baskets():
    return repo.baskets()


@api.get("/search")
async def get_search(q: str = ""):
    if not q:
        return []
    return repo.search(q)


@api.get("/method")
async def get_method():
    text = METHOD_FILE.read_text(encoding="utf-8") if METHOD_FILE.exists() else "# Yöntem\n"
    return {"markdown": text}


@api.post("/basket/compute")
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
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
