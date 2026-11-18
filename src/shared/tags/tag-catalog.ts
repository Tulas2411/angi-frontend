/**
 * The dish tag catalogue as the owner form, filters and tag lists show it: ANGI_8_TagType_Mon_An_Dong_Bo.xlsx,
 * sheets "Bố trí UI" and "Tag nhập tay". CAT-02 returns only id, tagType, code and name, so the group order,
 * chip position and order, hidden tags and companion rules are kept here and looked up by code. A tag missing from
 * this table still shows in its type's group, after the known ones, by name.
 */

/** CAT-02 tagType values (API Design v1.8, sheet "Enum"). */
export const TAG_TYPES = [
  "meal_time",
  "dietary",
  "category",
  "meal_role",
  "cooking_method",
  "ingredient",
] as const;
export type TagType = (typeof TAG_TYPES)[number];

/** The shape every feature's tag DTO shares. */
export interface CatalogTag {
  id: number;
  tagType: string;
  code: string;
  name: string;
}

/** Owner form placement: always shown, behind "Xem thêm" in its group, or inside "Thêm chi tiết". */
export type TagPlacement = "open" | "more" | "detail";

/** Groups in display order, with the Vietnamese title and where the group sits in the owner form. */
export const TAG_GROUPS: readonly {
  type: TagType;
  title: string;
  placement: "open" | "detail";
}[] = [
  { type: "meal_time", title: "Bữa ăn", placement: "open" },
  { type: "category", title: "Kiểu món", placement: "open" },
  { type: "dietary", title: "Chế độ ăn", placement: "open" },
  { type: "meal_role", title: "Vai trò trong bữa", placement: "detail" },
  { type: "cooking_method", title: "Cách chế biến", placement: "detail" },
  { type: "ingredient", title: "Nguyên liệu", placement: "detail" },
];

export const TAG_TYPE_TITLES: Record<TagType, string> = Object.fromEntries(
  TAG_GROUPS.map((group) => [group.type, group.title]),
) as Record<TagType, string>;

/** Code → [order inside its group, placement], sheet "Tag nhập tay". */
const CHIPS: Record<string, [number, TagPlacement]> = {
  breakfast: [1, "open"],
  lunch: [2, "open"],
  snack: [3, "open"],
  dinner: [4, "open"],
  late_night: [5, "open"],
  vegetarian: [1, "open"],
  "diet.thuan_chay": [2, "open"],
  "form.mon_com_va_ngu_coc": [1, "open"],
  "form.mon_soi": [2, "open"],
  "form.banh_mi_va_banh_kep": [3, "open"],
  "form.canh_va_sup": [4, "open"],
  "form.lau": [5, "open"],
  local_sf_dessert: [6, "open"],
  local_sf_drink: [7, "open"],
  "form.chao": [8, "more"],
  "form.banh_bot_va_mon_nhan": [9, "more"],
  "form.goi_va_salad": [10, "more"],
  "form.do_an_kem_va_thanh_phan_ban_rieng": [11, "more"],
  local_sf_snack: [12, "more"],
  "form.muc_menu_nhieu_cau_phan": [13, "more"],
  "form.khac_cho_duyet": [14, "more"],
  "role.mon_chinh": [1, "detail"],
  "role.bua_du_trong_mot_mon": [2, "detail"],
  "role.mon_dam_dung_voi_mon_khac": [3, "detail"],
  "role.mon_rau_an_kem": [4, "detail"],
  "role.mon_tinh_bot_an_kem": [5, "detail"],
  "role.mon_canh_sup_an_kem": [6, "detail"],
  "role.khai_vi": [7, "detail"],
  "role.an_vat": [8, "detail"],
  "role.trang_mieng": [9, "detail"],
  "role.do_uong": [10, "detail"],
  "method.chien_chua_ro_kieu": [1, "detail"],
  "method.nuong": [2, "detail"],
  "method.xao": [3, "detail"],
  "method.hap": [4, "detail"],
  "method.luoc": [5, "detail"],
  "method.kho": [6, "detail"],
  "method.ham_va_ninh": [7, "detail"],
  "method.tron": [8, "detail"],
  "method.ap_chao": [9, "detail"],
  beef: [1, "detail"],
  pork: [2, "detail"],
  "ingredient.thit_ga": [3, "detail"],
  "ingredient.thit_vit": [4, "detail"],
  seafood: [5, "detail"],
  "ingredient.trung": [6, "detail"],
  "ingredient.sua_dong_vat": [7, "detail"],
  "ingredient.dau_phu": [8, "detail"],
  "ingredient.dau_nanh": [9, "detail"],
};

/** The main-dish chip and the hidden category tag the Agent reads for it (sheet "Tag ngừng dùng"). */
export const MAIN_ROLE_CODE = "role.mon_chinh";
export const MAIN_SYSTEM_CODE = "local_sf_main";
export const SEAFOOD_CODE = "seafood";

