import type { Review } from "@/features/platform/contracts";

/**
 * Dữ liệu minh họa cho trang "Lắng nghe thực khách" của chủ nhà hàng.
 *
 * Nhà hàng `bep-nha` khớp `ownerRestaurantId` trong `fixtures.ts`. Bộ dữ liệu
 * cố tình phủ đủ các trạng thái để xem giao diện: đủ 5 mức sao, đánh giá có
 * và không có ảnh, đã phản hồi và chưa phản hồi, cùng một đánh giá bị ẩn.
 */

const asset = (name: string) => `/assets/figma/${name}`;

/** Ngày giảm dần từ mốc cố định để thứ tự hiển thị luôn ổn định. */
const anchor = Date.parse("2026-10-20T09:00:00+07:00");
const daysAgo = (days: number) =>
  new Date(anchor - days * 86_400_000).toISOString();

export interface OwnerReviewSeed extends Review {
  /** Ảnh thực khách đính kèm. Rỗng khi đánh giá không có ảnh. */
  images: string[];
  /** Số lượt thích từ cộng đồng, chỉ mang tính minh họa. */
  likes: number;
  /** Có phải đánh giá mà nhà hàng đã phản hồi hay chưa. */
  visitedFrom: string;
  /**
   * Phản hồi mới sẽ chờ người kiểm duyệt của ANGI duyệt. `Review.replyModeration`
   * chỉ có ba giá trị kiểm duyệt nên phần chờ dùng `hidden`; cờ `replyPending`
   * cho biết đó là hàng chờ chứ không phải phản hồi đã bị ẩn.
   */
  replyPending?: boolean;
}

