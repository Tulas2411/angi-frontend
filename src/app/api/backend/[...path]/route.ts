import {
  backend,
  getSession,
  readAuth,
  withAuth,
} from "@/features/auth/server";
import { ApiError } from "@/shared/api/error";
import { checkOrigin, fail, ok, readJson } from "@/shared/api/http";
import { ownerMenuOperation } from "@/shared/api/owner-menu-proxy";
import { ownerReviewsOperation } from "@/shared/api/owner-reviews-proxy";
import { publicOperation } from "@/shared/api/public-proxy";
import { agentOperation } from "@/shared/api/agent-proxy";
import {
  adminDashboardOperation,
  adminModsOperation,
  adminPermissionsOperation,
} from "@/shared/api/admin-proxy";
import {
  isModeratorRole,
  moderationBlogsOperation,
  moderationReportsOperation,
  moderationUsersOperation,
  moderationVerificationsOperation,
} from "@/shared/api/moderation-proxy";
import {
  roadmapOperation,
  roadmapOperationHasBody,
  roadmapOperationStatus,
} from "@/shared/api/roadmap-proxy";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
// Exact operations verified against API Design v1.8 and the sibling BE checkout.
const allowedEndpoints = new Set([
  "GET me",
  "PATCH me",
  "PUT me/password",
  "GET me/notifications",
  "GET me/notifications/unread-count",
  "POST me/notifications/read",
  "GET owner/restaurant",
  "PATCH owner/restaurant",
  "PUT owner/restaurant/business-hours",
  "PUT owner/restaurant/operating-status",
  "POST owner/restaurant",
  "POST owner/restaurant/verifications",
  "GET owner/restaurant/verifications",
  "GET owner/restaurant/reviews",
  "POST media",
  "GET tags",
  "GET roadmaps",
  "POST roadmaps",
]);

