import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    Credentials({
      id: "email-otp",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) return null;

        // Verify OTP code via backend
        const apiBase = process.env.INTERNAL_API_URL || "http://api:8000";
        const res = await fetch(`${apiBase}/api/v1/auth/verify-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            code: credentials.code,
          }),
        });

        if (!res.ok) return null;

        const user = await res.json();
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user, account, trigger, session }) {
      // On first sign-in, persist stable user ID
      if (account && user) {
        if (account.provider === "google") {
          token.sub = account.providerAccountId;
        } else {
          // Email OTP: user.id is "email:user@example.com"
          token.sub = user.id;
        }
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      // Handle client-side `session.update({ name: '...' })` calls so a
      // user who edits their display_name in /account sees the new name
      // in the header and other `useSession()` consumers without having
      // to sign out and back in. Backend is still authoritative — the
      // update only rewrites the cached JWT claim.
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as { name?: string };
        if (typeof s.name === "string" && s.name.trim()) {
          token.name = s.name.trim();
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      // Mirror the jwt-stored name into the session so client consumers
      // (AppHeader, account menus) see the updated value after a
      // session.update() call.
      if (session.user && typeof token.name === "string") {
        session.user.name = token.name;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
});
