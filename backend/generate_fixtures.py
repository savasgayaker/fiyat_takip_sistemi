"""Generates static JSON fixtures for the DCK-EOS price index app.

Run once:  python generate_fixtures.py
Output goes to backend/fixtures/*.json and is read by FixtureRepository.
All numeric domain fields keep their Turkish field names (kod, ad_tr, ...).
"""
import json
import random
from datetime import date, timedelta
from pathlib import Path

FIX = Path(__file__).parent / "fixtures"
FIX.mkdir(exist_ok=True)

START = date(2026, 7, 15)
END = date(2026, 9, 12)
DATES = [(START + timedelta(days=i)).isoformat() for i in range((END - START).days + 1)]
N = len(DATES)  # 60

SOURCES = ["Migros", "A101", "BİM", "LCW", "Bursa Hal", "TOBB", "K13 Kira", "Şok"]

# division: (kod, ad_tr, weight, growth%, [ (group_ad, [class_ad, ...]) ])
DIVISIONS = [
    ("01", "Gıda ve alkolsüz içecekler", 24.4, 2.3, [
        ("Ekmek ve tahıllar", ["Ekmek", "Pirinç", "Makarna"]),
        ("Et", ["Kırmızı et", "Tavuk eti"]),
        ("Süt, peynir ve yumurta", ["Süt", "Beyaz peynir", "Yumurta"]),
        ("Yağlar", ["Ayçiçek yağı", "Zeytinyağı"]),
        ("Sebze ve meyve", ["Domates", "Patates", "Elma"]),
        ("Şeker ve içecekler", ["Toz şeker", "Çay"]),
    ]),
    ("02", "Alkollü içecekler, tütün ve uyuşturucular", 4.5, 3.0, [
        ("Tütün", ["Sigara"]),
        ("Alkollü içecekler", ["Rakı", "Bira"]),
    ]),
    ("03", "Giyim ve ayakkabı", 7.9, 0.5, [
        ("Giyim eşyası", ["Erkek gömleği", "Kadın elbisesi", "Çocuk giyimi"]),
        ("Ayakkabı", ["Deri ayakkabı", "Spor ayakkabı"]),
    ]),
    ("04", "Konut, su, elektrik, gaz ve diğer yakıtlar", 11.4, 2.2, [
        ("Kira", ["Konut kirası"]),
        ("Su, elektrik ve gaz", ["Elektrik", "Su", "Doğal gaz"]),
    ]),
    ("05", "Mobilya, ev aletleri ve ev bakımı", 6.0, 0.8, [
        ("Mobilya", ["Oturma grubu", "Yatak"]),
        ("Ev aletleri", ["Buzdolabı", "Çamaşır makinesi"]),
        ("Ev bakımı", ["Çamaşır deterjanı"]),
    ]),
    ("06", "Sağlık", 3.5, 1.0, [
        ("İlaç", ["Ağrı kesici ilaç"]),
        ("Sağlık hizmetleri", ["Doktor muayenesi", "Diş tedavisi"]),
    ]),
    ("07", "Ulaştırma", 16.6, 0.9, [
        ("Araç", ["Otomobil"]),
        ("Yakıt", ["Benzin", "Motorin", "LPG"]),
        ("Ulaştırma hizmetleri", ["Şehir içi ulaşım", "Uçak bileti"]),
    ]),
    ("08", "Bilgi ve iletişim", 3.8, 0.3, [
        ("İletişim cihazları", ["Akıllı telefon"]),
        ("İletişim hizmetleri", ["Mobil tarife", "İnternet aboneliği"]),
    ]),
    ("09", "Boş zaman, spor ve kültür", 3.2, 0.6, [
        ("Elektronik eşya", ["Televizyon"]),
        ("Kültür hizmetleri", ["Sinema bileti"]),
        ("Tatil", ["Yurt içi paket tur"]),
    ]),
    ("10", "Eğitim hizmetleri", 1.5, 0.2, [
        ("Okul", ["Özel okul ücreti"]),
        ("Kurslar", ["Yabancı dil kursu"]),
    ]),
    ("11", "Lokanta ve konaklama hizmetleri", 11.1, 2.2, [
        ("Lokantalar", ["Lokanta yemeği", "Fast food"]),
        ("Kafeler", ["Kahve"]),
        ("Konaklama", ["Otel konaklama"]),
    ]),
    ("12", "Sigorta ve finansal hizmetler", 2.1, 1.2, [
        ("Sigorta", ["Kasko sigortası"]),
        ("Finansal hizmetler", ["Banka hizmet ücreti"]),
    ]),
    ("13", "Kişisel bakım, sosyal koruma ve çeşitli mal ve hizmetler", 4.0, 1.5, [
        ("Kişisel bakım hizmetleri", ["Kuaför / berber"]),
        ("Kişisel bakım ürünleri", ["Şampuan", "Diş macunu", "Sabun"]),
    ]),
]

