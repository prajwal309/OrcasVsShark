/** Original woodland scenery, with no effect on the board graph. */
export function ForestBackground() {
  return (
    <g aria-hidden="true" pointerEvents="none">
      <defs>
        <linearGradient id="forest-light" x2="1" y2="1">
          <stop stopColor="#536047" />
          <stop offset=".55" stopColor="#293f32" />
          <stop offset="1" stopColor="#182d28" />
        </linearGradient>
        <pattern
          id="forest-grain"
          width="72"
          height="72"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 18Q18 9 36 18T72 18M0 54Q18 45 36 54T72 54"
            fill="none"
            stroke="#c9b67c"
            strokeOpacity=".07"
          />
        </pattern>
        <clipPath id="forest-frame">
          <rect x="18" y="18" width="484" height="484" rx="20" />
        </clipPath>
      </defs>
      <g clipPath="url(#forest-frame)">
        <rect
          x="18"
          y="18"
          width="484"
          height="484"
          fill="url(#forest-light)"
        />
        <circle cx="405" cy="90" r="49" fill="#d6bf80" opacity=".16" />
        <path
          d="M18 207 118 107 194 178 276 82 370 176 427 127 502 207V502H18Z"
          fill="#a3ad81"
          opacity=".13"
        />
        <path
          d="M18 332Q142 229 260 318T502 288V502H18Z"
          fill="#0f251f"
          opacity=".48"
        />
        <rect
          x="18"
          y="18"
          width="484"
          height="484"
          fill="url(#forest-grain)"
        />
        <g stroke="#b8bf91" fill="none" opacity=".3" strokeWidth="1.5">
          <path d="M25 488Q68 426 37 357M37 452Q16 418 28 400M43 431Q76 417 77 390M42 402Q20 383 27 369M477 488Q452 428 486 362M469 445Q495 421 495 403M470 417Q445 398 451 381" />
        </g>
        <rect
          x="43"
          y="43"
          width="434"
          height="434"
          rx="4"
          fill="#1b3028"
          fillOpacity=".46"
        />
        <rect
          x="29"
          y="29"
          width="462"
          height="462"
          rx="12"
          fill="none"
          stroke="#d6bf80"
          strokeOpacity=".3"
        />
      </g>
    </g>
  );
}
