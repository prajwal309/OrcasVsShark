import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SqlClient } from "@/lib/database/connection";
import { RoomError } from "@/lib/multiplayer/protocol";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 letters, digits, or underscores.");
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());
export const invitationSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const signupCodeRequired = () =>
  process.env.REQUIRE_SIGNUP_CODE === "true";

export function invalidInvitation() {
  return new RoomError(
    400,
    "INVALID_INVITE",
    "This code is invalid or expired.",
  );
}

export async function createAccount(
  db: SqlClient,
  username: string,
  email: string,
  invitationHash: string | undefined,
  credential: { passwordHash: string } | { googleSubject: string },
) {
  if (invitationHash) {
    const invitation = await db.query(
      `DELETE FROM account_invites WHERE token_hash = $1
     AND reset_account IS NULL AND expires_at > EXTRACT(EPOCH FROM clock_timestamp())`,
      [invitationHash],
    );
    if (!invitation.rowCount) throw invalidInvitation();
  }

  const id = randomUUID();
  const inserted = await db.query(
    `INSERT INTO accounts (id, username, email, password_hash, google_subject)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
    [
      id,
      username,
      email,
      "passwordHash" in credential ? credential.passwordHash : null,
      "googleSubject" in credential ? credential.googleSubject : null,
    ],
  );
  if (!inserted.rowCount) {
    const taken = await db.accounts.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!taken)
      throw new RoomError(
        409,
        "EMAIL_TAKEN",
        "Could not create an account with that email address.",
      );
    throw new RoomError(
      409,
      "USERNAME_TAKEN",
      "An account already uses that username. Sign in or choose a different username.",
    );
  }
  return id;
}

export async function registerGuestAccount(
  db: SqlClient,
  guestId: string,
  username: string,
  email: string,
  invitationHash: string | undefined,
  passwordHash: string,
) {
  if (invitationHash) {
    const invitation = await db.query(
      `DELETE FROM account_invites WHERE token_hash = $1
       AND reset_account IS NULL AND expires_at > EXTRACT(EPOCH FROM clock_timestamp())`,
      [invitationHash],
    );
    if (!invitation.rowCount) throw invalidInvitation();
  }
  const { rows } = await db.query<{
    username_taken: boolean;
    email_taken: boolean;
  }>(
    `SELECT
       EXISTS (SELECT 1 FROM accounts WHERE username = $2 AND id <> $1) AS username_taken,
       EXISTS (SELECT 1 FROM accounts WHERE email = $3 AND id <> $1) AS email_taken`,
    [guestId, username, email],
  );
  if (rows[0].username_taken)
    throw new RoomError(
      409,
      "USERNAME_TAKEN",
      "An account already uses that username. Sign in or choose a different username.",
    );
  if (rows[0].email_taken)
    throw new RoomError(
      409,
      "EMAIL_TAKEN",
      "Could not create an account with that email address.",
    );
  const updated = await db.query(
    `UPDATE accounts SET username = $2, email = $3, password_hash = $4,
       google_subject = NULL, is_guest = FALSE
     WHERE id = $1 AND is_guest = TRUE`,
    [guestId, username, email, passwordHash],
  );
  if (!updated.rowCount)
    throw new RoomError(
      409,
      "GUEST_SESSION_EXPIRED",
      "This guest session can no longer be upgraded. Please sign in.",
    );
  return guestId;
}

export async function googleAccount(
  db: SqlClient,
  subject: string,
  email: string,
  signup?: { username: string; invitationHash: string },
) {
  const {
    rows: [existing],
  } = await db.query<{ id: string }>(
    "SELECT id FROM accounts WHERE google_subject = $1",
    [subject],
  );
  if (existing) return existing.id;
  if (!signup)
    throw new RoomError(
      403,
      "GOOGLE_SIGNUP_REQUIRED",
      "Create an account with a signup code to use this Google account.",
    );
  return createAccount(db, signup.username, email, signup.invitationHash, {
    googleSubject: subject,
  });
}