# realistic base prices (TL) per class name for item generation
BASE_PRICE = {
    "Ekmek": 12, "Pirinç": 68, "Makarna": 22, "Kırmızı et": 640, "Tavuk eti": 145,
    "Süt": 34, "Beyaz peynir": 320, "Yumurta": 6.5, "Ayçiçek yağı": 82, "Zeytinyağı": 380,
    "Domates": 28, "Patates": 19, "Elma": 42, "Toz şeker": 44, "Çay": 190,
    "Sigara": 95, "Rakı": 780, "Bira": 95, "Erkek gömleği": 640, "Kadın elbisesi": 1250,
    "Çocuk giyimi": 480, "Deri ayakkabı": 2200, "Spor ayakkabı": 2600, "Konut kirası": 22000,
    "Elektrik": 2.4, "Su": 38, "Doğal gaz": 4.8, "Oturma grubu": 42000, "Yatak": 15000,
    "Buzdolabı": 32000, "Çamaşır makinesi": 24000, "Çamaşır deterjanı": 185, "Ağrı kesici ilaç": 78,
    "Doktor muayenesi": 900, "Diş tedavisi": 3200, "Otomobil": 1650000, "Benzin": 44.5,
    "Motorin": 46.2, "LPG": 24.8, "Şehir içi ulaşım": 27, "Uçak bileti": 3200,
    "Akıllı telefon": 32000, "Mobil tarife": 420, "İnternet aboneliği": 560, "Televizyon": 28000,
    "Sinema bileti": 260, "Yurt içi paket tur": 18500, "Özel okul ücreti": 240000,
    "Yabancı dil kursu": 12500, "Lokanta yemeği": 480, "Fast food": 320, "Kahve": 145,
    "Otel konaklama": 4200, "Kasko sigortası": 22000, "Banka hizmet ücreti": 180,
    "Kuaför / berber": 480, "Şampuan": 145, "Diş macunu": 78, "Sabun": 42,
}

rnd = random.Random(20260912)

CARRY_CLASS_KOD = None  # will be set to Zeytinyağı's sinif5 kod


def gen_leaf_series(growth, seed):
    r = random.Random(seed)
    walk = 0.0
    out = []
    for i in range(N):
        frac = i / (N - 1)
        if i == 0:
            v = 100.0
        else:
            walk += r.uniform(-0.09, 0.09)
            walk = max(-0.7, min(0.7, walk))
            v = 100.0 * (1 + growth / 100.0 * frac) + walk
        out.append(round(v, 2))
    return out


nodes = []          # flat list
leaf_index = {}     # kod5 -> series values
leaf_meta = {}      # kod5 -> dict

kisim_counter = 0