/** Kept for the Agent, never offered to people: the main-dish mirror and regional specialty. */
const HIDDEN_CODES = new Set([MAIN_SYSTEM_CODE, "local_sf_specialty"]);

/** Column "Tự gắn kèm": choosing the key also chooses these tags. */
const COMPANIONS: Record<string, readonly string[]> = {
  "diet.thuan_chay": ["vegetarian"],
  [MAIN_ROLE_CODE]: [MAIN_SYSTEM_CODE],
  "role.bua_du_trong_mot_mon": [MAIN_ROLE_CODE, MAIN_SYSTEM_CODE],
  local_sf_dessert: ["role.trang_mieng"],
  local_sf_drink: ["role.do_uong"],
  local_sf_snack: ["role.an_vat"],
};

/** A key that cannot stand without these: dropping one drops the key (Thuần chay is always Món chay). */
const REQUIRES: Record<string, readonly string[]> = {
  "diet.thuan_chay": ["vegetarian"],
  "role.bua_du_trong_mot_mon": [MAIN_ROLE_CODE],
};

const MEAT_AND_SEAFOOD = [
  "beef",
  "pork",
  "ingredient.thit_ga",
  "ingredient.thit_vit",
  SEAFOOD_CODE,
] as const;

/** A diet chip rules out these ingredients: Món chay has no meat or seafood, Thuần chay also no egg or dairy. */
const EXCLUDES: Record<string, readonly string[]> = {
  vegetarian: MEAT_AND_SEAFOOD,
  "diet.thuan_chay": [
    ...MEAT_AND_SEAFOOD,
    "ingredient.trung",
    "ingredient.sua_dong_vat",
  ],
};

/**
 * Tags the current selection rules out, mapped to the name of the chosen diet tag that rules each out
 * (Thuần chay wins over Món chay when both are chosen, so the reason names the stricter one).
 */
export function excludedTags(
  ids: readonly number[],
  tags: readonly CatalogTag[],
): Map<number, string> {
  const result = new Map<number, string>();
  const chosen = tags
    .filter((tag) => ids.includes(tag.id) && EXCLUDES[tag.code])
    .sort((a, b) => EXCLUDES[a.code].length - EXCLUDES[b.code].length);
  for (const diet of chosen)
    for (const tag of tags)
      if (EXCLUDES[diet.code].includes(tag.code)) result.set(tag.id, diet.name);
  return result;
}

/** "Món chay không thể có Thịt heo." for the first chosen tag that a chosen diet rules out; empty when none. */
export function dietConflictProblem(
  ids: readonly number[],
  tags: readonly CatalogTag[],
): string {
  const excluded = excludedTags(ids, tags);
  const clash = tags.find(
    (tag) => ids.includes(tag.id) && excluded.has(tag.id),
  );
  return clash ? `${excluded.get(clash.id)} không thể có ${clash.name}.` : "";
}

export function isHiddenTag(tag: Pick<CatalogTag, "code">) {
  return HIDDEN_CODES.has(tag.code);
}

/** Kiểu món: a visible category tag. A dish has exactly one. */
export function isDishKindTag(tag: Pick<CatalogTag, "code" | "tagType">) {
  return tag.tagType === "category" && !isHiddenTag(tag);
}

export function tagPlacement(
  tag: Pick<CatalogTag, "code" | "tagType">,
): TagPlacement {
  const known = CHIPS[tag.code];
  if (known) return known[1];
  return (
    TAG_GROUPS.find((group) => group.type === tag.tagType)?.placement ??
    "detail"
  );
}

/** Catalogue order inside a group; unknown tags follow by name. */
export function compareTags(a: CatalogTag, b: CatalogTag) {
  const left = CHIPS[a.code]?.[0] ?? Number.MAX_SAFE_INTEGER;
  const right = CHIPS[b.code]?.[0] ?? Number.MAX_SAFE_INTEGER;
  return left - right || a.name.localeCompare(b.name, "vi");
}

/** Visible tags of one type, in catalogue order. */
export function tagsOfType<T extends CatalogTag>(
  tags: readonly T[],
  type: TagType,
): T[] {
  return tags
    .filter((tag) => tag.tagType === type && !isHiddenTag(tag))
    .sort(compareTags);
}

/** Visible tags grouped in display order; empty groups are left out. Unknown tag types are not shown. */
export function tagGroups<T extends CatalogTag>(tags: readonly T[]) {
  return TAG_GROUPS.map((group) => ({
    ...group,
    tags: tagsOfType(tags, group.type),
  })).filter((group) => group.tags.length > 0);
}

