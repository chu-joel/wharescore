import { auth } from "@/auth";
import { SignJWT } from "jose";

// The browser extension needs to mint short-lived JWTs from chrome-extension://<id>
// origins. Next.js Route Handlers don't apply any CORS middleware, so we set the
// headers manually. We only echo back Origin values that look like a Chrome
// extension id. everything else is handled by the browser's same-origin rules.
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-z]{32}$/;

function buildCorsHeaders(originHeader: string | null): Record<string, string> {
  if (!originHeader) return {};
  if (!EXTENSION_ORIGIN.test(originHeader)) return {};
  return {
    "Access-Control-Allow-Origin": originHeader,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders },
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json(
      { error: "AUTH_SECRET not configured" },
      { status: 500, headers: corsHeaders },
    );
  }

  const token = await new SignJWT({
    sub: session.user.id,
    email: session.user.email,
    name: session.user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));

  return Response.json({ token }, { headers: corsHeaders });
}
