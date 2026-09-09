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
  { to: "/", label: tr.nav.pano, icon: LayoutDashboard },
  { to: "/kirilim", label: tr.nav.kirilim, icon: ListTree },
  { to: "/sepet", label: tr.nav.sepet, icon: ShoppingBasket },
  { to: "/kalite", label: tr.nav.kaynaklar, icon: ShieldCheck },
  { to: "/tuik", label: tr.nav.tuik, icon: GitCompareArrows },
  { to: "/disa-aktar", label: tr.nav.disaAktar, icon: Download },
  { to: "/yontem", label: tr.nav.yontem, icon: BookText },
];

/** Compact horizontal nav for < lg screens. */
export function MobileNav() {
  return (
    <nav className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 lg:hidden">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === "/"}
          className={({ isActive }) =>
            cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )
          }
        >
          <it.icon className="h-3.5 w-3.5" />
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
