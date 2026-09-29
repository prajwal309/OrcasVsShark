export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const values = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.DATABASE_URL,
  ];
  if (!values.some(Boolean)) return; // The local game can run without a backend.
  if (!values.every(Boolean))
    throw new Error(
      "Online play requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and DATABASE_URL together.",
    );
  try {
    const auth = new URL(values[0]!);
    const database = new URL(values[2]!);
    if (!(
      auth.protocol === "https:" ||
      (auth.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(auth.hostname))
    ))
      throw new Error();
    if (!["postgres:", "postgresql:"].includes(database.protocol))
      throw new Error();
  } catch {
    // Do not include the URLs in errors: the database URI contains a password.
    throw new Error("Invalid online service URL configuration.");
  }
}
