import { useId } from "react";

export function SandBackground() {
  const id = useId();
  return (
    <g className="sand-background" aria-hidden="true" pointerEvents="none">
      <defs>
        <clipPath id={`${id}-frame`}>
          <rect x="18" y="18" width="484" height="484" rx="20" />
        </clipPath>
        <linearGradient id={`${id}-sand`} x2="85%" y2="100%">
          <stop stopColor="#ab8254" />
          <stop offset=".55" stopColor="#8d643e" />
          <stop offset="1" stopColor="#6b492d" />
        </linearGradient>
        <pattern
          id={`${id}-grain`}
          width="19"
          height="17"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M3 4h1m8 2h.6M7 13h1m7-3h.5m2 6h1"
            stroke="#f8db9e"
            strokeWidth="1"
            opacity=".25"
          />
          <path
            d="M0 11h1m7-9h.6m7 2h1"
            stroke="#3d281e"
            strokeWidth="1"
            opacity=".32"
          />
        </pattern>
      </defs>
      <g clipPath={`url(#${id}-frame)`}>
        <rect
          x="18"
          y="18"
          width="484"
          height="484"
          fill={`url(#${id}-sand)`}
        />
        <path
          d="M-20 126C90 31 167 120 268 100S415 28 539 59V-5H-20Z"
          fill="#eec688"
          opacity=".2"
        />
        <path
          d="M-20 420C100 305 190 436 312 361C383 317 447 312 540 333V529H-20Z"
          fill="#624129"
          opacity=".34"
        />
        <path
          d="M-20 458C91 350 184 473 309 401S469 366 540 376V529H-20Z"
          fill="#e4af6e"
          opacity=".16"
        />
        <path
          d="M-20 175C106 80 177 164 280 142S451 76 543 103M-20 198C106 104 176 186 285 165S444 100 543 127M-20 480C94 375 189 493 316 422S459 391 540 397"
          fill="none"
          stroke="#f6d294"
          strokeWidth="1.4"
          opacity=".27"
        />
        <rect
          x="18"
          y="18"
          width="484"
          height="484"
          fill={`url(#${id}-grain)`}
        />
        <rect
          x="30"
          y="30"
          width="460"
          height="460"
          rx="12"
          fill="none"
          stroke="#ffdead"
          strokeOpacity=".42"
        />
      </g>
    </g>
  );
}
