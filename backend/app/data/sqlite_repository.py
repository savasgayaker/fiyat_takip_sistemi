"""SqliteRepository — reads the nightly tables of fiyat_takip.sqlite (read-only).

The application never computes the index. Everything here is a read or a
linear combination of stored class indices (upper levels, baskets), which the
handover note allows (§2). Tables touched: endeks_gunluk, endeks_sinif,
endeks_sinif_kaynak, endeks_kosu, master_rc, tuik_agirlik_2026, kisim, gozlem,
gozlem_coicop (only for items/search/exclusions; heavy scans are cached per
data date). Every index query is filtered by `yontem_surumu` (default: the
latest run's version).

Item identity in the API: "k<kisim_no>:<kimlik>" (kimlik alone is not unique
across sections and the (kisim_no, kimlik, tarih) index makes lookups cheap).
"""
from __future__ import annotations

import json
import sqlite3
import statistics
import sys
import threading
import unicodedata
from collections import OrderedDict, defaultdict
from math import fsum
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .repository import (DEFAULT_CONFIG_DIR, TUIK_SEPET, WEAK_MAX_ITEMS, WEAK_MIN_WEIGHT, Repository,
                         load_config)

DEVREDEN = ("CARRY", "CARRY_GUN_YOK", "ZINCIR_KOPUK")
PAGE_SIZE = 25
SORT_KEYS = ("urun_adi", "kaynak", "son_fiyat", "degisim", "gun", "kisim_no")
TOPLAM_AD = "Genel Endeks (TÜFE)"
RC_KAYIT_YOK = -1  # master_rc has no row for that section/day


def kaynak_anahtar(x: Optional[str]) -> str:
    """Same normalisation as fiyat_takip.endeks.veri.kaynak_anahtar (kept in sync; not index math)."""
    s = (x or "").casefold().strip()
    s = unicodedata.normalize("NFD", s).replace("̇", "")
    s = unicodedata.normalize("NFC", s)
    return s or "bilinmiyor"


def _seviye(kod: str) -> str:
    return "TOPLAM" if kod == "TOPLAM" else {2: "bolum", 3: "grup", 4: "sinif4", 5: "sinif5"}[len(kod)]


def _item_id(kisim_no: int, kimlik: str) -> str:
    return f"k{kisim_no}:{kimlik}"


def _parse_item_id(s: str) -> Tuple[Optional[int], str]:
    if s.startswith("k") and ":" in s:
        head, rest = s[1:].split(":", 1)
        if head.isdigit():
            return int(head), rest
    return None, s


def _median(xs: List[float]) -> float:
    return float(statistics.median(xs))


class _Cache:
    """Tiny LRU keyed by (data_date, *key) so a new nightly run invalidates everything."""

    def __init__(self, size: int = 16):
        self.size, self.d = size, OrderedDict()

    def get(self, key):
        if key in self.d:
            self.d.move_to_end(key)
            return self.d[key]
        return None

    def put(self, key, value):
        self.d[key] = value
        self.d.move_to_end(key)
        while len(self.d) > self.size:
            self.d.popitem(last=False)
        return value


