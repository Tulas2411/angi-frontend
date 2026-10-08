import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="text-sm font-semibold text-orange-600">404</p>
      <h1 className="mt-4 text-3xl font-bold">Trang này chưa có</h1>
      <p className="mt-4 text-sm text-stone-500">
        Bạn có thể quay về trang chủ để tiếp tục.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white"
      >
        Về trang chủ
      </Link>
    </main>
  );
}
