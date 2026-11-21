import { signupCodeRequired } from "@/lib/auth/accounts";
import { googleConfiguration } from "@/lib/auth/google";
import { OnlineLobby } from "@/components/lobby/online-lobby";
import { sqliteDisabled } from "@/lib/deployment";
import { roomCodeSchema } from "@/lib/multiplayer/protocol";

export default async function OnlinePage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; google?: string; account?: string }>;
}) {
  const params = await searchParams;
  const room = roomCodeSchema.safeParse(params.room);
  return (
    <OnlineLobby
      onlineUnavailable={sqliteDisabled()}
      key={params.account === "register" ? "register" : "login"}
      register={params.account === "register"}
      requireSignupCode={signupCodeRequired()}
      returnRoom={room.success ? room.data : undefined}
      googleEnabled={!!googleConfiguration()}
      googleError={params.google}
    />
  );
}
