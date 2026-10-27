import { ApiError, getErrorMessage } from "@/shared/api/error";
import type { BlogReportReason, BlogSort, BlogStatus } from "./blog-types";

export const blogPageSize = 9;
export const commentPageSize = 10;
export const maxBlogTitle = 255;
export const maxBlogImages = 20;
export const maxCommentLength = 1000;

export const blogSortOptions: { value: BlogSort; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "popular", label: "Phổ biến" },
];

export const blogStatusLabels: Record<BlogStatus, string> = {
  published: "Đang hiển thị",
  hidden: "Đã bị ẩn",
  removed: "Đã bị gỡ",
};

export const blogStatusTabs: { value: "" | BlogStatus; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "published", label: blogStatusLabels.published },
  { value: "hidden", label: blogStatusLabels.hidden },
  { value: "removed", label: blogStatusLabels.removed },
];

export const blogReportReasons: { value: BlogReportReason; label: string }[] = [
  { value: "spam", label: "Nội dung rác hoặc quảng cáo" },
  { value: "offensive", label: "Nội dung xúc phạm" },
  { value: "wrong_info", label: "Thông tin không chính xác" },
  { value: "scam", label: "Lừa đảo" },
  { value: "other", label: "Lý do khác" },
];

export const mealLabels: Record<string, string> = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
  snack: "Ăn vặt",
};

export function blogDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
  }).format(new Date(value));
}

/** `/guides/45` → 45; anything that is not a positive whole number is not a page. */
export function parseBlogId(value: string): number | null {
  return /^[1-9]\d{0,9}$/.test(value) ? Number(value) : null;
}

export interface BlogFilters {
  q: string;
  sort: BlogSort;
  hasRoadmap: boolean;
  page: number;
}

export function blogFiltersFromParams(params: URLSearchParams): BlogFilters {
  const page = Number(params.get("page"));
  return {
    q: params.get("q") ?? "",
    sort: params.get("sort") === "popular" ? "popular" : "newest",
    hasRoadmap: params.get("roadmap") === "1",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function blogFiltersHref(filters: BlogFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.hasRoadmap) params.set("roadmap", "1");
  if (filters.page > 1) params.set("page", String(filters.page));
  const text = params.toString();
  return text ? `/guides?${text}` : "/guides";
}

export function mineHref(status: "" | BlogStatus, page: number) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `/guides/mine?${text}` : "/guides/mine";
}

const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) =>
    char === "&"
      ? "&amp;"
      : char === "<"
        ? "&lt;"
        : char === ">"
          ? "&gt;"
          : char === '"'
            ? "&quot;"
            : "&#39;",
  );

/**
 * The editor is plain text: a blank line starts a paragraph and a line break stays a line break.
 * Everything is escaped, so what is sent is only `<p>` and `<br>`; the backend sanitizes it again.
 */
export function textToHtml(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim())
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

/** The editor shows a blog's HTML as plain text again; formatting beyond paragraphs is lost. */
export function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => entities[entity])
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function blogProblems(title: string, text: string) {
  const problems: { title?: string; content?: string } = {};
  if (!title.trim()) problems.title = "Nhập tiêu đề cho cẩm nang.";
  else if (title.trim().length > maxBlogTitle)
    problems.title = `Tiêu đề tối đa ${maxBlogTitle} ký tự.`;
  if (!text.trim()) problems.content = "Nhập nội dung cho cẩm nang.";
  return problems;
}

/** BLOG-02..11 failures by `errorCode`. */
export function blogError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "BLOG_NOT_FOUND")
    return { gone: true, message: "Bài viết không còn khả dụng." };
  if (code === "COMMENT_NOT_FOUND")
    return { gone: false, message: "Bình luận này không còn nữa." };
  if (code === "NOT_OWNER")
    return { gone: false, message: "Bạn không phải tác giả của bài viết này." };
  if (code === "BLOG_REMOVED")
    return {
      gone: false,
      message: "Bài viết đã bị kiểm duyệt viên gỡ nên không sửa được.",
    };
  if (code === "ROADMAP_NOT_FOUND")
    return {
      gone: false,
      message: "Lộ trình đính kèm không còn hoặc không phải của bạn.",
    };
  return { gone: false, message: getErrorMessage(error) };
}

/** REP-02 failures by `errorCode`; `settled` means there is nothing to retry. */
export function blogReportError(error: unknown) {
  const code = error instanceof ApiError ? error.errorCode : "";
  if (code === "REPORT_ALREADY_PENDING")
    return {
      settled: true,
      message:
        "Báo cáo trước đó của bạn về bài viết này đang chờ xử lý, chưa thể gửi thêm.",
    };
  if (code === "CANNOT_REPORT_OWN_CONTENT")
    return {
      settled: false,
      message: "Bạn không thể báo cáo bài viết của chính mình.",
    };
  if (code === "BLOG_NOT_FOUND")
    return { settled: false, message: "Bài viết không còn khả dụng." };
  return { settled: false, message: getErrorMessage(error) };
}
