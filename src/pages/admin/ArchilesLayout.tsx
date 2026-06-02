import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CheckSquare,
  Database,
  Inbox,
  MessageCircle,
  Sliders,
  BarChart3,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NotFound from "@/pages/NotFound";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "palenik.filip@gmail.com";

type AuthState = "loading" | "denied" | "ok";

const NAV = [
  { to: "/admin/archiles", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/archiles/review", label: "Review Queue", icon: CheckSquare },
  { to: "/admin/archiles/sources-queue", label: "Sources Queue", icon: Inbox },
  { to: "/admin/archiles/sources", label: "Sources", icon: Database },
  { to: "/admin/archiles/chat", label: "Chat s Archilem", icon: MessageCircle },
  { to: "/admin/archiles/autonomy", label: "Autonomie", icon: Sliders },
  { to: "/admin/stats", label: "Statistiky", icon: BarChart3 },
];

export function useAdminGate() {
  const [auth, setAuth] = useState<AuthState>("loading");
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setAuth(data.user?.email === ADMIN_EMAIL ? "ok" : "denied");
    });
    return () => {
      alive = false;
    };
  }, []);
  return auth;
}

function Breadcrumb() {
  const loc = useLocation();
  const parts = loc.pathname.split("/").filter(Boolean);
  return (
    <nav className="text-xs text-muted-foreground flex items-center gap-1">
      <Link to="/dashboard" className="hover:text-foreground">App</Link>
      {parts.map((p, i) => {
        const href = "/" + parts.slice(0, i + 1).join("/");
        return (
          <span key={href} className="flex items-center gap-1">
            <span>/</span>
            <Link to={href} className="hover:text-foreground capitalize">{p}</Link>
          </span>
        );
      })}
    </nav>
  );
}

interface Props {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export default function ArchilesLayout({ title, children, actions }: Props) {
  const auth = useAdminGate();

  if (auth === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (auth === "denied") return <NotFound />;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-card/40">
        <div className="px-4 py-4 border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Zpět do aplikace
          </Link>
          <div className="mt-3">
            <div className="text-lg font-semibold">Archiles</div>
            <div className="text-xs text-muted-foreground">Admin Console</div>
          </div>
        </div>
        <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Breadcrumb />
            <h1 className="text-xl md:text-2xl font-semibold mt-1">{title}</h1>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "—";
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "právě teď";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} d`;
}