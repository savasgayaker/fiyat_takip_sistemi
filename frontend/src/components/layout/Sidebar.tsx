import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListTree,
  ShoppingBasket,
  ShieldCheck,
  GitCompareArrows,
  Download,
  BookText,
} from "lucide-react";
import { tr } from "@/i18n/tr";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: tr.nav.pano, icon: LayoutDashboard, testid: "nav-pano" },
  { to: "/kirilim", label: tr.nav.kirilim, icon: ListTree, testid: "nav-kirilim" },
  { to: "/sepet", label: tr.nav.sepet, icon: ShoppingBasket, testid: "nav-sepet" },
  {
    to: "/kalite",
    label: tr.nav.kaynaklar,
    icon: ShieldCheck,
    testid: "nav-kalite",
  },
  {
    to: "/tuik",
    label: tr.nav.tuik,
    icon: GitCompareArrows,
    testid: "nav-tuik",
  },
  {
    to: "/disa-aktar",
    label: tr.nav.disaAktar,
    icon: Download,
    testid: "nav-disa-aktar",
  },
  { to: "/yontem", label: tr.nav.yontem, icon: BookText, testid: "nav-yontem" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground">
          EÖS
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold">{tr.appShort}</div>
          <div className="text-[11px] text-muted-foreground">{tr.subtitle}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            data-testid={it.testid}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <it.icon className="h-4 w-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
