/** Original, stylized coastal illustration; decorative rather than navigational. */
export function CapeCodBackground() {
  return (
    <g aria-hidden="true" pointerEvents="none" className="cape-cod-background">
      <defs>
        <linearGradient id="cape-water" x2=".8" y2="1">
          <stop stopColor="#346b80" />
          <stop offset=".5" stopColor="#174759" />
          <stop offset="1" stopColor="#0b2b40" />
        </linearGradient>
        <linearGradient id="cape-land" x2=".5" y2="1">
          <stop stopColor="#c9c6a0" />
          <stop offset="1" stopColor="#789e8e" />
        </linearGradient>
        <pattern
          id="cape-waves"
          width="96"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M-24 24 Q0 13 24 24 T72 24 T120 24"
            fill="none"
            stroke="#a3d2d6"
            strokeOpacity=".13"
          />
          <path
            d="M0 43 Q24 35 48 43 T96 43"
            fill="none"
            stroke="#a3d2d6"
            strokeOpacity=".06"
          />
        </pattern>
        <clipPath id="cape-frame">
          <rect x="18" y="18" width="484" height="484" rx="20" />
        </clipPath>
      </defs>
      <g clipPath="url(#cape-frame)">
        <rect x="18" y="18" width="484" height="484" fill="url(#cape-water)" />
        <rect x="18" y="18" width="484" height="484" fill="url(#cape-waves)" />
        {/* Mainland, Cape Cod Bay, and the Cape's curved outer arm. */}
        <path
          d="M18 18H151L157 50 145 76 162 98 157 123 175 148 171 170 188 193 190 224 210 248 213 278 235 310 269 333 312 337 353 329 383 310 401 281 412 248 416 215 411 187 398 167 383 162 375 168 379 178 390 180 397 193 399 216 392 249 380 277 362 292 336 302 304 305 279 298 257 286 242 271 225 264 216 282 221 306 236 327 255 344 278 354 310 359 347 353 376 340 399 318 414 288 428 249 435 211 431 182 419 160 402 149 385 148 371 156 366 170 373 184 383 186 380 174 387 169 398 173 408 191 410 214 402 245 390 271 374 292 348 310 315 319 282 315 256 299 238 274 230 245 211 216 208 188 193 166 190 139 174 115 180 91 164 68 174 42 169 18Z"
          fill="url(#cape-land)"
          stroke="#e2d5ac"
          strokeWidth="2"
          strokeLinejoin="round"
          opacity=".8"
        />
        {/* Martha's Vineyard and Nantucket, interpreted as simple sand forms. */}
        <path
          d="M240 383 Q264 372 285 380L306 396 283 402 253 398 235 391Z"
          fill="#b7bb99"
          stroke="#e2d5ac"
          strokeWidth="1.5"
          opacity=".7"
        />
        <path
          d="M350 411 Q368 398 387 403L404 415 389 424 364 422 348 417Z"
          fill="#b7bb99"
          stroke="#e2d5ac"
          strokeWidth="1.5"
          opacity=".7"
        />
        <g fill="none" stroke="#c5e6df" strokeWidth="1" opacity=".2">
          <path d="M447 160Q482 240 430 325T313 381" />
          <path d="M459 147Q499 240 446 336T318 394" />
          <path d="M261 226Q296 201 349 220" />
          <path d="M255 210Q300 181 357 207" />
          <path d="M62 365Q111 340 164 359T224 363" />
          <path d="M54 379Q111 355 164 374T215 380" />
        </g>
        <g className="coastal-lettering" fill="#d8e9df" textAnchor="middle">
          <text x="287" y="153" fontSize="10" letterSpacing="3">
            CAPE COD BAY
          </text>
          <text x="393" y="455" fontSize="9" letterSpacing="3">
            ATLANTIC
          </text>
          <text x="393" y="470" fontSize="8" letterSpacing="4">
            OCEAN
          </text>
        </g>
        <g
          transform="translate(70 425)"
          stroke="#d8e9df"
          fill="none"
          opacity=".5"
        >
          <circle r="19" strokeWidth=".6" />
          <path d="M0-26V26M-26 0H26" strokeWidth=".6" />
          <path d="M0-18 4 0 0 18-4 0Z" strokeWidth=".8" />
          <text
            y="-31"
            textAnchor="middle"
            fill="#d8e9df"
            stroke="none"
            fontSize="9"
          >
            N
          </text>
        </g>
        {/* A quiet glazing layer separates the illustration from game markings. */}
        <rect
          x="43"
          y="43"
          width="434"
          height="434"
          rx="4"
          className="coastal-board-glaze"
        />
      </g>
    </g>
  );
}
