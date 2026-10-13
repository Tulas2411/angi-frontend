import type { AppData, Dish, Trip } from "@/features/platform/contracts";

const asset = (name: string) => `/assets/figma/${name}`;
const dishes: Dish[] = [
  ["pho", "Phở bò", 65000, "water", "Bữa sáng"],
  ["com", "Cơm thịt kho", 75000, "dry", "Bữa trưa"],
  ["bun", "Bún chả", 70000, "dry", "Bữa trưa"],
  ["goi", "Gỏi cuốn", 45000, "dry", "Bữa tối"],
  ["tra", "Trà sen", 25000, "other", "Đồ uống"],
].map(([id, name, price, kind, tag], index) => ({
  id: String(id),
  restaurantId: "bep-nha",
  name: String(name),
  price: Number(price),
  kind: kind as Dish["kind"],
  description: `${name} được chuẩn bị tại bếp mỗi ngày, kết hợp nguyên liệu tươi cùng hương vị Việt gần gũi.`,
  image: asset(`dish-${index}.png`),
  tags: [String(tag), "Món Việt"],
  serving: index !== 2,
  moderation: index === 3 ? "hidden" : "visible",
}));
const trip: Trip = {
  id: "ha-noi",
  name: "Ăn ngon Hà Nội",
  destination: "Hà Nội",
  start: "2026-09-25",
  end: "2026-10-04",
  budget: 3500000,
  notes: "Đi 1 người · Ưu tiên món Việt, ít cay.",
  readOnly: false,
  days: Array.from({ length: 10 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 25 + i)).toISOString().slice(0, 10),
    items: [
      {
        id: `breakfast-${i}`,
        dishId: "pho-thin-dish",
        restaurantId: "pho-thin",
        meal: "Bữa sáng",
        time: "08:00",
        note: "Dùng nóng, ít hành và không cay.",
        feedback: null,
      },
      {
        id: `lunch-${i}`,
        dishId: "com",
        restaurantId: "bep-nha",
        meal: "Bữa trưa",
        time: "12:00",
        note: "Một phần cơm, thêm rau xào.",
        feedback: null,
      },
      {
        id: `snack-${i}`,
        dishId: "cafe-dinh-dish",
        restaurantId: "cafe-dinh",
        meal: "Bữa phụ",
        time: "15:00",
        note: "Ít đường và ít đá.",
        feedback: null,
      },
      {
        id: `dinner-${i}`,
        dishId: "bun",
        restaurantId: "bep-nha",
        meal: "Bữa tối",
        time: "19:00",
        note: "Kiểm tra món còn phục vụ trước khi đến.",
        feedback: null,
      },
    ],
  })),
};
const permissionLabels = [
  "Xem nhật ký người dùng",
  "Cảnh báo và đình chỉ",
  "Cấm và gỡ hạn chế",
  "Xác minh nhà hàng",
  "Kiểm duyệt nhà hàng và món",
  "Duyệt thực đơn",
  "Xử lý báo cáo nhà hàng",
  "Xử lý báo cáo bài viết",
  "Kiểm duyệt bài viết và bình luận",
  "Kiểm duyệt đánh giá và phản hồi",
  "Quản lý Mod",
  "Xem nhật ký hệ thống",
  "Xem tổng quan",
];
const permissionCodes = [
  "user.audit",
  "user.sanction",
  "user.ban",
  "restaurant.verify",
  "restaurant.moderate",
  "menu.review",
  "report.restaurant",
  "report.blog",
  "blog.moderate",
  "review.moderate",
  "admin.moderators",
  "admin.audit",
  "dashboard.view",
];

