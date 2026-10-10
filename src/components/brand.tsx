import Link from "next/link";
export default function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="ANGI — Trang chủ">
      <img src="/assets/figma/logo.png" width={28} height={34} alt="" />
      <span>ANGI</span>
    </Link>
  );
}