/** Visible tags only, for read-only lists (dish cards, review screens); a tag without a code is kept. */
export function visibleTags<T extends { code?: string }>(
  tags: readonly T[],
): T[] {
  return tags.filter((tag) => !HIDDEN_CODES.has(tag.code ?? ""));
}

function idsOf(tags: readonly CatalogTag[], codes: readonly string[]) {
  return codes.flatMap((code) =>
    tags.filter((tag) => tag.code === code).map((tag) => tag.id),
  );
}

/**
 * Applies every companion rule to a selection: each chosen key brings its companions, and an existing dish that has
 * the hidden main-dish tag gets the visible Món chính chip (menus saved before the catalogue change).
 */
export function normalizeTagIds(
  ids: readonly number[],
  tags: readonly CatalogTag[],
): number[] {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const result = [...new Set(ids)];
  const add = (id: number) => {
    if (result.includes(id)) return;
    result.push(id);
    const code = byId.get(id)?.code;
    if (code)
      for (const companion of idsOf(tags, COMPANIONS[code] ?? []))
        add(companion);
  };
  for (const id of [...result]) {
    result.splice(result.indexOf(id), 1);
    add(id);
  }
  if (idsOf(tags, [MAIN_SYSTEM_CODE]).some((id) => result.includes(id)))
    for (const id of idsOf(tags, [MAIN_ROLE_CODE])) add(id);
  return result;
}

/**
 * The selection after one chip is turned on or off.
 * On: the chip and its companions; a new Kiểu món first turns the previous kind off. A chip a chosen diet rules
 * out does not turn on, and a diet turned on drops the ingredients it rules out.
 * Off: the chip and every key that requires it; then the hidden companions and a kind's paired role go too unless
 * another chosen key still brings them. Visible companions the owner may also have chosen alone (Món chay after
 * Thuần chay, Món chính after Đủ một bữa) stay.
 */
export function toggleTag(
  ids: readonly number[],
  tags: readonly CatalogTag[],
  tagId: number,
  checked: boolean,
): number[] {
  const tag = tags.find((item) => item.id === tagId);
  if (!tag)
    return checked
      ? [...new Set([...ids, tagId])]
      : ids.filter((id) => id !== tagId);
  if (checked) {
    let next = [...ids];
    if (isDishKindTag(tag))
      for (const other of tags)
        if (
          other.id !== tag.id &&
          isDishKindTag(other) &&
          next.includes(other.id)
        )
          next = toggleTag(next, tags, other.id, false);
    // A tag the chosen diet rules out stays off; choosing a diet drops the ingredients it rules out.
    if (excludedTags(next, tags).has(tag.id)) return [...ids];
    next = normalizeTagIds([...next, tag.id], tags);
    const excluded = excludedTags(next, tags);
    return next.filter((id) => !excluded.has(id));
  }
  const codeOf = new Map(tags.map((item) => [item.id, item.code]));
  const chosen = (list: readonly number[]) =>
    new Set(list.map((id) => codeOf.get(id) ?? ""));
  const dropped = new Set([tag.code]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [key, required] of Object.entries(REQUIRES))
      if (
        !dropped.has(key) &&
        chosen(ids).has(key) &&
        required.some((code) => dropped.has(code))
      ) {
        dropped.add(key);
        grew = true;
      }
  }
  let next = ids.filter((id) => !dropped.has(codeOf.get(id) ?? ""));
  const stillBrought = new Set(
    [...chosen(next)].flatMap((code) => COMPANIONS[code] ?? []),
  );
  for (const code of dropped)
    for (const companion of COMPANIONS[code] ?? []) {
      const owned =
        HIDDEN_CODES.has(companion) ||
        isDishKindTag({ code, tagType: tagTypeOf(tags, code) });
      if (owned && !stillBrought.has(companion))
        next = next.filter((id) => codeOf.get(id) !== companion);
    }
  return next;
}

function tagTypeOf(tags: readonly CatalogTag[], code: string) {
  return tags.find((tag) => tag.code === code)?.tagType ?? "";
}

/** Seafood words in a dish name or description; "cá" is matched as a whole word so "các" does not count. */
const SEAFOOD_WORDS = new Set([
  "tôm",
  "cá",
  "cua",
  "ghẹ",
  "mực",
  "ốc",
  "nghêu",
  "ngao",
  "sò",
  "hến",
  "hàu",
  "tép",
  "sứa",
  "ruốc",
]);
const SEAFOOD_PHRASES = ["hải sản", "bạch tuộc", "cồi sò", "thủy sản"];

/** True when the text names seafood, so the form can remind the owner to choose Hải sản (allergy filter). */
export function mentionsSeafood(text: string) {
  const lower = text.toLocaleLowerCase("vi");
  if (SEAFOOD_PHRASES.some((phrase) => lower.includes(phrase))) return true;
  return lower.split(/[^\p{L}]+/u).some((word) => SEAFOOD_WORDS.has(word));
}
