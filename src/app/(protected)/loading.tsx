export default function Loading() {
  return (
    <div role="status" className="animate-pulse space-y-6">
      <span className="sr-only">Đang tải trang...</span>
      <div className="h-8 w-64 rounded-lg bg-stone-200" />
      <div className="h-56 rounded-2xl bg-stone-200/60" />
    </div>
  );
}
