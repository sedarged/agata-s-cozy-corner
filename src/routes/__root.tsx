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
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { QuotaToastListener } from "@/components/QuotaToastListener";
import { ErrorScreen } from "@/components/ErrorScreen";
import { runMigrations } from "@/lib/backup";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Agata — Twoja prywatna przestrzeń na książki, notatki i refleksje" },
      { name: "description", content: "Agata to prywatna aplikacja do śledzenia książek i notatek. Twoja biblioteka, cytaty, zdjęcia stron i refleksje — tylko dla Ciebie." },
      { name: "theme-color", content: "#3a1018" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Agata" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Parisienne&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <h1 className="font-serif text-5xl">Nic tu nie ma</h1>
        <p className="text-muted-foreground mt-2">Ta strona nie znalazła jeszcze swojego miejsca na półce.</p>
        <Link to="/" className="inline-block mt-6 px-5 py-2.5 rounded-full bg-primary text-primary-foreground">Wróć do biblioteki</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }) => <ErrorScreen error={error} reset={reset} />,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
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
          <AppShell><Outlet /></AppShell>
          <Toaster />
          <QuotaToastListener />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
