import { NextResponse } from "next/server";

/**
 * Heet in Next.js 16 `proxy` in plaats van `middleware`; zelfde functionaliteit.
 *
 * Laat nu alles door. Zodra SSO er is komt hier de guard: geen sessie-cookie op
 * een route binnen `(app)` betekent doorsturen naar de loginpagina. De pagina's
 * staan al in die routegroep, dus er hoeft dan niets verplaatst te worden.
 */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
