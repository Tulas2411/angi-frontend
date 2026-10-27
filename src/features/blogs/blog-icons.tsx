/** Outline icons of the blog screens: 16px, 1.5px stroke, grey like the text beside them. */
function Svg({
  children,
  fill = "none",
}: {
  children: React.ReactNode;
  fill?: string;
}) {
  return (
    <svg
      className="blog-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <Svg fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.7 3.6 4.5 6.9 4.5c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.3 0 5.2 3.2 4.1 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" />
    </Svg>
  );
}

export function CommentIcon() {
  return (
    <Svg>
      <path d="M4 5.5h16a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H10l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}

export function EyeIcon() {
  return (
    <Svg>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Svg>
  );
}
