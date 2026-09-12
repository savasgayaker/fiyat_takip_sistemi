import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtNum, fmtPct } from "@/lib/format";
import { colorForKod } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { tr } from "@/i18n/tr";
import { DEVREDEN_DURUMLAR, type TreeNode } from "@/types";

/** Değişim rengi: devreden sınıfta gri; artış yeşil, düşüş kırmızı; %0,00 yalnız FRESH'te siyah. */
function changeClass(node: TreeNode): string {
  if (node.durum && DEVREDEN_DURUMLAR.includes(node.durum)) return "text-muted-foreground";
  if (node.degisim_donem > 0) return "text-emerald-600";
  if (node.degisim_donem < 0) return "text-red-600";
  return node.durum === "FRESH" ? "text-foreground" : "text-muted-foreground";
}

interface Props {
  nodes: TreeNode[];
  selected: string[];
  onToggle: (kod: string) => void;
}

interface FlatRow {
  /** The node whose index/weight/children are shown (deepest of a collapsed chain). */
  node: TreeNode;
  /** Codes of the chain, e.g. ["081", "0811"]; a single entry when nothing collapsed. */
  chain: string[];
  depth: number;
  hasChildren: boolean;
}

const WEIGHT_EPS = 0.005;

/**
 * Collapse pass-through levels: a node with exactly one child whose weight
 * equals its own carries no information of its own, so it is displayed as
 * "081 › 0811" with the child's index and weight. Applied repeatedly, so
 * chains of any length collapse; any depth (bolum → grup → sinif4 → sinif5
 * or deeper) is supported because the walk is recursive.
 */
function collapseChain(node: TreeNode): { node: TreeNode; chain: string[] } {
  const chain = [node.kod];
  let cur = node;
  while (
    cur.children?.length === 1 &&
    Math.abs(cur.children[0].agirlik - cur.agirlik) < WEIGHT_EPS
  ) {
    cur = cur.children[0];
    chain.push(cur.kod);
  }
  return { node: cur, chain };
}

/** Flatten the visible portion of the tree into rows (respecting open state). */
function flatten(nodes: TreeNode[], openSet: Set<string>, depth: number, out: FlatRow[]) {
  for (const raw of nodes) {
    const { node, chain } = collapseChain(raw);
    const hasChildren = !!node.children && node.children.length > 0;
    out.push({ node, chain, depth, hasChildren });
    if (hasChildren && openSet.has(node.kod)) {
      flatten(node.children, openSet, depth + 1, out);
    }
  }
}

export function TreeView({ nodes, selected, onToggle }: Props) {
  // Divisions (top level) start open.
  const [openSet, setOpenSet] = useState<Set<string>>(
    () => new Set(nodes.map((n) => collapseChain(n).node.kod)),
  );

  const rows = useMemo(() => {
    const out: FlatRow[] = [];
    flatten(nodes, openSet, 0, out);
    return out;
  }, [nodes, openSet]);

  const toggleOpen = (kod: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(kod)) next.delete(kod);
      else next.add(kod);
      return next;
    });
  };

  return (
    <div>
      {rows.map(({ node, chain, depth, hasChildren }) => {
        // Selection uses the deepest code of the chain: its series is the one shown.
        const isSel = selected.includes(node.kod);
        const isOpen = openSet.has(node.kod);
        return (
          <div
            key={node.kod}
            onClick={() => onToggle(node.kod)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-sm hover:bg-accent",
              isSel && "bg-accent",
            )}
            style={{ paddingLeft: depth * 14 + 4 }}
            data-testid={`tree-node-${node.kod}`}
            data-chain={chain.length > 1 ? chain.join(">") : undefined}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) toggleOpen(node.kod);
              }}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded",
                !hasChildren && "invisible",
              )}
              aria-label={isOpen ? "Kapat" : "Aç"}
              data-testid={`tree-toggle-${node.kod}`}
            >
              <ChevronRight
                className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
              />
            </button>
            <Checkbox
              checked={isSel}
              onClick={(e: any) => e.stopPropagation()}
              onCheckedChange={() => onToggle(node.kod)}
              className="shrink-0"
              data-testid={`tree-check-${node.kod}`}
            />
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: colorForKod(node.kod) }}
            />
            <span className="flex-1 truncate text-left" title={node.ad_tr}>
              <span className="mr-1 font-mono text-xs text-muted-foreground">
                {chain.join(" › ")}
              </span>
              {node.ad_tr}
            </span>
            {node.tarife && (
              <span
                className="shrink-0 rounded border border-border px-1 text-[10px] leading-4 text-muted-foreground"
                title="Tarifeli (idari fiyatlı) sınıf: az kalemle temsil normaldir"
                data-testid={`tree-tarife-${node.kod}`}
              >
                {tr.breakdown.tariff}
              </span>
            )}
            {node.durum && DEVREDEN_DURUMLAR.includes(node.durum) && (
              <span
                className="shrink-0 rounded bg-muted px-1 text-[10px] leading-4 text-muted-foreground"
                title={(tr.durum as any)[node.durum] || node.durum}
                data-testid={`tree-devreden-${node.kod}`}
              >
                {tr.breakdown.carried} · {node.devreden_gun ?? 1} {tr.breakdown.carriedDays}
              </span>
            )}
            <span className="shrink-0 text-xs tabular text-muted-foreground">
              {fmtNum(node.agirlik)}%
            </span>
            <span className={cn("w-16 shrink-0 text-right text-xs tabular", changeClass(node))} data-testid={`tree-change-${node.kod}`}>
              {fmtPct(node.degisim_donem)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
