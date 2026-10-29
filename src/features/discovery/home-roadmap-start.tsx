import Image from "next/image";
import type { RoleCode } from "@/features/auth/types";
import { HomeQuickStart } from "./home-quick-start";
import "./home-roadmap-start.css";

/** Main homepage entry: a real RM-01 plan, distinct from the editorial roadmap example below. */
export function HomeRoadmapStart({ role }: { role: RoleCode | null }) {
  return (
    <section
      id="tao-lo-trinh"
      className="home-roadmap-start"
      aria-labelledby="home-planner-title"
    >
      <div className="home-quick-intro">
        <div className="home-quick-copy">
          <p className="home-eyebrow">
            <span className="home-dot" /> Chuyến đi của bạn · Hương vị của bạn
          </p>
          <h1 id="home-planner-title">
            Chuyến đi ngon,
            <br />
            <span>bắt đầu từ đây.</span>
          </h1>
          <p>
            Một điểm đến. Vài ngày thảnh thơi.
            <br />
            Lên lịch cho những bữa ăn đáng nhớ cùng ANGI.
          </p>
        </div>
        <div className="home-quick-photo">
          <Image
            src="/assets/figma/roll-0.png"
            alt="Phở bò với rau thơm, chanh và ớt cho hành trình khám phá món Việt"
            fill
            sizes="(max-width: 700px) 100vw, 48vw"
            preload
          />
          <span>Đi theo gu. Ăn theo cách của bạn.</span>
        </div>
      </div>
      <HomeQuickStart role={role} />
    </section>
  );
}
