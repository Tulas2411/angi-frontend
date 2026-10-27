"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/shared/ui";
import {
  ActionLink,
  Avatar,
  ConfirmDialog,
  Tabs,
} from "@/components/ui/primitives";
import { ReportDialog } from "@/components/domain/report-dialog";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { dateLabel } from "@/shared/format";
import { restaurantHref } from "@/features/explore/explore-routes";
import { useRemote } from "@/features/explore/use-remote";
import { vnd } from "@/features/explore/explore-rules";
import { blogEditHref } from "./blog-cards";
import { BlogComments } from "./blog-comments";
import { BlogContent } from "./blog-content";
import { EyeIcon, HeartIcon } from "./blog-icons";
import { BlogSkeleton } from "./blog-layout";
import {
  blogDate,
  blogError,
  blogReportError,
  blogReportReasons,
  mealLabels,
} from "./blog-rules";
import { blogService, type BlogService } from "./blog-service";
import type { BlogLikeDto, RoadmapSnapshotDto } from "./blog-types";
import "./blogs.css";

/** Who is reading: only a Traveler likes, comments and reports (BLOG-08, 10, REP-02). */
export type BlogViewer = "TRAVELER" | "GUEST" | "OTHER";

/** The roadmap the author shared, as it was on the day it was posted. */
function Snapshot({
  snapshot,
  detached,
}: {
  snapshot: RoadmapSnapshotDto;
  detached: boolean;
}) {
  const [day, setDay] = useState(0);
  const current = snapshot.days[Math.min(day, snapshot.days.length - 1)];
  const dishes = snapshot.days.reduce((sum, d) => sum + d.items.length, 0);
  return (
    <section className="blog-panel blog-snapshot" aria-labelledby="blog-trip">
      <h2 id="blog-trip">Lịch ăn đính kèm</h2>
      <div>
        <p className="blog-trip-title">{snapshot.title}</p>
        <p className="blog-line">
          {snapshot.startDate ? `${dateLabel(snapshot.startDate)} · ` : ""}
          {snapshot.numDays} ngày · {dishes} món · {vnd(snapshot.totalCost)}
        </p>
      </div>
      {snapshot.days.length > 1 && (
        <Tabs
          label="Ngày trong lịch ăn"
          value={String(day)}
          onChange={(value) => setDay(Number(value))}
          items={snapshot.days.map((entry, index) => ({
            value: String(index),
            label: `Ngày ${entry.dayNumber}`,
          }))}
        />
      )}
      {current?.items.length ? (
        <ul className="blog-snapshot-items">
          {current.items.map((item, index) => (
            <li key={`${item.dishId}-${index}`}>
              <p className="blog-meal">
                {mealLabels[item.mealSlot] ?? item.mealSlot}
              </p>
              <p className="blog-dish">{item.dishName}</p>
              <p className="blog-where">
                <Link href={restaurantHref(item.restaurantId)}>
                  {item.restaurantName}
                </Link>
              </p>
              <p className="blog-line">
                {item.address} · <span className="num">{vnd(item.price)}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="blog-line">Ngày này chưa có món.</p>
      )}
      <p className="blog-line">
        Chụp lại lúc đăng bài
        {detached ? ", lộ trình gốc đã bị xóa" : ""}. Giá và quán có thể đã thay
        đổi.
      </p>
    </section>
  );
}

/** F-32 View Detail Blog: BLOG-02 with comments, a like (BLOG-08/09), a report and my own actions. */
export function BlogDetailPage({
  blogId,
  viewer,
  service = blogService,
}: {
  blogId: number;
  viewer: BlogViewer;
  service?: BlogService;
}) {
  const router = useRouter();
  const [state, retry] = useRemote(
    () => service.detail(blogId),
    String(blogId),
  );
  const [like, setLike] = useState<BlogLikeDto | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "info";
    text: string;
  } | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeProblem, setRemoveProblem] = useState("");
  const working = useRef(false);

  if (state.status === "loading")
    return (
      <div className="blog-page">
        <BlogSkeleton lead rows={2} />
      </div>
    );
  if (state.status === "error") {
    const missing =
      state.error instanceof ApiError &&
      (state.error.errorCode === "BLOG_NOT_FOUND" ||
        state.error.status === 404);
    return (
      <div className="blog-page">
        <section className="blog-panel stack-sm">
          <h1 className="blog-panel-title">
            {missing ? "Bài viết không còn khả dụng" : "Chưa tải được bài viết"}
          </h1>
          {missing ? (
            <p>
              Bài viết không tồn tại, đã bị xóa hoặc đã bị kiểm duyệt viên ẩn.
            </p>
          ) : (
            <Alert>{getErrorMessage(state.error)}</Alert>
          )}
          <div className="actions">
            {!missing && <Button onClick={retry}>Thử lại</Button>}
            <ActionLink href="/guides" secondary>
              Về cẩm nang
            </ActionLink>
          </div>
        </section>
      </div>
    );
  }
  const blog = state.data;
  const liked = like ? like.liked : blog.likedByMe;
  const likeCount = like ? like.likeCount : blog.likeCount;

  async function toggleLike() {
    if (working.current) return;
    working.current = true;
    setLikeBusy(true);
    setProblem("");
    try {
      setLike(await (liked ? service.unlike(blogId) : service.like(blogId)));
    } catch (caught) {
      setProblem(blogError(caught).message);
    } finally {
      working.current = false;
      setLikeBusy(false);
    }
  }

  async function confirmRemove() {
    if (working.current) return;
    working.current = true;
    setRemoveBusy(true);
    setRemoveProblem("");
    try {
      await service.remove(blogId);
      router.push("/guides/mine");
    } catch (caught) {
      if (blogError(caught).gone) router.push("/guides/mine");
      else setRemoveProblem(blogError(caught).message);
    } finally {
      working.current = false;
      setRemoveBusy(false);
    }
  }

  return (
    <div className="blog-page">
      <nav className="blog-back" aria-label="Quay lại">
        <Link href="/guides">← Tất cả cẩm nang</Link>
      </nav>
      <header className="blog-article-head">
        <h1>{blog.title}</h1>
        <div className="blog-article-meta">
          <p className="blog-byline blog-byline-lg">
            <Avatar
              name={blog.author.displayName}
              image={blog.author.avatarUrl}
            />
            <span>
              <strong>{blog.author.displayName}</strong>
              <span className="blog-line">
                {blogDate(blog.publishedAt)}
                <span aria-hidden> · </span>
                <span className="blog-views">
                  <EyeIcon />
                  <span className="num">{blog.viewCount}</span> lượt xem
                </span>
              </span>
            </span>
          </p>
          <div className="blog-article-actions">
            {viewer === "TRAVELER" ? (
              <Button
                variant="secondary"
                aria-pressed={liked}
                loading={likeBusy}
                onClick={() => void toggleLike()}
              >
                <span className="blog-like">
                  <HeartIcon filled={liked} />
                  {liked ? "Đã thích" : "Thích"} ·{" "}
                  <span className="num">{likeCount}</span>
                </span>
              </Button>
            ) : (
              <span className="blog-pill">
                <HeartIcon />
                <span className="num">{likeCount}</span> lượt thích
              </span>
            )}
            {blog.isMine && (
              <>
                <ActionLink href={blogEditHref(blog.id)} secondary>
                  Chỉnh sửa
                </ActionLink>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRemoveProblem("");
                    setRemoveOpen(true);
                  }}
                >
                  Xóa bài viết
                </Button>
              </>
            )}
            {viewer === "TRAVELER" && !blog.isMine && (
              <Button variant="tertiary" onClick={() => setReportOpen(true)}>
                Báo cáo bài viết
              </Button>
            )}
            {viewer === "GUEST" && (
              <ActionLink href="/login" secondary>
                Đăng nhập để tương tác
              </ActionLink>
            )}
          </div>
        </div>
        {problem && <Alert>{problem}</Alert>}
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      </header>
      {blog.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="blog-hero" src={blog.coverUrl} alt="" />
      )}
      <div className="blog-columns">
        <article className="blog-main">
          <BlogContent html={blog.content} />
          {blog.images.length > 0 && (
            <section aria-label="Ảnh trong bài">
              <ul className="blog-images">
                {blog.images.map((url, index) => (
                  <li key={url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Ảnh ${index + 1} trong bài ${blog.title}`}
                      loading="lazy"
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <BlogComments
            blogId={blogId}
            canWrite={viewer === "TRAVELER"}
            service={service}
          />
        </article>
        {blog.roadmapSnapshot && (
          <aside className="blog-aside">
            <Snapshot
              snapshot={blog.roadmapSnapshot}
              detached={blog.roadmapId === null}
            />
          </aside>
        )}
      </div>
      {reportOpen && (
        <ReportDialog
          open
          title="Báo cáo bài viết"
          reasons={blogReportReasons}
          send={(request) => service.report(blogId, request)}
          upload={(file) => service.upload(file, "report_evidence")}
          errorOf={blogReportError}
          onClose={() => setReportOpen(false)}
          onSent={(already) => {
            setReportOpen(false);
            setNotice(
              already
                ? {
                    tone: "info",
                    text: "Báo cáo trước đó của bạn về bài viết này đang chờ xử lý.",
                  }
                : {
                    tone: "success",
                    text: "Đã gửi báo cáo. Đội kiểm duyệt sẽ xem xét sớm.",
                  },
            );
          }}
        />
      )}
      {removeOpen && (
        <ConfirmDialog
          open
          destructive
          loading={removeBusy}
          title="Xóa bài viết này?"
          label="Xóa bài viết"
          cancelLabel="Giữ lại"
          onClose={() => {
            if (!removeBusy) setRemoveOpen(false);
          }}
          onConfirm={() => void confirmRemove()}
        >
          <div className="stack-sm">
            <p>
              <strong>{blog.title}</strong> sẽ bị xóa khỏi ANGI. Thao tác này
              không hoàn tác được.
            </p>
            {removeProblem && <Alert>{removeProblem}</Alert>}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
