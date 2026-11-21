import { signupCodeRequired } from "@/lib/auth/accounts";
import { googleConfiguration } from "@/lib/auth/google";
import { OnlineLobby } from "@/components/lobby/online-lobby";

export default function Home() {
  return (
    <OnlineLobby
      googleEnabled={!!googleConfiguration()}
      requireSignupCode={signupCodeRequired()}
    />
  );
}
