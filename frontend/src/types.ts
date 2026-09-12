export type Seviye = "TOPLAM" | "bolum" | "grup" | "sinif4" | "sinif5";
/** Sınıf-gün durumu (fiyat_takip.endeks v0.1):
 *  FRESH — zincir ilerledi; CARRY — eşleşen kalem eşiğin altında, endeks taşındı;
 *  CARRY_GUN_YOK — sınıfta o gün veri yok; ZINCIR_KOPUK — bugün veri var, önceki veri gününde yok;
 *  BASLANGIC — pencerenin ilk günü. "Devreden" sayımı CARRY, CARRY_GUN_YOK ve ZINCIR_KOPUK'u kapsar. */
export type Durum = "FRESH" | "CARRY" | "CARRY_GUN_YOK" | "ZINCIR_KOPUK" | "BASLANGIC";
export const DEVREDEN_DURUMLAR: readonly Durum[] = ["CARRY", "CARRY_GUN_YOK", "ZINCIR_KOPUK"];

export interface Meta {
  data_date: string;
  base_day: string;
  coverage_weight: number;
  class_count: number;
  /** Son gün devreden sınıf sayısı (durum ∈ DEVREDEN_DURUMLAR). */
  carry_count: number;
  app_version: string;
  /** Method version of the published series (yontem_surumu), e.g. "v0.1". */
  yontem_surumu: string;
}

export interface SeriesPoint {
  tarih: string;
  endeks: number;
  eslesen_kalem?: number;
  durum?: Durum;
}

export interface IndexResponse {
  kod: string;
  ad_tr: string;
  agirlik: number;
  seviye: Seviye;
  series: SeriesPoint[];
}

export interface MultiSeries {
  kod: string;
  ad_tr: string;
  seviye: Seviye;
  agirlik: number;
  series: SeriesPoint[];
}

export interface TreeNode {
  kod: string;
  ad_tr: string;
  seviye: Seviye;
  agirlik: number;
  degisim_donem: number;
  children: TreeNode[];
}

export interface Contrib {
  kod: string;
  ad_tr: string;
  agirlik: number;
  endeks_bas: number;
  endeks_bit: number;
  degisim: number;
  katki_puan: number;
}

export interface SourceSeries {
  kaynak: string;
  kisim_no: number;
  kalem_sayisi: number;
  series: { tarih: string; endeks: number }[];
}

export interface Item {
  kimlik: string;
  urun_adi: string;
  kaynak: string;
  kisim_no: number;
  son_fiyat: number;
  degisim: number;
  gun: number;
}

export interface ItemsResponse {
  total: number;
  items: Item[];
}

export interface ItemDetail {
  kimlik: string;
  urun_adi: string;
  kaynak: string;
  series: { tarih: string; fiyat: number }[];
}

export interface QualityDay {
  tarih: string;
  rc: number;
}
export interface QualitySection {
  kisim_no: number;
  ad: string;
  /** COICOP divisions this section feeds (config/kisim_adlari.json). */
  bolumler: string[];
  days: QualityDay[];
}
/** MASTER return-code canon (config/rc_kodlari.json). */
export interface RcCode {
  rc: number;
  ad: string;
  aciklama: string;
  renk: string;
}
export interface CarryClass {
  kod: string;
  ad_tr: string;
  agirlik: number;
  gun: number;
}
export interface Exclusion {
  neden: string;
  satir: number;
}
/** "Temsil zayıf": ağırlık ≥ 0,3 ∧ kalem < 10 ∧ tarife listesinde değil. */
export interface WeakClass {
  kod: string;
  ad_tr: string;
  agirlik: number;
  kalem: number;
}
export interface QualityResponse {
  sections: QualitySection[];
  carry_classes: CarryClass[];
  exclusions: Exclusion[];
  weak_classes: WeakClass[];
  rc_kodlari: RcCode[];
}

/** 'TÜİK 2026' hazır sepeti: veri tarihindeki kapsanan bölüm ağırlıkları (Pano TOPLAM ile aynı payda). */
export interface TuikBasket {
  ad: string;
  tarih: string;
  agirlik: Record<string, number>;
  tam_agirlik: Record<string, number>;
  kapsanan_toplam: number;
}

export interface BasketResult {
  series: { tarih: string; endeks: number }[];
  contrib: {
    kod: string;
    ad_tr: string;
    agirlik: number;
    degisim: number;
    katki_puan: number;
  }[];
}

export interface TuikRow {
  kod: string;
  ad_tr: string;
  tuik: number;
  biz: number;
  fark: number;
  agirlik: number;
  katki_fark: number;
}
export interface TuikCompareResult {
  month: string;
  rows: TuikRow[];
  summary: { tuik: number; biz: number; fark: number };
}

export interface SearchHit {
  type: "class" | "item";
  kod?: string;
  kimlik?: string;
  ad_tr: string;
  seviye?: Seviye;
  kaynak?: string;
}

export interface ExportTable {
  name: string;
  columns: string[];
  rows: (string | number)[][];
}
