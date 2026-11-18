import { describe, expect, it } from "vitest";
import {
  dietConflictProblem,
  excludedTags,
  mentionsSeafood,
  normalizeTagIds,
  tagGroups,
  tagPlacement,
  tagsOfType,
  toggleTag,
  visibleTags,
  type CatalogTag,
} from "@/shared/tags/tag-catalog";

/** The 6-type catalogue (ANGI_8_TagType_Mon_An_Dong_Bo.xlsx) as CAT-02 returns it: API order is type, then name. */
const tags: CatalogTag[] = [
  { id: 1, tagType: "meal_time", code: "breakfast", name: "Ăn sáng" },
  { id: 3, tagType: "meal_time", code: "dinner", name: "Ăn tối" },
  { id: 6, tagType: "dietary", code: "vegetarian", name: "Món chay" },
  { id: 15, tagType: "dietary", code: "diet.thuan_chay", name: "Thuần chay" },
  {
    id: 16,
    tagType: "category",
    code: "form.mon_com_va_ngu_coc",
    name: "Cơm & xôi",
  },
  { id: 11, tagType: "category", code: "local_sf_snack", name: "Đồ ăn vặt" },
  { id: 12, tagType: "category", code: "local_sf_drink", name: "Đồ uống" },
  {
    id: 14,
    tagType: "category",
    code: "local_sf_specialty",
    name: "Đặc sản vùng miền",
  },
  { id: 10, tagType: "category", code: "local_sf_main", name: "Món chính" },
  { id: 21, tagType: "category", code: "form.chao", name: "Cháo" },
  { id: 27, tagType: "meal_role", code: "role.mon_chinh", name: "Món chính" },
  {
    id: 28,
    tagType: "meal_role",
    code: "role.bua_du_trong_mot_mon",
    name: "Đủ một bữa",
  },
  { id: 34, tagType: "meal_role", code: "role.an_vat", name: "Món ăn vặt" },
  { id: 36, tagType: "meal_role", code: "role.do_uong", name: "Đồ uống" },
  { id: 38, tagType: "cooking_method", code: "method.nuong", name: "Nướng" },
  { id: 9, tagType: "ingredient", code: "seafood", name: "Hải sản" },
  { id: 8, tagType: "ingredient", code: "beef", name: "Thịt bò" },
];
const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

describe("tag catalogue groups", () => {
  it("shows the six groups in form order, catalogue order inside, without the two hidden tags", () => {
    const groups = tagGroups(tags);
    expect(groups.map((group) => group.title)).toEqual([
      "Bữa ăn",
      "Kiểu món",
      "Chế độ ăn",
      "Vai trò trong bữa",
      "Cách chế biến",
      "Nguyên liệu",
    ]);
    expect(tagsOfType(tags, "category").map((tag) => tag.code)).toEqual([
      "form.mon_com_va_ngu_coc",
      "local_sf_drink",
      "form.chao",
      "local_sf_snack",
    ]);
    expect(tagsOfType(tags, "ingredient").map((tag) => tag.name)).toEqual([
      "Thịt bò",
      "Hải sản",
    ]);
    expect(
      visibleTags(tags).some((tag) => tag.code.startsWith("local_sf_main")),
    ).toBe(false);
    expect(
      visibleTags(tags).some((tag) => tag.code === "local_sf_specialty"),
    ).toBe(false);
  });

  it("places chips as sheet Bố trí UI says, and an unknown tag by its group", () => {
    expect(tagPlacement({ code: "local_sf_drink", tagType: "category" })).toBe(
      "open",
    );
    expect(tagPlacement({ code: "form.chao", tagType: "category" })).toBe(
      "more",
    );
    expect(
      tagPlacement({ code: "method.nuong", tagType: "cooking_method" }),
    ).toBe("detail");
    expect(tagPlacement({ code: "new_kind", tagType: "category" })).toBe(
      "open",
    );
    expect(tagPlacement({ code: "new_role", tagType: "meal_role" })).toBe(
      "detail",
    );
  });
});

