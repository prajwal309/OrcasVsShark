import { useId } from "react";

const shoreline =
  "M18 18H150C154 48 142 58 151 81C159 103 175 105 168 126C160 150 180 154 185 178C189 206 204 214 212 236C216 246 220 249 225 251L221 257C222 265 228 267 234 272C245 280 251 274 257 279C267 288 280 283 291 287C326 289 348 281 364 262C383 240 390 208 382 185C378 173 368 167 357 172C347 177 343 169 348 162C353 154 361 150 369 151L376 154L382 155C407 164 417 189 414 217C410 248 398 276 375 299C356 318 324 329 292 330C278 330 270 332 262 335L254 333L249 337L241 335C229 332 222 325 218 321L211 324L205 318L201 320C185 325 171 318 162 309L155 314L151 301C137 288 109 294 98 277C86 259 88 250 80 245L75 248L73 242L62 237C43 229 33 214 18 214Z";
const islands =
  "M195 367C206 360 216 361 221 355L230 356L237 352L251 355L256 353L265 358L272 365L283 369L270 374L262 373L255 382C240 389 225 384 215 376L206 377ZM329 390L338 386L347 385L355 379C366 377 376 381 384 388L391 390L393 395L402 401C391 405 374 409 361 404L349 403L343 397ZM176 348L185 343L191 345L185 349L178 351ZM188 341L196 337L204 338L199 342ZM166 354L173 352L175 354L169 357Z";

export function CapeCodBackground() {
  const id = useId();
  return (
    <g aria-hidden="true" pointerEvents="none">
      <defs>
        <clipPath id={`${id}-frame`}>
          <rect x="18" y="18" width="484" height="484" rx="20" />
        </clipPath>
        <radialGradient id={`${id}-water`} cx="27%" cy="22%" r="86%">
          <stop stopColor="#306064" />
          <stop offset=".58" stopColor="#153d49" />
          <stop offset="1" stopColor="#0a2332" />
        </radialGradient>
        <linearGradient id={`${id}-land`} x2="65%" y2="95%">
          <stop stopColor="#72867a" />
          <stop offset="1" stopColor="#335b59" />
        </linearGradient>
        <pattern
          id={`${id}-hatching`}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-32)"
        >
          <path d="M0 0V5" stroke="#e2dcc0" strokeWidth=".45" opacity=".24" />
        </pattern>
        <radialGradient id={`${id}-wash`}>
          <stop stopColor="#092431" stopOpacity=".64" />
          <stop offset="1" stopColor="#092431" stopOpacity=".12" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id}-frame)`}>
        <rect
          x="18"
          y="18"
          width="484"
          height="484"
          fill={`url(#${id}-water)`}
        />
        <g fill="none" stroke="#9bbfb5" strokeWidth=".8" opacity=".27">
          <path d="M510 134C465 150 459 181 463 224C470 291 431 327 396 350C352 380 340 412 383 435C431 459 487 437 521 455" />
          <path d="M506 112C451 130 442 173 446 219C453 280 414 318 379 342C331 374 317 412 361 441C408 472 467 453 518 477" />
          <path d="M503 91C434 110 425 166 429 217C434 271 401 309 361 336C309 370 293 416 342 452C393 489 458 468 513 497" />
          <path d="M173 37C179 61 168 63 177 86C187 106 200 116 196 140C193 162 211 179 214 199C222 237 242 257 275 259C304 261 330 254 344 236C358 218 364 196 353 188" />
          <path d="M195 44C197 68 193 76 205 93C218 111 222 128 220 146C219 168 234 179 237 199C247 229 265 244 290 242C313 240 338 224 338 203" />
          <path d="M18 276C76 260 84 316 127 328C176 341 174 364 158 391C145 418 92 451 18 434" />
          <path d="M18 296C64 286 79 327 117 341C151 355 153 373 139 391C118 419 75 436 18 420" />
          <path d="M18 318C54 304 68 338 105 354C133 367 134 379 120 391C96 409 51 422 18 405" />
        </g>
        <g fill="none" stroke="#71aba8" strokeLinejoin="round">
          <path d={shoreline} strokeWidth="16" opacity=".12" />
          <path d={islands} strokeWidth="12" opacity=".14" />
          <path d={shoreline} strokeWidth="8" opacity=".14" />
          <path d={islands} strokeWidth="6" opacity=".14" />
        </g>
        <g
          fill={`url(#${id}-land)`}
          stroke="#b4ba9c"
          strokeWidth="1.25"
          strokeLinejoin="round"
        >
          <path d={shoreline} />
          <path d={islands} />
        </g>
        <path d={shoreline} fill={`url(#${id}-hatching)`} />
        <path d={islands} fill={`url(#${id}-hatching)`} />
        <rect
          x="18"
          y="18"
          width="484"
          height="484"
          fill={`url(#${id}-wash)`}
        />
        <g fill="none" stroke="#c7c4a3" strokeWidth=".8" opacity=".58">
          <rect x="31" y="31" width="458" height="458" rx="12" />
          <path
            d="M31 50V43Q31 31 43 31H50M470 31H477Q489 31 489 43V50M489 470V477Q489 489 477 489H470M50 489H43Q31 489 31 477V470"
            strokeWidth="1.8"
          />
          <path d="M60 31v5m100-5v5m100-5v5m100-5v5m100-5v5M60 489v-5m100 5v-5m100 5v-5m100 5v-5m100 5v-5M31 60h5m-5 100h5m-5 100h5m-5 100h5m-5 100h5M489 60h-5m5 100h-5m5 100h-5m5 100h-5m5 100h-5" />
        </g>
      </g>
    </g>
  );
}

export function CapeCodCompass() {
  return (
    <svg
      className="cape-compass"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="32"
        cy="32"
        r="18"
        fill="#0c2833"
        stroke="#c2b28e"
        strokeWidth=".75"
      />
      <circle
        cx="32"
        cy="32"
        r="15"
        fill="none"
        stroke="#c2b28e"
        strokeWidth=".6"
        strokeDasharray="1 2"
        opacity=".7"
      />
      <path d="m23 23 9 5 9-5-5 9 5 9-9-5-9 5 5-9Z" fill="#5a8582" />
      <path
        d="m32 11 3.5 17.5L50 32l-14.5 3.5L32 50l-3.5-14.5L14 32l14.5-3.5Z"
        fill="#decaa2"
      />
      <path
        d="M32 11v21l3.5-3.5ZM50 32H32l3.5 3.5ZM32 50V32l-3.5 3.5ZM14 32h18l-3.5-3.5Z"
        fill="#806a4f"
      />
      <circle
        cx="32"
        cy="32"
        r="2"
        fill="#f3e6cd"
        stroke="#806a4f"
        strokeWidth=".6"
      />
      <g
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fill="#deceb0"
        fontSize="8"
      >
        <text x="32" y="8" fontSize="9" fontWeight="bold">
          N
        </text>
        <text x="57" y="35">
          E
        </text>
        <text x="32" y="60">
          S
        </text>
        <text x="6" y="35">
          W
        </text>
      </g>
    </svg>
  );
}
