"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppBottomNav, type AppBottomTab } from "@/components/app-bottom-nav";

function tabFromPath(pathname: string): AppBottomTab | null {
  if (pathname === "/" || pathname === "") return "decks";
  if (pathname.startsWith("/jlpt-analyzer")) return "vocab";
  if (pathname.startsWith("/grammar-analyzer")) return "grammar";
  if (pathname.startsWith("/script-analyzer")) return "script";
  return null;
}

function AppChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const search = useSearchParams();
  const studying = pathname === "/" && Boolean(search.get("deck"));
  const active = studying ? null : tabFromPath(pathname);
  const showBottomNav = Boolean(active);

  return (
    <div
      className={["app-chrome", showBottomNav ? "app-chrome--with-nav" : ""].filter(Boolean).join(" ")}
    >
      <div className="app-chrome__main">{children}</div>
      {active ? <AppBottomNav active={active} /> : null}
    </div>
  );
}

/**
 * Stable chrome shell: keeps bottom nav mounted across Decks ↔ analyzers
 * and reserves nav space so content height does not jump.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="app-chrome">
          <div className="app-chrome__main">{children}</div>
        </div>
      }
    >
      <AppChromeInner>{children}</AppChromeInner>
    </Suspense>
  );
}
