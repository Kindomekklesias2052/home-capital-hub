import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-md px-5 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            KC
          </span>
          <span className="font-display text-base font-semibold">Kinship Capital</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-12">
        <div className="surface p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
