"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input } from "@/shared/ui";
import {
  ActionLink,
  Choice,
  ConfirmDialog,
  SelectField,
  TextArea,
} from "@/components/ui/primitives";
import {
  ImageAttachments,
  type Attachment,
} from "@/components/domain/image-attachments";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import { vnd } from "@/features/explore/explore-rules";
import { useRemote } from "@/features/explore/use-remote";
import {
  roadmapService,
  type RoadmapListService,
} from "@/features/roadmaps/roadmap-service";
import type { RoadmapSummaryDto } from "@/features/roadmaps/roadmap-types";
import { blogHref } from "./blog-cards";
import { BlogHeading, BlogSkeleton } from "./blog-layout";
import {
  blogError,
  blogProblems,
  htmlToText,
  maxBlogImages,
  maxBlogTitle,
  textToHtml,
} from "./blog-rules";
import { blogService, type BlogService } from "./blog-service";
import type {
  BlogDetailDto,
  CreateBlogRequestDto,
  EditBlogRequestDto,
} from "./blog-types";
import "./blogs.css";

/** Asks before leaving a form that has unsent edits (links, reload and close). */
function useUnsavedGuard(dirty: boolean, onLeave: (target: string) => void) {
  const leave = useRef(onLeave);
  useEffect(() => {
    leave.current = onLeave;
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const intercept = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      if (
        link &&
        link.origin === window.location.origin &&
        link.pathname !== window.location.pathname
      ) {
        event.preventDefault();
        leave.current(link.pathname + link.search);
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);
}

type ImageChoice = "keep" | "replace";

function EditorForm({
  blog,
  initialRoadmapId,
  roadmaps,
  service,
}: {
  /** The blog being edited, or null to write a new one. */
  blog: BlogDetailDto | null;
  initialRoadmapId: number | null;
  roadmaps: RoadmapSummaryDto[];
  service: BlogService;
}) {
  const router = useRouter();
  const originalText = blog ? htmlToText(blog.content) : "";
  const [title, setTitle] = useState(blog?.title ?? "");
  const [text, setText] = useState(originalText);
  const [cover, setCover] = useState<Attachment[]>([]);
  const [coverChoice, setCoverChoice] = useState<ImageChoice | "remove">(
    "keep",
  );
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [photoChoice, setPhotoChoice] = useState<ImageChoice>("keep");
  const [roadmapId, setRoadmapId] = useState(
    initialRoadmapId ? String(initialRoadmapId) : "",
  );
  const [refreshSnapshot, setRefreshSnapshot] = useState(false);
  const [problems, setProblems] = useState<{
    title?: string;
    content?: string;
  }>({});
  const [failure, setFailure] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exit, setExit] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const sending = useRef(false);

  const dirty =
    !saved &&
    (title !== (blog?.title ?? "") ||
      text !== originalText ||
      cover.length > 0 ||
      coverChoice === "remove" ||
      photos.length > 0 ||
      photoChoice === "replace" ||
      refreshSnapshot ||
      (!blog &&
        roadmapId !== (initialRoadmapId ? String(initialRoadmapId) : "")));
  useUnsavedGuard(dirty, setExit);

  async function submit() {
    if (sending.current || uploading) return;
    const found = blogProblems(title, text);
    setProblems(found);
    setFailure("");
    if (found.title || found.content) return;
    sending.current = true;
    setBusy(true);
    try {
      let result: BlogDetailDto;
      if (blog) {
        const request: EditBlogRequestDto = {};
        if (title.trim() !== blog.title) request.title = title.trim();
        if (text !== originalText) request.content = textToHtml(text);
        if (coverChoice === "remove") request.coverMediaId = null;
        else if (cover.length) request.coverMediaId = cover[0].mediaId;
        if (photoChoice === "replace")
          request.imageMediaIds = photos.map((photo) => photo.mediaId);
        if (refreshSnapshot) request.refreshRoadmapSnapshot = true;
        if (!Object.keys(request).length) {
          router.push(blogHref(blog.id));
          return;
        }
        result = await service.edit(blog.id, request);
      } else {
        const request: CreateBlogRequestDto = {
          title: title.trim(),
          content: textToHtml(text),
        };
        if (cover.length) request.coverMediaId = cover[0].mediaId;
        if (photos.length)
          request.imageMediaIds = photos.map((photo) => photo.mediaId);
        if (roadmapId) request.roadmapId = Number(roadmapId);
        result = await service.create(request);
      }
      setSaved(true);
      router.push(blogHref(result.id));
    } catch (caught) {
      setFailure(blogError(caught).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const upload = (file: File) => service.upload(file, "blog");
  const back = blog ? blogHref(blog.id) : "/guides";
  const chosen = roadmaps.find((roadmap) => String(roadmap.id) === roadmapId);
  return (
    <div className="blog-page">
      <BlogHeading
        title={blog ? "Chỉnh sửa cẩm nang" : "Viết cẩm nang"}
        line="Bài được đăng ngay, không cần duyệt trước."
      />
      <form
        className="blog-columns blog-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        noValidate
      >
        <div className="blog-main">
          <section className="blog-panel" aria-labelledby="blog-write">
            <h2 id="blog-write">Bài viết</h2>
            <div className="field">
              <label htmlFor="blog-title">Tiêu đề *</label>
              <Input
                id="blog-title"
                value={title}
                maxLength={maxBlogTitle}
                aria-invalid={!!problems.title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <p className={problems.title ? "field-error" : "helper"}>
                {problems.title ?? `${title.length} / ${maxBlogTitle} ký tự`}
              </p>
            </div>
            <TextArea
              label="Nội dung *"
              value={text}
              rows={16}
              onChange={(event) => setText(event.target.value)}
              error={problems.content}
              helper="Để trống một dòng để sang đoạn mới."
            />
          </section>
        </div>
        <aside className="blog-aside blog-editor-side">
          <section className="blog-panel" aria-labelledby="blog-publish">
            <h2 id="blog-publish">{blog ? "Lưu bài" : "Đăng bài"}</h2>
            <p className="blog-line">
              {blog
                ? "Thay đổi có hiệu lực ngay khi bạn lưu."
                : "Nội dung chưa đăng không được tự động lưu."}
            </p>
            {failure && <Alert>{failure}</Alert>}
            <div className="blog-publish-actions">
              <Button type="submit" loading={busy} disabled={uploading}>
                {blog ? "Lưu thay đổi" : "Đăng cẩm nang"}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => (dirty ? setExit(back) : router.push(back))}
              >
                Hủy
              </Button>
            </div>
          </section>
          <section className="blog-panel" aria-labelledby="blog-photos">
            <h2 id="blog-photos">Ảnh</h2>
            {blog &&
            blog.coverUrl &&
            coverChoice === "keep" &&
            !cover.length ? (
              <div className="stack-sm">
                <p className="blog-line">Ảnh bìa hiện tại</p>
                <div className="blog-current-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={blog.coverUrl} alt="Ảnh bìa hiện tại" />
                </div>
                <div className="actions">
                  <Button
                    variant="secondary"
                    onClick={() => setCoverChoice("replace")}
                  >
                    Đổi ảnh bìa
                  </Button>
                  <Button
                    variant="tertiary"
                    onClick={() => setCoverChoice("remove")}
                  >
                    Bỏ ảnh bìa
                  </Button>
                </div>
              </div>
            ) : coverChoice === "remove" ? (
              <div className="stack-sm">
                <p className="blog-line">Ảnh bìa sẽ được bỏ khi lưu.</p>
                <div>
                  <Button
                    variant="tertiary"
                    onClick={() => setCoverChoice("keep")}
                  >
                    Giữ ảnh bìa
                  </Button>
                </div>
              </div>
            ) : (
              <ImageAttachments
                label="Ảnh bìa · Không bắt buộc"
                helper="1 ảnh JPG, PNG hoặc WEBP, dưới 5 MB."
                max={1}
                value={cover}
                onChange={setCover}
                onUploading={setUploading}
                upload={upload}
              />
            )}
            {blog && blog.images.length > 0 && photoChoice === "keep" ? (
              <div className="stack-sm">
                <p className="blog-line">
                  {blog.images.length} ảnh trong bài hiện tại
                </p>
                <ul className="blog-images blog-images-small">
                  {blog.images.map((url, index) => (
                    <li key={url}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Ảnh ${index + 1} hiện tại`} />
                    </li>
                  ))}
                </ul>
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => setPhotoChoice("replace")}
                  >
                    Thay toàn bộ ảnh trong bài
                  </Button>
                </div>
              </div>
            ) : (
              <ImageAttachments
                label="Ảnh trong bài · Không bắt buộc"
                helper="Tối đa 20 ảnh JPG, PNG hoặc WEBP, mỗi ảnh dưới 5 MB."
                max={maxBlogImages}
                value={photos}
                onChange={setPhotos}
                onUploading={setUploading}
                upload={upload}
              />
            )}
          </section>
          {!blog && (
            <section className="blog-panel" aria-labelledby="blog-trip-pick">
              <h2 id="blog-trip-pick">Lịch ăn đính kèm</h2>
              <SelectField
                label="Không bắt buộc · chọn một lộ trình của bạn"
                value={roadmapId}
                onChange={setRoadmapId}
                options={[
                  { value: "", label: "Không đính kèm" },
                  ...(initialRoadmapId &&
                  !roadmaps.some((roadmap) => roadmap.id === initialRoadmapId)
                    ? [
                        {
                          value: String(initialRoadmapId),
                          label: `Lộ trình #${initialRoadmapId}`,
                        },
                      ]
                    : []),
                  ...roadmaps.map((roadmap) => ({
                    value: String(roadmap.id),
                    label: roadmap.title,
                  })),
                ]}
              />
              <p className="blog-line">
                {chosen
                  ? `${chosen.numDays} ngày · ${chosen.itemCount} món · ${vnd(chosen.totalEstimatedCost)}. Hệ thống chụp lại lộ trình lúc đăng nên bài giữ nguyên khi lộ trình gốc đổi.`
                  : "Hệ thống chụp lại lộ trình lúc đăng, nên bài vẫn giữ nguyên khi lộ trình gốc thay đổi."}
              </p>
            </section>
          )}
          {blog && blog.roadmapId !== null && (
            <section className="blog-panel" aria-labelledby="blog-trip-pick">
              <h2 id="blog-trip-pick">Lịch ăn đính kèm</h2>
              <Choice
                label="Chụp lại lộ trình theo dữ liệu hiện tại"
                checked={refreshSnapshot}
                onChange={setRefreshSnapshot}
              />
            </section>
          )}
        </aside>
      </form>
      {exit && (
        <ConfirmDialog
          open
          destructive
          label="Rời trang"
          cancelLabel="Ở lại"
          title="Rời trang khi chưa đăng?"
          onClose={() => setExit(null)}
          onConfirm={() => {
            const target = exit;
            setSaved(true);
            setExit(null);
            router.push(target);
          }}
        >
          <p>Nội dung chưa đăng sẽ bị mất. Ở lại để hoàn thành bài viết.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

/**
 * F-33 Write Blog and F-34 Share My Roadmap (BLOG-04, with `roadmapId`) and F-36 Edit Blog
 * (BLOG-06). New and edited blogs go live at once; `blogId` set means edit.
 */
export function BlogEditorPage({
  blogId,
  roadmapId = null,
  service = blogService,
  roadmaps = roadmapService,
}: {
  blogId?: number;
  roadmapId?: number | null;
  service?: BlogService;
  roadmaps?: RoadmapListService;
}) {
  const [loaded, retry] = useRemote(
    async () => {
      const blog = blogId ? await service.detail(blogId) : null;
      // The roadmap choice is only for a new blog; reading it is best effort.
      const list = blogId
        ? []
        : await roadmaps
            .list(1, 50)
            .then((page) => page.items)
            .catch(() => []);
      return { blog, list };
    },
    String(blogId ?? "new"),
  );
  if (loaded.status === "loading")
    return (
      <div className="blog-page">
        <BlogSkeleton rows={3} />
      </div>
    );
  if (loaded.status === "error") {
    const missing =
      loaded.error instanceof ApiError &&
      (loaded.error.errorCode === "BLOG_NOT_FOUND" ||
        loaded.error.status === 404);
    return (
      <Card
        title={missing ? "Không tìm thấy bài viết" : "Chưa tải được bài viết"}
      >
        {missing ? (
          <p>Bài viết không tồn tại hoặc không còn hiển thị.</p>
        ) : (
          <Alert>{getErrorMessage(loaded.error)}</Alert>
        )}
        <div className="actions">
          {!missing && <Button onClick={retry}>Thử lại</Button>}
          <ActionLink href="/guides/mine" secondary>
            Bài viết của tôi
          </ActionLink>
        </div>
      </Card>
    );
  }
  const { blog, list } = loaded.data;
  if (blog && !blog.isMine)
    return (
      <Card title="Bạn không có bài viết này để chỉnh sửa">
        <p>Chỉ tác giả mới chỉnh sửa được bài viết.</p>
        <ActionLink href="/guides/mine" secondary>
          Bài viết của tôi
        </ActionLink>
      </Card>
    );
  return (
    <EditorForm
      blog={blog}
      initialRoadmapId={roadmapId}
      roadmaps={list}
      service={service}
    />
  );
}
