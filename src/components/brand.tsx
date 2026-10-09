import Link from "next/link";
export default function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-3"
      aria-label="ANGI — Trang chủ"
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-xl text-white"
        aria-hidden
      >
        ✦
      </span>
      <span className="text-2xl font-extrabold tracking-tight">
        ANGI<span className="text-orange-600">.</span>
      </span>
    </Link>
  );
}
