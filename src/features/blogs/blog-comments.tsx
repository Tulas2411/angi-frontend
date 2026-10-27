"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Alert, Button } from "@/shared/ui";
import {
  Avatar,
  ConfirmDialog,
  Icon,
  Pagination,
  TextArea,
} from "@/components/ui/primitives";
import { useRemote } from "@/features/explore/use-remote";
import { ApiError, getErrorMessage } from "@/shared/api/error";
import {
  blogDate,
  blogError,
  commentPageSize,
  maxCommentLength,
} from "./blog-rules";
import { BlogSkeleton } from "./blog-layout";
import type { BlogService } from "./blog-service";
import type { BlogCommentDto } from "./blog-types";

/** BLOG-03 (read), BLOG-10 (write) and BLOG-11 (delete my own); one level, oldest first. */
export function BlogComments({
  blogId,
  canWrite,
  service,
}: {
  blogId: number;
  /** Only a Traveler comments; a guest is asked to sign in. */
  canWrite: boolean;
  service: BlogService;
}) {
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [state, retry] = useRemote(
    () => service.comments(blogId, page, commentPageSize),
    `${blogId}:${page}:${version}`,
  );
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState("");
  const [removing, setRemoving] = useState<BlogCommentDto | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeProblem, setRemoveProblem] = useState("");
  const busy = useRef(false);

  async function post() {
    if (busy.current) return;
    const content = text.trim();
    if (!content) {
      setFormError("Nhập nội dung bình luận.");
      return;
    }
    busy.current = true;
    setPosting(true);
    setFormError("");
    try {
      await service.comment(blogId, content);
      setText("");
      // The new comment is the newest, so it is on the last page.
      const total = state.status === "ready" ? state.data.totalItems + 1 : 1;
      setPage(Math.max(1, Math.ceil(total / commentPageSize)));
      setVersion((value) => value + 1);
    } catch (caught) {
      setFormError(blogError(caught).message);
    } finally {
      busy.current = false;
      setPosting(false);
    }
  }

  async function confirmRemove() {
    if (!removing || busy.current) return;
    busy.current = true;
    setRemoveBusy(true);
    setRemoveProblem("");
    try {
      await service.removeComment(blogId, removing.id);
      setRemoving(null);
      setVersion((value) => value + 1);
    } catch (caught) {
      // Already gone elsewhere: nothing left to delete, so read the list again.
      if (
        caught instanceof ApiError &&
        caught.errorCode === "COMMENT_NOT_FOUND"
      ) {
        setRemoving(null);
        setVersion((value) => value + 1);
      } else setRemoveProblem(blogError(caught).message);
    } finally {
      busy.current = false;
      setRemoveBusy(false);
    }
  }

  const total = state.status === "ready" ? state.data.totalItems : null;
  return (
    <section className="blog-panel" aria-labelledby="blog-comments-title">
      <h2 id="blog-comments-title">
        {total === null ? "Bình luận" : `Bình luận · ${total}`}
      </h2>
      {canWrite ? (
        <form
          className="stack-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void post();
          }}
          noValidate
        >
          <TextArea
            className="textarea-compact"
            label="Bình luận của bạn"
            value={text}
            maxLength={maxCommentLength}
            onChange={(event) => setText(event.target.value)}
            error={formError}
          />
          <Button type="submit" loading={posting}>
            Gửi bình luận
          </Button>
        </form>
      ) : (
        <p className="blog-line">
          <Link href="/login">Đăng nhập</Link> để bình luận.
        </p>
      )}
      {state.status === "loading" && <BlogSkeleton rows={2} />}
      {state.status === "error" && (
        <div className="stack-sm">
          <Alert>{getErrorMessage(state.error)}</Alert>
          <Button onClick={retry}>Thử lại</Button>
        </div>
      )}
      {state.status === "ready" && (
        <>
          {state.data.items.length === 0 ? (
            <p className="blog-line">
              Chưa có bình luận nào. Hãy là người đầu tiên.
            </p>
          ) : (
            <ul className="blog-comments">
              {state.data.items.map((comment) => (
                <li key={comment.id}>
                  <article className="blog-comment">
                    <header>
                      <Avatar
                        name={comment.user.displayName}
                        image={comment.user.avatarUrl}
                      />
                      <span>
                        <strong>{comment.user.displayName}</strong>
                        <span className="blog-line">
                          {blogDate(comment.createdAt)}
                        </span>
                      </span>
                      {comment.isMine && (
                        <button
                          type="button"
                          className="blog-comment-delete"
                          aria-label="Xóa bình luận của tôi"
                          title="Xóa bình luận"
                          onClick={() => {
                            setRemoveProblem("");
                            setRemoving(comment);
                          }}
                          suppressHydrationWarning
                        >
                          <Icon name="trash" />
                        </button>
                      )}
                    </header>
                    <p>{comment.content}</p>
                  </article>
                </li>
              ))}
            </ul>
          )}
          {state.data.totalPages > 1 && (
            <Pagination
              total={state.data.totalItems}
              page={state.data.page}
              size={state.data.pageSize}
              onChange={setPage}
            />
          )}
        </>
      )}
      {removing && (
        <ConfirmDialog
          open
          destructive
          loading={removeBusy}
          title="Xóa bình luận?"
          label="Xóa bình luận"
          cancelLabel="Giữ lại"
          onClose={() => {
            if (!removeBusy) setRemoving(null);
          }}
          onConfirm={() => void confirmRemove()}
        >
          <div className="stack-sm">
            <p>Bạn có chắc chắn muốn xóa bình luận này không?</p>
            {removeProblem && <Alert>{removeProblem}</Alert>}
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}
