import { signupCodeRequired } from "@/lib/auth/accounts";
import { googleConfiguration } from "@/lib/auth/google";
import { pageSessionAccount } from "@/lib/auth/session";
import { PlayerDashboard } from "@/components/lobby/player-dashboard";
import { OnlineLobby } from "@/components/lobby/online-lobby";
import { roomCodeSchema } from "@/lib/multiplayer/protocol";

export const metadata = { title: "Online Play and Accounts" };

export default async function OnlinePage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; google?: string; account?: string }>;
}) {
  const params = await searchParams;
  const account = await pageSessionAccount();
  const room = roomCodeSchema.safeParse(params.room);
  return (
    <OnlineLobby
      playerDashboard={
        account && !account.is_guest ? (
          <PlayerDashboard username={account.username} />
        ) : null
      }
      onlineUnavailable={!process.env.PRISMA_DATABASE_URL}
      key={params.account === "register" ? "register" : "login"}
      register={params.account === "register"}
      requireSignupCode={signupCodeRequired()}
      returnRoom={room.success ? room.data : undefined}
      googleEnabled={!!googleConfiguration()}
      googleError={params.google}
    />
  );
}
