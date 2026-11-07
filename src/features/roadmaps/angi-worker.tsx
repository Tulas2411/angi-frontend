/**
 * ANGI at work: a small chef robot tossing a dish in a pan, drawn inline so it follows the theme
 * colours. Its motion (bob, blink, the hop of the dish, twinkles) lives in roadmap-generate.css and
 * stops under prefers-reduced-motion. Decorative: the text next to it says what is happening.
 */
export function AngiWorker({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`angi-worker ${className}`.trim()}
      viewBox="0 0 120 120"
      aria-hidden
      focusable="false"
    >
      <circle className="angi-worker-halo" cx="60" cy="62" r="54" />
      <g className="angi-worker-sparkles">
        <path d="M18 34l2.5 5.5L26 42l-5.5 2.5L18 50l-2.5-5.5L10 42l5.5-2.5z" />
        <path d="M100 22l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" />
        <path d="M104 74l1.6 3.4 3.4 1.6-3.4 1.6-1.6 3.4-1.6-3.4-3.4-1.6 3.4-1.6z" />
      </g>
      <g className="angi-worker-body">
        {/* Chef hat */}
        <path
          className="angi-worker-hat"
          d="M40 34c-6 0-10-5-9-10.5 1-5 6-8 11-6.5C44 12 50 8 57 8s13 4 15 9c5-1.5 10 1.5 11 6.5C84 29 80 34 74 34z"
        />
        <rect
          className="angi-worker-hat"
          x="40"
          y="32"
          width="34"
          height="8"
          rx="2"
        />
        {/* Head with a screen face */}
        <rect
          className="angi-worker-head"
          x="30"
          y="40"
          width="54"
          height="42"
          rx="14"
        />
        <rect
          className="angi-worker-screen"
          x="37"
          y="47"
          width="40"
          height="28"
          rx="9"
        />
        <g className="angi-worker-eyes">
          <rect x="46" y="55" width="6" height="10" rx="3" />
          <rect x="62" y="55" width="6" height="10" rx="3" />
        </g>
        <path className="angi-worker-smile" d="M52 69q5 4 10 0" />
        {/* Antenna */}
        <line className="angi-worker-antenna" x1="84" y1="50" x2="92" y2="44" />
        <circle className="angi-worker-led" cx="93" cy="43" r="3.5" />
        {/* Arm and pan */}
        <path className="angi-worker-arm" d="M84 70q8 2 12 8" />
        <g className="angi-worker-pan">
          <ellipse cx="88" cy="90" rx="17" ry="5.5" />
          <rect x="102" y="87" width="14" height="5" rx="2.5" />
        </g>
        <circle className="angi-worker-dish" cx="86" cy="80" r="5" />
        {/* Torso */}
        <rect
          className="angi-worker-head"
          x="40"
          y="84"
          width="34"
          height="20"
          rx="8"
        />
        <rect
          className="angi-worker-apron"
          x="48"
          y="88"
          width="18"
          height="14"
          rx="4"
        />
      </g>
    </svg>
  );
}

/**
 * ANGI peeking in from the right edge of the screen (background generation): only its hat and
 * head, eyes looking into the page, the antenna on the inner side. Decorative, like AngiWorker.
 */
export function AngiPeek({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`angi-peek ${className}`.trim()}
      viewBox="0 0 90 100"
      aria-hidden
      focusable="false"
    >
      <path
        className="angi-worker-hat"
        d="M22 31c-6 0-10-5-9-10.5 1-5 6-8 11-6.5C26 9 33 4 43 4s17 5 19 10c5-1.5 10 1.5 11 6.5C74 26 70 31 64 31z"
      />
      <rect
        className="angi-worker-hat"
        x="22"
        y="29"
        width="44"
        height="8"
        rx="2"
      />
      <line className="angi-worker-antenna" x1="16" y1="46" x2="5" y2="36" />
      <circle className="angi-worker-led" cx="4" cy="35" r="4" />
      <rect
        className="angi-worker-head"
        x="10"
        y="36"
        width="70"
        height="56"
        rx="18"
      />
      <rect
        className="angi-worker-screen"
        x="18"
        y="45"
        width="54"
        height="38"
        rx="12"
      />
      <g className="angi-worker-eyes">
        <rect x="26" y="55" width="8" height="13" rx="4" />
        <rect x="44" y="55" width="8" height="13" rx="4" />
      </g>
      <path className="angi-worker-smile" d="M31 74q7 5 14 0" />
    </svg>
  );
}