for (bkod, bad, bweight, bgrowth, groups) in DIVISIONS:
    # collect leaves first
    group_defs = []
    total_leaves = sum(len(cs) for _, cs in groups)
    for gi, (gad, classes) in enumerate(groups):
        gkod = f"{bkod}{gi + 1}"
        s4kod = f"{gkod}1"
        leaves = []
        for ci, cad in enumerate(classes):
            s5kod = f"{s4kod}{ci + 1}"
            kisim_counter = kisim_counter % 24 + 1
            leaves.append((s5kod, cad, kisim_counter))
        group_defs.append((gkod, gad, s4kod, leaves))

    # assign leaf weights so they sum to division weight
    n_leaves = total_leaves
    per = bweight / n_leaves
    leaf_weight = {}
    acc = 0.0
    all_leaves = [lf for _, _, _, lvs in group_defs for lf in lvs]
    for idx, (s5kod, cad, kisim) in enumerate(all_leaves):
        if idx == len(all_leaves) - 1:
            w = round(bweight - acc, 4)
        else:
            w = round(per * rnd.uniform(0.7, 1.3), 4)
            acc += w
        leaf_weight[s5kod] = max(w, 0.05)

    # generate leaf series
    for (s5kod, cad, kisim) in all_leaves:
        g = bgrowth + rnd.uniform(-0.5, 0.6)
        series = gen_leaf_series(g, hash(s5kod) & 0xFFFFFFFF)
        if cad == "Zeytinyağı":
            global_carry = s5kod
            CARRY_CLASS_KOD = s5kod
        leaf_index[s5kod] = series
        leaf_meta[s5kod] = {"ad_tr": cad, "agirlik": round(leaf_weight[s5kod], 2),
                             "kisim_no": kisim}

# mark carry class: flatten last 8 days of Zeytinyağı series (carried forward)
def series_with_durum(kod, values):
    entries = []
    is_carry = (kod == CARRY_CLASS_KOD)
    base_items = leaf_item_count.get(kod, 3)
    for i, d in enumerate(DATES):
        durum = "FRESH"
        endeks = values[i]
        eslesen = base_items
        if is_carry and i >= N - 8:
            durum = "CARRY"
            endeks = values[N - 9]  # carried value
            eslesen = 0
            if i >= N - 2:
                durum = "CARRY_GUN_YOK"
        entries.append({"tarih": d, "endeks": round(endeks, 2),
                        "eslesen_kalem": eslesen, "durum": durum})
    return entries


# ---- items ----------------------------------------------------------------
items_by_leaf = {}     # kod5 -> [item summary]
item_series = {}       # kimlik -> {urun_adi, kaynak, series}
leaf_item_count = {}
kimlik_seq = 1000

variant_suffix = ["", " (1 kg)", " (500 g)", " (adet)", " (paket)", " (1 lt)"]

# Classes with deliberately few items: two trigger the "temsil zayıf" label
# (Otel konaklama, Uçak bileti); the tariff-priced ones are exempt via
# config/tarife_siniflari.json and must NOT be labelled.
FEW_ITEMS = {"Otel konaklama": 5, "Uçak bileti": 6, "Elektrik": 3, "Su": 3,
             "Doğal gaz": 3, "Sigara": 4, "Mobil tarife": 5, "Şehir içi ulaşım": 2}

for s5kod, meta in leaf_meta.items():
    cad = meta["ad_tr"]
    base = BASE_PRICE.get(cad, 100)
    n_items = FEW_ITEMS.get(cad, rnd.randint(10, 16))
    leaf_item_count[s5kod] = n_items
    srcs = [rnd.choice(SOURCES) for _ in range(n_items)]
    lst = []
    series_vals = leaf_index[s5kod]
    for k in range(n_items):
        kimlik = str(kimlik_seq)
        kimlik_seq += 1
        src = srcs[k]
        offset = rnd.uniform(0.9, 1.12)
        prices = []
        for i in range(N):
            p = base * offset * (series_vals[i] / 100.0) * (1 + rnd.uniform(-0.01, 0.01))
            prices.append(round(p, 2))
        son = prices[-1]
        first = prices[0]
        deg = round((son / first - 1) * 100, 2)
        urun = cad + rnd.choice(variant_suffix)
        lst.append({"kimlik": kimlik, "urun_adi": urun, "kaynak": src,
                    "kisim_no": meta["kisim_no"], "son_fiyat": round(son, 2),
                    "degisim": deg, "gun": rnd.randint(28, 60)})
        item_series[kimlik] = {"urun_adi": urun, "kaynak": src,
                               "series": [{"tarih": DATES[i], "fiyat": prices[i]} for i in range(N)]}
    items_by_leaf[s5kod] = lst

# ---- build node tree with aggregated series --------------------------------
# recompute leaf series entries now that item counts exist

