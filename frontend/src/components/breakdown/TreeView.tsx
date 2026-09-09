import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtNum, fmtPct } from "@/lib/format";
import { colorForKod } from "@/lib/palette";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/types";

interface Props {
  nodes: TreeNode[];
  selected: string[];
  onToggle: (kod: string) => void;
}

interface FlatRow {
  node: TreeNode;
  depth: number;
  hasChildren: boolean;
}

/** Flatten the visible portion of the tree into rows (respecting open state). */
function flatten(
  nodes: TreeNode[],
  openSet: Set<string>,
  depth: number,
  out: FlatRow[],
) {
  for (const node of nodes) {
    const hasChildren = !!node.children && node.children.length > 0;
    out.push({ node, depth, hasChildren });
    if (hasChildren && openSet.has(node.kod)) {
      flatten(node.children, openSet, depth + 1, out);
    }
  }
}

export function TreeView({ nodes, selected, onToggle }: Props) {
  // Divisions (top level) start open.
  const [openSet, setOpenSet] = useState<Set<string>>(
    () => new Set(nodes.map((n) => n.kod)),
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
      {rows.map(({ node, depth, hasChildren }) => {
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
                {node.kod}
              </span>
              {node.ad_tr}
            </span>
            <span className="shrink-0 text-xs tabular text-muted-foreground">
              {fmtNum(node.agirlik)}%
            </span>
            <span
              className={cn(
                "w-16 shrink-0 text-right text-xs tabular",
                node.degisim_donem > 0
                  ? "text-emerald-600"
                  : node.degisim_donem < 0
                    ? "text-red-600"
                    : "text-muted-foreground",
              )}
            >
              {fmtPct(node.degisim_donem)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