class SqliteRepository(Repository):
    def __init__(self, db_path: str | Path, config_dir: Optional[Path] = None,
                 yontem_surumu: Optional[str] = None, app_version: str = "1.0.0"):
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"DB yok: {self.db_path}")
        self.config_dir = Path(config_dir) if config_dir else DEFAULT_CONFIG_DIR
        self.app_version = app_version
        self._lock = threading.Lock()
        self._con = sqlite3.connect(f"file:{self.db_path.resolve().as_posix()}?mode=ro", uri=True,
                                    check_same_thread=False)
        self._con.row_factory = sqlite3.Row
        eksik = [t for t in ("endeks_gunluk", "endeks_sinif", "endeks_sinif_kaynak", "master_rc", "tuik_agirlik_2026")
                 if not self._con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (t,)).fetchone()]
        if eksik:
            self._con.close()
            raise RuntimeError(f"endeks tablolari yok: {', '.join(eksik)} — once C:\\FiyatTakip\\endeks_yeniden_hesapla.py kosturun")
        self._tarife = {c["kod"] for c in load_config(self.config_dir, "tarife_siniflari").get("siniflar", [])}
        self._kisimlar: Dict[str, Dict[str, Any]] = load_config(self.config_dir, "kisim_adlari").get("kisimlar", {})
        self._rc_kodlari: List[Dict[str, Any]] = load_config(self.config_dir, "rc_kodlari").get("kodlar", [])
        self._surum_sabit = yontem_surumu
        self._cache = _Cache()
        self._tuik: Dict[str, Tuple[str, float]] = {}
        for r in self._q("SELECT kod, ad_tr, agirlik FROM tuik_agirlik_2026 WHERE seviye BETWEEN 2 AND 5"):
            self._tuik[r["kod"]] = ((r["ad_tr"] or "").strip(), float(r["agirlik"] or 0.0))
        self._tuik["TOPLAM"] = (TOPLAM_AD, 100.0)

    # ------------------------------------------------------------------ plumbing
    def _q(self, sql: str, params: Iterable = ()) -> List[sqlite3.Row]:
        with self._lock:
            return self._con.execute(sql, tuple(params)).fetchall()

    def _one(self, sql: str, params: Iterable = ()):
        rows = self._q(sql, params)
        return rows[0] if rows else None

    @property
    def surum(self) -> str:
        if self._surum_sabit:
            return self._surum_sabit
        r = self._one("SELECT yontem_surumu FROM endeks_kosu ORDER BY hesap_zamani DESC LIMIT 1")
        if r:
            return r[0]
        r = self._one("SELECT MAX(yontem_surumu) FROM endeks_gunluk")
        return r[0] if r and r[0] else "0"

    @property
    def data_date(self) -> Optional[str]:
        r = self._one("SELECT MAX(tarih) FROM endeks_gunluk WHERE yontem_surumu=?", (self.surum,))
        return r[0] if r else None

    @property
    def baz(self) -> Optional[str]:
        r = self._one("SELECT baz_gunu FROM endeks_kosu WHERE yontem_surumu=? ORDER BY hesap_zamani DESC LIMIT 1", (self.surum,))
        if r and r[0]:
            return r[0]
        r = self._one("SELECT MIN(tarih) FROM endeks_gunluk WHERE yontem_surumu=?", (self.surum,))
        return r[0] if r else None

    def _ad(self, kod: str) -> str:
        return self._tuik.get(kod, (kod, 0.0))[0]

    def _agirlik(self, kod: str) -> float:
        """Weight that actually enters the index: TOPLAM=100, leaf=its own, aggregate=sum of covered leaves
        (a bolum's TÜİK weight is larger than its covered weight; contributions must use the covered one)."""
        if kod == "TOPLAM":
            return 100.0
        leaves = self._leaves()
        if kod in leaves:
            return leaves[kod]
        return fsum(w for k, w in leaves.items() if k.startswith(kod)) or self._tuik.get(kod, (kod, 0.0))[1]

    def _range(self, frm: Optional[str], to: Optional[str]) -> Tuple[str, str]:
        return (max(frm, self.baz) if frm and self.baz else (frm or self.baz or "0000-00-00"), to or "9999-99-99")

    def _leaves(self) -> Dict[str, float]:
        """Classes that carry the index on the data date (not dropped by the hierarchy rule) -> weight."""
        key = ("leaves", self.data_date, self.surum)
        hit = self._cache.get(key)
        if hit is None:
            hit = self._cache.put(key, {r["sinif"]: float(r["agirlik"]) for r in self._q(
                "SELECT sinif, agirlik FROM endeks_sinif WHERE yontem_surumu=? AND tarih=? AND hiyerarsi_dus=0",
                (self.surum, self.data_date))})
        return hit

    # ------------------------------------------------------------------ series
    def _series(self, kod: str, frm: Optional[str], to: Optional[str]) -> List[Dict[str, Any]]:
        bas, bit = self._range(frm, to)
        s = self.surum
        if kod == "TOPLAM" or len(kod) == 2:
            rows = self._q("SELECT tarih, endeks, kalem FROM endeks_gunluk WHERE yontem_surumu=? AND kod=? AND tarih BETWEEN ? AND ? ORDER BY tarih",
                           (s, kod, bas, bit))
            return [{"tarih": r["tarih"], "endeks": float(r["endeks"]), "eslesen_kalem": int(r["kalem"] or 0)} for r in rows]
        if len(kod) == 5 or kod in self._leaves():
            rows = self._q("SELECT tarih, endeks, eslesen_kalem, durum FROM endeks_sinif WHERE yontem_surumu=? AND sinif=? AND tarih BETWEEN ? AND ? ORDER BY tarih",
                           (s, kod, bas, bit))
            return [{"tarih": r["tarih"], "endeks": float(r["endeks"]), "eslesen_kalem": int(r["eslesen_kalem"] or 0), "durum": r["durum"]} for r in rows]
        # grup / sinif4 aggregate: same normalised weighted average as the stored upper levels
        rows = self._q("SELECT tarih, SUM(endeks*agirlik)/SUM(agirlik) AS endeks, SUM(eslesen_kalem) AS kalem FROM endeks_sinif "
                       "WHERE yontem_surumu=? AND sinif LIKE ? AND hiyerarsi_dus=0 AND tarih BETWEEN ? AND ? GROUP BY tarih ORDER BY tarih",
                       (s, kod + "%", bas, bit))
        return [{"tarih": r["tarih"], "endeks": float(r["endeks"]), "eslesen_kalem": int(r["kalem"] or 0)} for r in rows]

    def _node(self, kod: str, frm, to) -> Dict[str, Any]:
        series = self._series(kod, frm, to)
        if not series:
            return {}
        return {"kod": kod, "ad_tr": self._ad(kod), "agirlik": self._agirlik(kod), "seviye": _seviye(kod), "series": series}

    def meta(self):
        dd, s = self.data_date, self.surum
        top = self._one("SELECT kapsanan_agirlik, sinif FROM endeks_gunluk WHERE yontem_surumu=? AND kod='TOPLAM' AND tarih=?", (s, dd))
        carry = self._one("SELECT COUNT(*) FROM endeks_sinif WHERE yontem_surumu=? AND tarih=? AND hiyerarsi_dus=0 AND durum IN (?,?,?)",
                          (s, dd, *DEVREDEN))
        return {"data_date": dd or "", "base_day": self.baz or "", "coverage_weight": float(top["kapsanan_agirlik"]) if top else 0.0,
                "class_count": int(top["sinif"]) if top else 0, "carry_count": int(carry[0]) if carry else 0,
                "app_version": self.app_version, "yontem_surumu": f"v{s}"}

    def index(self, level, kod, frm, to):
        if not kod:
            kod = "TOPLAM" if level == "TOPLAM" else None
        return self._node(kod, frm, to) if kod else {}

    def index_multi(self, kodlar, frm, to):
        if kodlar == ["*"]:
            kodlar = sorted(self._leaves())
        out = []
        for k in kodlar:
            n = self._node(k, frm, to)
            if n:
                out.append(n)
        return out

    # ------------------------------------------------------------------ tree / changes
    def _first_last(self, frm, to) -> Dict[str, Tuple[float, float]]:
        """kod -> (endeks_bas, endeks_bit) for every leaf class in range."""
        bas, bit = self._range(frm, to)
        rows = self._q("SELECT sinif, tarih, endeks FROM endeks_sinif WHERE yontem_surumu=? AND hiyerarsi_dus=0 AND tarih BETWEEN ? AND ? "
                       "AND tarih IN (SELECT MIN(tarih) FROM endeks_sinif WHERE yontem_surumu=? AND tarih BETWEEN ? AND ? "
                       "UNION SELECT MAX(tarih) FROM endeks_sinif WHERE yontem_surumu=? AND tarih BETWEEN ? AND ?) ORDER BY sinif, tarih",
                       (self.surum, bas, bit, self.surum, bas, bit, self.surum, bas, bit))
        acc: Dict[str, List[float]] = defaultdict(list)
        for r in rows:
            acc[r["sinif"]].append(float(r["endeks"]))
        return {k: (v[0], v[-1]) for k, v in acc.items() if len(v) >= 2}

    def _aggregate_changes(self, prefix: str, fl: Dict[str, Tuple[float, float]], w: Dict[str, float]) -> Optional[Tuple[float, float, float]]:
        """(endeks_bas, endeks_bit, covered weight) of the leaves under `prefix`."""
        ks = [k for k in fl if k.startswith(prefix) and k in w]
        if not ks:
            return None
        sw = fsum(w[k] for k in ks)
        return fsum(w[k] * fl[k][0] for k in ks) / sw, fsum(w[k] * fl[k][1] for k in ks) / sw, sw

    def tree(self):
        leaves = self._leaves()
        fl = self._first_last(None, None)
        nodes: Dict[str, Dict[str, Any]] = {}
        parent: Dict[str, str] = {}
        for leaf in leaves:
            chain = [leaf[:2], leaf[:3]] + ([leaf[:4]] if len(leaf) == 5 else []) + [leaf]
            for i, kod in enumerate(chain):
                nodes.setdefault(kod, {"kod": kod, "ad_tr": self._ad(kod), "seviye": _seviye(kod), "agirlik": self._agirlik(kod)})
                parent[kod] = chain[i - 1] if i else "TOPLAM"
        children: Dict[str, List[str]] = defaultdict(list)
        for kod, p in parent.items():
            children[p].append(kod)

        state = self._leaf_state()

        def build(kod):
            if kod in leaves and kod in fl:
                b, e = fl[kod]
            else:
                agg = self._aggregate_changes(kod, fl, leaves)
                b, e = (agg[0], agg[1]) if agg else (1.0, 1.0)
            out = {**nodes[kod], "degisim_donem": round((e / b - 1) * 100, 2),
                   "children": [build(c) for c in sorted(children.get(kod, []))]}
            if kod in leaves:
                durum, gun = state.get(kod, ("FRESH", 0))
                out.update({"durum": durum, "devreden_gun": gun, "tarife": kod in self._tarife})
            return out

        return [build(b) for b in sorted(children["TOPLAM"])]

    def _changes(self, level, frm, to) -> List[Dict[str, Any]]:
        bas, bit = self._range(frm, to)
        out = []
        if level in ("bolum", "TOPLAM"):
            rows = self._q("SELECT kod, tarih, endeks, kapsanan_agirlik FROM endeks_gunluk WHERE yontem_surumu=? AND duzey=? AND tarih BETWEEN ? AND ? ORDER BY kod, tarih",
                           (self.surum, level, bas, bit))
            acc: Dict[str, List[Tuple[float, float]]] = defaultdict(list)
            for r in rows:
                acc[r["kod"]].append((float(r["endeks"]), float(r["kapsanan_agirlik"] or 0.0)))
            for kod, v in acc.items():
                if len(v) >= 2:
                    out.append({"kod": kod, "ad_tr": self._ad(kod), "agirlik": v[0][1] if kod != "TOPLAM" else 100.0,
                                "endeks_bas": v[0][0], "endeks_bit": v[-1][0]})
        else:
            fl, leaves = self._first_last(frm, to), self._leaves()
            if level == "sinif5":
                for kod, (b, e) in fl.items():
                    if len(kod) == 5:
                        out.append({"kod": kod, "ad_tr": self._ad(kod), "agirlik": leaves.get(kod, self._agirlik(kod)), "endeks_bas": b, "endeks_bit": e})
            else:
                n = {"grup": 3, "sinif4": 4}[level]
                for prefix in sorted({k[:n] for k in fl}):
                    agg = self._aggregate_changes(prefix, fl, leaves)
                    if agg:
                        out.append({"kod": prefix, "ad_tr": self._ad(prefix), "agirlik": agg[2], "endeks_bas": agg[0], "endeks_bit": agg[1]})
        for r in out:
            r["degisim"] = (r["endeks_bit"] / r["endeks_bas"] - 1) * 100
        out.sort(key=lambda x: x["kod"])
        return out

    def class_changes(self, level, frm, to):
        return [{**r, "endeks_bas": round(r["endeks_bas"], 2), "endeks_bit": round(r["endeks_bit"], 2), "degisim": round(r["degisim"], 2)}
                for r in self._changes(level, frm, to)]

    def contrib(self, frm, to, level):
        """katki_B = w_B (I_B(t2) - I_B(t1)) / sum_B w_B I_B(t1) (puan); sum equals the period change of the level."""
        rows = self._changes(level, frm, to)
        payda = fsum(r["agirlik"] * r["endeks_bas"] for r in rows)
        out = []
        for r in rows:
            katki = 100.0 * r["agirlik"] * (r["endeks_bit"] - r["endeks_bas"]) / payda if payda else 0.0
            out.append({**r, "endeks_bas": round(r["endeks_bas"], 2), "endeks_bit": round(r["endeks_bit"], 2),
                        "degisim": round(r["degisim"], 2), "katki_puan": katki})
        out.sort(key=lambda x: abs(x["katki_puan"]), reverse=True)
        return out

    # ------------------------------------------------------------------ sources
    def _kaynak_kisim(self) -> Dict[str, int]:
        """kaynak key -> dominant kisim_no on the data date (one scan, cached)."""
        key = ("kaynak_kisim", self.data_date)
        hit = self._cache.get(key)
        if hit is None:
            best: Dict[str, Tuple[int, int]] = {}
            for r in self._q("SELECT kaynak, kisim_no, COUNT(*) AS n FROM gozlem WHERE tarih=? AND kalite_durumu='HAZIR' GROUP BY kaynak, kisim_no",
                             (self.data_date,)):
                k = kaynak_anahtar(r["kaynak"])
                if k not in best or r["n"] > best[k][1]:
                    best[k] = (int(r["kisim_no"]), int(r["n"]))
            hit = self._cache.put(key, {k: v[0] for k, v in best.items()})
        return hit

    def sources(self, kod, frm, to):
        """Only endeks_sinif_kaynak. A non-leaf kod gets the weighted average of its classes' per-source series."""
        bas, bit = self._range(frm, to)
        leaves = self._leaves()
        if kod == "TOPLAM":
            like = "%"
        else:
            like = kod if (len(kod) == 5 or kod in leaves) else kod + "%"
        rows = self._q("SELECT k.tarih, k.sinif, k.kaynak, k.endeks, k.kalem FROM endeks_sinif_kaynak k "
                       "WHERE k.yontem_surumu=? AND k.sinif LIKE ? AND k.tarih BETWEEN ? AND ? ORDER BY k.kaynak, k.tarih, k.sinif",
                       (self.surum, like, bas, bit))
        acc: Dict[str, Dict[str, List[Tuple[float, float]]]] = defaultdict(lambda: defaultdict(list))
        kalem: Dict[str, Dict[str, int]] = defaultdict(dict)
        for r in rows:
            if r["sinif"] not in leaves:
                continue
            acc[r["kaynak"]][r["tarih"]].append((float(r["endeks"]), leaves[r["sinif"]]))
            kalem[r["kaynak"]][r["tarih"]] = kalem[r["kaynak"]].get(r["tarih"], 0) + int(r["kalem"] or 0)
        kk = self._kaynak_kisim()
        out = []
        for kaynak in sorted(acc):
            series = []
            for tarih in sorted(acc[kaynak]):
                pts = acc[kaynak][tarih]
                sw = fsum(w for _, w in pts)
                series.append({"tarih": tarih, "endeks": fsum(v * w for v, w in pts) / sw})
            son = max(kalem[kaynak]) if kalem[kaynak] else None
            out.append({"kaynak": kaynak, "kisim_no": kk.get(kaynak, 0), "kalem_sayisi": kalem[kaynak].get(son, 0) if son else 0, "series": series})
        return out

    # ------------------------------------------------------------------ items
    def _item_rows(self, kod: str, frm, to) -> List[Dict[str, Any]]:
        bas, bit = self._range(frm, to)
        key = ("items", self.data_date, kod, bas, bit)
        hit = self._cache.get(key)
        if hit is not None:
            return hit
        if kod == "TOPLAM":
            where, params = "1=1", ()
        elif len(kod) == 5:
            where, params = "c.sinif5 = ?", (kod,)
        else:
            where, params = "(c.sinif5 LIKE ? OR (c.sinif5 IS NULL AND c.sinif4 LIKE ?))", (kod + "%", kod + "%")
        rows = self._q(f"SELECT g.kisim_no, g.kimlik, g.urun_adi, g.kaynak, g.tarih, g.fiyat FROM gozlem g "
                       f"JOIN gozlem_coicop c ON c.satir_sha = g.satir_sha WHERE g.kalite_durumu='HAZIR' AND g.fiyat>0 AND {where} "
                       f"AND g.tarih BETWEEN ? AND ?", (*params, bas, bit))
        acc: Dict[Tuple[int, str], Dict[str, Any]] = {}
        for r in rows:
            k = (int(r["kisim_no"]), r["kimlik"])
            a = acc.get(k)
            if a is None:
                a = acc[k] = {"urun_adi": r["urun_adi"], "kaynak": r["kaynak"], "gunler": {}}
            a["gunler"].setdefault(r["tarih"], []).append(float(r["fiyat"]))
            a["urun_adi"], a["kaynak"] = r["urun_adi"] or a["urun_adi"], r["kaynak"] or a["kaynak"]
        out = []
        for (kisim_no, kimlik), a in acc.items():
            gunler = sorted(a["gunler"])
            ilk, son = _median(a["gunler"][gunler[0]]), _median(a["gunler"][gunler[-1]])
            out.append({"kimlik": _item_id(kisim_no, kimlik), "urun_adi": a["urun_adi"] or kimlik, "kaynak": a["kaynak"] or "",
                        "kisim_no": kisim_no, "son_fiyat": round(son, 2), "degisim": round((son / ilk - 1) * 100, 2) if ilk else 0.0,
                        "gun": len(gunler)})
        return self._cache.put(key, out)

    def items(self, kod, frm, to, page, sort):
        rows = self._item_rows(kod, frm, to)
        reverse = sort.startswith("-")
        key = sort.lstrip("-") or "urun_adi"
        if key not in SORT_KEYS:
            key = "urun_adi"
        rows = sorted(rows, key=lambda r: (r[key] is None, r[key]), reverse=reverse)
        start = (max(page, 1) - 1) * PAGE_SIZE
        return {"total": len(rows), "items": rows[start:start + PAGE_SIZE]}

    def item(self, kimlik, frm, to):
        bas, bit = self._range(frm, to)
        kisim_no, kim = _parse_item_id(kimlik)
        if kisim_no is None:
            rows = self._q("SELECT urun_adi, kaynak, tarih, fiyat FROM gozlem WHERE kimlik=? AND kalite_durumu='HAZIR' AND fiyat>0 AND tarih BETWEEN ? AND ? ORDER BY tarih",
                           (kim, bas, bit))
        else:
            rows = self._q("SELECT urun_adi, kaynak, tarih, fiyat FROM gozlem WHERE kisim_no=? AND kimlik=? AND kalite_durumu='HAZIR' AND fiyat>0 AND tarih BETWEEN ? AND ? ORDER BY tarih",
                           (kisim_no, kim, bas, bit))
        if not rows:
            return {}
        gunler: Dict[str, List[float]] = defaultdict(list)
        for r in rows:
            gunler[r["tarih"]].append(float(r["fiyat"]))
        return {"kimlik": kimlik, "urun_adi": rows[-1]["urun_adi"] or kim, "kaynak": rows[-1]["kaynak"] or "",
                "series": [{"tarih": t, "fiyat": round(_median(v), 4)} for t, v in sorted(gunler.items())]}

    # ------------------------------------------------------------------ quality
    def _exclusions(self) -> List[Dict[str, Any]]:
        key = ("exclusions", self.data_date)
        hit = self._cache.get(key)
        if hit is None:
            rows = self._q("SELECT CASE WHEN instr(COALESCE(kalite_ham,''),'|')>0 THEN substr(kalite_ham,1,instr(kalite_ham,'|')-1) "
                           "ELSE COALESCE(kalite_ham,'') END AS neden, COUNT(*) AS n FROM gozlem WHERE kalite_durumu='HAZIR_DEGIL' "
                           "GROUP BY 1 ORDER BY 2 DESC")
            hit = self._cache.put(key, [{"neden": r["neden"] or "(bos)", "satir": int(r["n"])} for r in rows])
        return hit

    def _devreden_gun(self, sinif: str) -> int:
        """Consecutive carried days ending on the data date (0 when the class is FRESH today)."""
        gun = 0
        for d in self._q("SELECT durum FROM endeks_sinif WHERE yontem_surumu=? AND sinif=? AND tarih<=? ORDER BY tarih DESC",
                         (self.surum, sinif, self.data_date)):
            if d["durum"] in DEVREDEN:
                gun += 1
            else:
                break
        return gun

    def _leaf_state(self) -> Dict[str, Tuple[str, int]]:
        """leaf kod -> (durum on data date, devreden_gun); cached per data date."""
        key = ("leaf_state", self.data_date, self.surum)
        hit = self._cache.get(key)
        if hit is None:
            hit = {}
            for r in self._q("SELECT sinif, durum FROM endeks_sinif WHERE yontem_surumu=? AND tarih=? AND hiyerarsi_dus=0", (self.surum, self.data_date)):
                hit[r["sinif"]] = (r["durum"], self._devreden_gun(r["sinif"]) if r["durum"] in DEVREDEN else 0)
            self._cache.put(key, hit)
        return hit

    def _carry_classes(self) -> List[Dict[str, Any]]:
        leaves, state = self._leaves(), self._leaf_state()
        out = [{"kod": k, "ad_tr": self._ad(k), "agirlik": leaves[k], "gun": g} for k, (d, g) in state.items() if d in DEVREDEN and k in leaves]
        out.sort(key=lambda x: -x["agirlik"])
        return out

    def weak_classes(self) -> List[Dict[str, Any]]:
        out = []
        for r in self._q("SELECT sinif, agirlik, eslesen_kalem FROM endeks_sinif WHERE yontem_surumu=? AND tarih=? AND hiyerarsi_dus=0 "
                         "AND length(sinif)=5 AND agirlik>=? AND eslesen_kalem<? ORDER BY agirlik DESC",
                         (self.surum, self.data_date, WEAK_MIN_WEIGHT, WEAK_MAX_ITEMS)):
            if r["sinif"] in self._tarife:
                continue
            out.append({"kod": r["sinif"], "ad_tr": self._ad(r["sinif"]), "agirlik": float(r["agirlik"]), "kalem": int(r["eslesen_kalem"] or 0)})
        return out

    def quality(self, days):
        gunler = sorted(r[0] for r in self._q("SELECT DISTINCT tarih FROM master_rc ORDER BY tarih DESC LIMIT ?", (max(int(days), 1),)))
        rc: Dict[Tuple[int, str], int] = {}
        if gunler:
            for r in self._q("SELECT kisim_no, tarih, rc FROM master_rc WHERE tarih BETWEEN ? AND ?", (gunler[0], gunler[-1])):
                rc[(int(r["kisim_no"]), r["tarih"])] = int(r["rc"]) if r["rc"] is not None else RC_KAYIT_YOK
        db_ad = {int(r["kisim_no"]): r["ad"] for r in self._q("SELECT kisim_no, ad FROM kisim")}
        kisimlar = sorted(set(db_ad) | {int(k) for k in self._kisimlar if k.isdigit()} | {k for k, _ in rc})
        sections = []
        for k in kisimlar:
            cfg = self._kisimlar.get(str(k), {})
            sections.append({"kisim_no": k, "ad": cfg.get("ad") or db_ad.get(k, f"Kısım {k}"), "bolumler": list(cfg.get("bolumler", [])),
                             "days": [{"tarih": t, "rc": rc.get((k, t), RC_KAYIT_YOK)} for t in gunler]})
        return {"sections": sections, "carry_classes": self._carry_classes(), "exclusions": self._exclusions(),
                "weak_classes": self.weak_classes(), "rc_kodlari": self._rc_kodlari}

    # ------------------------------------------------------------------ baskets / search
    def tuik_basket(self):
        """Covered division weights of the data date (endeks_gunluk.kapsanan_agirlik): Σ w_B I_B / Σ w_B == TOPLAM."""
        dd, s = self.data_date, self.surum
        rows = self._q("SELECT kod, kapsanan_agirlik FROM endeks_gunluk WHERE yontem_surumu=? AND tarih=? AND duzey='bolum' ORDER BY kod", (s, dd))
        w = {r["kod"]: float(r["kapsanan_agirlik"] or 0.0) for r in rows}
        top = self._one("SELECT kapsanan_agirlik FROM endeks_gunluk WHERE yontem_surumu=? AND tarih=? AND kod='TOPLAM'", (s, dd))
        return {"ad": TUIK_SEPET, "tarih": dd or "", "agirlik": w,
                "tam_agirlik": {k: self._tuik.get(k, (k, 0.0))[1] for k in w},
                "kapsanan_toplam": float(top["kapsanan_agirlik"]) if top else fsum(w.values())}

    def baskets(self):
        from app.baskets_store import baskets as _store
        return {TUIK_SEPET: self.tuik_basket()["agirlik"], **{k: v for k, v in _store().items() if k != TUIK_SEPET}}

    def basket_compute(self, weights, frm, to):
        """Export-only path: linear combination of stored class indices via fiyat_takip.endeks.katki."""
        katki = _endeks_katki(self.config_dir)
        member = [(k, float(w), {p["tarih"]: p["endeks"] for p in self._series(k, frm, to)}) for k, w in weights.items()]
        member = [(k, w, s) for k, w, s in member if s]
        if not member:
            return {"series": [], "contrib": []}
        tarihler = sorted(set.intersection(*[set(s) for _, _, s in member]))
        agirlik = {k: w for k, w, _ in member}
        series = [{"tarih": t, "endeks": katki.toplam_endeks(agirlik, {k: s[t] for k, _, s in member})} for t in tarihler]
        if len(tarihler) < 2:
            return {"series": series, "contrib": []}
        i1 = {k: s[tarihler[0]] for k, _, s in member}
        i2 = {k: s[tarihler[-1]] for k, _, s in member}
        kk = katki.katkilar(agirlik, i1, i2)
        contrib = [{"kod": k, "ad_tr": self._ad(k), "agirlik": agirlik[k], "degisim": katki.donem_degisim(i1[k], i2[k]), "katki_puan": kk[k]}
                   for k in agirlik]
        contrib.sort(key=lambda x: abs(x["katki_puan"]), reverse=True)
        return {"series": series, "contrib": contrib}

    def search(self, q):
        ql = q.casefold().strip()
        if not ql:
            return []
        out = []
        for kod, (ad, _) in sorted(self._tuik.items()):
            if kod == "TOPLAM":
                continue
            if ql in ad.casefold() or kod.startswith(ql):
                out.append({"type": "class", "kod": kod, "ad_tr": ad, "seviye": _seviye(kod)})
        rows = self._q("SELECT DISTINCT kisim_no, kimlik, urun_adi, kaynak FROM gozlem WHERE tarih=? AND kalite_durumu='HAZIR' "
                       "AND urun_adi LIKE ? COLLATE NOCASE LIMIT 200", (self.data_date, f"%{q.strip()}%"))
        for r in rows:
            if ql in (r["urun_adi"] or "").casefold():
                out.append({"type": "item", "kimlik": _item_id(int(r["kisim_no"]), r["kimlik"]), "ad_tr": r["urun_adi"], "kaynak": r["kaynak"] or ""})
        return out[:30]


def _endeks_katki(config_dir: Path):
    """Import fiyat_takip.endeks.katki from the night-chain tree (config.json: fiyat_takip_kok). No second copy of the formula here."""
    try:
        from fiyat_takip.endeks import katki  # type: ignore
        return katki
    except ImportError:
        kok = load_config(config_dir, "config").get("fiyat_takip_kok")
        if kok and str(Path(kok)) not in sys.path:
            sys.path.append(str(Path(kok)))
        from fiyat_takip.endeks import katki  # type: ignore
        return katki