export const initialData: AppData = {
  ownerRestaurantId: "bep-nha",
  restaurants: [
    {
      id: "bep-nha",
      name: "Bếp Nhà",
      address: "24 Nguyễn Hữu Huân, Hoàn Kiếm, Hà Nội",
      province: "Hà Nội",
      district: "Hoàn Kiếm",
      phone: "024 3826 2468",
      email: "chao@bepnha.example",
      website: "",
      description:
        "Bếp Nhà phục vụ những bữa cơm Việt gần gũi với món nóng nấu mỗi ngày. Không gian nhỏ, ấm áp cho bữa trưa và bữa tối cùng gia đình.",
      image: asset("restaurant.png"),
      verification: "verified",
      operating: "open",
      moderation: "visible",
      rating: 4.6,
      latitude: 21.0345,
      longitude: 105.8532,
    },
    {
      id: "pho-thin",
      name: "Phở Thìn",
      address: "13 Lò Đúc, Hai Bà Trưng, Hà Nội",
      province: "Hà Nội",
      district: "Hai Bà Trưng",
      phone: "024 3821 2709",
      email: "",
      website: "",
      description: "Một bát phở nóng để bắt đầu ngày mới.",
      image: asset("roadmap-restaurant.png"),
      verification: "verified",
      operating: "open",
      moderation: "visible",
      rating: 4.7,
      latitude: 21.0136,
      longitude: 105.8568,
    },
    {
      id: "cafe-dinh",
      name: "Cafe Đinh",
      address: "13 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội",
      province: "Hà Nội",
      district: "Hoàn Kiếm",
      phone: "024 3824 2605",
      email: "",
      website: "",
      description: "Cà phê trứng và những góc phố đáng ghé.",
      image: asset("coffee.png"),
      verification: "verified",
      operating: "open",
      moderation: "visible",
      rating: 4.5,
      latitude: 21.0314,
      longitude: 105.8529,
    },
  ],
  dishes: [
    ...dishes,
    { ...dishes[0], id: "pho-thin-dish", restaurantId: "pho-thin" },
    {
      ...dishes[4],
      id: "cafe-dinh-dish",
      restaurantId: "cafe-dinh",
      name: "Cà phê trứng",
      price: 40000,
    },
  ],
  menuDraft: dishes
    .filter((d) => d.id !== "goi")
    .map((d) => ({ ...d, price: d.id === "pho" ? 70000 : d.price }))
    .concat({
      id: "flan",
      restaurantId: "bep-nha",
      name: "Bánh flan",
      description:
        "Bánh flan mềm, thơm trứng và sữa, dùng cùng lớp caramel nấu tại bếp.",
      price: 30000,
      image: "",
      kind: "other",
      tags: ["Tráng miệng", "Bữa tối"],
      serving: true,
      moderation: "visible",
    }),
  reviews: [
    {
      id: "review-1",
      restaurantId: "bep-nha",
      author: "Mai Anh",
      rating: 5,
      text: "Phở bò nóng, nước dùng thanh và nhân viên rất dễ thương. Mình sẽ quay lại cùng gia đình.",
      date: "2026-10-03T12:30:00+07:00",
      moderation: "visible",
    },
    {
      id: "review-2",
      restaurantId: "bep-nha",
      author: "Quang Minh",
      rating: 4,
      text: "Cơm thịt kho ngon, phần ăn vừa đủ. Buổi trưa hơi đông nên mình đợi một chút.",
      date: "2026-10-02T13:20:00+07:00",
      reply:
        "Cảm ơn Minh đã ghé Bếp Nhà. Bếp sẽ sắp xếp phục vụ nhanh hơn vào giờ trưa.",
      moderation: "visible",
      replyModeration: "visible",
    },
    {
      id: "review-3",
      restaurantId: "bep-nha",
      author: "Thu Hà",
      rating: 3,
      text: "Bún chả hợp vị nhưng hôm nay món ra hơi chậm. Mong quán cải thiện thời gian chờ.",
      date: "2026-10-01T19:15:00+07:00",
      moderation: "visible",
    },
    {
      id: "review-4",
      restaurantId: "bep-nha",
      author: "Nam Trần",
      rating: 2,
      text: "Nội dung đánh giá bị ẩn.",
      date: "2026-09-30T18:10:00+07:00",
      moderation: "hidden",
    },
  ],
  blogs: [
    "Một buổi chiều cà phê quanh Hồ Gươm",
    "Ăn ngon quanh phố cổ trong hai ngày",
    "Bữa trưa món Việt ở Hoàn Kiếm",
    "Từ phở sáng đến cà phê trứng",
    "Những quán nhỏ mình muốn quay lại",
    "Cẩm nang món ngon Việt Nam",
  ].map((title, i) => ({
    id: `guide-${i + 1}`,
    title,
    content:
      "Khám phá món Việt theo từng bữa: món chính, món ăn nhẹ và đồ uống. Chọn món để xem quán và giá trong hệ thống.\n\nCập nhật khẩu vị, khu vực và ngân sách. Bạn chọn quán riêng cho mỗi món và lưu vào lịch ăn cá nhân.\n\nTrước khi đi, kiểm tra giờ mở cửa, giá và thành phần với quán.",
    author: ["Lan Anh", "Mai Nguyễn", "Hà Linh"][i % 3],
    date: "2026-10-03",
    image: asset(i % 3 === 0 ? "coffee.png" : "food-inspiration.png"),
    photos: [asset("food-inspiration.png"), asset("coffee.png")],
    likes: [32, 86, 24, 54, 18, 48][i],
    liked: false,
    moderation: "visible",
    trip: i % 2 ? structuredClone(trip) : undefined,
    comments: [
      {
        id: `comment-${i}`,
        author: "Hà Linh",
        text: "Cảm ơn bạn đã chia sẻ, mình sẽ thử vào cuối tuần!",
        date: "2026-10-03",
        moderation: "visible",
      },
    ],
  })),
  trips: [trip],
  notices: ["TRAVELER", "RESTAURANT_OWNER", "MOD", "ADMIN"].flatMap((role) => [
    {
      id: `${role}-1`,
      role: role as AppData["notices"][number]["role"],
      title:
        role === "TRAVELER"
          ? "Lịch ăn của bạn đã sẵn sàng"
          : "Nhà hàng đã được xác minh",
      body: "Kết quả mới đã được cập nhật. Mở nội dung liên quan để xem chi tiết.",
      date: "2026-10-03T10:20:00+07:00",
      read: false,
      destination:
        role === "TRAVELER"
          ? "roadmaps/ha-noi"
          : role === "RESTAURANT_OWNER"
            ? "verification"
            : role === "ADMIN"
              ? "moderation/verification/bep-nha"
              : "verification/bep-nha",
    },
    {
      id: `${role}-2`,
      role: role as AppData["notices"][number]["role"],
      title: "Có cập nhật mới trong cộng đồng",
      body: "Xem nội dung thông báo trước khi thực hiện thao tác.",
      date: "2026-10-02T09:30:00+07:00",
      read: false,
    },
    {
      id: `${role}-3`,
      role: role as AppData["notices"][number]["role"],
      title: "Thông tin tài khoản",
      body: "Tài khoản của bạn đang hoạt động.",
      date: "2026-10-01T16:00:00+07:00",
      read: true,
      destination: "account",
    },
  ]),
  people: ["Mai Anh", "Mai Nguyễn", "Mai Linh", "Mai Phương", "Mai Hà"].map(
    (name, i) => ({
      id: `user-${i + 1}`,
      name,
      email: [
        "mai.anh@example.vn",
        "mai.nguyen@example.vn",
        "linh@bepnha.example",
        "phuong@example.vn",
        "ha@example.vn",
      ][i],
      role: i === 2 ? "RESTAURANT_OWNER" : "TRAVELER",
      status: (
        [
          "active",
          "suspended",
          "active",
          "banned",
          "pending_verification",
        ] as const
      )[i],
      suspendedUntil: i === 1 ? "2026-10-10T18:00:00+07:00" : undefined,
      history:
        i === 1
          ? [
              {
                action: "Tạm đình chỉ",
                reason: "Quảng cáo lặp lại sau cảnh báo.",
                date: "2026-10-03",
                actor: "Hoài An",
              },
            ]
          : [],
    }),
  ),
  moderators: ["Hoài An", "Minh Khuê", "Thu Hà", "Nam Trần", "Lan Anh"].map(
    (name, i) => ({
      id: `mod-${i + 1}`,
      name,
      email:
        ["hoai.an", "minh.khue", "thu.ha", "nam.tran", "lan.anh"][i] +
        "@angi.example",
      active: i !== 3,
      created: "2026-06-01",
      lastLogin: i === 2 ? null : "2026-10-08T09:15:00+07:00",
      invitation: i === 2 ? "pending" : "accepted",
      overrides:
        i === 0
          ? [
              { permission: "user.ban", effect: "deny" },
              { permission: "dashboard.view", effect: "allow" },
            ]
          : [],
    }),
  ),
  permissions: permissionLabels.map((label, i) => ({
    code: permissionCodes[i],
    label,
    description:
      i === 10 || i === 11
        ? "Chỉ dành cho Quản trị viên; không thể cấp cho Mod."
        : "Truy cập và thao tác trong đúng ngữ cảnh được cấp quyền.",
    defaultAllowed: i < 10,
    grantable: i !== 10 && i !== 11,
  })),
  audit: [
    "Lưu quyền Mod",
    "Phê duyệt xác minh",
    "Vô hiệu hóa Mod",
    "Phê duyệt thực đơn",
    "Cập nhật hồ sơ",
  ].map((action, i) => ({
    id: `audit-${i + 1}`,
    actor: i === 1 ? "Minh Khuê" : "Hoài An",
    role: i === 1 ? "Mod" : "Quản trị viên",
    action,
    entity: i === 1 ? "Hồ sơ xác minh" : "Tài khoản",
    entityId: i === 1 ? "verification-1" : "mod-1",
    related: i === 1 ? "Mai Linh" : "Hoài An",
    date: `2026-10-08T10:${String(35 - i * 5).padStart(2, "0")}:00+07:00`,
    before: { active: true, permissions: ["user.ban"] },
    after: { active: i !== 2, permissions: i === 0 ? [] : ["user.ban"] },
    reason: "Đã đối chiếu hồ sơ trước khi cập nhật.",
  })),
  sync: ["Cập nhật món", "Tạo phản hồi", "Ngừng hiển thị món"].map(
    (type, i) => ({
      id: `msg-${804 + i}`,
      type,
      entityId: `dish-${52 + i}`,
      status: "dead",
      attempts: 8,
      date: "2026-10-08T09:40:00+07:00",
      nextAttempt: null,
      error:
        "Không kết nối được với dịch vụ nhận dữ liệu trong thời gian cho phép.",
      payload: { entityId: `dish-${52 + i}`, eventVersion: 1 },
    }),
  ),
  reports: [
    {
      id: "report-1",
      target: "restaurant",
      targetId: "bep-nha",
      reporter: "Quang Minh",
      reason: "Sai thông tin",
      description: "Giờ mở cửa hiển thị khác với thông báo tại quán.",
      status: "open",
      date: "2026-10-03",
    },
    {
      id: "report-2",
      target: "blog",
      targetId: "guide-2",
      reporter: "Thu Hà",
      reason: "Nội dung không phù hợp",
      description: "Bài viết có thông tin cần kiểm tra thêm.",
      status: "claimed",
      assignee: "Hoài An",
      date: "2026-10-03",
    },
  ],
  submissions: [
    {
      id: "verification-1",
      kind: "verification",
      restaurantId: "bep-nha",
      status: "pending",
      date: "2026-09-29",
      note: "Đã bổ sung tài liệu còn hiệu lực.",
      legalName: "Hộ kinh doanh Bếp Nhà",
      license: "01A8023456",
      taxCode: "0101234567",
      documents: [{ type: "Giấy phép kinh doanh", name: "giay-phep.pdf" }],
    },
    {
      id: "menu-1",
      kind: "menu",
      restaurantId: "bep-nha",
      status: "pending",
      date: "2026-10-03",
      note: "Điều chỉnh giá phở bò, bổ sung bánh flan và gỡ gỏi cuốn.",
    },
  ],
  profile: { name: "Tuấn Nguyễn Minh", phone: "", avatar: "" },
  preferences: ["Món Việt", "Ít cay"],
  surveyFinished: false,
  hours: [
    "Thứ hai",
    "Thứ ba",
    "Thứ tư",
    "Thứ năm",
    "Thứ sáu",
    "Thứ bảy",
    "Chủ nhật",
  ].map((day) => ({ day, open: "07:00", close: "21:00", closed: false })),
};

