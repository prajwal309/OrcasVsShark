import type { Metadata } from "next";
import Game from "@/components/game/game";

const title = "Play Tigers and Goats (Baghchal) Online";
const description =
  "Play Tigers and Goats, Nepal’s traditional Baghchal strategy game. Hunt with four tigers or surround them with twenty goats. Play with a friend or against the computer.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/tigers-and-goats" },
  openGraph: { title, description },
  twitter: { title, description },
};

export default function TigersAndGoatsPage() {
  return <Game initialTheme="tigers-goats" />;
}
