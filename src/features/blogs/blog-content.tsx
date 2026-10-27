"use client";
import { createElement, useMemo, type ReactNode } from "react";

/** Tags that keep their meaning; everything else is unwrapped to its children. */
const blockTags = new Set([
  "p",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "hr",
  "br",
]);
const inlineTags = new Set(["strong", "b", "em", "i", "u", "s", "code"]);
/** Never rendered, children included. */
const dropped = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "svg",
  "math",
  "link",
  "meta",
  "base",
  "template",
  "noscript",
]);
const headings: Record<string, string> = {
  h1: "h2",
  h2: "h2",
  h3: "h3",
  h4: "h3",
  h5: "h3",
  h6: "h3",
};

/** Only web and mail links: no `javascript:` and no `data:`. */
export function safeUrl(value: string | null, schemes: string[]) {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), "https://angi.invalid");
    const scheme = url.protocol.replace(":", "");
    return schemes.includes(scheme) ? value.trim() : null;
  } catch {
    return null;
  }
}

function convert(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (dropped.has(tag)) return null;
  const children = Array.from(element.childNodes).map((child, index) =>
    convert(child, `${key}.${index}`),
  );
  if (tag === "br" || tag === "hr") return createElement(tag, { key });
  if (blockTags.has(tag) || inlineTags.has(tag))
    return createElement(tag, { key }, ...children);
  if (headings[tag]) return createElement(headings[tag], { key }, ...children);
  if (tag === "a") {
    const href = safeUrl(element.getAttribute("href"), [
      "http",
      "https",
      "mailto",
    ]);
    return href
      ? createElement(
          "a",
          { key, href, target: "_blank", rel: "noopener noreferrer nofollow" },
          ...children,
        )
      : createElement("span", { key }, ...children);
  }
  if (tag === "img") {
    const src = safeUrl(element.getAttribute("src"), ["http", "https"]);
    return src
      ? createElement("img", {
          key,
          src,
          alt: element.getAttribute("alt") ?? "",
          loading: "lazy",
        })
      : null;
  }
  return createElement("span", { key }, ...children);
}

/**
 * The backend sanitizes a blog's HTML before saving it; this renders that HTML as React elements
 * anyway, from a small allow-list, so no markup from the network ever reaches `innerHTML`.
 */
export function BlogContent({ html }: { html: string }) {
  const content = useMemo(() => {
    const document = new DOMParser().parseFromString(html, "text/html");
    return Array.from(document.body.childNodes).map((node, index) =>
      convert(node, String(index)),
    );
  }, [html]);
  return <div className="blog-content">{content}</div>;
}