def weighted_series(children):
    tw = sum(w for _, w in children)
    out = []
    for i in range(N):
        v = sum(vals[i] * w for vals, w in children) / tw
        out.append(round(v, 2))
    return out


all_bolum_series = {}
for (bkod, bad, bweight, bgrowth, groups) in DIVISIONS:
    group_series_list = []
    for gi, (gad, classes) in enumerate(groups):
        gkod = f"{bkod}{gi + 1}"
        s4kod = f"{gkod}1"
        leaf_pairs = []
        s5_nodes = []
        for ci, cad in enumerate(classes):
            s5kod = f"{s4kod}{ci + 1}"
            vals = leaf_index[s5kod]
            w = leaf_meta[s5kod]["agirlik"]
            leaf_pairs.append((vals, w))
            s5_nodes.append((s5kod, cad, w, vals))
        s4_vals = weighted_series(leaf_pairs)
        s4_weight = round(sum(w for _, w in leaf_pairs), 2)
        group_series_list.append((s4_vals, s4_weight))
        # register sinif4 node (== group aggregate)
        nodes.append({
            "kod": s4kod, "ad_tr": gad, "seviye": "sinif4", "agirlik": s4_weight,
            "parent": gkod, "kisim_no": None,
            "series": [{"tarih": DATES[i], "endeks": s4_vals[i],
                        "eslesen_kalem": sum(leaf_item_count[f"{s4kod}{ci+1}"] for ci in range(len(classes))),
                        "durum": "FRESH"} for i in range(N)],
        })
        # grup node
        nodes.append({
            "kod": gkod, "ad_tr": gad, "seviye": "grup", "agirlik": s4_weight,
            "parent": bkod, "kisim_no": None,
            "series": [{"tarih": DATES[i], "endeks": s4_vals[i],
                        "eslesen_kalem": 0, "durum": "FRESH"} for i in range(N)],
        })
        # leaf nodes
        for (s5kod, cad, w, vals) in s5_nodes:
            nodes.append({
                "kod": s5kod, "ad_tr": cad, "seviye": "sinif5", "agirlik": w,
                "parent": s4kod, "kisim_no": leaf_meta[s5kod]["kisim_no"],
                "series": series_with_durum(s5kod, vals),
            })
    b_vals = weighted_series(group_series_list)
    all_bolum_series[bkod] = b_vals
    nodes.append({
        "kod": bkod, "ad_tr": bad, "seviye": "bolum", "agirlik": round(bweight, 2),
        "parent": "TOPLAM", "kisim_no": None,
        "series": [{"tarih": DATES[i], "endeks": b_vals[i], "eslesen_kalem": 0,
                    "durum": "FRESH"} for i in range(N)],
    })

# TOPLAM
toplam_pairs = [(all_bolum_series[b], w) for (b, _, w, _, _) in DIVISIONS]
toplam_vals = weighted_series(toplam_pairs)
nodes.append({
    "kod": "TOPLAM", "ad_tr": "Genel Endeks (TÜFE)", "seviye": "TOPLAM", "agirlik": 100.0,
    "parent": None, "kisim_no": None,
    "series": [{"tarih": DATES[i], "endeks": toplam_vals[i], "eslesen_kalem": 0,
                "durum": "FRESH"} for i in range(N)],
})

# ---- quality ---------------------------------------------------------------
QUALITY_DAYS = 14
q_dates = DATES[-QUALITY_DAYS:]
section_names = {
    1: "İstanbul - Market", 2: "Ankara - Market", 3: "İzmir - Market",
    4: "Bursa - Hal", 5: "Adana - Market", 6: "Antalya - Market",
    7: "Konya - Akaryakıt", 8: "Gaziantep - Market", 9: "Kayseri - Market",
    10: "Samsun - Market", 11: "Trabzon - Market", 12: "Diyarbakır - Akaryakıt",
    13: "Eskişehir - Market", 14: "Şanlıurfa - Market", 15: "Mersin - Market",
    16: "Kocaeli - Market", 17: "Denizli - Market", 18: "Malatya - Market",
    19: "Erzurum - Kira", 20: "Sivas - Market", 21: "Manisa - Market",
    22: "Balıkesir - Market", 23: "Van - Market", 24: "Aydın - Market",
}
sections = []
for kisim in range(1, 25):
    days = []
    for di, d in enumerate(q_dates):
        rc = 0
        r = random.Random(kisim * 100 + di)
        if kisim in (7, 12) and di in (5, 8, 9):
            rc = 4
        elif kisim == 3 and di in (10, 11):
            rc = 1
        elif kisim == 19 and di == 12:
            rc = 5
        elif r.random() < 0.05:
            rc = 1
        days.append({"tarih": d, "rc": rc})
    sections.append({"kisim_no": kisim, "ad": section_names[kisim], "days": days})

