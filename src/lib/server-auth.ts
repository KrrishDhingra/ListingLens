import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

// Accounts that never get charged and bypass all wallet checks.
// Hardcoded now that the product is live (previously the UNLIMITED_EMAILS env var).
export const ADMIN_EMAILS = ["krrishdhingra574@gmail.com"];

export interface AuthedUser {
  userId: string;
  userEmail: string | null;
  isAdmin: boolean;
}

/**
 * Verify the Firebase ID token sent as a Bearer token and return the caller.
 * Returns null if there's no valid token.
 */
export async function getUserFromRequest(
  req: NextRequest
): Promise<AuthedUser | null> {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userEmail = decoded.email?.toLowerCase() || null;
    return {
      userId: decoded.uid,
      userEmail,
      isAdmin: userEmail !== null && ADMIN_EMAILS.includes(userEmail),
    };
  } catch {
    return null;
  }
}
