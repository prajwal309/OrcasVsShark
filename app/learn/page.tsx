import type { Metadata } from "next";
import { Academy } from "@/components/learn/academy";
import "./academy.css";

export const metadata: Metadata = {
  title: "Learn to Play",
  description:
    "Learn Baghchal with interactive lessons, tactical puzzles, and guided practice.",
};

export default async function Learn({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; activity?: string }>;
}) {
  const { section, activity } = await searchParams;
  return <Academy section={section} activity={activity} />;
}
