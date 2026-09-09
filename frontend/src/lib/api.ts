import axios from "axios";
import type {
  BasketResult,
  Contrib,
  IndexResponse,
  ItemDetail,
  ItemsResponse,
  Meta,
  MultiSeries,
  QualityResponse,
  SearchHit,
  SourceSeries,
  TreeNode,
  TuikCompareResult,
  ExportTable,
} from "@/types";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL as string;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export async function getMeta(): Promise<Meta> {
  return (await client.get("/meta")).data;
}

export async function getIndex(
  level: string,
  kod: string,
  from: string,
  to: string,
): Promise<IndexResponse> {
  return (await client.get("/index", { params: { level, kod, from, to } })).data;
}

export async function getIndexMulti(
  kodlar: string[],
  from: string,
  to: string,
): Promise<MultiSeries[]> {
  return (
    await client.get("/index/multi", {
      params: { kodlar: kodlar.join(","), from, to },
    })
  ).data;
}

export async function getTree(): Promise<TreeNode[]> {
  return (await client.get("/tree")).data;
}

export async function getContrib(
  from: string,
  to: string,
  level = "bolum",
): Promise<Contrib[]> {
  return (await client.get("/contrib", { params: { from, to, level } })).data;
}

export async function getSources(
  kod: string,
  from: string,
  to: string,
): Promise<SourceSeries[]> {
  return (await client.get(`/sources/${kod}`, { params: { from, to } })).data;
}

export async function getItems(
  kod: string,
  from: string,
  to: string,
  page = 1,
  sort = "urun_adi",
): Promise<ItemsResponse> {
  return (
    await client.get(`/items/${kod}`, { params: { from, to, page, sort } })
  ).data;
}

export async function getItem(
  kimlik: string,
  from: string,
  to: string,
): Promise<ItemDetail> {
  return (await client.get(`/item/${kimlik}`, { params: { from, to } })).data;
}

export async function getQuality(days = 14): Promise<QualityResponse> {
  return (await client.get("/quality", { params: { days } })).data;
}

export async function getBaskets(): Promise<Record<string, Record<string, number>>> {
  return (await client.get("/baskets")).data;
}

export async function computeBasket(
  weights: Record<string, number>,
  from: string,
  to: string,
): Promise<BasketResult> {
  return (await client.post("/basket/compute", { weights, from, to })).data;
}

export async function searchAll(q: string): Promise<SearchHit[]> {
  if (!q) return [];
  return (await client.get("/search", { params: { q } })).data;
}

export async function getMethod(): Promise<{ markdown: string }> {
  return (await client.get("/method")).data;
}

export async function tuikCompare(
  file: File,
  from: string,
  to: string,
): Promise<TuikCompareResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("from", from);
  fd.append("to", to);
  return (
    await client.post("/tuik/compare", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  ).data;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportExcel(screen: string, tables: ExportTable[]) {
  const res = await client.post(
    "/export/excel",
    { screen, payload: { tables } },
    { responseType: "blob" },
  );
  download(res.data, `${screen}.xlsx`);
}

export async function exportPdf(from: string, to: string) {
  const res = await client.post(
    "/export/pdf",
    { from, to },
    { responseType: "blob" },
  );
  download(res.data, "bulten.pdf");
}
