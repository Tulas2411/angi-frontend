"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  ConfirmDialog,
  EmptyState,
  Field,
  Media,
  Pagination,
  Tabs,
  TextArea,
  UploadField,
  type UploadedFile,
} from "@/components/ui/primitives";
import { BlogCard } from "@/components/domain/cards";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import {
  dateLabel,
  money,
  pageSlice,
  snapshotTrip,
} from "@/features/platform/rules";
import type { Trip } from "@/features/platform/contracts";

export function BlogList({ mine = false }: { mine?: boolean }) {
  const { data, mutate } = usePlatform(),
    { user, base } = useWorkspace(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("new"),
    [page, setPage] = useState(1),
    [remove, setRemove] = useState<string | null>(null);
  const blogs = data.blogs
    .filter(
      (b) =>
        b.moderation === "visible" &&
        (!mine || b.author === user?.displayName) &&
        `${b.title} ${b.content}`
          .toLocaleLowerCase("vi")
          .includes(search.toLocaleLowerCase("vi")),
    )
    .sort((a, b) =>
      sort === "popular"
        ? b.likes + b.comments.length - a.likes - a.comments.length
        : b.date.localeCompare(a.date),
    );
  return (
    <div className="container workspace stack">
      <PageHeading
        title={mine ? "Bài viết của tôi" : "Cẩm nang ẩm thực"}
        description="Câu chuyện ăn ngon, kinh nghiệm chọn quán và lịch ăn từ cộng đồng."
        action={
          user && (
            <ActionLink href={`${base}/guides/new`}>Viết cẩm nang</ActionLink>
          )
        }
      />
      <Field
        label="Tìm cẩm nang"
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <Tabs
        value={sort}
        onChange={(v) => {
          setSort(v);
          setPage(1);
        }}
        items={[
          { value: "new", label: "Mới nhất" },
          { value: "popular", label: "Phổ biến" },
        ]}
      />
      <div className="grid-3">
        {pageSlice(blogs, page, 6).items.map((b) => (
          <div className="stack-sm" key={b.id}>
            <BlogCard blog={b} href={`${base}/guides/${b.id}`} />
            {mine && (
              <div className="actions">
                <ActionLink href={`${base}/guides/${b.id}/edit`} secondary>
                  Chỉnh sửa
                </ActionLink>
                <Button variant="destructive" onClick={() => setRemove(b.id)}>
                  Xóa bài viết
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {!blogs.length && (
        <EmptyState
          title={mine ? "Bạn chưa có bài viết" : "Chưa có kết quả"}
          action={
            user && (
              <ActionLink href={`${base}/guides/new`}>Viết cẩm nang</ActionLink>
            )
          }
        />
      )}
      <Pagination
        total={blogs.length}
        page={page}
        size={6}
        onChange={setPage}
      />
      <ConfirmDialog
        open={!!remove}
        title="Xóa bài viết này?"
        destructive
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          await mutate((d) => {
            d.blogs = d.blogs.filter((b) => b.id !== remove);
          });
          setRemove(null);
        }}
      >
        <p>Bài viết sẽ được xóa khỏi bản minh họa.</p>
      </ConfirmDialog>
    </div>
  );
}
export function TripSnapshot({ trip }: { trip: Trip }) {
  const { data } = usePlatform(),
    [day, setDay] = useState(0);
  return (
    <Card className="plain" title="Lịch ăn đính kèm">
      <h3>{trip.name}</h3>
      <p className="helper">
        {dateLabel(trip.start)}–{dateLabel(trip.end)} · {trip.days.length} ngày
      </p>
      <Tabs
        value={String(day)}
        onChange={(v) => setDay(Number(v))}
        items={trip.days.map((d, i) => ({
          value: String(i),
          label: `Ngày ${i + 1}`,
        }))}
      />
      {trip.days[day]?.items.map((item) => {
        const dish = data.dishes.find((d) => d.id === item.dishId),
          restaurant = data.restaurants.find((r) => r.id === item.restaurantId);
        return (
          <Card className="plain" key={item.id}>
            <strong>
              {item.snapshot?.restaurantName ??
                restaurant?.name ??
                "Quán không còn khả dụng"}
            </strong>
            <span>
              {item.snapshot?.dishName ?? dish?.name ?? "Món trong lịch đã lưu"}{" "}
              · {item.meal}
            </span>
            <span className="helper">
              Dự chi: {money(item.snapshot?.price ?? dish?.price ?? 0)}
            </span>
          </Card>
        );
      })}
      <Alert tone="info">
        Bản chụp lịch ăn được giữ tại thời điểm đăng bài, kể cả khi lịch gốc
        thay đổi.
      </Alert>
    </Card>
  );
}
export function BlogDetail({ id }: { id: string }) {
  const { data, mutate, busy } = usePlatform(),
    { base, user } = useWorkspace(),
    [comment, setComment] = useState(""),
    [remove, setRemove] = useState<string | null>(null);
  const blog = data.blogs.find(
    (b) => b.id === id && b.moderation === "visible",
  );
  if (!blog)
    return (
      <div className="container workspace">
        <EmptyState
          title="Bài viết không còn khả dụng"
          action={<ActionLink href={`${base}/guides`}>Về cẩm nang</ActionLink>}
        />
      </div>
    );
  const comments = blog.comments.filter((c) => c.moderation === "visible");
  return (
    <div className="container workspace stack">
      <p className="helper">
        <Link href={`${base}/guides`}>Cẩm nang</Link> / Chi tiết
      </p>
      <PageHeading
        title={blog.title}
        description={`${blog.author} · ${dateLabel(blog.date)} · Nội dung minh họa`}
      />
      <div className="split-content">
        <article className="stack">
          <Media src={blog.image} alt={blog.title} />
          {blog.content.split("\n\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <h2>Trải nghiệm ẩm thực</h2>
          {blog.photos.map((photo, i) => (
            <Media key={photo} src={photo} alt={`Ảnh trải nghiệm ${i + 1}`} />
          ))}
          <div className="actions">
            <Button
              variant={blog.liked ? "primary" : "secondary"}
              aria-pressed={blog.liked}
              disabled={!user}
              onClick={() =>
                void mutate(
                  (d) => {
                    const b = d.blogs.find((b) => b.id === id)!;
                    b.likes += b.liked ? -1 : 1;
                    b.liked = !b.liked;
                  },
                  blog.liked ? "Đã bỏ thích bài viết." : "Đã thích bài viết.",
                )
              }
            >
              {blog.liked ? "♥ Đã thích" : "♡ Thích"} · {blog.likes}
            </Button>
            {!user && (
              <ActionLink href="/login" secondary>
                Đăng nhập để tương tác
              </ActionLink>
            )}
          </div>
          <Card title={`Bình luận · ${comments.length}`}>
            {user && (
              <form
                className="stack-sm"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  await mutate((d) =>
                    d.blogs
                      .find((b) => b.id === id)!
                      .comments.push({
                        id: crypto.randomUUID(),
                        author: user.displayName,
                        text: comment.trim(),
                        date: "2026-10-09",
                        moderation: "visible",
                      }),
                  );
                  setComment("");
                }}
              >
                <TextArea
                  label="Bình luận của bạn"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  required
                />
                <Button type="submit" loading={busy}>
                  Gửi bình luận
                </Button>
              </form>
            )}
            {comments.map((c) => (
              <div className="review" key={c.id}>
                <strong>{c.author}</strong>
                <p className="helper">{dateLabel(c.date)}</p>
                <p>{c.text}</p>
                {c.author === user?.displayName && (
                  <Button variant="tertiary" onClick={() => setRemove(c.id)}>
                    Xóa bình luận
                  </Button>
                )}
              </div>
            ))}
          </Card>
        </article>
        <aside className="sticky-card">
          {blog.trip ? (
            <TripSnapshot trip={blog.trip} />
          ) : (
            <Card title="Gợi ý trước khi chọn món">
              <p>
                Xác nhận giá, giờ mở cửa và thành phần với quán trước khi ăn.
              </p>
              <ActionLink href={`${base}/restaurants`} secondary>
                Xem quán ăn
              </ActionLink>
            </Card>
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={!!remove}
        title="Xóa bình luận?"
        destructive
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          await mutate((d) => {
            const b = d.blogs.find((b) => b.id === id)!;
            b.comments = b.comments.filter((c) => c.id !== remove);
          });
          setRemove(null);
        }}
      >
        <p>Bình luận sẽ bị xóa khỏi bản minh họa.</p>
      </ConfirmDialog>
    </div>
  );
}
export function BlogEditor({
  id,
  share = false,
}: {
  id?: string;
  share?: boolean;
}) {
  const { data, mutate, busy } = usePlatform(),
    { base, user } = useWorkspace(),
    router = useRouter(),
    existing = data.blogs.find(
      (b) => b.id === id && b.author === user?.displayName,
    );
  const [title, setTitle] = useState(existing?.title ?? ""),
    [content, setContent] = useState(existing?.content ?? ""),
    [cover, setCover] = useState<UploadedFile[]>(
      existing?.image
        ? [
            {
              id: "cover",
              name: "Ảnh bìa",
              url: existing.image,
              size: 1258291,
              type: "image/png",
            },
          ]
        : [],
    ),
    [photos, setPhotos] = useState<UploadedFile[]>(
      existing?.photos.map((url, i) => ({
        id: `photo-${i}`,
        name: `Ảnh ${i + 1}`,
        url,
        size: 1258291,
        type: "image/png",
      })) ?? [],
    ),
    [attached, setAttached] = useState(
      existing?.trip?.id ?? (share ? (data.trips[0]?.id ?? "") : ""),
    ),
    [exit, setExit] = useState<string | null>(null),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const intercept = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (
        link &&
        link.origin === window.location.origin &&
        link.pathname !== window.location.pathname
      ) {
        e.preventDefault();
        setExit(link.pathname + link.search);
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);
  const trip =
    attached === existing?.trip?.id
      ? existing.trip
      : data.trips.find((t) => t.id === attached);
  if (id && !existing)
    return (
      <div className="container workspace">
        <EmptyState
          title="Bạn không có bài viết này để chỉnh sửa"
          action={
            <ActionLink href={`${base}/my-guides`}>Bài viết của tôi</ActionLink>
          }
        />
      </div>
    );
  return (
    <div className="container workspace stack">
      <PageHeading
        title={
          share ? "Chia sẻ lịch" : id ? "Chỉnh sửa cẩm nang" : "Viết cẩm nang"
        }
        description="Chia sẻ những món ngon và trải nghiệm của bạn."
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || !content.trim()) return;
          const nextId = id ?? crypto.randomUUID();
          await mutate((d) => {
            const blog = {
              id: nextId,
              title: title.trim(),
              content: content.trim(),
              author: user!.displayName,
              date: "2026-10-09",
              image: cover[0]?.url ?? "",
              photos: photos.map((f) => f.url!).filter(Boolean),
              trip: trip ? snapshotTrip(trip, d) : undefined,
              likes: existing?.likes ?? 0,
              liked: existing?.liked ?? false,
              comments: existing?.comments ?? [],
              moderation: "visible" as const,
            };
            const index = d.blogs.findIndex((b) => b.id === id);
            if (index >= 0) d.blogs[index] = blog;
            else d.blogs.unshift(blog);
          });
          setDirty(false);
          router.push(`${base}/guides/${nextId}`);
        }}
      >
        <div className="split-content">
          <div className="stack">
            <Card className="soft" title="Bài viết của bạn">
              <Field
                label="Tiêu đề"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                minLength={1}
                maxLength={255}
                required
                helper={`${title.length} / 255 ký tự`}
              />
              <TextArea
                label="Nội dung"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
                required
                rows={8}
              />
            </Card>
            <Card className="soft" title="Ảnh cho cẩm nang">
              <UploadField
                label="Ảnh bìa · Không bắt buộc"
                files={cover}
                onChange={(f) => {
                  setCover(f);
                  setDirty(true);
                }}
              />
              <UploadField
                label="Ảnh trong bài · Không bắt buộc"
                max={20}
                files={photos}
                onChange={(f) => {
                  setPhotos(f);
                  setDirty(true);
                }}
              />
            </Card>
            {!share && (
              <Card title="Lịch ăn đính kèm">
                <label htmlFor="attach-trip">
                  Không bắt buộc · Chọn một lịch ăn của bạn
                </label>
                <select
                  id="attach-trip"
                  className="input"
                  value={attached}
                  onChange={(e) => {
                    setAttached(e.target.value);
                    setDirty(true);
                  }}
                >
                  <option value="">Không đính kèm</option>
                  {data.trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Card>
            )}
            <div className="between">
              <p className="helper">
                Nội dung chưa đăng không được tự động lưu.
              </p>
              <div className="actions">
                <Button
                  variant="secondary"
                  onClick={() =>
                    dirty
                      ? setExit(`${base}/guides`)
                      : router.push(`${base}/guides`)
                  }
                >
                  Hủy
                </Button>
                <Button type="submit" loading={busy}>
                  {share ? "Đăng và chia sẻ" : "Đăng cẩm nang"}
                </Button>
              </div>
            </div>
          </div>
          <aside className="sticky-card">
            {trip ? (
              <TripSnapshot trip={trip} />
            ) : (
              <Card title="Kể lại một bữa ngon">
                <p>
                  Chia sẻ món đáng thử, cách chọn quán và trải nghiệm thực tế.
                </p>
                <p className="helper">
                  Tiêu đề và nội dung là bắt buộc. Ảnh và lịch ăn không bắt
                  buộc.
                </p>
              </Card>
            )}
          </aside>
        </div>
      </form>
      <ConfirmDialog
        open={!!exit}
        title="Rời trang khi chưa đăng?"
        destructive
        label="Rời trang"
        onClose={() => setExit(null)}
        onConfirm={() => {
          const target = exit!;
          setDirty(false);
          setExit(null);
          router.push(target);
        }}
      >
        <p>
          Nội dung chưa đăng sẽ bị mất. Tiếp tục ở lại để hoàn thành bài viết.
        </p>
      </ConfirmDialog>
    </div>
  );
}