describe("tag companions", () => {
  it("brings the hidden main-dish tag with Món chính and drops it with it", () => {
    const on = toggleTag([], tags, 27, true);
    expect(sorted(on)).toEqual([10, 27]);
    expect(toggleTag(on, tags, 27, false)).toEqual([]);
  });

  it("makes Đủ một bữa a main dish; dropping Món chính drops Đủ một bữa, dropping Đủ một bữa keeps Món chính", () => {
    const full = toggleTag([], tags, 28, true);
    expect(sorted(full)).toEqual([10, 27, 28]);
    expect(sorted(toggleTag(full, tags, 28, false))).toEqual([10, 27]);
    expect(toggleTag(full, tags, 27, false)).toEqual([]);
  });

  it("makes Thuần chay vegetarian; dropping Món chay drops Thuần chay but not the other way round", () => {
    const vegan = toggleTag([], tags, 15, true);
    expect(sorted(vegan)).toEqual([6, 15]);
    expect(toggleTag(vegan, tags, 15, false)).toEqual([6]);
    expect(toggleTag(vegan, tags, 6, false)).toEqual([]);
  });

  it("keeps one Kiểu món: a new kind replaces the old one and the role it brought", () => {
    const drink = toggleTag([1], tags, 12, true);
    expect(sorted(drink)).toEqual([1, 12, 36]);
    expect(sorted(toggleTag(drink, tags, 16, true))).toEqual([1, 16]);
    expect(sorted(toggleTag(drink, tags, 21, true))).toEqual([1, 21]);
  });

  it("gives a menu saved before the change the visible Món chính chip and the paired roles", () => {
    expect(sorted(normalizeTagIds([3, 10, 9], tags))).toEqual([3, 9, 10, 27]);
    expect(sorted(normalizeTagIds([11], tags))).toEqual([11, 34]);
    expect(normalizeTagIds([999], tags)).toEqual([999]);
  });
});

describe("seafood reminder", () => {
  it("finds seafood words as whole words", () => {
    expect(mentionsSeafood("Bánh xèo tôm nhảy")).toBe(true);
    expect(mentionsSeafood("Cá hấp xì dầu")).toBe(true);
    expect(mentionsSeafood("Gỏi hải sản")).toBe(true);
    expect(mentionsSeafood("Các loại rau củ xào")).toBe(false);
    expect(mentionsSeafood("Phở bò tái")).toBe(false);
  });
});

describe("diet exclusions", () => {
  const withIngredients: CatalogTag[] = [
    ...tags,
    { id: 40, tagType: "ingredient", code: "pork", name: "Thịt heo" },
    { id: 41, tagType: "ingredient", code: "ingredient.trung", name: "Trứng" },
    {
      id: 42,
      tagType: "ingredient",
      code: "ingredient.dau_phu",
      name: "Đậu phụ",
    },
  ];

  it("Món chay rules out meat and seafood but not egg; Thuần chay also rules out egg", () => {
    expect(sorted([...excludedTags([6], withIngredients).keys()])).toEqual([
      8, 9, 40,
    ]);
    const vegan = excludedTags([6, 15], withIngredients);
    expect(sorted([...vegan.keys()])).toEqual([8, 9, 40, 41]);
    expect(vegan.get(40)).toBe("Thuần chay");
    expect(excludedTags([8], withIngredients).size).toBe(0);
  });

  it("will not turn on an excluded ingredient, and a diet turned on drops the ones it rules out", () => {
    expect(toggleTag([6], withIngredients, 40, true)).toEqual([6]);
    expect(sorted(toggleTag([6], withIngredients, 42, true))).toEqual([6, 42]);
    expect(sorted(toggleTag([40, 41, 42], withIngredients, 6, true))).toEqual([
      6, 41, 42,
    ]);
    expect(sorted(toggleTag([40, 41, 42], withIngredients, 15, true))).toEqual([
      6, 15, 42,
    ]);
  });

  it("names the clash in a selection saved before the rule", () => {
    expect(dietConflictProblem([6, 40], withIngredients)).toBe(
      "Món chay không thể có Thịt heo.",
    );
    expect(dietConflictProblem([6, 42], withIngredients)).toBe("");
  });
});
