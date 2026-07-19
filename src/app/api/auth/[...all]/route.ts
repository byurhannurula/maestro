import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// better-auth owns everything under /api/auth/* (sign-in, callbacks, session).
// Distinct namespace from the app's own /api/* routes — no collision.
export const { GET, POST } = toNextJsHandler(auth);
