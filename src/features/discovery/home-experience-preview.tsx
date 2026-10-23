"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/shared/ui";
import { homeDishes } from "./home-content";

// These editorial examples do not create a preference profile or call recommendation APIs.
const tasteExamples = [
  {
    key: "rich",
    label: "Đậm đà",
    dish: homeDishes[1],
    reason:
      "Chả nướng thơm, nước chấm chua ngọt. Một ví dụ cho lúc bạn muốn một bữa thật đậm vị.",
  },
  {
    key: "fresh",
    label: "Thanh nhẹ",
    dish: homeDishes[3],
    reason:
      "Rau xanh giòn mát, tôm và bún trong lớp bánh tráng mỏng. Một lựa chọn gợi cảm hứng cho gu thanh nhẹ.",
  },
  {
    key: "warm",
    label: "Ấm bụng",
    dish: homeDishes[0],
    reason:
      "Nước dùng nóng thơm và bánh phở mềm. Một gợi ý minh họa cho những lúc bạn thèm một bát ăn ấm lòng.",
  },
] as const;

export function HomePreferencePreview({
  signedIn = false,
}: {
  signedIn?: boolean;
}) {
  const [taste, setTaste] =
    useState<(typeof tasteExamples)[number]["key"]>("rich");
  const example =
    tasteExamples.find((item) => item.key === taste) ?? tasteExamples[0];
  return (
    <section
      id="goi-y"
      className="home-preferences"
      aria-labelledby="preference-title"
    >
      <div className="home-preference-copy">
        <p className="home-eyebrow">
          <span className="home-feature-number">01</span> Gợi ý cá nhân hóa
        </p>
        <h2 id="preference-title">
          Vị ngon bắt đầu
          <br />
          từ <span className="home-underline">gu của bạn.</span>
        </h2>
        <p>
          Thích đậm đà, mê món nước hay muốn một bữa thanh nhẹ? Khẩu vị riêng là
          điểm bắt đầu để ANGI gợi ý món ăn cho bạn.
        </p>
        <fieldset
          className="home-taste-picker"
          aria-describedby="taste-preview-note"
        >
          <legend>Hôm nay, bạn nghiêng về gu nào?</legend>
          <div>
            {tasteExamples.map((item) => (
              <Button
                key={item.key}
                variant="secondary"
                aria-pressed={taste === item.key}
                onClick={() => setTaste(item.key)}
              >
                {item.label}
                <span aria-hidden>{taste === item.key ? "✓" : "+"}</span>
              </Button>
            ))}
          </div>
        </fieldset>
        <p id="taste-preview-note" className="home-preview-note">
          Giới thiệu tính năng đang được phát triển: thử chọn gu để xem ví dụ
          minh họa. Lựa chọn này không được lưu vào hồ sơ.
        </p>
        {!signedIn && (
          <Link href="/register" prefetch={false} className="home-text-link">
            Tham gia ANGI <span aria-hidden>↗</span>
          </Link>
        )}
      </div>
      <div className="home-taste-example" aria-live="polite" aria-atomic="true">
        <div className="home-taste-photo">
          <Image
            key={example.key}
            src={example.dish.image}
            alt={example.dish.imageAlt}
            fill
            sizes="(max-width: 700px) 100vw, 50vw"
          />
          <span>Thử gu · {example.label}</span>
        </div>
        <div className="home-taste-caption">
          <div>
            <p className="home-origin">
              Ví dụ theo khẩu vị {example.label.toLocaleLowerCase("vi")}
            </p>
            <h3>{example.dish.name}</h3>
          </div>
          <span className="home-preview-badge">Minh họa</span>
          <p>{example.reason}</p>
        </div>
      </div>
    </section>
  );
}

interface PreviewStop {
  time: string;
  meal: string;
  name: string;
  image: string;
  imageAlt: string;
  note: string;
}

