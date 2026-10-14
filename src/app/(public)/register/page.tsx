import Brand from "@/components/brand";
import RegisterForm from "@/features/auth/register-form";

export const metadata = {
  title: "Đăng ký",
};

export default function Page() {
  // Cho phép mở /register bất kể đã đăng nhập hay chưa: người dùng có thể
  // tạo tài khoản khác hoặc xem lại form mà không bị đẩy đi nơi khác.
  return (
    <main className="container auth-page">
      <Brand />
      <div className="auth-card stack">
        <h1>Đăng ký</h1>
        <p>Khám phá món ngon và lưu lại hành trình ăn uống của bạn.</p>
        <RegisterForm />
      </div>
    </main>
  );
}
