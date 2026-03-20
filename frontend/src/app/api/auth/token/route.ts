import { auth } from "@/auth";
import { SignJWT } from "jose";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json({ error: "AUTH_SECRET not configured" }, { status: 500 });
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

  return Response.json({ token });
}
