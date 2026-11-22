import { handlers } from "@/auth";

/**
 * Auth.js route handlers. Everything (sign-in, callback, session, csrf) is
 * served from this single catch-all route.
 */
export const { GET, POST } = handlers;
