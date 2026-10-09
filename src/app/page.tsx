import Link from "next/link";
import Brand from "@/components/brand";

export default function HomePage() {
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Brand />
        <Link
          href="/login"
          className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold"
        >
          Đăng nhập ↗
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pt-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
              Một hành trình · Nhiều hương vị
            </p>
            <h1 className="text-5xl font-bold leading-[1.12] tracking-tight md:text-6xl">
              Hôm nay,
              <br />
              mình <span className="text-orange-600">ăn gì?</span>
            </h1>
            <p className="mt-6 max-w-md leading-8 text-stone-600">
              Một nơi để bắt đầu hành trình khám phá món ngon, nhà hàng và những
              hương vị đặc trưng của Việt Nam.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex rounded-xl bg-orange-600 px-6 py-3.5 font-semibold text-white hover:bg-orange-700"
            >
              Bắt đầu với ANGI →
            </Link>
            <p className="mt-5 text-xs text-stone-500">
              Dự án ANGI đang được phát triển.
            </p>
          </div>
          <div className="rounded-[2rem] bg-[#e9eee2] p-8 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-900/60">
              Khám phá hương vị Việt
            </p>
            <div className="my-10 flex justify-center">
              <div className="flex h-48 w-48 items-center justify-center rounded-full border-[14px] border-white bg-[#f8e3c8] shadow-xl shadow-emerald-950/10">
                <span className="text-8xl" role="img" aria-label="Tô mì">
                  🍜
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-emerald-950">
              Món ngon. Câu chuyện mới.
            </h2>
            <p className="mt-3 text-sm leading-7 text-emerald-950/70">
              Từ một bữa ăn quen thuộc đến một chuyến đi đầy cảm hứng.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Hương vị địa phương",
                "Khẩu vị của bạn",
                "Hành trình ẩm thực",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-white/70 px-3 py-2 text-xs text-emerald-950"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-20 grid gap-6 border-t border-stone-200 pt-8 sm:grid-cols-3">
          {[
            ["01", "Khám phá", "Tìm cảm hứng cho bữa ăn tiếp theo."],
            ["02", "Kết nối", "Gặp những nhà hàng và người yêu ẩm thực."],
            ["03", "Trải nghiệm", "Để mỗi chuyến đi có thêm một hương vị."],
          ].map(([number, title, text]) => (
            <div key={number}>
              <span className="text-xs font-semibold text-orange-600">
                {number}
              </span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-stone-500">{text}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="border-t border-stone-200 px-6 py-5 text-center text-xs text-stone-500">
        ANGI — Ăn Gì · Hương vị của mỗi hành trình
      </footer>
    </div>
  );
}