/** Meal ideas only: no invented restaurant, map coordinates, distance or route optimization. */
const roadmapDays: readonly {
  label: string;
  theme: string;
  stops: readonly PreviewStop[];
}[] = [
  {
    label: "Ngày 1",
    theme: "Một ngày với những vị quen",
    stops: [
      {
        time: "08:00",
        meal: "Bữa sáng",
        name: "Phở bò",
        image: "/assets/figma/roll-0.png",
        imageAlt: "Bát phở bò với hành xanh, chanh và ớt",
        note: "Bắt đầu chậm rãi với một bát phở nóng thơm.",
      },
      {
        time: "12:00",
        meal: "Bữa trưa",
        name: "Bún chả",
        image: "/assets/figma/dish-2.png",
        imageAlt: "Bún chả với chả nướng, nước chấm và rau sống",
        note: "Dành bữa trưa cho hương chả nướng và rau thơm.",
      },
      {
        time: "15:30",
        meal: "Nghỉ chiều",
        name: "Trà sen",
        image: "/assets/figma/dish-4.png",
        imageAlt: "Chén trà bên hoa sen trên bàn gỗ",
        note: "Một khoảng nghỉ để nhâm nhi và kể chuyện chuyến đi.",
      },
    ],
  },
  {
    label: "Ngày 2",
    theme: "Thêm vài hương vị để nhớ",
    stops: [
      {
        time: "08:30",
        meal: "Bữa sáng",
        name: "Bánh cuốn",
        image: "/assets/figma/roll-4.png",
        imageAlt: "Bánh cuốn nhân thịt với hành phi, rau thơm và chả",
        note: "Một đĩa bánh cuốn mềm, thơm hành phi cho buổi sáng.",
      },
      {
        time: "12:30",
        meal: "Bữa trưa",
        name: "Bánh mì trứng",
        image: "/assets/figma/roll-1.png",
        imageAlt: "Bánh mì trứng với rau thơm và đồ chua",
        note: "Gói gọn một bữa ngon trong chiếc bánh mì giòn.",
      },
      {
        time: "18:00",
        meal: "Bữa tối",
        name: "Gỏi cuốn tôm",
        image: "/assets/figma/dish-3.png",
        imageAlt: "Gỏi cuốn tôm với rau xanh và bát nước chấm",
        note: "Khép lại ngày bằng những cuốn tươi mát, nhẹ nhàng.",
      },
    ],
  },
];

export function HomeRoadmapPreview({
  signedIn = false,
}: {
  signedIn?: boolean;
}) {
  const [dayIndex, setDayIndex] = useState(0);
  const [stopIndex, setStopIndex] = useState(0);
  const day = roadmapDays[dayIndex];
  const stop = day.stops[stopIndex];
  return (
    <section
      id="lich-trinh"
      className="home-roadmap"
      aria-labelledby="roadmap-title"
    >
      <div className="home-section-heading">
        <div>
          <p className="home-eyebrow">
            <span className="home-feature-number">02</span> Roadmap ẩm thực
          </p>
          <h2 id="roadmap-title">
            Từ món muốn thử,
            <br />
            đến chuyến đi muốn nhớ.
          </h2>
        </div>
        <div className="home-roadmap-intro">
          <p>
            Sắp xếp các bữa theo ngày, chọn giờ và điều chỉnh ngân sách. Một
            lịch trình ăn uống để bạn chủ động tận hưởng chuyến đi.
          </p>
          {!signedIn && (
            <Link href="/register" prefetch={false} className="home-text-link">
              Tham gia ANGI <span aria-hidden>↗</span>
            </Link>
          )}
        </div>
      </div>
      <div className="home-roadmap-board">
        <div className="home-roadmap-plan">
          <div className="home-roadmap-plan-heading">
            <div>
              <p className="home-origin">Một cuối tuần ở Hà Nội</p>
              <h3>Đi một vòng, ăn thật ngon.</h3>
            </div>
            <span className="home-preview-badge">Lịch trình mẫu</span>
          </div>
          <div
            className="home-day-picker"
            role="group"
            aria-label="Chọn ngày trong lịch trình mẫu"
          >
            {roadmapDays.map((item, index) => (
              <Button
                key={item.label}
                variant="secondary"
                aria-pressed={dayIndex === index}
                onClick={() => {
                  setDayIndex(index);
                  setStopIndex(0);
                }}
              >
                {item.label}
              </Button>
            ))}
            <span>2 ngày · 3 điểm dừng mỗi ngày</span>
          </div>
          <p className="home-roadmap-theme" role="status">
            {day.theme}
          </p>
          <ol
            className="home-roadmap-stops"
            aria-label={`${day.label} · Các bữa ăn mẫu`}
          >
            {day.stops.map((item, index) => (
              <li key={`${dayIndex}-${item.time}`}>
                <span className="home-stop-number" aria-hidden>
                  {index + 1}
                </span>
                <Button
                  variant="tertiary"
                  aria-pressed={stopIndex === index}
                  onClick={() => setStopIndex(index)}
                >
                  <span className="home-stop-time">
                    {item.time}
                    <small>{item.meal}</small>
                  </span>
                  <span className="home-stop-name">{item.name}</span>
                  <span aria-hidden>↗</span>
                </Button>
              </li>
            ))}
          </ol>
          <p className="home-preview-note">
            Giới thiệu tính năng đang được phát triển: chọn ngày và từng bữa để
            xem thử. Lịch trình minh họa, không được lưu.
          </p>
        </div>
        <figure
          className="home-roadmap-photo"
          aria-live="polite"
          aria-atomic="true"
        >
          <Image
            key={`${dayIndex}-${stopIndex}`}
            src={stop.image}
            alt={stop.imageAlt}
            fill
            sizes="(max-width: 700px) 100vw, 50vw"
          />
          <figcaption>
            <span>
              {day.label} · {stop.time} · {stop.meal}
            </span>
            <strong>{stop.name}</strong>
            <p>{stop.note}</p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
