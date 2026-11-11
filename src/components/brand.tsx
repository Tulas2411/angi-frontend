import Link from "next/link";

/**
 * The ANGI wordmark (roof, bowl and leaf drawn into the letters), a transparent WebP cut from the
 * owner's artwork (public/assets/brand/angi-logo.webp, 800 × 219). The picture is the name, so the
 * link carries it for screen readers and the image itself is decorative.
 */
export default function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="ANGI — Trang chủ">
      <img
        src="/assets/brand/angi-logo.webp"
        width={800}
        height={219}
        alt=""
        decoding="async"
      />
    </Link>
  );
}
