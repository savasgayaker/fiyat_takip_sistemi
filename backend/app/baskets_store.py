"""config/sepetler.json — the only file the application writes.

Shape: {"_not": "...", "_sabit": ["TÜİK 2026", ...], "<ad>": {"01": 24.44, ...}, ...}
Presets listed in `_sabit` cannot be deleted or overwritten. Weights are scaled to 100 on save.
Path override for tests: DCK_EOS_SEPETLER=<file>.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Dict, List

from app.data.repository import DEFAULT_CONFIG_DIR

KOD_RE = re.compile(r"^\d{2,5}$")


def sepetler_yolu() -> Path:
    return Path(os.environ.get("DCK_EOS_SEPETLER") or (DEFAULT_CONFIG_DIR / "sepetler.json"))


def _oku() -> Dict:
    p = sepetler_yolu()
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def baskets() -> Dict[str, Dict[str, float]]:
    return {k: {kod: float(w) for kod, w in v.items()} for k, v in _oku().items()
            if not k.startswith("_") and isinstance(v, dict)}


def sabit() -> List[str]:
    return [str(x) for x in _oku().get("_sabit", [])]


def kaydet(ad: str, agirliklar: Dict[str, float]) -> Dict[str, Dict[str, float]]:
    ad = (ad or "").strip()
    if not ad or ad.startswith("_") or len(ad) > 60:
        raise ValueError("geçersiz sepet adı")
    if ad in sabit():
        raise PermissionError(f"'{ad}' hazır sepettir, üzerine yazılamaz")
    temiz = {}
    for kod, w in (agirliklar or {}).items():
        if not KOD_RE.match(str(kod)):
            raise ValueError(f"geçersiz kod: {kod}")
        w = float(w)
        if w < 0:
            raise ValueError(f"negatif ağırlık: {kod}")
        if w > 0:
            temiz[str(kod)] = w
    toplam = sum(temiz.values())
    if toplam <= 0:
        raise ValueError("ağırlıkların toplamı sıfır")
    temiz = {k: round(w * 100.0 / toplam, 4) for k, w in temiz.items()}
    d = _oku()
    d[ad] = temiz
    _yaz(d)
    return baskets()


def sil(ad: str) -> Dict[str, Dict[str, float]]:
    d = _oku()
    if ad in sabit():
        raise PermissionError(f"'{ad}' hazır sepettir, silinemez")
    if ad not in d or ad.startswith("_"):
        raise KeyError(ad)
    del d[ad]
    _yaz(d)
    return baskets()


def _yaz(d: Dict) -> None:
    p = sepetler_yolu()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, p)
