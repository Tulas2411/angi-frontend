"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShareIcon } from "@heroicons/react/24/outline";
import { SiteNav, type SiteNavItem } from "./site-nav";

/** `/roadmaps/{id}`: the roadmap detail page, whose header trades the menu for its share action. */
export function roadmapDetailIdOf(path: string): number | null {
  const match = /^\/roadmaps\/(\d+)\/?$/.exec(path);
  return match ? Number(match[1]) : null;
}

/** The header menu, left out on the roadmap detail page (the account drawer still has it). */
export function HeaderNav({
  items,
  label,
}: {
  items: readonly SiteNavItem[];
  label: string;
}) {
  if (roadmapDetailIdOf(usePathname()) !== null) return null;
  return <SiteNav items={items} label={label} />;
}

/** "Chia sẻ lộ trình" in the header of the roadmap detail page: writes a guide from the roadmap. */
export function HeaderRoadmapShare() {
  const roadmapId = roadmapDetailIdOf(usePathname());
  if (roadmapId === null) return null;
  return (
    <Link
      className="button button-secondary header-share"
      href={`/guides/new?roadmap=${roadmapId}`}
      aria-label="Chia sẻ lộ trình"
    >
      <ShareIcon aria-hidden />
      <span aria-hidden>Chia sẻ lộ trình</span>
    </Link>
  );
}
