export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    // Protect /account routes — require sign-in
    '/account(.*)',
  ],
};
