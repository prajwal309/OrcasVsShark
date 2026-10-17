import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VictoryBanner } from "@/components/game/victory-banner";

afterEach(cleanup);
it("names the themed winner and provides replay and board review without losing the result", () => {
  const replay = vi.fn();
  render(
    <VictoryBanner
      winner="orcas"
      theme="tigers-goats"
      actionLabel="Play again"
      disabled={false}
      onPlay={replay}
    />,
  );
  expect(screen.getByRole("heading", { name: "Tigers win!" })).toBeVisible();
  const review = screen.getByRole("button", { name: "View board" });
  fireEvent.click(review);
  expect(screen.getByRole("region", { name: "Tigers win!" })).toHaveClass(
    "is-compact",
  );
  expect(
    screen.getByRole("button", { name: "Show celebration" }),
  ).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByRole("button", { name: "Show celebration" }));
  expect(screen.getByRole("region", { name: "Tigers win!" })).not.toHaveClass(
    "is-compact",
  );
  fireEvent.click(screen.getByRole("button", { name: "Play again" }));
  expect(replay).toHaveBeenCalledOnce();
});
it("supports either marine side and disables pending online rematches", () => {
  const replay = vi.fn();
  const props = {
    winner: "sharks" as const,
    theme: "ocean" as const,
    actionLabel: "Rematch",
    disabled: true,
    onPlay: replay,
    note: "Waiting for your opponent.",
  };
  const { rerender } = render(<VictoryBanner {...props} />);
  expect(screen.getByRole("heading", { name: "Sharks win!" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Rematch" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Rematch" }));
  expect(replay).not.toHaveBeenCalled();
  rerender(
    <VictoryBanner
      {...props}
      winner="orcas"
      disabled={false}
      actionLabel="Accept rematch"
    />,
  );
  expect(screen.getByRole("heading", { name: "Orcas win!" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Accept rematch" }));
  expect(replay).toHaveBeenCalledOnce();
});
