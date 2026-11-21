import { signupCodeRequired } from "@/lib/auth/accounts";
import { googleConfiguration } from "@/lib/auth/google";
import { OnlineLobby } from "@/components/lobby/online-lobby";
import { sqliteDisabled } from "@/lib/deployment";

export default function Home() {
  return (
    <OnlineLobby
      onlineUnavailable={sqliteDisabled()}
      googleEnabled={!!googleConfiguration()}
      requireSignupCode={signupCodeRequired()}
    />
  );
}
