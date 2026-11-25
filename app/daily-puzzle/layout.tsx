import type { ReactNode } from "react";
import { pageSessionAccount } from "@/lib/auth/session";
import { readIfAvailable } from "@/lib/database/connection";
import { emptyProgress } from "@/lib/learn/progress";
import { loadProgress } from "@/lib/learn/store";
import { ProgressProvider } from "@/components/learn/progress-provider";

export default async function DailyPuzzleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const account = await pageSessionAccount();
  const player = account && !account.is_guest ? account.id : null;
  const initial = player
    ? ((await readIfAvailable((db) => loadProgress(db, player))) ??
      emptyProgress)
    : emptyProgress;
  return (
    <ProgressProvider
      key={player ?? "guest"}
      account={player}
      username={player ? account?.username : undefined}
      initial={initial}
    >
      {children}
    </ProgressProvider>
  );
}
