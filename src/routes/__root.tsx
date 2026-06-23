import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import backgroundPolishCss from "../background-polish.css?url";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { QuotaToastListener } from "@/components/QuotaToastListener";
import { ErrorScreen } from "@/components/ErrorScreen";
import { ScrollToTop } from "@/components/ScrollToTop";
import { runMigrations } from "@/lib/backup";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Agata — Twoja prywatna przestrzeń na książki, notatki i refleksje" },
      {
        name: "description",
        content:
          "Agata to prywatna aplikacja do śledzenia książek i notatek. Twoja biblioteka, cytaty, zdjęcia stron i refleksje — tylko dla Ciebie.",
      },
      { name: "theme-color", content: "#1a120a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Agata" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: backgroundPolishCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icon.svg" },
      // Fonts are self-hosted via @fontsource (imported in styles.css) — no
      // external CDN, keeping the app private and functional offline.
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <h1 className="font-serif text-5xl">Nic tu nie ma</h1>
        <p className="text-muted-foreground mt-2">
          Ta strona nie znalazła jeszcze swojego miejsca na półce.
        </p>
        <Link
          to="/"
          className="inline-block mt-6 px-5 py-2.5 rounded-full bg-primary text-primary-foreground"
        >
          Wróć do biblioteki
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }) => <ErrorScreen error={error} reset={reset} />,
});

// Apply the saved (or OS-preferred) theme before first paint to avoid a
// light-mode flash for dark-mode users. Mirrors theme-context STORAGE_KEY.
const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem("agata-theme-mode");if(m!=="light"&&m!=="dark"){m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var r=document.documentElement;r.classList.toggle("dark",m==="dark");r.dataset.theme=m;}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    // `suppressHydrationWarning` is intentional: the inline <script> below
    // sets `data-theme` and the `.dark` class on <html> before first paint to
    // avoid a light-mode flash. React doesn't know about the script's DOM
    // mutation, so without this the hydration step complains.
    <html lang="pl" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    runMigrations();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ScrollToTop />
          <AppShell>
            <Outlet />
          </AppShell>
          <Toaster />
          <QuotaToastListener />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
