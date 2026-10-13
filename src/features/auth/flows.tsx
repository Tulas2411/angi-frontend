"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Card } from "@/shared/ui";
import { ActionLink, Choice, Field } from "@/components/ui/primitives";
import { PageHeading } from "@/components/layout/workspace";
export type AuthFlow =
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email"
  | "setup-password"
  | "choose-role";
export function AuthFlowPage({
  flow,
  demo = false,
  tokenPresent = false,
}: {
  flow: AuthFlow;
  demo?: boolean;
  tokenPresent?: boolean;
}) {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("TRAVELER"),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [state, setState] = useState<"form" | "success">("form"),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const titles = {
    register: "Đăng ký",
    "forgot-password": "Quên mật khẩu",
    "reset-password": "Đặt lại mật khẩu",
    "verify-email": "Xác minh email",
    "setup-password": "Thiết lập mật khẩu",
    "choose-role": "Chọn vai trò",
  };
  const needsPassword = [
      "register",
      "reset-password",
      "setup-password",
    ].includes(flow),
    invalidToken =
      (flow === "reset-password" || flow === "setup-password") &&
      !tokenPresent &&
      !demo;
  function submit() {
    setError("");
    if (
      needsPassword &&
      (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    ) {
      setError("Mật khẩu có 8–64 ký tự, ít nhất một chữ cái và một chữ số.");
      return;
    }
    if (needsPassword && password !== confirm) {
      setError("Mật khẩu xác nhận chưa trùng khớp.");
      return;
    }
    if (!demo) {
      setError(
        "Luồng này chưa có hợp đồng API trong repository. Chưa gửi email hoặc thay đổi tài khoản.",
      );
      return;
    }
    setState("success");
    if (flow === "register") setCooldown(60);
  }
  return (
    <div className="container workspace" style={{ maxWidth: 640 }}>
      <PageHeading
        title={titles[flow]}
        description={
          demo
            ? "Bản minh họa · Không tạo phiên đăng nhập hoặc gửi email thực."
            : "Các mục có dấu * là bắt buộc."
        }
      />
      <Card className="soft">
        {invalidToken ? (
          <Alert>
            Liên kết không hợp lệ hoặc đã hết hạn. Yêu cầu một liên kết mới.
          </Alert>
        ) : state === "success" ? (
          <div className="stack">
            <h2>
              {flow === "register"
                ? "Kiểm tra hộp thư của bạn"
                : "Đã hoàn thành bước minh họa"}
            </h2>
            <p>
              {flow === "register"
                ? `Minh họa gửi liên kết xác minh đến ${email}. Bạn cần xác minh trước khi đăng nhập.`
                : "Không có thay đổi trên tài khoản hoặc email thực."}
            </p>
            <ActionLink href="/login">Quay lại đăng nhập</ActionLink>
          </div>
        ) : flow === "verify-email" ? (
          <div className="stack">
            <h2>Đang chờ xác minh</h2>
            <p>
              Kiểm tra liên kết trong email. API xác minh email chưa có trong
              repository.
            </p>
            <Button
              disabled={cooldown > 0}
              onClick={() => {
                setCooldown(60);
                setError(
                  demo
                    ? "Đã mô phỏng gửi lại liên kết. Không có email thực được gửi."
                    : "Chưa có API gửi lại liên kết xác minh.",
                );
              }}
            >
              {cooldown ? `Gửi lại sau ${cooldown} giây` : "Gửi lại liên kết"}
            </Button>
          </div>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {flow === "register" && (
              <Field
                label="Tên hiển thị"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={100}
                required
                helper="Từ 2 đến 100 ký tự."
              />
            )}
            {(flow === "register" || flow === "forgot-password") && (
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                autoComplete="email"
              />
            )}
            {needsPassword && (
              <>
                <Field
                  label={flow === "register" ? "Mật khẩu" : "Mật khẩu mới"}
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={64}
                  autoComplete="new-password"
                  helper="8–64 ký tự, có ít nhất một chữ cái và một chữ số."
                />
                <Field
                  label="Nhập lại mật khẩu"
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <Choice
                  label="Hiện mật khẩu"
                  checked={show}
                  onChange={setShow}
                />
              </>
            )}
            {(flow === "register" || flow === "choose-role") && (
              <fieldset>
                <legend>Bạn muốn sử dụng ANGI với vai trò nào? *</legend>
                <div className="actions">
                  <Choice
                    kind="radio"
                    name="role"
                    label="Người khám phá"
                    checked={role === "TRAVELER"}
                    onChange={() => setRole("TRAVELER")}
                  />
                  <Choice
                    kind="radio"
                    name="role"
                    label="Chủ nhà hàng"
                    checked={role === "RESTAURANT_OWNER"}
                    onChange={() => setRole("RESTAURANT_OWNER")}
                  />
                </div>
              </fieldset>
            )}
            <Button type="submit">
              {flow === "register"
                ? "Tạo tài khoản"
                : flow === "forgot-password"
                  ? "Gửi liên kết đặt lại"
                  : "Tiếp tục"}
            </Button>
          </form>
        )}
        {error && (
          <Alert tone={demo && cooldown > 0 ? "info" : "error"}>{error}</Alert>
        )}
        <ActionLink href="/login" secondary>
          Đăng nhập
        </ActionLink>
      </Card>
    </div>
  );
}