export const ownerReviewsSeed: OwnerReviewSeed[] = [
  {
    id: "review-01",
    restaurantId: "bep-nha",
    author: "Mai Anh",
    rating: 5,
    text: "Phở bò nóng, nước dùng thanh và nhân viên rất dễ thương. Mình sẽ quay lại cùng gia đình.",
    date: daysAgo(2),
    moderation: "visible",
    images: [asset("food-inspiration.png")],
    likes: 24,
    visitedFrom: "2026-09-28",
    reply:
      "Cảm ơn chị Mai Anh đã ghé quán! Dây là lời cảm ơn chân thành từ đội ngũ Bếp Nhà, hẹn gặp lại bạn.",
    replyModeration: "visible",
  },
  {
    id: "review-02",
    restaurantId: "bep-nha",
    author: "Quang Bình",
    rating: 4,
    text: "Phở ngon, phục vụ nhanh. Tuy nhiên chỗ ngồi hơi chật vào giờ cao điểm.",
    date: daysAgo(5),
    moderation: "visible",
    images: [],
    likes: 11,
    visitedFrom: "2026-09-30",
    reply:
      "Cảm ơn anh Quang Bình! Chúng tôi sẽ sắp xếp lại khu vực chờ để mọi người thoải mái hơn vào giờ cao điểm.",
    replyModeration: "visible",
  },
  {
    id: "review-03",
    restaurantId: "bep-nha",
    author: "Thảo Nguyễn",
    rating: 3,
    text: "Món ăn bình thường, giá hơi cao so với chất lượng. Sẽ cân nhắc lần sau.",
    date: daysAgo(8),
    moderation: "visible",
    images: [],
    likes: 6,
    visitedFrom: "2026-10-02",
  },
  {
    id: "review-04",
    restaurantId: "bep-nha",
    author: "Hùng Lê",
    rating: 5,
    text: "Bún bò Huế đúng vị, cay vừa phải. Nhà vệ sinh sạch sẽ, quán thoáng.",
    date: daysAgo(11),
    moderation: "visible",
    images: [asset("guide-cover.png")],
    likes: 31,
    visitedFrom: "2026-09-25",
    reply:
      "Cảm ơn anh Hùng Lê đã góp ý. Bếp Nhà đã bổ sung thêm nhân viên ca tối và rất mong bạn ghé lại.",
    replyModeration: "visible",
  },
  {
    id: "review-05",
    restaurantId: "bep-nha",
    author: "Linh Trần",
    rating: 2,
    text: "Mình đến 19h nhưng phải chờ 20 phút do thiếu nhân viên. Món nguội khi ra bàn.",
    date: daysAgo(14),
    moderation: "visible",
    images: [],
    likes: 9,
    visitedFrom: "2026-10-01",
    reply:
      "Cảm ơn chị Linh Trần đã phản hồi. Bếp Nhà đang cải thiện quy trình phục vụ vào giờ cao điểm.",
    replyModeration: "visible",
  },
  {
    id: "review-06",
    restaurantId: "bep-nha",
    author: "Gia Minh",
    rating: 4,
    text: "Gỏi vịt lá é rất đúng ý. Quán có thể ngồi trước hiếm, mình ngồi trong xe.",
    date: daysAgo(17),
    moderation: "visible",
    images: [],
    likes: 14,
    visitedFrom: "2026-09-21",
    reply:
      "Xin cảm ơn anh Gia Minh, chúng tôi rất vui khi bạn chọn ngồi ngoài trời vào buổi tối.",
    replyModeration: "visible",
  },
  {
    id: "review-07",
    restaurantId: "bep-nha",
    author: "Linh Chi",
    rating: 5,
    text: "Bánh xèo giòn, nước chấm chuẩn vị miền Nam. Chắc chắn sẽ ghé lại.",
    date: daysAgo(20),
    moderation: "visible",
    images: [asset("coffee.png")],
    likes: 27,
    visitedFrom: "2026-09-14",
  },
  {
    id: "review-08",
    restaurantId: "bep-nha",
    author: "Hoàng Long",
    rating: 1,
    text: "Phục vụ chậm và thiếu thái độ. Mình không khuyến nghị cho nhóm đông.",
    date: daysAgo(24),
    moderation: "visible",
    images: [],
    likes: 4,
    visitedFrom: "2026-09-10",
  },
  {
    id: "review-09",
    restaurantId: "bep-nha",
    author: "Mai Anh",
    rating: 4,
    text: "Quán ổn, giá hợp lý. Nhân viên nhiệt tình, phòng chờ thoáng.",
    date: daysAgo(28),
    moderation: "visible",
    images: [],
    likes: 8,
    visitedFrom: "2026-09-02",
  },
  {
    id: "review-10",
    restaurantId: "bep-nha",
    author: "Quang Bình",
    rating: 5,
    text: "Nước dùng ngọt thanh, thịt bò mềm. Kinh nghiệm 30 năm ở Bếp Nhà hiện rõ.",
    date: daysAgo(32),
    moderation: "visible",
    images: [],
    likes: 19,
    visitedFrom: "2026-08-25",
  },
  {
    id: "review-11",
    restaurantId: "bep-nha",
    author: "Thảo Nguyễn",
    rating: 2,
    text: "Bún bò Huế hơi mặn so với khẩu vị của mình. Nhân viên vẫn vui vẻ hỗ trợ.",
    date: daysAgo(36),
    moderation: "hidden",
    images: [],
    likes: 2,
    visitedFrom: "2026-08-20",
  },
  {
    id: "review-12",
    restaurantId: "bep-nha",
    author: "Hùng Lê",
    rating: 5,
    text: "Một trong những quán phở mình thích nhất Sài Gòn. Phở gà không mỡ, nước dùng trong.",
    date: daysAgo(40),
    moderation: "visible",
    images: [],
    likes: 22,
    visitedFrom: "2026-08-12",
  },
  {
    id: "review-13",
    restaurantId: "bep-nha",
    author: "Linh Trần",
    rating: 3,
    text: "Gỏi vịt ổn, chỗ ngồi thiếu. Chờ khoảng 10 phút mới có món.",
    date: daysAgo(45),
    moderation: "visible",
    images: [],
    likes: 7,
    visitedFrom: "2026-08-05",
  },
  {
    id: "review-14",
    restaurantId: "bep-nha",
    author: "Gia Minh",
    rating: 4,
    text: "Phở tái nạm gầu đậm đà. Giá 60k hơi cao nhưng chất lượng xứng đáng.",
    date: daysAgo(50),
    moderation: "visible",
    images: [],
    likes: 12,
    visitedFrom: "2026-07-28",
  },
  {
    id: "review-15",
    restaurantId: "bep-nha",
    author: "Hoàng Long",
    rating: 5,
    text: "Đưa bạn bè người Sài Gòn đến ăn đều rất hài lòng. Nhân viên nhớ mặt khách.",
    date: daysAgo(55),
    moderation: "visible",
    images: [],
    likes: 17,
    visitedFrom: "2026-07-18",
  },
];

/** Tổng hợp số liệu dùng cho phần tổng quan đầu trang. */
export interface ReviewSummary {
  total: number;
  visible: number;
  answered: number;
  unanswered: number;
  ratingAvg: number;
  /** Số lượng theo mức sao, khoá từ `"5"` đến `"1"`. */
  breakdown: { rating: number; count: number }[];
}

export function summarizeOwnerReviews(
  reviews: OwnerReviewSeed[],
): ReviewSummary {
  const visible = reviews.filter((review) => review.moderation === "visible");
  const totalRating = visible.reduce((sum, review) => sum + review.rating, 0);
  const answered = visible.filter((review) => !!review.reply).length;
  return {
    total: reviews.length,
    visible: visible.length,
    answered,
    unanswered: visible.length - answered,
    ratingAvg: visible.length
      ? Math.round((totalRating / visible.length) * 10) / 10
      : 0,
    breakdown: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: visible.filter((review) => review.rating === rating).length,
    })),
  };
}