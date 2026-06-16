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

const SITE_URL = "https://ballasgang.eu";
const SITE_TITLE = "Ballas Gang";
const SITE_DESCRIPTION = "Painel interno da Ballas Gang para gestão operacional, membros, entregas, encomendas, inventário e direção.";
const SITE_IMAGE = `${SITE_URL}/assets/ballas-logo-Dw-OuUpd.png`;

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
        { title: SITE_TITLE },
        { name: "description", content: SITE_DESCRIPTION },
        { property: "og:site_name", content: SITE_TITLE },
        { property: "og:title", content: SITE_TITLE },
        { property: "og:description", content: SITE_DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: SITE_URL },
        { property: "og:image", content: SITE_IMAGE },
        { property: "og:image:secure_url", content: SITE_IMAGE },
        { property: "og:image:alt", content: SITE_TITLE },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: SITE_TITLE },
        { name: "twitter:description", content: SITE_DESCRIPTION },
        { name: "twitter:image", content: SITE_IMAGE },
        { name: "twitter:image:alt", content: SITE_TITLE },
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
