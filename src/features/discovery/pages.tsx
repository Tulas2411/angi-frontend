"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  EmptyState,
  Field,
  Tabs,
  Pagination,
  Dialog,
  SelectField,
  TextArea,
} from "@/components/ui/primitives";
import {
  BlogCard,
  DishCard,
  RestaurantCard,
  ReviewContent,
  RestaurantStatuses,
  verificationLabels,
} from "@/components/domain/cards";
import { usePlatform } from "@/features/platform/provider";
import { useWorkspace, PageHeading } from "@/components/layout/workspace";
import { Media } from "@/components/ui/primitives";
import { money } from "@/features/platform/rules";
import { pageSlice } from "@/features/platform/rules";
import { ProvinceField } from "@/components/domain/province-field";
import { matchesRestaurantLocation } from "@/shared/locations/restaurant-search";
import { RestaurantMapButton } from "@/components/domain/mapbox-preview";
import { dishBrowseService } from "@/api/services/dish-browse-service";
import { dishDetailService } from "@/api/services/dish-detail-service";
import { restaurantDetailService } from "@/api/services/restaurant-detail-service";

export function DiscoveryPage() {
  const { data } = usePlatform(),
    { base, user } = useWorkspace();
  return (
    <>
      <section className="section-band">
        <div className="container stack home-intro">
          <PageHeading
            title={
              user
                ? `Chào ${user.displayName.split(" ")[0]}, tiếp tục hành trình ăn ngon nhé.`
                : "Ăn gì hôm nay? Đi đâu cũng có món hợp bạn."
            }
            description="Tìm món hợp khẩu vị, chọn quán và sắp xếp lịch ăn theo cách của bạn."
          />
          {user && data.trips.length > 0 && (
            <Card className="soft" title="Lịch đang dùng · Hà Nội">
              <div className="between">
                <p>
                  {data.trips[0].name} · {data.trips[0].days.length} ngày
                </p>
                <ActionLink href={`${base}/roadmaps/${data.trips[0].id}`}>
                  Mở lịch ăn
                </ActionLink>
              </div>
            </Card>
          )}
          <div className="grid-2">
            <Card className="feature-card elevated" title="Gợi ý bữa ăn">
              <p>
                Chưa biết ăn gì? Chọn khu vực, ngân sách và khẩu vị để nhận một
                bữa ăn phù hợp.
              </p>
              <ActionLink href={user ? `${base}/roll` : "/login"}>
                Tìm bữa ăn cho tôi
              </ActionLink>
            </Card>
            <Card
              className="feature-card elevated"
              title="Lên lịch ăn cho chuyến đi"
            >
              <p>
                Khám phá đặc sản và tổ chức các bữa theo ngày, món ăn và quán
                phục vụ.
              </p>
              <ActionLink href={user ? `${base}/roadmaps/new` : "/login"}>
                Tạo lịch ăn
              </ActionLink>
            </Card>
          </div>
          <div className="grid-3 home-steps">
            {[
              ["01 · Chọn nhu cầu", "Một bữa ăn hoặc lịch ăn nhiều ngày."],
              ["02 · Nhận gợi ý", "Món phù hợp và quán phục vụ."],
              [
                "03 · Lưu và trải nghiệm",
                "Điều chỉnh lịch, đi ăn và phản hồi.",
              ],
            ].map(([title, copy]) => (
              <Card key={title} className="control" title={title}>
                <p>{copy}</p>
              </Card>
            ))}
          </div>
          <Card className="home-banner">
            <div className="grid-2">
              <div className="stack-sm">
                <h2>Khám phá hương vị Hà Nội</h2>
                <p>Xem món, quán và cẩm nang trước khi đưa vào lịch ăn.</p>
                <div className="actions">
                  <ActionLink href={`${base}/restaurants`} secondary>
                    Khám phá món & quán
                  </ActionLink>
                  <ActionLink href={`${base}/guides`} secondary>
                    Mở cẩm nang ẩm thực
                  </ActionLink>
                </div>
              </div>
              <Media src="/assets/figma/coffee.png" alt="Cà phê trứng Hà Nội" />
            </div>
          </Card>
        </div>
      </section>
      <section className="section-band white">
        <div className="container">
          <div className="section-heading">
            <h2>Món Thịnh Hành</h2>
            <p>Những món được yêu thích từ cộng đồng ANGI · Dữ liệu minh họa</p>
          </div>
          <div className="grid-3">
            {data.dishes
              .filter((d) => d.moderation === "visible")
              .slice(0, 3)
              .map((d) => (
                <DishCard
                  dish={d}
                  href={`${base}/restaurants/${d.restaurantId}`}
                  key={d.id}
                />
              ))}
          </div>
        </div>
      </section>
      <section className="section-band">
        <div className="container">
          <div className="section-heading">
            <h2>Quán Nổi Bật</h2>
            <p>Khám phá những quán ăn được yêu thích quanh bạn.</p>
          </div>
          <div className="grid-3">
            {data.restaurants
              .filter((r) => r.moderation === "visible")
              .map((r) => (
                <RestaurantCard
                  restaurant={r}
                  href={`${base}/restaurants/${r.id}`}
                  key={r.id}
                />
              ))}
          </div>
          <div className="home-trip-cta">
            <Card
              className="elevated feature-card"
              title={
                user && data.trips.length
                  ? "Lên lịch cho hành trình tiếp theo"
                  : "Lịch ăn của bạn còn trống"
              }
            >
              <p>Bắt đầu lên lịch ăn theo ngày, chọn món và quán phục vụ.</p>
              <ActionLink href={user ? `${base}/roadmaps/new` : "/login"}>
                Tạo lịch ăn
              </ActionLink>
            </Card>
          </div>
        </div>
      </section>
      <section className="section-band white">
        <div className="container">
          <div className="section-heading">
            <h2>Cẩm Nang Ẩm Thực</h2>
            <p>
              Câu chuyện ăn ngon, kinh nghiệm chọn quán và lịch ăn từ cộng đồng.
            </p>
          </div>
          <div className="grid-3">
            {data.blogs
              .filter((b) => b.moderation === "visible")
              .slice(0, 3)
              .map((b) => (
                <BlogCard blog={b} href={`${base}/guides/${b.id}`} key={b.id} />
              ))}
          </div>
          <div className="home-quick-actions actions">
            <ActionLink
              href={user ? `${base}/preferences` : "/login"}
              secondary
            >
              Hồ sơ khẩu vị
            </ActionLink>
            <ActionLink href={user ? `${base}/roll` : "/login"}>
              Gợi ý bữa ăn
            </ActionLink>
            <ActionLink
              href={user ? `${base}/roadmaps/new` : "/login"}
              secondary
            >
              Lịch ăn
            </ActionLink>
          </div>
          <Alert tone="warning">
            Xác nhận thành phần với quán. Thông tin nguyên liệu có thể thay đổi.
            Nếu có dị ứng, hãy hỏi quán trước khi ăn.
          </Alert>
        </div>
      </section>
    </>
  );
}
export function DiscoveryList({ kind }: { kind: "restaurants" | "dishes" }) {
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  return (
    <DiscoveryResults
      key={`${kind}:${query}`}
      kind={kind}
      initialQuery={query}
    />
  );
}
function DiscoveryResults({
  kind,
  initialQuery,
}: {
  kind: "restaurants" | "dishes";
  initialQuery: string;
}) {
  const { data } = usePlatform(),
    { base } = useWorkspace(),
    [search, setSearch] = useState(initialQuery),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1);
  // F-12: gọi BE song song (fire-and-forget) mỗi khi search/filter thay đổi.
  useEffect(() => {
    if (kind !== "dishes") return;
    const handle = window.setTimeout(() => {
      void dishBrowseService.browse({
        q: search || undefined,
        maxPrice: filter === "budget" ? 50000 : undefined,
        limit: 24,
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [kind, search, filter]);
  const dishes = data.dishes.filter(
    (d) =>
      d.moderation === "visible" &&
      d.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")) &&
      (filter !== "budget" || d.price <= 50000),
  );
  const restaurants = data.restaurants.filter(
    (r) =>
      r.moderation === "visible" &&
      matchesRestaurantLocation(r, search) &&
      (filter !== "verified" || r.verification === "verified"),
  );
  return (
    <div className="container workspace stack">
      <PageHeading
        title={kind === "dishes" ? "Khám phá món ngon" : "Khám phá quán ăn"}
        description="Tìm hương vị cho bữa ăn tiếp theo · Dữ liệu minh họa"
      />
      {kind === "restaurants" ? (
        <ProvinceField
          label="Tìm theo tên quán hoặc địa điểm"
          type="search"
          value={search}
          autoComplete="off"
          helper="Nhập tên quán, địa chỉ hoặc chọn tỉnh/thành từ gợi ý."
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      ) : (
        <Field
          label="Tìm món ăn"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      )}
      <Tabs
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        items={[
          { value: "all", label: "Tất cả" },
          {
            value: kind === "dishes" ? "budget" : "verified",
            label: kind === "dishes" ? "Dưới 50.000₫" : "Đã xác minh",
          },
        ]}
      />
      <div className="actions">
        <RestaurantMapButton
          locations={
            kind === "restaurants"
              ? restaurants
              : data.restaurants.filter(
                  (restaurant) =>
                    restaurant.moderation === "visible" &&
                    dishes.some((dish) => dish.restaurantId === restaurant.id),
                )
          }
        />
      </div>
      <div className="grid-3">
        {kind === "dishes"
          ? pageSlice(dishes, page, 6).items.map((d) => (
              <DishCard
                key={d.id}
                dish={d}
                href={`${base}/restaurants/${d.restaurantId}`}
                isDetailPage={true}
              />
            ))
          : pageSlice(restaurants, page, 6).items.map((r) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                href={`${base}/restaurants/${r.id}`}
              />
            ))}
      </div>
      {(kind === "dishes" ? dishes : restaurants).length === 0 && (
        <EmptyState title="Không có kết quả">
          Thử từ khóa hoặc bộ lọc khác.
        </EmptyState>
      )}
      <Pagination
        total={kind === "dishes" ? dishes.length : restaurants.length}
        page={page}
        size={6}
        onChange={setPage}
      />
    </div>
  );
}
export function RestaurantDetail({ id }: { id: string }) {
  const { data, mutate, busy } = usePlatform(),
    { base, user } = useWorkspace(),
    [tab, setTab] = useState("menu"),
    [reviewOpen, setReviewOpen] = useState(false),
    [rating, setRating] = useState("5"),
    [text, setText] = useState(""),
    [reportOpen, setReportOpen] = useState(false),
    [reason, setReason] = useState("Sai thông tin");
  // F-16: gọi BE song song (fire-and-forget) để xác nhận endpoint khi user mở chi tiết.
  useEffect(() => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    void restaurantDetailService.getDetail(numericId, { include: "menu,reviews" });
    void restaurantDetailService.getMenu(numericId);
    void restaurantDetailService.getReviews(numericId, { page: 1, pageSize: 20 });
  }, [id]);
  const restaurant = data.restaurants.find(
    (r) => r.id === id && r.moderation === "visible",
  );
  if (!restaurant)
    return (
      <EmptyState
        title="Không tìm thấy nhà hàng"
        action={
          <ActionLink href={`${base}/restaurants`}>Về danh sách</ActionLink>
        }
      />
    );
  const reviews = data.reviews.filter(
      (r) => r.restaurantId === id && r.moderation === "visible",
    ),
    dishes = data.dishes.filter(
      (d) => d.restaurantId === id && d.moderation === "visible",
    );
  return (
    <div className="container workspace stack">
      <PageHeading title={restaurant.name} description={restaurant.address} />
      <Card className="soft">
        <div className="profile-card">
          <Media src={restaurant.image} alt={restaurant.name} />
          <div className="stack-sm">
            <h2>{restaurant.name}</h2>
            <p>{restaurant.description}</p>
            <p>
              {restaurant.rating} / 5 · {reviews.length} đánh giá minh họa
            </p>
            <p>{restaurant.phone}</p>
            <div className="actions">
              <RestaurantMapButton
                locations={[restaurant]}
                highlighted={restaurant}
              />
              {user ? (
                <>
                  <Button onClick={() => setReviewOpen(true)}>
                    Viết đánh giá
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setReportOpen(true)}
                  >
                    Báo cáo thông tin
                  </Button>
                </>
              ) : (
                <ActionLink href="/login">Đăng nhập để đánh giá</ActionLink>
              )}
            </div>
          </div>
        </div>
      </Card>
      <RestaurantStatuses restaurant={restaurant} />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "menu", label: "Thực đơn" },
          { value: "reviews", label: "Đánh giá" },
          { value: "information", label: "Thông tin" },
        ]}
      />
      {tab === "menu" ? (
        <div className="grid-3">
          {dishes.map((d) => (
            <DishCard
              key={d.id}
              dish={d}
              href={`${base}/restaurants/${restaurant.id}`}
              isDetailPage={true}
            />
          ))}
          {dishes.length === 0 && (
            <EmptyState title="Chưa có thực đơn">
              Nhà hàng chưa cung cấp món ăn trong bản minh họa.
            </EmptyState>
          )}
        </div>
      ) : tab === "reviews" ? (
        <Card title={`Đánh giá · ${reviews.length}`}>
          {reviews.map((r) => (
            <article className="review" key={r.id}>
              <ReviewContent review={r} />
            </article>
          ))}
          {!reviews.length && <EmptyState title="Chưa có đánh giá" />}
        </Card>
      ) : (
        <Card title="Thông tin nhà hàng">
          <p>{restaurant.address}</p>
          <p>Điện thoại: {restaurant.phone}</p>
          <p>Giờ kinh doanh minh họa: 07:00–21:00</p>
          <p>
            Tọa độ: {restaurant.latitude}, {restaurant.longitude}
          </p>
          <Alert tone="info">
            Kiểm tra giá, giờ mở cửa và thành phần với quán trước khi đi.
          </Alert>
        </Card>
      )}
      <Dialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Chia sẻ trải nghiệm"
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            await mutate((d) =>
              d.reviews.unshift({
                id: crypto.randomUUID(),
                restaurantId: id,
                author: user!.displayName,
                rating: Number(rating),
                text: text.trim(),
                date: "2026-10-09T12:00:00+07:00",
                moderation: "visible",
              }),
            );
            setReviewOpen(false);
            setText("");
            setTab("reviews");
          }}
        >
          <SelectField
            label="Số sao"
            value={rating}
            onChange={setRating}
            options={[1, 2, 3, 4, 5].map((v) => ({
              value: String(v),
              label: `${v} / 5 sao`,
            }))}
          />
          <TextArea
            label="Đánh giá"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            maxLength={1000}
          />
          <Button type="submit" loading={busy}>
            Đăng đánh giá minh họa
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Báo cáo nhà hàng"
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            await mutate(
              (d) =>
                d.reports.unshift({
                  id: crypto.randomUUID(),
                  target: "restaurant",
                  targetId: id,
                  reporter: user!.displayName,
                  reason,
                  description: text,
                  status: "open",
                  date: "2026-10-09",
                }),
              "Đã nhận báo cáo trong bản minh họa.",
            );
            setReportOpen(false);
            setText("");
          }}
        >
          <SelectField
            label="Lý do"
            value={reason}
            onChange={setReason}
            options={["Sai thông tin", "Vệ sinh", "Nội dung không phù hợp"].map(
              (v) => ({ value: v, label: v }),
            )}
          />
          <TextArea
            label="Thông tin bổ sung"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
          <Button type="submit" loading={busy}>
            Gửi báo cáo
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
export function DishDetail({ id }: { id: string }) {
  const { data, mutate, busy } = usePlatform(),
    { base, user, demo } = useWorkspace(),
    [reportOpen, setReportOpen] = useState(false),
    [reason, setReason] = useState("Sai thông tin"),
    [text, setText] = useState("");
  // F-13: gọi BE song song (fire-and-forget) để xác nhận endpoint khi user mở chi tiết món.
  useEffect(() => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    void dishDetailService.getDetail(numericId);
  }, [id]);
  const visibleDishes = data.dishes.filter((d) => d.id === id),
    dish =
      visibleDishes.find((d) => d.moderation === "visible") || visibleDishes[0];
  if (!dish) {
    if (typeof window !== "undefined") {
      console.warn(
        "[DishDetail] Không tìm thấy dish với id:",
        id,
        "- tổng số dish trong data:",
        data.dishes.length,
        "- demo mode:",
        demo,
      );
    }
    return (
      <EmptyState
        title="Không tìm thấy món ăn"
        action={
          <div className="actions">
            <ActionLink href={`${base}/dishes`}>Về danh sách món</ActionLink>
            <ActionLink href={`${base}/restaurants`} secondary>
              Khám phá quán
            </ActionLink>
          </div>
        }
      >
        Món ăn với mã &quot;{id}&quot; không tồn tại trong dữ liệu hiện tại hoặc
        đã bị gỡ. Bạn có thể quay lại danh sách để chọn món khác.
      </EmptyState>
    );
  }
  const restaurant = data.restaurants.find(
    (r) => r.id === dish.restaurantId && r.moderation === "visible",
  );
  const relatedDishes = data.dishes
    .filter(
      (d) =>
        d.id !== id &&
        d.restaurantId === dish.restaurantId &&
        d.moderation === "visible",
    )
    .slice(0, 3);
  const reviewsForRestaurant = data.reviews.filter(
    (r) => r.restaurantId === dish.restaurantId && r.moderation === "visible",
  );
  const averageRating =
    reviewsForRestaurant.length > 0
      ? reviewsForRestaurant.reduce((s, r) => s + r.rating, 0) /
        reviewsForRestaurant.length
      : 0;
  return (
    <div className="container workspace stack">
      <PageHeading title={dish.name} description={dish.description} />

      {/* HERO: Ảnh + Thông tin tổng quan */}
      <Card className="soft">
        <div className="profile-card">
          <Media src={dish.image} alt={dish.name} className="profile-media" />
          <div className="stack-sm">
            <h2>{dish.name}</h2>
            <p className="helper">{dish.description}</p>
            <p className="price">{money(dish.price)}</p>
            <div className="tags">
              {dish.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
              {dish.kind === "water" && <Badge>Món nước</Badge>}
              {dish.kind === "dry" && <Badge>Món khô</Badge>}
              {dish.kind === "other" && <Badge>Khác</Badge>}
              {dish.serving ? (
                <Badge tone="success">Đang phục vụ</Badge>
              ) : (
                <Badge tone="warning">Tạm hết món</Badge>
              )}
            </div>
            <div className="actions">
              {user ? (
                <Button variant="secondary" onClick={() => setReportOpen(true)}>
                  Báo cáo thông tin
                </Button>
              ) : (
                <ActionLink href="/login">Đăng nhập để báo cáo</ActionLink>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ĐẶC ĐIỂM NỔI BẬT */}
      <Card title="Đặc điểm nổi bật" className="soft">
        <ul className="dish-features">
          <li>
            <strong>Loại món:</strong>{" "}
            {dish.kind === "water"
              ? "Món nước (súp, phở, bún nước...)"
              : dish.kind === "dry"
                ? "Món khô (cơm, bún trộn, gỏi...)"
                : "Món khác (đồ uống, tráng miệng...)"}
          </li>
          <li>
            <strong>Trạng thái phục vụ:</strong>{" "}
            {dish.serving ? "Đang được phục vụ" : "Tạm hết món"}
          </li>
          <li>
            <strong>Giá tham khảo:</strong> {money(dish.price)}
          </li>
          {dish.tags.length > 0 && (
            <li>
              <strong>Phù hợp:</strong> {dish.tags.join(", ")}
            </li>
          )}
          {reviewsForRestaurant.length > 0 && (
            <li>
              <strong>Mức độ yêu thích:</strong> {averageRating.toFixed(1)} / 5
              sao từ {reviewsForRestaurant.length} đánh giá
            </li>
          )}
        </ul>
      </Card>

      {/* THÔNG TIN CHI TIẾT */}
      <Card title="Thông tin chi tiết" className="soft">
        <div className="dish-info-grid">
          <div>
            <p className="helper">Danh mục</p>
            <p>
              {dish.kind === "water"
                ? "Món nước"
                : dish.kind === "dry"
                  ? "Món khô"
                  : "Khác"}
            </p>
          </div>
          <div>
            <p className="helper">Trạng thái</p>
            <p>
              {dish.serving ? (
                <Badge tone="success">Đang phục vụ</Badge>
              ) : (
                <Badge tone="warning">Tạm hết món</Badge>
              )}
            </p>
          </div>
          <div>
            <p className="helper">Giá</p>
            <p>
              <strong>{money(dish.price)}</strong>
            </p>
          </div>
          <div>
            <p className="helper">Đánh giá</p>
            <p>
              {reviewsForRestaurant.length > 0
                ? `${averageRating.toFixed(1)} / 5 (${reviewsForRestaurant.length})`
                : "Chưa có"}
            </p>
          </div>
          <div>
            <p className="helper">Mã món</p>
            <p>
              <code>{dish.id}</code>
            </p>
          </div>
          <div>
            <p className="helper">Cập nhật</p>
            <p>Đang phục vụ hôm nay</p>
          </div>
        </div>
      </Card>

      {/* NHÀ HÀNG PHỤC VỤ */}
      {restaurant && (
        <Card title="Nhà hàng phục vụ món này" className="soft">
          <div className="profile-card">
            <Media
              src={restaurant.image}
              alt={restaurant.name}
              className="profile-media"
            />
            <div className="stack-sm">
              <h3>{restaurant.name}</h3>
              <div className="tags">
                <Badge
                  tone={
                    restaurant.verification === "verified"
                      ? "success"
                      : "warning"
                  }
                >
                  {verificationLabels[restaurant.verification]}
                </Badge>
                <Badge
                  tone={restaurant.operating === "open" ? "success" : "warning"}
                >
                  {restaurant.operating === "open"
                    ? "Đang mở cửa"
                    : "Đang đóng cửa"}
                </Badge>
                <Badge>{restaurant.rating} / 5 sao</Badge>
              </div>
              <p className="helper">
                📍{" "}
                {[
                  restaurant.address,
                  restaurant.ward || restaurant.district,
                  restaurant.province,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="helper">
                📞 {restaurant.phone} · ✉️ {restaurant.email}
              </p>
              {restaurant.website && (
                <p className="helper">🌐 {restaurant.website}</p>
              )}
              <p>{restaurant.description}</p>
              <div className="actions">
                <RestaurantMapButton
                  locations={[restaurant]}
                  highlighted={restaurant}
                />
                <ActionLink
                  href={`${base}/restaurants/${restaurant.id}`}
                  secondary
                >
                  Xem chi tiết nhà hàng
                </ActionLink>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* THÔNG TIN LIÊN QUAN: Món cùng quán + Món cùng loại */}
      <Card title="Thông tin liên quan" className="soft">
        <div className="stack">
          {relatedDishes.length > 0 && (
            <div className="stack-sm">
              <h4>Món khác tại {restaurant ? restaurant.name : "quán này"}</h4>
              <div className="grid-3">
                {relatedDishes.map((d) => (
                  <DishCard
                    key={d.id}
                    dish={d}
                    href={`${base}/restaurants/${d.restaurantId}`}
                    isDetailPage={true}
                  />
                ))}
              </div>
            </div>
          )}
          {(() => {
            const sameKind = data.dishes
              .filter(
                (d) =>
                  d.id !== id &&
                  d.kind === dish.kind &&
                  d.moderation === "visible",
              )
              .slice(0, 3);
            if (sameKind.length === 0) return null;
            return (
              <div className="stack-sm">
                <h4>
                  Món cùng loại (
                  {dish.kind === "water"
                    ? "món nước"
                    : dish.kind === "dry"
                      ? "món khô"
                      : "khác"}
                  )
                </h4>
                <div className="grid-3">
                  {sameKind.map((d) => (
                    <DishCard
                      key={d.id}
                      dish={d}
                      href={`${base}/restaurants/${d.restaurantId}`}
                      isDetailPage={true}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </Card>

      {/* ĐÁNH GIÁ */}
      {reviewsForRestaurant.length > 0 && (
        <Card
          title={`Đánh giá từ thực khách (${reviewsForRestaurant.length})`}
          className="soft"
        >
          <div className="stack">
            {reviewsForRestaurant.slice(0, 3).map((r) => (
              <div key={r.id} className="review-row">
                <ReviewContent review={r} />
              </div>
            ))}
          </div>
        </Card>
      )}
      <Dialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Báo cáo món ăn"
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            await mutate(
              (d) =>
                d.reports.unshift({
                  id: crypto.randomUUID(),
                  target: "dish",
                  targetId: id,
                  reporter: user!.displayName,
                  reason,
                  description: text,
                  status: "open",
                  date: new Date().toISOString().slice(0, 10),
                }),
              "Đã nhận báo cáo trong bản minh họa.",
            );
            setReportOpen(false);
            setText("");
          }}
        >
          <SelectField
            label="Lý do"
            value={reason}
            onChange={setReason}
            options={[
              "Sai thông tin",
              "Giá không đúng",
              "Hết nguyên liệu",
              "Nội dung không phù hợp",
            ].map((v) => ({ value: v, label: v }))}
          />
          <TextArea
            label="Thông tin bổ sung"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
          <Button type="submit" loading={busy}>
            Gửi báo cáo
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
