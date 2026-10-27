import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/site/account-menu";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Icon } from "@/components/ui/primitives";
import type { AuthUserDto } from "@/features/auth/types";
import { roadmapRoutes } from "@/features/roadmaps/routes";
import { Button, Input } from "@/shared/ui";
import { HomeDishCollection } from "./home-dish-collection";
import { createDishPhotos } from "./home-dish-layout";
import {
  HomePreferencePreview,
  HomeRoadmapPreview,
} from "./home-experience-preview";
import {
  homeSelectionHref,
  homeTastes,
  selectHomeDishes,
  type HomeSelection,
} from "./home-content";
import "./public-home.css";

/**
 * Public homepage. Its recommendation, roadmap and dish-collection blocks are
 * editorial product introductions: they use no backend data and are labelled as
 * illustrations. `user` is set for a signed-in role that has no workspace yet.
 */
export function PublicHomePage({
  selection,
  user = null,
}: {
  selection: HomeSelection;
  user?: AuthUserDto | null;
}) {
  const dishes = selectHomeDishes(selection);
  const filtered = Boolean(selection.query) || selection.taste !== "all";
  return (
    <div className="home-page">
      <a className="skip-link" href="#noi-dung">
        Đến nội dung chính
      </a>
      <SiteHeader
        nav={
          <nav className="site-nav" aria-label="Điều hướng chính">
            <a href="#goi-y">Gợi ý hợp gu</a>
            <a href="#lich-trinh">Lịch trình ẩm thực</a>
            <a href="#mon-ngon">Khám phá món</a>
            <Link href="/dishes">Món ăn</Link>
            <Link href="/restaurants">Quán ăn</Link>
          </nav>
        }
      >
        {user ? (
          <AccountMenu user={user} />
        ) : (
          <>
            <Link
              href="/login"
              prefetch={false}
              className="button button-secondary"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              prefetch={false}
              className="button button-primary site-join"
            >
              Tham gia ANGI <span aria-hidden>↗</span>
            </Link>
          </>
        )}
      </SiteHeader>
      <main id="noi-dung" tabIndex={-1}>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="home-eyebrow">
              <span className="home-dot" /> Người bạn đồng hành ẩm thực của bạn
            </p>
            <h1 id="home-title">
              Ăn <span className="home-underline">đúng gu.</span>
              <br />
              Đi thật đã.
            </h1>
            <p className="home-hero-description">
              Tìm món hợp khẩu vị, rồi biến những bữa ăn thành một lịch trình
              đáng nhớ. Cùng ANGI khám phá Việt Nam theo gu của riêng bạn.
            </p>
            <div className="home-hero-actions">
              <a
                href="#goi-y"
                className="button button-primary home-primary-cta"
              >
                Khám phá gu ăn <span aria-hidden>↗</span>
              </a>
              <a
                href="#lich-trinh"
                className="button button-secondary home-secondary-cta"
              >
                Xem roadmap mẫu <span aria-hidden>→</span>
              </a>
            </div>
            <p className="home-guest-note">
              {user
                ? `Bạn đang đăng nhập với tài khoản ${user.displayName}.`
                : "Thử khám phá ngay, chưa cần đăng nhập."}
            </p>
          </div>
          <figure className="home-hero-visual">
            <div className="home-hero-photo">
              <Image
                src="/assets/figma/roll-2.png"
                alt="Bún thịt nướng với rau xanh, đồ chua và lạc rang"
                fill
                sizes="(max-width: 700px) 100vw, 50vw"
                preload
                className="home-hero-image"
              />
            </div>
            <div className="home-hero-inset">
              <Image
                src="/assets/figma/roll-1.png"
                alt="Bánh mì trứng với rau thơm và đồ chua"
                fill
                sizes="(max-width: 700px) 120px, 180px"
              />
            </div>
            <figcaption className="home-hero-caption">
              <span className="home-caption-symbol" aria-hidden>
                ↗
              </span>
              <div>
                <span>Từ một món hợp gu</span>
                <strong>Đến cả hành trình ăn ngon.</strong>
              </div>
            </figcaption>
          </figure>
        </section>
        <nav className="home-path" aria-label="Hành trình cùng ANGI">
          <a href="#goi-y">
            <span>01</span>
            <div>
              <strong>Hiểu gu của bạn</strong>
              <p>Bắt đầu từ khẩu vị riêng.</p>
            </div>
            <span aria-hidden>↗</span>
          </a>
          <a href="#lich-trinh">
            <span>02</span>
            <div>
              <strong>Ghép thành hành trình</strong>
              <p>Mỗi ngày, một bữa đáng nhớ.</p>
            </div>
            <span aria-hidden>↗</span>
          </a>
          <a href="#mon-ngon">
            <span>03</span>
            <div>
              <strong>Khám phá vị Việt</strong>
              <p>Tìm cảm hứng cho chuyến đi.</p>
            </div>
            <span aria-hidden>↗</span>
          </a>
        </nav>
        <HomePreferencePreview signedIn={Boolean(user)} />
        <HomeRoadmapPreview
          signedIn={Boolean(user)}
          planHref={user?.role === "TRAVELER" ? roadmapRoutes.plan : undefined}
        />
        <section
          id="mon-ngon"
          className="home-collection"
          aria-labelledby="collection-title"
        >
          <div className="home-section-heading">
            <div>
              <p className="home-eyebrow">Bộ sưu tập cảm hứng món Việt</p>
              <h2 id="collection-title" tabIndex={-1}>
                Nhìn thôi, đã thấy thèm.
              </h2>
              <p className="home-section-description">
                Một món quen cũng có thể là khởi đầu của một chuyến đi mới.
              </p>
            </div>
            <form action="/#mon-ngon" role="search" className="home-search">
              <label htmlFor="home-food-search">
                Bữa tiếp theo, bạn đang thèm gì?
              </label>
              <div className="home-search-box">
                <Icon name="search" />
                <Input
                  key={selection.query}
                  id="home-food-search"
                  name="q"
                  type="search"
                  defaultValue={selection.query}
                  maxLength={120}
                  placeholder="Phở, bún chả, thanh nhẹ…"
                  aria-describedby="home-search-help"
                />
                {selection.taste !== "all" && (
                  <input type="hidden" name="taste" value={selection.taste} />
                )}
                <Button type="submit" className="home-search-button">
                  Tìm món <span aria-hidden>↗</span>
                </Button>
              </div>
              <p id="home-search-help">
                Tìm trong bộ sưu tập cảm hứng món Việt bên dưới.
              </p>
            </form>
          </div>
          <div className="home-collection-toolbar">
            <nav className="home-filters" aria-label="Lọc món theo khẩu vị">
              {homeTastes.map((taste) => (
                <Link
                  key={taste.value}
                  href={homeSelectionHref({
                    query: selection.query,
                    taste: taste.value,
                  })}
                  prefetch={false}
                  aria-current={
                    selection.taste === taste.value ? "true" : undefined
                  }
                >
                  {taste.label}
                </Link>
              ))}
            </nav>
            <p className="home-result-count" role="status">
              {dishes.length} món gợi cảm hứng
              {selection.query && <> cho “{selection.query}”</>}
            </p>
          </div>
          <HomeDishCollection photos={createDishPhotos(dishes)} />
          {filtered && (
            <div className="home-reset">
              <Link href="/#mon-ngon" prefetch={false}>
                Bỏ bộ lọc, xem tất cả món <span aria-hidden>↗</span>
              </Link>
            </div>
          )}
        </section>
        <section className="home-invitation" aria-labelledby="invitation-title">
          <div>
            <p className="home-eyebrow">Hành trình tiếp theo là của bạn</p>
            <h2 id="invitation-title">
              Gu ăn riêng.
              <br />
              Chuyến đi mang dấu ấn riêng.
            </h2>
            <p>
              Một nơi để khám phá món hợp gu và lên kế hoạch cho những bữa ăn
              đáng nhớ.
            </p>
          </div>
          <div className="home-invitation-actions">
            {user ? (
              <Link
                href="/account"
                prefetch={false}
                className="button button-primary home-primary-cta"
              >
                Quản lý tài khoản <span aria-hidden>↗</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  prefetch={false}
                  className="button button-primary home-primary-cta"
                >
                  Bắt đầu cùng ANGI <span aria-hidden>↗</span>
                </Link>
                <span className="home-invitation-note">
                  Đã có tài khoản?{" "}
                  <Link href="/login" prefetch={false}>
                    Đăng nhập
                  </Link>
                </span>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "#mon-ngon", label: "Khám phá món Việt", anchor: true },
          { href: "/dishes", label: "Tất cả món ăn" },
          { href: "/restaurants", label: "Quán ăn" },
          user
            ? { href: "/account", label: "Tài khoản của tôi" }
            : {
                href: "/login",
                label: (
                  <>
                    Dành cho chủ nhà hàng <span aria-hidden>↗</span>
                  </>
                ),
              },
        ]}
      />
    </div>
  );
}
