"""SqliteRepository against a real nightly DB. Skipped unless DCK_EOS_DB points to a file
that carries the endeks tables (e.g. C:\\FiyatTakip\\db\\fiyat_takip_kopya.sqlite).

Both repositories must satisfy the same pydantic contract (app/models.py); the
contract tests run on the fixture always and on SQLite when available.
"""
import os
from pathlib import Path

import pytest

from app import models as M
from app.data.repository import FixtureRepository, SqliteRepository

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
DB = os.environ.get("DCK_EOS_DB")


def _sqlite():
    if not DB or not Path(DB).exists():
        pytest.skip("DCK_EOS_DB tanımlı değil / dosya yok")
    return SqliteRepository(DB)


@pytest.fixture(scope="module")
def sq():
    return _sqlite()


@pytest.fixture(scope="module", params=["fixture", "sqlite"])
def repo(request):
    return FixtureRepository(FIXTURES) if request.param == "fixture" else _sqlite()


# ---------------------------------------------------------------- contract (both repos)
def test_contract_meta(repo):
    M.Meta.model_validate(repo.meta())


def test_contract_index_and_multi(repo):
    top = M.IndexResponse.model_validate(repo.index("TOPLAM", None, None, None))
    assert top.kod == "TOPLAM" and len(top.series) >= 2
    bolum = [n.kod for n in (M.TreeNode.model_validate(t) for t in repo.tree())]
    for r in repo.index_multi(bolum[:3], None, None):
        M.IndexResponse.model_validate(r)


def test_contract_tree_contrib_changes(repo):
    tree = [M.TreeNode.model_validate(t) for t in repo.tree()]
    assert len(tree) >= 10 and all(n.seviye == "bolum" for n in tree)
    for r in repo.contrib(None, None, "bolum"):
        M.Contrib.model_validate(r)
    for r in repo.class_changes("sinif5", None, None):
        M.ClassChange.model_validate(r)


def test_contract_items_item_sources(repo):
    tree = repo.tree()
    leaf = tree[0]
    while leaf["children"]:
        leaf = leaf["children"][0]
    page = M.ItemsResponse.model_validate(repo.items(leaf["kod"], None, None, 1, "urun_adi"))
    assert page.total >= 1 and 1 <= len(page.items) <= 25
    det = M.ItemDetail.model_validate(repo.item(page.items[0].kimlik, None, None))
    assert det.series
    for s in repo.sources(leaf["kod"], None, None):
        M.SourceSeries.model_validate(s)


def test_contract_quality_search_baskets(repo):
    q = M.QualityResponse.model_validate(repo.quality(7))
    assert q.sections and all(len(s.days) == len(q.sections[0].days) for s in q.sections)
    for h in repo.search("ekmek"):
        M.SearchHit.model_validate(h)
    b = repo.baskets()
    assert b and all(isinstance(v, dict) for v in b.values())
    t = M.TuikBasket.model_validate(repo.tuik_basket())
    assert t.ad == "TÜİK 2026" and b["TÜİK 2026"] == t.agirlik and set(t.tam_agirlik) == set(t.agirlik)


def test_tuik_basket_equals_toplam_series(sq):
    """'TÜİK 2026' preset (covered division weights) reproduces the stored TOPLAM series: same denominator as the dashboard."""
    t = sq.tuik_basket()
    w = t["agirlik"]
    assert abs(sum(w.values()) - t["kapsanan_toplam"]) < 1e-9
    top = {p["tarih"]: p["endeks"] for p in sq.index("TOPLAM", None, None, None)["series"]}
    bol = {r["kod"]: {p["tarih"]: p["endeks"] for p in r["series"]} for r in sq.index_multi(sorted(w), None, None)}
    sw = sum(w.values())
    for tarih, endeks in top.items():
        lin = sum(w[k] * bol[k][tarih] for k in w) / sw
        assert abs(lin - endeks) < 1e-9, tarih
    # and through the export path (fiyat_takip.endeks.katki)
    r = sq.basket_compute(w, None, None)
    for p in r["series"]:
        assert abs(p["endeks"] - top[p["tarih"]]) < 1e-9
    assert abs(sum(c["katki_puan"] for c in r["contrib"]) - 100 * (r["series"][-1]["endeks"] / r["series"][0]["endeks"] - 1)) < 1e-9


# ---------------------------------------------------------------- SQLite semantics
def test_meta_from_tables(sq):
    m = sq.meta()
    assert m["yontem_surumu"].startswith(f"v{sq.surum}")
    assert ("deneme" in m["yontem_surumu"]) == (sq.etiket == "deneme")
    assert m["base_day"] <= m["data_date"]
    assert 0 < m["coverage_weight"] <= 100 and m["class_count"] > 0


