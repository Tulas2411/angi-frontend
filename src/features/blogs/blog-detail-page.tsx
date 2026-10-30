"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/shared/ui";
import {
  ActionLink,
  Avatar,
  ConfirmDialog,
} from "@/components/ui/primitives";
import { ReportDialog } from "@/components/domain/report-dialog";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { useRemote } from "@/features/explore/use-remote";
import { exploreService } from "@/features/explore/explore-service";
import { blogEditHref } from "./blog-cards";
import { BlogComments } from "./blog-comments";
import { BlogContent } from "./blog-content";
import { EyeIcon, HeartIcon } from "./blog-icons";
import { BlogSkeleton } from "./blog-layout";
import { BlogMap } from "./blog-map";
import { BlogPhotos } from "./blog-photos";
import { BlogRoadmap, useBlogDishCovers, useBlogRoadmapStops } from "./blog-roadmap";
import { blogDate, blogError, blogReportError, blogReportReasons } from "./blog-rules";
import { blogService, type BlogService } from "./blog-service";
import type { BlogLikeDto } from "./blog-types";
import "./blogs.css";

/** Who is reading: only a Traveler likes, comments and reports (BLOG-08, 10, REP-02). */
export type BlogViewer = "TRAVELER" | "GUEST" | "OTHER";

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
  const snapshot =
    state.status === "ready" ? (state.data.roadmapSnapshot ?? null) : null;
  // The pins of the map come from the restaurants of the shared roadmap.
  const stops = useBlogRoadmapStops(snapshot, (restaurantId) =>
    exploreService.restaurant(restaurantId),
  );
  // The photos of the dishes come from the dish catalogue.
  const covers = useBlogDishCovers(snapshot, (dishId) =>
    exploreService.dish(dishId),
  );

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
    <div className="blog-page blog-detail-layout">
      <div className="blog-detail">
        <div className="blog-detail-main">
          <nav className="blog-back" aria-label="Quay lại">
            <Link href="/guides">← Tất cả cẩm nang</Link>
          </nav>
          {/* 1. The cover and the title of the blog, the title over the cover. */}
          <section className="blog-section blog-hero-section">
            <div className="blog-hero-top">
              <header className="blog-article-head">
              <h1 className="blog-hero-title">{blog.title}</h1>
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
                    <Button
                      variant="tertiary"
                      onClick={() => setReportOpen(true)}
                    >
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
                <div className="blog-hero-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={blog.coverUrl} alt="" />
                </div>
              )}
            </div>
          </section>

          {/* The description of the blog, its own panel under the cover. */}
          {blog.content.trim() && (
            <section className="blog-section blog-desc-panel" aria-labelledby="blog-desc-title">
              <header className="blog-section-head">
                <div>
                  <p className="blog-eyebrow">Mô tả</p>
                  <h2 id="blog-desc-title" className="blog-section-title">
                    Câu chuyện của chuyến đi
                  </h2>
                </div>
              </header>
              <BlogContent html={blog.content} />
            </section>
          )}

          {/* 2. The photos of the trip, two to a row. */}
          {blog.images.length > 0 && (
            <BlogPhotos images={blog.images} title={blog.title} />
          )}

          {/* 3. The roadmap the author shared. */}
          {snapshot && (
            <BlogRoadmap
              snapshot={snapshot}
              detached={blog.roadmapId === null}
              covers={covers}
            />
          )}

          {/* 4. The comments of the blog. */}
          <section className="blog-section" aria-labelledby="blog-comments-heading">
            <header className="blog-section-head">
              <div>
                <p className="blog-eyebrow">Thảo luận</p>
                <h2 id="blog-comments-heading" className="blog-section-title">
                  Bình luận
                </h2>
              </div>
            </header>
            <div className="blog-comments-wrap">
              <BlogComments
                blogId={blogId}
                canWrite={viewer === "TRAVELER"}
                service={service}
                showTitle={false}
              />
            </div>
          </section>
        </div>

        {/* The map of the shared roadmap, on the other half of the screen. */}
        <aside className="blog-detail-aside">
          <div className="blog-detail-map">
            <div className="blog-detail-map-head">
              <p className="blog-eyebrow">Bản đồ lộ trình</p>
              <h2 className="blog-section-title">
                {snapshot ? snapshot.title : "Lộ trình của bài viết"}
              </h2>
              {snapshot && (
                <p className="blog-line">
                  {snapshot.numDays} ngày · {stops.length} địa điểm có tọa độ
                </p>
              )}
            </div>
            <BlogMap stops={stops} />
          </div>
        </aside>
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
