import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export function browserAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Online play is not configured. You can still play locally.",
    );
  client ??= createClient(url, key);
  return client;
}
let signingIn: Promise<string> | null = null;
export async function accessToken(): Promise<string> {
  // Deduplicate anonymous sign-in when effects and user actions overlap.
  if (!signingIn)
    signingIn = (async () => {
      const auth = browserAuth().auth;
      const { data, error } = await auth.getSession();
      if (error) throw new Error("Could not restore your player session.");
      if (data.session) return data.session.access_token;
      const signed = await auth.signInAnonymously();
      if (signed.error || !signed.data.session)
        throw new Error(
          "Could not sign in. Check that anonymous sign-in is enabled and try again.",
        );
      return signed.data.session.access_token;
    })().finally(() => {
      signingIn = null;
    });
  return signingIn;
}
