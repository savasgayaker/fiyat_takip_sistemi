"""Cross-check: tests/sepet_capraz.json (consumed by frontend src/lib/basket.test.ts) must match
fiyat_takip.endeks.katki. Skips when the night-chain package is not importable (Mac/CI)."""
import json
import sys
from pathlib import Path

import pytest

from app.data.repository import DEFAULT_CONFIG_DIR, load_config

FIXTURE = Path(__file__).resolve().parents[2] / "tests" / "sepet_capraz.json"


@pytest.fixture(scope="module")
def katki():
    kok = load_config(DEFAULT_CONFIG_DIR, "config").get("fiyat_takip_kok")
    if kok and Path(kok).exists() and str(Path(kok)) not in sys.path:
        sys.path.append(str(Path(kok)))
    return pytest.importorskip("fiyat_takip.endeks.katki")


def test_fixture_matches_python_formulas(katki):
    d = json.loads(FIXTURE.read_text(encoding="utf-8"))
    kapsanan = {k: w for k, w in d["agirlik"].items() if k in d["seriler"]}
    for i, t in enumerate(d["tarihler"]):
        v = katki.toplam_endeks(kapsanan, {k: d["seriler"][k][i] for k in kapsanan})
        assert d["beklenen"]["series"][i]["tarih"] == t
        assert abs(d["beklenen"]["series"][i]["endeks"] - v) < 1e-9
    i1 = {k: d["seriler"][k][0] for k in kapsanan}
    i2 = {k: d["seriler"][k][-1] for k in kapsanan}
    kk = katki.katkilar(kapsanan, i1, i2)
    for c in d["beklenen"]["contrib"]:
        assert abs(c["katki_puan"] - kk[c["kod"]]) < 1e-9
        assert abs(c["degisim"] - katki.donem_degisim(i1[c["kod"]], i2[c["kod"]])) < 1e-9
    assert abs(sum(kk.values()) - d["beklenen"]["donem_degisim"]) < 1e-9


def test_baskets_store_roundtrip(tmp_path, monkeypatch):
    from app import baskets_store as bs
    p = tmp_path / "sepetler.json"
    p.write_text(json.dumps({"_sabit": ["TÜİK 2026"], "TÜİK 2026": {"01": 60, "07": 40}}), encoding="utf-8")
    monkeypatch.setenv("DCK_EOS_SEPETLER", str(p))
    assert bs.sabit() == ["TÜİK 2026"]
    out = bs.kaydet("Benim", {"01": 1, "07": 3, "99": 0})
    assert out["Benim"] == {"01": 25.0, "07": 75.0}
    with pytest.raises(PermissionError):
        bs.kaydet("TÜİK 2026", {"01": 100})
    with pytest.raises(PermissionError):
        bs.sil("TÜİK 2026")
    with pytest.raises(ValueError):
        bs.kaydet("x", {"01": -1})
    assert "Benim" not in bs.sil("Benim")
    with pytest.raises(KeyError):
        bs.sil("Benim")
