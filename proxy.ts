import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Rutas públicas (sin sesión). El resto exige autenticación.
 * En Next.js 16+ usar `proxy.ts` (Node) en lugar de `middleware.ts` (Edge deprecado)
 * evita fallos tipo MIDDLEWARE_INVOCATION_FAILED en Vercel.
 */
const isPublicRoute = createRouteMatcher(["/login(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublicRoute(req)) await auth.protect();
  },
  {
    // Misma ruta que `app/login/page.tsx`. Opcional si defines NEXT_PUBLIC_CLERK_SIGN_IN_URL en Vercel.
    signInUrl: "/login",
  },
);

export const config = {
  matcher: [
    // Omitir estáticos y `_next` (patrón recomendado Clerk + Next)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
