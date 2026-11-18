import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SqlClient } from "@/lib/database/connection";
import { RoomError } from "@/lib/multiplayer/protocol";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/);
export const invitationSchema = z.string().regex(/^[a-f0-9]{64}$/);

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
  invitationHash: string,
  credential: { passwordHash: string } | { googleSubject: string },
) {
  const invitation = await db.query(
    `DELETE FROM account_invites WHERE token_hash = $1
     AND reset_account IS NULL AND expires_at > now()`,
    [invitationHash],
  );
  if (!invitation.rowCount) throw invalidInvitation();

  const id = randomUUID();
  const inserted = await db.query(
    `INSERT INTO accounts (id, username, password_hash, google_subject)
     VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
    [
      id,
      username,
      "passwordHash" in credential ? credential.passwordHash : null,
      "googleSubject" in credential ? credential.googleSubject : null,
    ],
  );
  if (!inserted.rowCount)
    throw new RoomError(
      409,
      "USERNAME_TAKEN",
      "An account already uses that username. Sign in or choose a different username.",
    );
  return id;
}

export async function googleAccount(
  db: SqlClient,
  subject: string,
  signup?: { username: string; invitationHash: string },
) {
  await db.query("SELECT pg_advisory_xact_lock(825015, hashtext($1))", [
    subject,
  ]);
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
  return createAccount(db, signup.username, signup.invitationHash, {
    googleSubject: subject,
  });
}
