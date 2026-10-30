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

/** Three dots in a row: the menu of a card. */
export function DotsHorizontalIcon() {
  return (
    <Svg fill="currentColor">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </Svg>
  );
}

/** A pencil: edit a blog. */
export function PencilIcon() {
  return (
    <Svg>
      <path d="M4.5 19.5h3.6L18.4 9.2a2.1 2.1 0 0 0 0-3l-1.1-1.1a2.1 2.1 0 0 0-3 0L4.5 15.9v3.6Z" />
      <path d="M13.6 6.4l4 4" />
    </Svg>
  );
}

/** A bin: delete a blog. */
export function TrashIcon() {
  return (
    <Svg>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v1.5" />
      <path d="M6.8 6.5 7.6 19a1.6 1.6 0 0 0 1.6 1.5h5.6a1.6 1.6 0 0 0 1.6-1.5l.8-12.5" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </Svg>
  );
}
