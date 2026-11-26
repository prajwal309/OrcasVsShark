import { signupCodeRequired } from "@/lib/auth/accounts";
import { googleConfiguration } from "@/lib/auth/google";
import { pageSessionAccount } from "@/lib/auth/session";
import { PlayerDashboard } from "@/components/lobby/player-dashboard";
import { OnlineLobby } from "@/components/lobby/online-lobby";

export default async function Home() {
  const account = await pageSessionAccount();
  return (
    <OnlineLobby
      isHome
      playerDashboard={
        account && !account.is_guest ? (
          <PlayerDashboard username={account.username} />
        ) : null
      }
      onlineUnavailable={!process.env.PRISMA_DATABASE_URL}
      googleEnabled={!!googleConfiguration()}
      requireSignupCode={signupCodeRequired()}
    />
  );
}
