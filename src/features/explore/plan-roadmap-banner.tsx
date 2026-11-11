"use client";
import Link from "next/link";
import { ArrowRightIcon, MapPinIcon } from "@heroicons/react/20/solid";
import { Media } from "@/components/ui/primitives";
import { roadmapRoutes } from "@/features/roadmaps/routes";
import "./plan-roadmap-banner.css";

/** Who sees the banner: a Traveler plans at once, a guest is invited to join; other roles never see it. */
export type PlanBannerAudience = "traveler" | "guest";

/** One meal of the illustrated day, each a real dish photo of the app. */
const stops = [
  { meal: "Sáng", dish: "Phở bò", image: "/assets/figma/roll-0.png" },
  { meal: "Trưa", dish: "Cơm tấm", image: "/assets/figma/roll-3.png" },
  { meal: "Tối", dish: "Bún chả", image: "/assets/figma/dish-2.png" },
] as const;

/**
 * Promotional banner on the explore pages (above the breadcrumb): invites the visitor to plan a
 * food roadmap. Always shown to its audience (no close button). The picture is a small itinerary:
 * three meals of one day joined by a dashed route.
 */
export function PlanRoadmapBanner({
  audience,
}: {
  audience: PlanBannerAudience;
}) {
  const traveler = audience === "traveler";
  return (
    <section className="plan-banner" aria-labelledby="plan-banner-title">
      <div className="plan-banner-text">
        <h2 id="plan-banner-title">Lên lịch ăn cho cả chuyến đi</h2>
        <p className="plan-banner-copy">
          Chọn nơi bạn sẽ đến, ANGI xếp sẵn món cho từng bữa sáng, trưa, tối
          theo khẩu vị và ngân sách của bạn.
        </p>
        <div className="plan-banner-actions">
          <Link
            className="button button-primary plan-banner-cta"
            href={traveler ? roadmapRoutes.plan : "/register"}
          >
            {traveler ? "Lập lộ trình ngay" : "Tham gia để lập lộ trình"}
            <ArrowRightIcon aria-hidden />
          </Link>
          <span className="plan-banner-note">
            {traveler
              ? "Miễn phí · chỉ mất 1 phút"
              : "Miễn phí · tạo tài khoản nhanh"}
          </span>
        </div>
      </div>

      <div className="plan-banner-art" aria-hidden>
        {/* A faint city map under the route: streets, a lake and a park in the theme's colours. */}
        <svg
          className="plan-banner-map"
          viewBox="0 0 400 200"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            className="plan-banner-map-lake"
            d="M250 128c18-14 52-16 70-4 16 11 12 32-6 41-22 11-58 9-72-6-10-11-4-23 8-31z"
          />
          <path
            className="plan-banner-map-park"
            d="M36 22c24-12 66-10 84 4 14 11 6 30-14 36-28 9-66 5-78-10-8-10-5-23 8-30z"
          />
          <g className="plan-banner-map-streets">
            <path d="M-10 92 L410 70" />
            <path d="M-10 170 L410 150" />
            <path d="M120 -10 L150 210" />
            <path d="M286 -10 L262 210" />
          </g>
          <g className="plan-banner-map-lanes">
            <path d="M-10 40 L410 26" />
            <path d="M60 -10 L78 210" />
            <path d="M200 -10 L212 210" />
            <path d="M350 -10 L340 210" />
          </g>
        </svg>
        <svg
          className="plan-banner-route"
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
        >
          <path d="M40 150 C 110 150, 120 50, 200 60 S 300 160, 360 70" />
        </svg>
        <span className="plan-banner-day">Ngày 1</span>
        {stops.map((stop, index) => (
          <figure
            key={stop.meal}
            className={`plan-banner-stop is-stop-${index + 1}`}
          >
            <Media className="plan-banner-photo" src={stop.image} alt="" />
            <figcaption>
              <strong>{stop.meal}</strong>
              {stop.dish}
            </figcaption>
          </figure>
        ))}
        <MapPinIcon className="plan-banner-pin" />
        {/* What ANGI works out for a day: meals, distance and spend (the three dishes above). */}
        <span className="plan-banner-summary">3 bữa · 2,4 km · 155.000 ₫</span>
      </div>
    </section>
  );
}