export const demoUsers = {
  TRAVELER: {
    id: 101,
    email: "tuan@angi.example",
    displayName: "Tuấn Nguyễn Minh",
    role: "TRAVELER",
    status: "active",
    avatarUrl: null,
    needsPreferenceSurvey: true,
  },
  RESTAURANT_OWNER: {
    id: 102,
    email: "linh@bepnha.example",
    displayName: "Mai Linh",
    role: "RESTAURANT_OWNER",
    status: "active",
    avatarUrl: null,
    needsPreferenceSurvey: null,
  },
  MOD: {
    id: 103,
    email: "hoai.an@angi.example",
    displayName: "Hoài An",
    role: "MOD",
    status: "active",
    avatarUrl: null,
    needsPreferenceSurvey: null,
  },
  ADMIN: {
    id: 104,
    email: "an@angi.example",
    displayName: "Hoài An",
    role: "ADMIN",
    status: "active",
    avatarUrl: null,
    needsPreferenceSurvey: null,
  },
} as const;

// Freeze reference itinerary values independently from mutable restaurant/menu records.
for (const blog of initialData.blogs) {
  if (blog.trip) {
    blog.trip.readOnly = true;
    for (const day of blog.trip.days)
      for (const item of day.items) {
        const dish = initialData.dishes.find((d) => d.id === item.dishId),
          restaurant = initialData.restaurants.find(
            (r) => r.id === item.restaurantId,
          );
        item.snapshot = {
          dishName: dish?.name ?? "Món đã lưu",
          restaurantName: restaurant?.name ?? "Quán đã lưu",
          price: dish?.price ?? 0,
        };
      }
  }
}
