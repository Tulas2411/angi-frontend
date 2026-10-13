import Brand from "@/components/brand";
import { getSession, readAuth } from "@/features/auth/server";
import { HOME_BY_ROLE } from "@/features/auth/roles";
import RegisterForm from "@/features/auth/register-form";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Đăng ký",
};

export default async function Page() {
  const auth = readAuth(await getSession());
  if (auth) redirect(HOME_BY_ROLE[auth.user.role]);
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
