"use client";
import type { ComponentType, SVGProps } from "react";
import {
  ClockIcon,
  InformationCircleIcon,
  MapPinIcon,
  PhoneIcon,
  PhotoIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";
import { Media } from "@/components/ui/primitives";
import { SlidingSegment } from "@/components/ui/sliding-segment";
import { RestaurantStatusBadges } from "./status-labels";
import type { OwnerProfileTab } from "./routes";
import type { OwnerRestaurantDto } from "./restaurant-types";
import "./restaurant-profile.css";

const tabs: {
  value: OwnerProfileTab;
  label: string;
  hint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  {
    value: "information",
    label: "Thông tin",
    hint: "Tên, giới thiệu, liên hệ và địa chỉ khách nhìn thấy.",
    icon: InformationCircleIcon,
  },
  {
    value: "photos",
    label: "Hình ảnh",
    hint: "Ảnh bìa và thư viện ảnh của quán.",
    icon: PhotoIcon,
  },
  {
    value: "hours",
    label: "Giờ mở cửa",
    hint: "Lịch phục vụ trong tuần, theo giờ Việt Nam.",
    icon: ClockIcon,
  },
  {
    value: "status",
    label: "Trạng thái",
    hint: "Mở cửa, tạm đóng hoặc đóng cửa hẳn.",
    icon: SignalIcon,
  },
];

/**
 * The head of every "Nhà hàng của tôi" tab: the restaurant at a glance (cover, name, the three
 * states, address, phone), then the tabs. It stays the same whichever tab is open, so the owner
 * always sees which restaurant and which part of its profile they are on.
 */
export function RestaurantProfileHeader({
  restaurant,
  tab,
  onTab,
}: {
  restaurant: OwnerRestaurantDto;
  tab: OwnerProfileTab;
  onTab: (tab: OwnerProfileTab) => void;
}) {
  const place = [
    restaurant.addressLine,
    restaurant.ward,
    restaurant.provinceName,
  ]
    .filter(Boolean)
    .join(", ");
  const current = tabs.find((item) => item.value === tab) ?? tabs[0];
  return (
    <div className="rp-head">
      <header className="rp-hero">
        <Media
          className="rp-hero-photo"
          src={restaurant.coverUrl ?? undefined}
          alt={restaurant.name}
        />
        <div className="rp-hero-body">
          <p className="rp-eyebrow">Nhà hàng của tôi</p>
          <h1>{restaurant.name}</h1>
          <RestaurantStatusBadges restaurant={restaurant} />
          <p className="rp-hero-facts">
            {place && (
              <span>
                <MapPinIcon aria-hidden /> {place}
              </span>
            )}
            {restaurant.phone && (
              <span>
                <PhoneIcon aria-hidden /> {restaurant.phone}
              </span>
            )}
          </p>
        </div>
      </header>
      <nav className="rp-tabs" aria-label="Phần hồ sơ nhà hàng">
        <SlidingSegment className="rp-tab-group" role="group">
          {tabs.map((item) => {
            const TabIcon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={tab === item.value}
                onClick={() => onTab(item.value)}
              >
                <TabIcon aria-hidden /> {item.label}
              </button>
            );
          })}
        </SlidingSegment>
        <p className="rp-tab-hint">{current.hint}</p>
      </nav>
    </div>
  );
}
