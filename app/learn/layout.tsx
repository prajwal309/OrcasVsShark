import type { ReactNode } from "react";
import { sessionAccount } from "@/lib/auth/session";
import { readIfAvailable } from "@/lib/database/connection";
import { emptyProgress } from "@/lib/learn/progress";
import { loadProgress } from "@/lib/learn/store";
import { ProgressProvider } from "@/components/learn/progress-provider";

export default async function LearnLayout({
  children,
}: {
  children: ReactNode;
}) {
  const account = await sessionAccount({ allowUnavailable: true });
  const initial = account
    ? ((await readIfAvailable((db) => loadProgress(db, account.id))) ??
      emptyProgress)
    : emptyProgress;
  return (
    <ProgressProvider
      key={account?.id ?? "guest"}
      account={account?.id ?? null}
      initial={initial}
    >
      {children}
    </ProgressProvider>
  );
}
