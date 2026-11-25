import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";

export function Rules({
  online = false,
  computer = false,
  theme = "ocean",
}: {
  online?: boolean;
  computer?: boolean;
  theme?: BoardTheme;
}) {
  const labels = themeLabels(theme);
  return (
    <div className="rules-copy">
      <p>Four hunters. Twenty defenders. One {labels.landscape}.</p>
      <h3>{labels.sides.sharks} surround</h3>
      <p>
        {labels.sides.sharks} play first. Place one {labels.defender} on any
        empty intersection each turn. Once all 20 have been introduced, move one{" "}
        {labels.defender} along a line to an adjacent empty point. Trap all four{" "}
        {labels.sides.orcas} to win.
      </p>
      <h3>{labels.sides.orcas} capture</h3>
      <p>
        Move one {labels.hunter} to an adjacent empty point, or jump over one{" "}
        {labels.defender} onto the empty point immediately beyond it. Follow a
        straight, connected line. Capture five {labels.sides.sharks} to win.
      </p>
      <h3>A few things to remember</h3>
      <p>
        Captures are optional. No chained jumps. {labels.sides.orcas} can move
        and capture during placement. Captured {labels.sides.sharks} still count
        toward the 20 introduced.
      </p>
      <h3>Play your way</h3>
      <p>
        {online
          ? "Each player controls their own side. "
          : computer
            ? "Play your chosen side against the computer. "
            : "Share this device with a friend. "}
        Tap or click to play. With a keyboard, Tab to the board, use arrow keys
        to navigate, and Enter or Space to select or move.{" "}
        {online
          ? "Online moves cannot be undone. "
          : computer
            ? "Undo takes back your last move and the computer’s reply. "
            : "Undo is available to both players. "}
        {computer
          ? "Draw offers are unavailable against the computer. "
          : "Draws require both players’ agreement. "}
        There is no automatic repetition draw.
      </p>
      <p className="heritage">
        An original digital adaptation of Baghchal, the traditional asymmetric
        strategy game of Nepal.
      </p>
    </div>
  );
}
