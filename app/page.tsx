import { signupCodeRequired } from "@/lib/auth/accounts";
import { googleConfiguration } from "@/lib/auth/google";
import { OnlineLobby } from "@/components/lobby/online-lobby";

export default function Home() {
  return (
    <OnlineLobby
      isHome
      onlineUnavailable={!process.env.PRISMA_DATABASE_URL}
      googleEnabled={!!googleConfiguration()}
      requireSignupCode={signupCodeRequired()}
    />
  );
}
