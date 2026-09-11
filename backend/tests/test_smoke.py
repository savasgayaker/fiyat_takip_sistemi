"""Smoke test: every API endpoint returns 200 with fixtures.

Run:  cd backend && python -m pytest tests/test_smoke.py -q
"""
import io
import os

os.environ["DCK_EOS_FIXTURES"] = "1"  # smoke tests are fixture-bound (len(tree)==13, 01111 ...)

from fastapi.testclient import TestClient
from openpyxl import Workbook

from server import app

client = TestClient(app)


def test_meta():
    r = client.get("/api/meta")
    assert r.status_code == 200
    m = r.json()
    for k in ("data_date", "base_day", "coverage_weight", "class_count",
              "carry_count", "app_version", "yontem_surumu"):
        assert k in m, k
    assert m["yontem_surumu"].startswith("v")


def test_index():
    r = client.get("/api/index", params={"level": "TOPLAM", "kod": "TOPLAM"})
    assert r.status_code == 200
    assert r.json()["kod"] == "TOPLAM"


def test_index_multi():
    r = client.get("/api/index/multi", params={"kodlar": "01,04,07"})
    assert r.status_code == 200
    assert len(r.json()) == 3


def test_tree():
    r = client.get("/api/tree")
    assert r.status_code == 200
    tree = r.json()
    assert len(tree) == 13

    # Depth is not fixed: bolum -> grup -> sinif4 -> sinif5 (5-digit) must all
    # be present so the UI tree can be exercised at every level.
    def depth(n):
        return 1 + max((depth(c) for c in n["children"]), default=0)

    assert max(depth(n) for n in tree) >= 4
    s4 = tree[0]["children"][0]["children"][0]
    assert s4["kod"] == "0111" and s4["seviye"] == "sinif4"
    assert [c["kod"] for c in s4["children"]][:2] == ["01111", "01112"]
    assert all(c["seviye"] == "sinif5" for c in s4["children"])
    # Pass-through levels (one child, same weight) exist in the fixture; the
    # frontend collapses them to "011 › 0111".
    grp = tree[0]["children"][0]
    assert len(grp["children"]) == 1 and grp["children"][0]["agirlik"] == grp["agirlik"]


def test_contrib():
    r = client.get("/api/contrib", params={"level": "bolum"})
    assert r.status_code == 200


def test_sources():
    assert client.get("/api/sources/01111").status_code == 200


def test_items():
    r = client.get("/api/items/01", params={"sort": "-degisim"})
    assert r.status_code == 200
    assert "total" in r.json()


def test_item():
    r = client.get("/api/items/01")
    kimlik = r.json()["items"][0]["kimlik"]
    assert client.get(f"/api/item/{kimlik}").status_code == 200


def test_quality():
    r = client.get("/api/quality", params={"days": 14})
    assert r.status_code == 200
    body = r.json()
    assert len(body["sections"][0]["days"]) == 14
    # "temsil zayıf": weight >= 0.3, items < 10, not in config/tarife_siniflari.json
    weak = {w["kod"]: w for w in body["weak_classes"]}
    assert set(weak) == {"11311", "07312"}  # Otel konaklama, Uçak bileti
    assert all(w["kalem"] < 10 and w["agirlik"] >= 0.3 for w in weak.values())
    assert "04211" not in weak  # Elektrik: few items but tariff-listed
    # rc canon and section metadata come from config/, not from code
    rcs = {r["rc"]: r for r in body["rc_kodlari"]}
    assert set(rcs) == {0, 1, 4, 5, 6}
    assert all(r["renk"].startswith("#") and r["ad"] for r in rcs.values())
    s1 = body["sections"][0]
    assert s1["kisim_no"] == 1 and s1["ad"] and isinstance(s1["bolumler"], list)
    assert "01" in s1["bolumler"]


def test_baskets():
    assert client.get("/api/baskets").status_code == 200


def test_search():
    assert client.get("/api/search", params={"q": "ekmek"}).status_code == 200


def test_method():
    assert client.get("/api/method").status_code == 200


def test_basket_compute():
    r = client.post(
        "/api/basket/compute",
        json={"weights": {"01": 50, "07": 50}, "from": None, "to": None},
    )
    assert r.status_code == 200
    assert "series" in r.json()


def test_export_excel():
    r = client.post(
        "/api/export/excel",
        json={"screen": "pano", "payload": {"tables": [
            {"name": "T", "columns": ["a", "b"], "rows": [[1, 2]]}]}},
    )
    assert r.status_code == 200
    assert r.content[:2] == b"PK"


def test_export_pdf():
    r = client.post("/api/export/pdf", json={"from": None, "to": None})
    assert r.status_code == 200
    assert r.content[:4] == b"%PDF"


def test_tuik_compare():
    wb = Workbook()
    ws = wb.active
    ws.append(["kod", "oran"])
    for k, v in [("01", 3.2), ("07", 1.1)]:
        ws.append([k, v])
    buf = io.BytesIO()
    wb.save(buf)
    r = client.post(
        "/api/tuik/compare",
        files={"file": ("tuik.xlsx", buf.getvalue(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"from": "2026-07-15", "to": "2026-09-12"},
    )
    assert r.status_code == 200
    assert "rows" in r.json()