async function handle(request: Request, context: Context) {
  const session = await getSession();
  try {
    const { path } = await context.params;
    const endpoint = path.join("/");
    const menuOperation = ownerMenuOperation(request.method, endpoint);
    const ownerReviews = ownerReviewsOperation(request.method, endpoint);
    const moderation = moderationReportsOperation(request.method, endpoint);
    const moderationUsers = moderationUsersOperation(request.method, endpoint);
    const moderationBlogs = moderationBlogsOperation(request.method, endpoint);
    const modVerifications = moderationVerificationsOperation(
      request.method,
      endpoint,
    );
    const publicOp = publicOperation(request.method, endpoint);
    const agentOp = agentOperation(request.method, endpoint);
    // F-63 ADM-D1..ADM-D3 + OPS-01, F-65 ADM-M1..ADM-M4, F-66 ADM-P1..ADM-P4: the Admin operations.
    const adminPermissions =
      adminPermissionsOperation(request.method, endpoint) ??
      adminModsOperation(request.method, endpoint) ??
      adminDashboardOperation(request.method, endpoint);
    const resubmission =
      request.method === "POST" &&
      /^owner\/restaurant\/verifications\/[1-9]\d*\/resubmit$/.test(endpoint);
    const roadmapRoute = roadmapOperation(request.method, endpoint);
    if (
      !allowedEndpoints.has(`${request.method} ${endpoint}`) &&
      !resubmission &&
      !roadmapRoute &&
      !menuOperation &&
      !ownerReviews &&
      !moderation &&
      !moderationUsers &&
      !moderationBlogs &&
      !modVerifications &&
      !adminPermissions &&
      !agentOp &&
      !publicOp
    ) {
      throw new ApiError(
        404,
        "ROUTE_NOT_FOUND",
        "Endpoint chưa được cấu hình.",
      );
    }
    if (request.method !== "GET") checkOrigin(request);
    let body: unknown;
    if (
      request.method !== "GET" &&
      menuOperation?.body !== false &&
      ownerReviews?.body !== false &&
      moderation?.body !== false &&
      moderationUsers?.body !== false &&
      moderationBlogs?.body !== false &&
      modVerifications?.body !== false &&
      adminPermissions?.body !== false &&
      publicOp?.body !== false &&
      !(roadmapRoute && !roadmapOperationHasBody(request.method))
    ) {
      if (endpoint === "media") {
        try {
          body = await request.formData();
        } catch {
          throw new ApiError(
            400,
            "BAD_REQUEST",
            "Tệp tải lên phải dùng multipart/form-data.",
          );
        }
      } else body = await readJson(request);
    }
    const query = new URL(request.url).search;
    if (agentOp) {
      let status = agentOp.status;
      const data = await withAuth(session, (auth) => {
        if (auth.user.role !== "TRAVELER")
          throw new ApiError(
            403,
            "FORBIDDEN",
            "Chỉ khách du lịch được sử dụng Trợ lý món ăn.",
          );
        return backend<unknown>(endpoint, {
          method: request.method,
          body,
          token: auth.accessToken,
          timeoutMs: agentOp.timeoutMs,
          onSuccess: (code) => {
            status = code;
          },
        });
      });
      return ok(data, status);
    }
    // Public-but-anonymous endpoints — bỏ qua withAuth (BE đã cho phép AllowAnonymous).
    // A signed-in traveler's token is sent when there is one (personal ranking, `myReview`);
    // a guest, or a session that can no longer be refreshed, is served anonymously.
    if (publicOp?.allowGuest) {
      const send = (token?: string) =>
        backend<unknown>(`${endpoint}${query}`, {
          method: request.method,
          body,
          token,
        });
      if (!readAuth(session)) return ok(await send(), publicOp.status);
      try {
        return ok(
          await withAuth(session, (auth) => send(auth.accessToken)),
          publicOp.status,
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          return ok(await send(), publicOp.status);
        throw error;
      }
    }
    // Public-yet-authenticated endpoints (roll dish, impressions, …) — vẫn chạy withAuth.
    if (publicOp && !publicOp.allowGuest) {
      return ok(
        await withAuth(session, (auth) =>
          backend<unknown>(`${endpoint}${query}`, {
            method: request.method,
            body,
            token: auth.accessToken,
          }),
        ),
        publicOp.status,
      );
    }
    // MOD-RP1..MOD-RP4 — chỉ Mod và Admin được vào hàng đợi báo cáo.
    if (moderation) {
      return ok(
        await withAuth(session, (auth) => {
          if (!isModeratorRole(auth.user.role))
            throw new ApiError(
              403,
              "FORBIDDEN",
              "Chỉ kiểm duyệt viên được xử lý báo cáo.",
            );
          return backend<unknown>(`${endpoint}${query}`, {
            method: request.method,
            body,
            token: auth.accessToken,
          });
        }),
        moderation.status,
      );
    }
    // MOD-U1..MOD-U4 — kiểm duyệt người dùng (Mod và Admin).
    if (moderationUsers) {
      return ok(
        await withAuth(session, (auth) => {
          if (!isModeratorRole(auth.user.role))
            throw new ApiError(
              403,
              "FORBIDDEN",
              "Chỉ kiểm duyệt viên được xử lý người dùng.",
            );
          return backend<unknown>(`${endpoint}${query}`, {
            method: request.method,
            body,
            token: auth.accessToken,
          });
        }),
        moderationUsers.status,
      );
    }
    // F-57 MOD-V1..MOD-V3 — duyệt hồ sơ xác minh nhà hàng (BE chỉ cho role MOD).
    if (modVerifications) {
      return ok(
        await withAuth(session, (auth) => {
          if (auth.user.role !== "MOD")
            throw new ApiError(
              403,
              "FORBIDDEN",
              "Chỉ Mod được duyệt hồ sơ xác minh nhà hàng.",
            );
          return backend<unknown>(`${endpoint}${query}`, {
            method: request.method,
            body,
            token: auth.accessToken,
          });
        }),
        modVerifications.status,
      );
    }
    // MOD-B1..MOD-B3 — kiểm duyệt bài viết và bình luận (Mod và Admin).
    if (moderationBlogs) {
      return ok(
        await withAuth(session, (auth) => {
          if (!isModeratorRole(auth.user.role))
            throw new ApiError(
              403,
              "FORBIDDEN",
              "Chỉ kiểm duyệt viên được xử lý nội dung cộng đồng.",
            );
          return backend<unknown>(`${endpoint}${query}`, {
            method: request.method,
            body,
            token: auth.accessToken,
          });
        }),
        moderationBlogs.status,
      );
    }
    // F-65 ADM-M1..ADM-M4 and F-66 ADM-P1..ADM-P4: only an Admin session gets through.
    if (adminPermissions) {
      return ok(
        await withAuth(session, (auth) => {
          if (auth.user.role !== "ADMIN")
            throw new ApiError(
              403,
              "FORBIDDEN",
              "Chỉ quản trị viên được quản lý Mod và phân quyền.",
            );
          return backend<unknown>(`${endpoint}${query}`, {
            method: request.method,
            body,
            token: auth.accessToken,
          });
        }),
        adminPermissions.status,
      );
    }
    // OWN-19/OWN-20 — chủ nhà hàng đọc và trả lời đánh giá của mình.
    if (ownerReviews) {
      return ok(
        await withAuth(session, (auth) => {
          if (auth.user.role !== "RESTAURANT_OWNER")
            throw new ApiError(
              403,
              "FORBIDDEN",
              "Chỉ chủ nhà hàng được xem đánh giá.",
            );
          return backend<unknown>(`${endpoint}${query}`, {
            method: request.method,
            body,
            token: auth.accessToken,
          });
        }),
        ownerReviews.status,
      );
    }
    return ok(
      await withAuth(session, (auth) => {
        if (
          (endpoint === "owner/restaurant" ||
            endpoint.startsWith("owner/restaurant/")) &&
          auth.user.role !== "RESTAURANT_OWNER"
        )
          throw new ApiError(
            403,
            "FORBIDDEN",
            "Chỉ chủ nhà hàng được thực hiện thao tác này.",
          );
        return backend<unknown>(`${endpoint}${query}`, {
          method: request.method,
          body,
          token: auth.accessToken,
        });
      }),
      menuOperation?.status ??
        roadmapOperationStatus(request.method, endpoint) ??
        // NOTI-03 answers 200 OK, unlike the creating POSTs.
        (request.method === "POST" && endpoint !== "me/notifications/read"
          ? 201
          : 200),
    );
  } catch (error) {
    return fail(error, session);
  }
}
export const GET = handle;
export const PATCH = handle;
export const PUT = handle;
export const POST = handle;
export const DELETE = handle;
