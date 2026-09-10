"""Excel / PDF / TÜİK-compare helpers.

Pure functions over the public `Repository` interface only — no private
attribute access (`repo._nodes` etc.) and no index math beyond what the
repository already returns.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Any, Dict, List, Optional

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font as XLFont, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.widgets.markers import makeMarker

# Bundled with the backend (backend/assets/fonts) so the PDF renders Turkish
# glyphs identically on Windows, macOS and inside the PyInstaller sidecar.
FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
_FONTS_READY = False


def _ensure_fonts():
    global _FONTS_READY
    if _FONTS_READY:
        return
    pdfmetrics.registerFont(TTFont("DejaVu", str(FONT_DIR / "DejaVuSans.ttf")))
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
    _FONTS_READY = True


def _tr_num(v: Any) -> str:
    if isinstance(v, (int, float)):
        s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return s
    return str(v)


# --------------------------------------------------------------------------
def build_excel(screen: str, payload: Dict[str, Any]) -> bytes:
    wb = Workbook()
    wb.remove(wb.active)
    tables: List[Dict[str, Any]] = payload.get("tables", [])
    if not tables:
        tables = [{"name": "Veri", "columns": ["Bilgi"], "rows": [["Veri yok"]]}]
    header_fill = PatternFill("solid", fgColor="1E3A8A")
    for t in tables:
        title = (t.get("name") or "Sayfa")[:31]
        ws = wb.create_sheet(title=title)
        cols = t.get("columns", [])
        ws.append(cols)
        for c in range(1, len(cols) + 1):
            cell = ws.cell(row=1, column=c)
            cell.font = XLFont(bold=True, color="FFFFFF")
            cell.fill = header_fill
        for row in t.get("rows", []):
            ws.append(row)
        for i, col in enumerate(cols, 1):
            width = max(12, len(str(col)) + 2)
            ws.column_dimensions[chr(64 + i) if i <= 26 else "AA"].width = width
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# --------------------------------------------------------------------------
def _line_drawing(series: List[Dict[str, Any]], width=440, height=200) -> Drawing:
    d = Drawing(width, height)
    data = [[(i, p["endeks"]) for i, p in enumerate(series)]]
    lp = LinePlot()
    lp.x = 40
    lp.y = 30
    lp.width = width - 70
    lp.height = height - 60
    lp.data = data
    lp.lines[0].strokeColor = colors.HexColor("#1E3A8A")
    lp.lines[0].strokeWidth = 1.6
    vals = [p["endeks"] for p in series] or [100]
    lp.yValueAxis.valueMin = min(vals) - 0.3
    lp.yValueAxis.valueMax = max(vals) + 0.3
    lp.xValueAxis.valueMin = 0
    lp.xValueAxis.valueMax = max(len(series) - 1, 1)
    lp.xValueAxis.visibleGrid = 1
    lp.yValueAxis.visibleGrid = 1
    d.add(lp)
    return d


def build_pdf(repo, frm: Optional[str], to: Optional[str]) -> bytes:
    _ensure_fonts()
    meta = repo.meta()
    toplam = repo.index("TOPLAM", "TOPLAM", frm, to)
    series = toplam.get("series", [])
    contrib = repo.contrib(frm, to, "bolum")
    # top risers / fallers among classes (sinif5) — stored index ratios only
    class_changes = [(c["ad_tr"], c["degisim"]) for c in repo.class_changes("sinif5", frm, to)]
    risers = sorted(class_changes, key=lambda x: x[1], reverse=True)[:10]
    fallers = sorted(class_changes, key=lambda x: x[1])[:10]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm,
                            bottomMargin=1.5 * cm, leftMargin=1.5 * cm, rightMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    for s in styles.byName.values():
        s.fontName = "DejaVu"
    title = ParagraphStyle("t", parent=styles["Title"], fontName="DejaVu-Bold",
                           textColor=colors.HexColor("#1E3A8A"), fontSize=22)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="DejaVu-Bold",
                        textColor=colors.HexColor("#1E3A8A"))
    normal = styles["Normal"]
    small = ParagraphStyle("small", parent=normal, fontSize=8,
                           textColor=colors.HexColor("#64748B"))

    el: List[Any] = []
    period = f"{frm or meta['base_day']} — {to or meta['data_date']}"
    el += [Spacer(1, 2 * cm), Paragraph("DÇK-EÖS Fiyat Endeksi", title),
           Spacer(1, 0.3 * cm), Paragraph("Günlük Fiyat Endeksi Bülteni", h2),
           Spacer(1, 0.5 * cm), Paragraph(f"Dönem: {period}", normal),
           Paragraph(f"Veri tarihi: {meta['data_date']}", normal),
           Paragraph(f"Uygulama sürümü: {meta['app_version']} · Yöntem sürümü: {meta.get('yontem_surumu', '—')}", normal),
           Spacer(1, 0.8 * cm)]

    change = 0.0
    if len(series) >= 2:
        change = (series[-1]["endeks"] / series[0]["endeks"] - 1) * 100
    el += [Paragraph(f"Genel endeks (son): {_tr_num(series[-1]['endeks']) if series else '-'}", normal),
           Paragraph(f"Dönem değişimi: %{_tr_num(round(change, 2))}", normal),
           Spacer(1, 0.4 * cm), Paragraph("Genel Endeks (TOPLAM)", h2),
           _line_drawing(series), Spacer(1, 0.5 * cm)]

    # division table
    el.append(Paragraph("Bölüm Katkıları (puan)", h2))
    tdata = [["Kod", "Bölüm", "Ağırlık", "Değişim %", "Katkı (puan)"]]
    for c in contrib:
        tdata.append([c["kod"], c["ad_tr"][:34], _tr_num(c["agirlik"]),
                      _tr_num(c["degisim"]), _tr_num(c["katki_puan"])])
    t = Table(tdata, colWidths=[1.4 * cm, 7 * cm, 2 * cm, 2.4 * cm, 3 * cm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "DejaVu"),
        ("FONTNAME", (0, 0), (-1, 0), "DejaVu-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
    ]))
    el += [t, Spacer(1, 0.5 * cm)]

    # risers / fallers
    el.append(Paragraph("En Çok Artan / Azalan 10 Sınıf", h2))
    rf = [["En çok artan", "%", "En çok azalan", "%"]]
    for i in range(10):
        r = risers[i] if i < len(risers) else ("", 0)
        f = fallers[i] if i < len(fallers) else ("", 0)
        rf.append([r[0][:26], _tr_num(round(r[1], 2)), f[0][:26], _tr_num(round(f[1], 2))])
    t2 = Table(rf, colWidths=[5.5 * cm, 2 * cm, 5.5 * cm, 2 * cm])
    t2.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "DejaVu"),
        ("FONTNAME", (0, 0), (-1, 0), "DejaVu-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("ALIGN", (3, 0), (3, -1), "RIGHT"),
    ]))
    el += [t2, Spacer(1, 0.5 * cm)]

    el += [Paragraph("Yöntem Notu", h2),
           Paragraph("Endeks, TÜİK 2026 sepet ağırlıkları kullanılarak baz gün = 100 "
                     "üzerinden hesaplanmıştır. Dönem enflasyonu I(t2)/I(t1) − 1 formülü "
                     "ile bulunur; bölüm katkısı (I_B − 100)·w_B / Σw olarak puan cinsinden "
                     "verilir.", normal),
           Spacer(1, 0.3 * cm),
           Paragraph(f"Kapsam dipnotu: Sepetin %{_tr_num(meta['coverage_weight'])} ağırlığı "
                     f"kapsanmıştır. Devreden (carry) sınıf sayısı: {meta['carry_count']}.", small)]

    doc.build(el)
    return buf.getvalue()


# --------------------------------------------------------------------------
def tuik_compare(repo, file_bytes: bytes, frm: Optional[str], to: Optional[str]) -> Dict[str, Any]:
    """Parse an uploaded TÜİK xlsx (columns: kod, oran) and compare to ours.

    Expected sheet: first column COICOP kod (e.g. 01), second column monthly %.
    A header row is auto-detected and skipped.
    """
    wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active
    tuik_map: Dict[str, float] = {}
    month = ""
    for row in ws.iter_rows(values_only=True):
        if not row or row[0] is None:
            continue
        kod = str(row[0]).strip()
        if kod.lower() in ("kod", "code", "bölüm", "bolum"):
            continue
        try:
            oran = float(str(row[1]).replace(",", ".")) if len(row) > 1 and row[1] is not None else None
        except (ValueError, TypeError):
            oran = None
        if oran is None:
            continue
        # normalise 2-digit codes
        if kod.isdigit() and len(kod) == 1:
            kod = "0" + kod
        tuik_map[kod] = oran
    month = to or repo.meta()["data_date"]

    rows = []
    divisions = repo.class_changes("bolum", frm, to)
    total_w = sum(d["agirlik"] for d in divisions)
    sum_tuik = sum_biz = 0.0
    for d in divisions:
        if d["kod"] not in tuik_map:
            continue
        biz = d["degisim"]
        tuik = tuik_map[d["kod"]]
        katki_fark = (biz - tuik) * d["agirlik"] / total_w
        rows.append({
            "kod": d["kod"], "ad_tr": d["ad_tr"], "tuik": round(tuik, 2),
            "biz": round(biz, 2), "fark": round(biz - tuik, 2),
            "agirlik": d["agirlik"], "katki_fark": round(katki_fark, 3),
        })
        sum_tuik += tuik * d["agirlik"] / total_w
        sum_biz += biz * d["agirlik"] / total_w
    rows.sort(key=lambda x: abs(x["fark"]), reverse=True)
    return {
        "month": month,
        "rows": rows,
        "summary": {"tuik": round(sum_tuik, 2), "biz": round(sum_biz, 2),
                    "fark": round(sum_biz - sum_tuik, 2)},
    }