carry_classes = [{
    "kod": CARRY_CLASS_KOD, "ad_tr": leaf_meta[CARRY_CLASS_KOD]["ad_tr"],
    "agirlik": leaf_meta[CARRY_CLASS_KOD]["agirlik"], "gun": 8,
}]
exclusions = [
    {"neden": "Fiyat sıfır veya negatif", "satir": 12},
    {"neden": "Aşırı fiyat değişimi (>%40)", "satir": 5},
    {"neden": "Kaynak eşleşmedi", "satir": 8},
    {"neden": "Miktar bilgisi eksik", "satir": 3},
    {"neden": "Ürün stok dışı", "satir": 6},
]
quality = {"sections": sections, "carry_classes": carry_classes, "exclusions": exclusions}

# ---- basket presets --------------------------------------------------------
bolum_w = {b: w for (b, _, w, _, _) in DIVISIONS}
baskets = {
    "TÜİK 2026": bolum_w,
    "Asgari ücretli": {"01": 32.0, "02": 5.0, "03": 7.0, "04": 16.0, "05": 5.0,
                        "06": 2.5, "07": 12.0, "08": 4.0, "09": 2.0, "10": 1.0,
                        "11": 8.5, "12": 1.5, "13": 3.5},
    "Emekli": {"01": 30.0, "02": 4.0, "03": 5.0, "04": 18.0, "05": 5.5, "06": 7.0,
               "07": 9.0, "08": 4.0, "09": 2.5, "10": 0.5, "11": 6.0, "12": 2.0,
               "13": 6.5},
    "Memur": {"01": 21.0, "02": 4.0, "03": 9.0, "04": 12.0, "05": 6.5, "06": 3.0,
              "07": 17.0, "08": 4.5, "09": 4.0, "10": 3.0, "11": 11.0, "12": 2.0,
              "13": 3.0},
}

# ---- meta ------------------------------------------------------------------
total_weight = sum(leaf_meta[k]["agirlik"] for k in leaf_meta)
covered = sum(leaf_meta[k]["agirlik"] for k in leaf_meta if k != CARRY_CLASS_KOD)
meta = {
    "data_date": DATES[-1],
    "base_day": DATES[0],
    "coverage_weight": round(covered / total_weight * 100, 2),
    "class_count": len(leaf_meta),
    "carry_count": len(carry_classes),
    "app_version": "1.0.0",
    # Method version stamp (yontem_surumu in endeks_* tables); shown in every footer.
    "yontem_surumu": "v0.1",
}

# ---- write -----------------------------------------------------------------
(FIX / "nodes.json").write_text(json.dumps(nodes, ensure_ascii=False), encoding="utf-8")
(FIX / "items.json").write_text(json.dumps(items_by_leaf, ensure_ascii=False), encoding="utf-8")
(FIX / "item_series.json").write_text(json.dumps(item_series, ensure_ascii=False), encoding="utf-8")
(FIX / "quality.json").write_text(json.dumps(quality, ensure_ascii=False), encoding="utf-8")
(FIX / "baskets.json").write_text(json.dumps(baskets, ensure_ascii=False), encoding="utf-8")
(FIX / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

print("Generated fixtures:")
print("  nodes:", len(nodes), "| classes:", len(leaf_meta), "| items:", len(item_series))
print("  TOPLAM last index:", toplam_vals[-1], "| carry class:", CARRY_CLASS_KOD)
print("  meta:", meta)
