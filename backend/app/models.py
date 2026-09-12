"""Pydantic response models — the API contract (mirror of frontend/src/types.ts).

Both repositories (fixture JSON and SQLite) must produce exactly these shapes;
server.py attaches them as `response_model`, so the smoke tests validate the
fixture and the SQLite tests validate the real data through the same models.
"""
from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel

Seviye = Literal["TOPLAM", "bolum", "grup", "sinif4", "sinif5"]
Durum = Literal["FRESH", "CARRY", "CARRY_GUN_YOK", "ZINCIR_KOPUK", "BASLANGIC"]
# "devreden" = every state where the class index was carried, not chained.
DEVREDEN_DURUMLAR = ("CARRY", "CARRY_GUN_YOK", "ZINCIR_KOPUK")


class Meta(BaseModel):
    data_date: str
    base_day: str
    coverage_weight: float
    class_count: int
    carry_count: int
    app_version: str
    yontem_surumu: str


class SeriesPoint(BaseModel):
    tarih: str
    endeks: float
    eslesen_kalem: Optional[int] = None
    durum: Optional[Durum] = None


class IndexResponse(BaseModel):
    kod: str
    ad_tr: str
    agirlik: float
    seviye: Seviye
    series: List[SeriesPoint]


class TreeNode(BaseModel):
    kod: str
    ad_tr: str
    seviye: Seviye
    agirlik: float
    degisim_donem: float
    children: List["TreeNode"]


class ClassChange(BaseModel):
    kod: str
    ad_tr: str
    agirlik: float
    endeks_bas: float
    endeks_bit: float
    degisim: float


class Contrib(ClassChange):
    katki_puan: float


class PricePoint(BaseModel):
    tarih: str
    endeks: float


class SourceSeries(BaseModel):
    kaynak: str
    kisim_no: int
    kalem_sayisi: int
    series: List[PricePoint]


class Item(BaseModel):
    kimlik: str
    urun_adi: str
    kaynak: str
    kisim_no: int
    son_fiyat: float
    degisim: float
    gun: int


class ItemsResponse(BaseModel):
    total: int
    items: List[Item]


class ItemPrice(BaseModel):
    tarih: str
    fiyat: float


class ItemDetail(BaseModel):
    kimlik: str
    urun_adi: str
    kaynak: str
    series: List[ItemPrice]


class QualityDay(BaseModel):
    tarih: str
    rc: int


class QualitySection(BaseModel):
    kisim_no: int
    ad: str
    bolumler: List[str]
    days: List[QualityDay]


class CarryClass(BaseModel):
    kod: str
    ad_tr: str
    agirlik: float
    gun: int


class Exclusion(BaseModel):
    neden: str
    satir: int


class WeakClass(BaseModel):
    kod: str
    ad_tr: str
    agirlik: float
    kalem: int


class RcCode(BaseModel):
    rc: int
    ad: str
    aciklama: str
    renk: str


class QualityResponse(BaseModel):
    sections: List[QualitySection]
    carry_classes: List[CarryClass]
    exclusions: List[Exclusion]
    weak_classes: List[WeakClass]
    rc_kodlari: List[RcCode]


class BasketContrib(BaseModel):
    kod: str
    ad_tr: str
    agirlik: float
    degisim: float
    katki_puan: float


class BasketResult(BaseModel):
    series: List[PricePoint]
    contrib: List[BasketContrib]


class SearchHit(BaseModel):
    type: Literal["class", "item"]
    kod: Optional[str] = None
    kimlik: Optional[str] = None
    ad_tr: str
    seviye: Optional[Seviye] = None
    kaynak: Optional[str] = None


Baskets = Dict[str, Dict[str, float]]


class BasketSave(BaseModel):
    ad: str
    agirliklar: Dict[str, float]

TreeNode.model_rebuild()
