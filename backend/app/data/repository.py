"""Data-access layer for the price index.

A single `Repository` interface isolates the data source so the fixture
implementation can be swapped for a real SQLite reader later without touching
the API layer. `FixtureRepository` reads the static JSON fixtures;
`SqliteRepository` (sqlite_repository.py) reads the nightly tables.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

# Repo-level config (config/*.json). No hard-coded paths elsewhere.
DEFAULT_CONFIG_DIR = Path(__file__).resolve().parents[3] / "config"

# Preset whose weights come from the stored index, not from config/sepetler.json.
TUIK_SEPET = "TÜİK 2026"
# Class states in which the index was carried rather than chained (see app/models.py).
DEVREDEN_DURUMLAR = ("CARRY", "CARRY_GUN_YOK", "ZINCIR_KOPUK")

# "Temsil zayıf" rule (handover note §5): weight >= 0.3, items < 10, not a tariff class.
WEAK_MIN_WEIGHT = 0.3
WEAK_MAX_ITEMS = 10


def load_config(config_dir: Path, name: str) -> Dict[str, Any]:
    """Read config/<name>.json; missing file -> {} so fixtures work without config."""
    p = Path(config_dir) / f"{name}.json"
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def _in_range(tarih: str, frm: Optional[str], to: Optional[str]) -> bool:
    if frm and tarih < frm:
        return False
    if to and tarih > to:
        return False
    return True


class Repository(ABC):
    """Single interface every data source must implement."""

    @abstractmethod
    def meta(self) -> Dict[str, Any]: ...

    @abstractmethod
    def index(self, level: str, kod: Optional[str], frm: Optional[str], to: Optional[str]) -> Dict[str, Any]: ...

    @abstractmethod
    def index_multi(self, kodlar: List[str], frm: Optional[str], to: Optional[str]) -> List[Dict[str, Any]]: ...

    @abstractmethod
    def tree(self) -> List[Dict[str, Any]]: ...

    @abstractmethod
    def contrib(self, frm: Optional[str], to: Optional[str], level: str) -> List[Dict[str, Any]]: ...

    @abstractmethod
    def sources(self, kod: str, frm: Optional[str], to: Optional[str]) -> List[Dict[str, Any]]: ...

    @abstractmethod
    def items(self, kod: str, frm: Optional[str], to: Optional[str], page: int, sort: str) -> Dict[str, Any]: ...

    @abstractmethod
    def item(self, kimlik: str, frm: Optional[str], to: Optional[str]) -> Dict[str, Any]: ...

    @abstractmethod
    def quality(self, days: int) -> Dict[str, Any]: ...

    @abstractmethod
    def basket_compute(self, weights: Dict[str, float], frm: Optional[str], to: Optional[str]) -> Dict[str, Any]: ...

    @abstractmethod
    def baskets(self) -> Dict[str, Dict[str, float]]: ...

    @abstractmethod
    def tuik_basket(self) -> Dict[str, Any]:
        """The 'TÜİK 2026' preset: covered division weights that produce exactly the TOPLAM series
        (same denominator as the dashboard). {ad, tarih, agirlik, tam_agirlik, kapsanan_toplam}."""
        ...

    @abstractmethod
    def search(self, q: str) -> List[Dict[str, Any]]: ...

    @abstractmethod
    def class_changes(self, level: str, frm: Optional[str], to: Optional[str]) -> List[Dict[str, Any]]:
        """Period change per node at `level` (e.g. "bolum", "sinif5").

        Each row: {kod, ad_tr, agirlik, endeks_bas, endeks_bit, degisim}.
        `degisim` is the stored-index ratio I(t2)/I(t1) - 1 in percent; nodes
        with fewer than two points in range are omitted. Consumers
        (PDF bulletin, TÜİK compare) must use this instead of touching the
        underlying node/series storage.
        """
        ...


class FixtureRepository(Repository):
    def __init__(self, fixtures_dir: Path, config_dir: Optional[Path] = None):
        self.dir = Path(fixtures_dir)
        self.config_dir = Path(config_dir) if config_dir else DEFAULT_CONFIG_DIR
        self._tarife = {c["kod"] for c in load_config(self.config_dir, "tarife_siniflari").get("siniflar", [])}
        # Section (kısım) names + fed COICOP divisions; no DB counterpart.
        self._kisimlar: Dict[str, Dict[str, Any]] = load_config(self.config_dir, "kisim_adlari").get("kisimlar", {})
        # MASTER rc canon: colour + meaning per return code.
        self._rc_kodlari: List[Dict[str, Any]] = load_config(self.config_dir, "rc_kodlari").get("kodlar", [])
        self._nodes: List[Dict[str, Any]] = self._load("nodes.json")
        self._items: Dict[str, List[Dict[str, Any]]] = self._load("items.json")
        self._item_series: Dict[str, Any] = self._load("item_series.json")
        self._quality: Dict[str, Any] = self._load("quality.json")
        self._baskets: Dict[str, Any] = self._load("baskets.json")
        self._meta: Dict[str, Any] = self._load("meta.json")
        self._by_kod = {n["kod"]: n for n in self._nodes}

    def _load(self, name: str):
        return json.loads((self.dir / name).read_text(encoding="utf-8"))

    # -- helpers ------------------------------------------------------------
    def _filter_series(self, series, frm, to):
        return [p for p in series if _in_range(p["tarih"], frm, to)]

    def _period_change(self, node, frm, to) -> float:
        s = self._filter_series(node["series"], frm, to)
        if len(s) < 2:
            return 0.0
        return round((s[-1]["endeks"] / s[0]["endeks"] - 1) * 100, 2)

    def _leaves_under(self, kod: str) -> List[Dict[str, Any]]:
        node = self._by_kod.get(kod)
        if node and node["seviye"] == "sinif5":
            return [node]
        result = []
        prefix_children = [n for n in self._nodes if n.get("parent") == kod]
        for ch in prefix_children:
            result.extend(self._leaves_under(ch["kod"]))
        return result

    # -- interface ----------------------------------------------------------
    def meta(self):
        return self._meta

    def index(self, level, kod, frm, to):
        node = None
        if kod:
            node = self._by_kod.get(kod)
        elif level == "TOPLAM":
            node = self._by_kod.get("TOPLAM")
        if not node:
            return {}
        return {
            "kod": node["kod"],
            "ad_tr": node["ad_tr"],
            "agirlik": node["agirlik"],
            "seviye": node["seviye"],
            "series": self._filter_series(node["series"], frm, to),
        }

    def index_multi(self, kodlar, frm, to):
        out = []
        for k in kodlar:
            node = self._by_kod.get(k)
            if not node:
                continue
            out.append({
                "kod": node["kod"],
                "ad_tr": node["ad_tr"],
                "seviye": node["seviye"],
                "agirlik": node["agirlik"],
                "series": self._filter_series(node["series"], frm, to),
            })
        return out

    def tree(self):
        def build(kod):
            node = self._by_kod[kod]
            children = sorted(
                [n for n in self._nodes if n.get("parent") == kod],
                key=lambda x: x["kod"],
            )
            out = {
                "kod": node["kod"],
                "ad_tr": node["ad_tr"],
                "seviye": node["seviye"],
                "agirlik": node["agirlik"],
                "degisim_donem": self._period_change(node, None, None),
                "children": [build(c["kod"]) for c in children],
            }
            if node["seviye"] == "sinif5" and node.get("series"):
                durum = node["series"][-1].get("durum") or "FRESH"
                out["durum"] = durum
                out["devreden_gun"] = carry_gun.get(node["kod"], 1) if durum in DEVREDEN_DURUMLAR else 0
                out["tarife"] = node["kod"] in self._tarife
            return out

        carry_gun = {c["kod"]: int(c.get("gun", 1)) for c in self._quality.get("carry_classes", [])}
        return build("TOPLAM")["children"]

    def contrib(self, frm, to, level):
        """katki_B = w_B (I_B(t2) - I_B(t1)) / sum_B w_B I_B(t1) (puan) — sums to the level's period change."""
        rows = self.class_changes(level, frm, to)
        payda = sum(c["agirlik"] * c["endeks_bas"] for c in rows)
        out = []
        for c in rows:
            katki = 100.0 * c["agirlik"] * (c["endeks_bit"] - c["endeks_bas"]) / payda if payda else 0.0
            out.append({**c, "katki_puan": round(katki, 3)})
        out.sort(key=lambda x: abs(x["katki_puan"]), reverse=True)
        return out

    def sources(self, kod, frm, to):
        # Fixture-only imitation of a per-source series (deterministic offset
        # over member leaves). Real data comes from the nightly
        # `endeks_sinif_kaynak` table; SqliteRepository must only read it.
        leaves = self._leaves_under(kod)
        # aggregate items by source across leaves of this node
        agg: Dict[str, Dict[str, Any]] = {}
        for leaf in leaves:
            for it in self._items.get(leaf["kod"], []):
                key = it["kaynak"]
                a = agg.setdefault(key, {"kaynak": key, "kisim_no": it["kisim_no"],
                                         "kalem_sayisi": 0, "_leaves": set()})
                a["kalem_sayisi"] += 1
                a["_leaves"].add(leaf["kod"])
        out = []
        for src, a in agg.items():
            # per-source series = weighted avg of member leaves w/ deterministic offset
            member = [self._by_kod[k] for k in a["_leaves"]]
            n = len(self._filter_series(member[0]["series"], frm, to)) if member else 0
            filt = [self._filter_series(m["series"], frm, to) for m in member]
            offset = (sum(ord(c) for c in src) % 7 - 3) * 0.05
            series = []
            if filt and filt[0]:
                for i in range(len(filt[0])):
                    vals = [f[i]["endeks"] for f in filt if i < len(f)]
                    v = sum(vals) / len(vals) + offset
                    series.append({"tarih": filt[0][i]["tarih"], "endeks": round(v, 2)})
            out.append({"kaynak": src, "kisim_no": a["kisim_no"],
                        "kalem_sayisi": a["kalem_sayisi"], "series": series})
        out.sort(key=lambda x: x["kaynak"])
        return out

    def items(self, kod, frm, to, page, sort):
        leaves = self._leaves_under(kod)
        rows: List[Dict[str, Any]] = []
        for leaf in leaves:
            rows.extend(self._items.get(leaf["kod"], []))
        reverse = sort.startswith("-")
        key = sort.lstrip("-") or "urun_adi"
        if key not in ("urun_adi", "kaynak", "son_fiyat", "degisim", "gun", "kisim_no"):
            key = "urun_adi"
        rows = sorted(rows, key=lambda r: r.get(key), reverse=reverse)
        total = len(rows)
        size = 25
        start = (max(page, 1) - 1) * size
        return {"total": total, "items": rows[start:start + size]}

    def item(self, kimlik, frm, to):
        it = self._item_series.get(kimlik)
        if not it:
            return {}
        return {
            "kimlik": kimlik,
            "urun_adi": it["urun_adi"],
            "kaynak": it["kaynak"],
            "series": self._filter_series(it["series"], frm, to),
        }

    def weak_classes(self) -> List[Dict[str, Any]]:
        """sinif5 nodes whose representation is weak (see WEAK_* constants)."""
        out = []
        for n in self._nodes:
            if n["seviye"] != "sinif5" or n["kod"] in self._tarife:
                continue
            kalem = len(self._items.get(n["kod"], []))
            if n["agirlik"] >= WEAK_MIN_WEIGHT and kalem < WEAK_MAX_ITEMS:
                out.append({"kod": n["kod"], "ad_tr": n["ad_tr"],
                            "agirlik": n["agirlik"], "kalem": kalem})
        out.sort(key=lambda x: -x["agirlik"])
        return out

    def quality(self, days):
        q = self._quality
        sections = []
        for s in q["sections"]:
            cfg = self._kisimlar.get(str(s["kisim_no"]), {})
            sections.append({**s, "ad": cfg.get("ad", s["ad"]),
                             "bolumler": list(cfg.get("bolumler", [])),
                             "days": s["days"][-days:]})
        return {"sections": sections, "carry_classes": q["carry_classes"],
                "exclusions": q["exclusions"], "weak_classes": self.weak_classes(),
                "rc_kodlari": self._rc_kodlari}

    def basket_compute(self, weights, frm, to):
        total_w = sum(weights.values()) or 1.0
        member = []
        for kod, w in weights.items():
            node = self._by_kod.get(kod)
            if node:
                member.append((node, w))
        series = []
        if member:
            base = self._filter_series(member[0][0]["series"], frm, to)
            for i in range(len(base)):
                v = sum(self._filter_series(n["series"], frm, to)[i]["endeks"] * w
                        for n, w in member) / total_w
                series.append({"tarih": base[i]["tarih"], "endeks": round(v, 2)})
        contrib = []
        for node, w in member:
            s = self._filter_series(node["series"], frm, to)
            if len(s) < 2:
                continue
            deg = (s[-1]["endeks"] / s[0]["endeks"] - 1) * 100
            contrib.append({
                "kod": node["kod"], "ad_tr": node["ad_tr"], "agirlik": round(w, 2),
                "degisim": round(deg, 2), "katki_puan": round(deg * w / total_w, 3),
            })
        contrib.sort(key=lambda x: abs(x["katki_puan"]), reverse=True)
        return {"series": series, "contrib": contrib}

    def tuik_basket(self):
        bolum = [n for n in self._nodes if n["seviye"] == "bolum"]
        w = {n["kod"]: float(n["agirlik"]) for n in bolum}
        return {"ad": TUIK_SEPET, "tarih": self._meta.get("data_date", ""), "agirlik": w, "tam_agirlik": dict(w),
                "kapsanan_toplam": sum(w.values())}

    def baskets(self):
        # 'TÜİK 2026' is derived from the stored division weights (never written to the store);
        # config/sepetler.json holds the other presets and user baskets (fixture file = fallback).
        from app.baskets_store import baskets as _store
        store = _store() or self._baskets
        return {TUIK_SEPET: self.tuik_basket()["agirlik"], **{k: v for k, v in store.items() if k != TUIK_SEPET}}

    def class_changes(self, level, frm, to):
        out = []
        for n in self._nodes:
            if n["seviye"] != level:
                continue
            s = self._filter_series(n["series"], frm, to)
            if len(s) < 2:
                continue
            bas, bit = s[0]["endeks"], s[-1]["endeks"]
            out.append({
                "kod": n["kod"], "ad_tr": n["ad_tr"], "agirlik": n["agirlik"],
                "endeks_bas": round(bas, 2), "endeks_bit": round(bit, 2),
                "degisim": round((bit / bas - 1) * 100, 2),
            })
        out.sort(key=lambda x: x["kod"])
        return out

    def search(self, q):
        ql = q.lower()
        out = []
        for n in self._nodes:
            if ql in n["ad_tr"].lower() or ql in n["kod"]:
                out.append({"type": "class", "kod": n["kod"], "ad_tr": n["ad_tr"],
                            "seviye": n["seviye"]})
        for kimlik, it in self._item_series.items():
            if ql in it["urun_adi"].lower():
                out.append({"type": "item", "kimlik": kimlik, "ad_tr": it["urun_adi"],
                            "kaynak": it["kaynak"]})
        return out[:30]


# Real data source: reads the nightly tables of fiyat_takip.sqlite (read-only).
from .sqlite_repository import SqliteRepository  # noqa: E402,F401
