import { searchText } from "@/shared/text/search";

/** Editorial inspiration, not backend restaurant/menu records or recommendations. */
export const homeTastes = [
  { value: "all", label: "Tất cả" },
  { value: "warm", label: "Ấm bụng" },
  { value: "rich", label: "Đậm đà" },
  { value: "fresh", label: "Thanh nhẹ" },
] as const;
export type HomeTaste = (typeof homeTastes)[number]["value"];
export interface HomeSelection {
  query: string;
  taste: HomeTaste;
}
export interface HomeDish {
  id: string;
  name: string;
  image: string;
  imageAlt: string;
  origin: string;
  taste: Exclude<HomeTaste, "all">;
  note: string;
  description: string;
  pairing: string;
}

export const homeDishes: readonly HomeDish[] = [
  {
    id: "pho-bo",
    name: "Phở bò",
    image: "/assets/figma/dish-0.png",
    imageAlt: "Bát phở bò với hành, rau thơm và đĩa giá bên cạnh",
    origin: "Hương vị miền Bắc",
    taste: "warm",
    note: "Nước dùng thơm, một bát là ấm lòng.",
    description:
      "Hương quế hồi thoảng trong làn nước dùng nóng, bánh phở mềm và những lát bò đậm vị. Có những buổi sáng, chỉ cần một bát phở là thấy ngày mới dễ chịu hơn.",
    pairing: "Thêm chút chanh, rau thơm và ớt theo khẩu vị của bạn.",
  },
  {
    id: "bun-cha",
    name: "Bún chả",
    image: "/assets/figma/dish-2.png",
    imageAlt: "Chả nướng trong bát nước chấm, ăn cùng bún trắng và rau sống",
    origin: "Hương vị Hà Nội",
    taste: "rich",
    note: "Chả nướng xém cạnh, thơm cả bữa trưa.",
    description:
      "Chả nướng thơm, nước chấm chua ngọt và những sợi bún trắng mềm. Gắp thêm rau sống, chấm một miếng chả còn ấm — một hương vị rất Hà Nội.",
    pairing: "Ăn cùng rau thơm, đu đủ ngâm và một chút ớt tươi.",
  },
  {
    id: "thit-kho",
    name: "Cơm thịt kho trứng",
    image: "/assets/figma/dish-1.png",
    imageAlt: "Đĩa cơm trắng ăn cùng thịt kho và trứng",
    origin: "Hương vị miền Nam",
    taste: "rich",
    note: "Mềm béo, đậm vị như cơm nhà.",
    description:
      "Thịt kho mềm, trứng thấm vị và chút nước kho chan lên cơm nóng. Một bữa ăn mộc mạc, gợi nhớ cảm giác quây quần bên mâm cơm nhà.",
    pairing: "Thử ăn cùng dưa cải hoặc rau luộc để cân bằng vị béo.",
  },
  {
    id: "goi-cuon",
    name: "Gỏi cuốn tôm",
    image: "/assets/figma/dish-3.png",
    imageAlt: "Những cuốn gỏi tôm, rau xanh và bún với bát nước chấm",
    origin: "Hương vị miền Nam",
    taste: "fresh",
    note: "Tươi mát, nhẹ nhàng mà vẫn đầy vị.",
    description:
      "Lớp bánh tráng mỏng ôm tôm, bún và rau xanh giòn mát. Chấm một cuốn vào sốt, cảm nhận vị tươi nhẹ xen chút đậm đà — hợp cho một buổi chiều thảnh thơi.",
    pairing: "Chọn tương chấm hoặc nước mắm chua ngọt theo sở thích.",
  },
  {
    id: "banh-mi-trung",
    name: "Bánh mì trứng",
    image: "/assets/figma/roll-1.png",
    imageAlt: "Bánh mì giòn kẹp trứng, dưa leo, đồ chua và rau mùi",
    origin: "Bữa sáng Việt",
    taste: "warm",
    note: "Vỏ bánh giòn, nhân trứng nóng hổi.",
    description:
      "Bẻ một miếng bánh mì giòn, chạm vào lớp trứng mềm còn ấm và vị chua nhẹ của đồ chua. Một bữa sáng quen thuộc, giản dị mà lúc nào cũng khiến ta muốn ăn thêm.",
    pairing: "Thêm dưa leo, rau mùi và chút tương ớt theo khẩu vị.",
  },
  {
    id: "bun-thit-nuong",
    name: "Bún thịt nướng",
    image: "/assets/figma/roll-2.png",
    imageAlt: "Bún với thịt nướng, rau xanh, đồ chua, lạc và hành phi",
    origin: "Hương vị miền Nam",
    taste: "rich",
    note: "Thịt nướng thơm, rau giòn và nước mắm chua ngọt.",
    description:
      "Thịt nướng xém cạnh nằm trên lớp bún mềm, xen rau xanh và đồ chua giòn mát. Rưới chút nước mắm, trộn nhẹ để mỗi đũa đều có vị thơm bùi của lạc và hành phi.",
    pairing: "Rưới nước mắm từng chút để giữ vị vừa miệng, thêm rau tùy thích.",
  },
  {
    id: "com-tam",
    name: "Cơm tấm sườn trứng",
    image: "/assets/figma/roll-3.png",
    imageAlt: "Đĩa cơm tấm với sườn nướng, trứng ốp la, dưa leo và đồ chua",
    origin: "Hương vị Sài Gòn",
    taste: "rich",
    note: "Sườn nướng óng thơm trên đĩa cơm nóng.",
    description:
      "Miếng sườn nướng đậm vị, trứng ốp la mềm và lớp mỡ hành thơm trên cơm nóng. Đồ chua cùng dưa leo thêm chút tươi mát cho một bữa ăn đầy đặn.",
    pairing: "Ăn cùng đồ chua và chấm sườn với nước mắm theo sở thích.",
  },
  {
    id: "banh-cuon",
    name: "Bánh cuốn",
    image: "/assets/figma/roll-4.png",
    imageAlt:
      "Bánh cuốn nhân thịt với hành phi, chả lụa, rau thơm và nước chấm",
    origin: "Hương vị miền Bắc",
    taste: "warm",
    note: "Bánh mỏng mềm, hành phi thơm nức.",
    description:
      "Lớp bánh mỏng mềm ôm nhân thịt thơm, phủ hành phi vàng giòn. Gắp một miếng còn ấm, chấm cùng nước mắm và ăn kèm rau thơm để cảm nhận vị thanh dịu của bữa sáng.",
    pairing: "Ăn ngay khi bánh còn ấm, thêm chả lụa và rau thơm tùy thích.",
  },
];

export function readHomeSelection(
  params: Record<string, string | string[] | undefined>,
): HomeSelection {
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const taste =
    homeTastes.find((item) => item.value === params.taste)?.value ?? "all";
  return { query, taste };
}
export function selectHomeDishes({ query, taste }: HomeSelection): HomeDish[] {
  const words = searchText(query).split(/\s+/).filter(Boolean);
  return homeDishes.filter((dish) => {
    const tasteLabel =
      homeTastes.find((item) => item.value === dish.taste)?.label ?? "";
    const text = searchText(
      `${dish.name} ${dish.origin} ${dish.note} ${tasteLabel}`,
    );
    return (
      (taste === "all" || dish.taste === taste) &&
      words.every((word) => text.includes(word))
    );
  });
}
export function homeSelectionHref({ query, taste }: HomeSelection): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (taste !== "all") params.set("taste", taste);
  return `/${params.size ? `?${params}` : ""}#mon-ngon`;
}
