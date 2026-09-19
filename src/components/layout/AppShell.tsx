import { Link, useRouterState, type LinkProps } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ReceiptText,
  PlusCircle,
  PieChart,
  Wallet,
  Tags,
  Smartphone,
  Users,
  User,
  Settings,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const primaryNav = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/transactions", label: "Ledger", icon: ReceiptText },
  { to: "/add-transaction", label: "Add", icon: PlusCircle },
  { to: "/analytics", label: "Insights", icon: PieChart },
  { to: "/budgets", label: "Budgets", icon: Wallet },
] as const;

const secondaryNav = [
  { to: "/import-messages", label: "Read messages", icon: MessageSquare },
  { to: "/family", label: "Family", icon: Users },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/devices", label: "Devices", icon: Smartphone },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggleTheme } = useTheme();
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-sidebar p-4 lg:flex">
        <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            KC
          </span>
          <span className="font-display text-base font-semibold leading-tight">
            Kinship
            <span className="block text-xs font-medium text-muted-foreground">Capital</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {[...primaryNav, ...secondaryNav].map((item) => (
            <SideLink key={item.to} to={item.to} label={item.label} icon={item.icon} active={pathname === item.to} />
          ))}
        </nav>
        <div className="mt-4 rounded-xl border border-border p-3">
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start gap-2" onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold sm:text-xl">{title}</h1>
              {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {action}
              <Button variant="ghost" size="icon" aria-label="Toggle colour theme" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pt-1">
          {primaryNav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-5", item.to === "/add-transaction" && "size-6")} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SideLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: NonNullable<LinkProps["to"]>;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