def test_toplam_series_is_stored_row(sq):
    s = sq.index("TOPLAM", None, None, None)["series"]
    assert s[0]["tarih"] == sq.baz and abs(s[0]["endeks"] - 100.0) < 1e-9
    assert s[-1]["tarih"] == sq.data_date


def test_group_level_is_weighted_average_of_leaves(sq):
    """grup (3 hane) = Σ w I / Σ w over undropped classes with that prefix — no other math."""
    tree = sq.tree()
    grp = tree[0]["children"][0]
    series = sq.index("grup", grp["kod"], None, None)["series"]
    leaves = {k: w for k, w in sq._leaves().items() if k.startswith(grp["kod"])}
    last = {r["kod"]: r["series"][-1]["endeks"] for r in sq.index_multi(sorted(leaves), None, None)}
    exp = sum(leaves[k] * last[k] for k in leaves) / sum(leaves.values())
    assert abs(series[-1]["endeks"] - exp) < 1e-9


def test_contrib_sums_to_pi(sq):
    for level in ("bolum", "sinif5"):
        rows = sq.contrib(None, None, level)
        raw = sq._changes(level, None, None)
        i1 = sum(r["agirlik"] * r["endeks_bas"] for r in raw)
        i2 = sum(r["agirlik"] * r["endeks_bit"] for r in raw)
        assert abs(sum(r["katki_puan"] for r in rows) - 100.0 * (i2 / i1 - 1.0)) < 1e-9
    # bolum contributions reproduce the stored TOPLAM change (same normalisation)
    top = sq.index("TOPLAM", None, None, None)["series"]
    pi_top = 100.0 * (top[-1]["endeks"] / top[0]["endeks"] - 1.0)
    assert abs(sum(r["katki_puan"] for r in sq.contrib(None, None, "bolum")) - pi_top) < 1e-6


def test_carry_count_uses_devreden_states(sq):
    m = sq.meta()
    q = sq.quality(3)
    assert m["carry_count"] == len(q["carry_classes"])
    assert all(c["gun"] >= 1 for c in q["carry_classes"])


def test_tree_leaf_badges(sq):
    """Leaves carry durum / devreden_gun / tarife; carried leaves match quality.carry_classes."""
    def leaves(nodes):
        for n in nodes:
            if n["children"]:
                yield from leaves(n["children"])
            else:
                yield n
    ls = {n["kod"]: n for n in leaves(sq.tree())}
    assert ls and all("durum" in n and "devreden_gun" in n and "tarife" in n for n in ls.values())
    carried = {n["kod"]: n["devreden_gun"] for n in ls.values() if n["durum"] in ("CARRY", "CARRY_GUN_YOK", "ZINCIR_KOPUK")}
    assert carried == {c["kod"]: c["gun"] for c in sq.quality(3)["carry_classes"]}
    assert all(n["devreden_gun"] == 0 for n in ls.values() if n["durum"] == "FRESH")
    tarife = {c["kod"] for c in __import__("json").loads((Path(__file__).resolve().parents[2] / "config" / "tarife_siniflari.json").read_text(encoding="utf-8"))["siniflar"]}
    assert all(n["tarife"] == (k in tarife) for k, n in ls.items())


def test_items_paging_and_sort(sq):
    kod = sorted(sq._leaves())[0]
    p1 = sq.items(kod, None, None, 1, "-son_fiyat")
    if p1["total"] > 25:
        p2 = sq.items(kod, None, None, 2, "-son_fiyat")
        assert p2["items"][0]["son_fiyat"] <= p1["items"][-1]["son_fiyat"]
    assert all(it["kimlik"].startswith("k") for it in p1["items"])


def test_quality_grid_aligned_and_rc_canon(sq):
    q = sq.quality(5)
    days = [d["tarih"] for d in q["sections"][0]["days"]]
    assert len(days) <= 5 and days == sorted(days)
    assert all([d["tarih"] for d in s["days"]] == days for s in q["sections"])


def test_sources_only_from_table(sq):
    kod = sorted(sq._leaves())[0]
    src = sq.sources(kod, None, None)
    assert src and all(s["series"] for s in src)
    stored = {r[0] for r in sq._q("SELECT DISTINCT kaynak FROM endeks_sinif_kaynak WHERE sinif=? AND yontem_surumu=?", (kod, sq.surum))}
    assert {s["kaynak"] for s in src} == stored
