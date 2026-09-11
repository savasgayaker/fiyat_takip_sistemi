"""Repository contract tests on fixtures (no DB needed)."""
from pathlib import Path

import pytest

from app.data.repository import FixtureRepository

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


@pytest.fixture(scope="module")
def repo():
    return FixtureRepository(FIXTURES)


def test_class_changes_bolum_shape(repo):
    rows = repo.class_changes("bolum", None, None)
    assert len(rows) == 13
    for r in rows:
        assert set(r) == {"kod", "ad_tr", "agirlik", "endeks_bas", "endeks_bit", "degisim"}
        expected = round((r["endeks_bit"] / r["endeks_bas"] - 1) * 100, 2)
        assert abs(r["degisim"] - expected) < 0.02


def test_class_changes_respects_range(repo):
    full = repo.class_changes("sinif5", None, None)
    narrow = repo.class_changes("sinif5", "2026-07-15", "2026-07-16")
    assert full and narrow
    assert all(r["endeks_bas"] == 100.0 for r in narrow)
    # a single-day window has <2 points -> nothing to report
    assert repo.class_changes("sinif5", "2026-07-15", "2026-07-15") == []


def test_contrib_sums_to_total_change(repo):
    """Σ katkı == π(t1,t2) of the level's weighted index (unit rule from CLAUDE.md §Kurallar)."""
    rows = repo.contrib(None, None, "bolum")
    i1 = sum(r["agirlik"] * r["endeks_bas"] for r in rows)
    i2 = sum(r["agirlik"] * r["endeks_bit"] for r in rows)
    pi = 100.0 * (i2 / i1 - 1.0)
    assert abs(sum(r["katki_puan"] for r in rows) - pi) < 0.01
