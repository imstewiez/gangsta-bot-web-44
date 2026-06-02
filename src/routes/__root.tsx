import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { PageTransition } from "@/components/layout/PageTransition";
import { AuthProvider } from "@/lib/auth";
import { AlertTriangle } from "lucide-react";

import appCss from "../styles.css?url";

import { MapPinOff, RotateCcw, Home } from "lucide-react";
import { ERROR_PAGE } from "@/lib/messages";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center animate-rise">
        <div className="relative mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/30">
          <MapPinOff className="h-9 w-9 text-primary" />
          <span className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse" />
        </div>
        <h1 className="text-display text-2xl font-bold tracking-wide">{ERROR_PAGE.notFoundTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {ERROR_PAGE.notFoundDescription}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex cursor-pointer items-center justify-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Home className="mr-1.5 h-4 w-4" />
            {ERROR_PAGE.notFoundButton}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center animate-rise">
        <div className="relative mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
          <AlertTriangle className="h-9 w-9 text-destructive" />
          <span className="absolute inset-0 rounded-full bg-destructive/10 blur-xl animate-pulse" />
        </div>
        <h1 className="text-display text-xl font-bold tracking-wide">{ERROR_PAGE.genericTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {ERROR_PAGE.genericDescription}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="cursor-pointer rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 inline-flex items-center"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            {ERROR_PAGE.genericButton}
          </button>
          <a
            href="/"
            className="rounded-sm border border-border px-4 py-2 text-sm font-medium hover:bg-accent inline-flex items-center"
          >
            <Home className="mr-1.5 h-4 w-4" />
            {ERROR_PAGE.notFoundButton}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" },
        { title: "Ballas Gang" },
        {
          name: "description",
          content:
            "Painel operacional da Ballas Gang — gestão interna, recursos e estrutura hierárquica.",
        },
        { property: "og:title", content: "Ballas Gang" },
        { name: "twitter:title", content: "Ballas Gang" },
        { property: "og:description", content: "Plataforma de gestão da firma Ballas Gang — encomendas, armazém, classificações e direção." },
        { name: "twitter:description", content: "Plataforma de gestão da firma Ballas Gang — encomendas, armazém, classificações e direção." },
        { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/63b21cd3-9da8-450a-9c1d-fd27accd9031/id-preview-9caf4930--19809dc3-8dcb-4892-b409-4a41be469381.lovable.app-1778616396528.png" },
        { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/63b21cd3-9da8-450a-9c1d-fd27accd9031/id-preview-9caf4930--19809dc3-8dcb-4892-b409-4a41be469381.lovable.app-1778616396528.png" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:type", content: "website" },
      ],
      links: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Unbounded:wght@400;600;700&display=swap",
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <HeadContent />
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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PageTransition><Outlet /></PageTransition>
        <GlobalSearch />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
