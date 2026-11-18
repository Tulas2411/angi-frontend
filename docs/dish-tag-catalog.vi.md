# Danh mục tag món ăn (6 nhóm)

Nguồn thiết kế: `ANGI_8_TagType_Mon_An_Dong_Bo.xlsx` (thư mục gốc của dự án), các sheet "Bố trí UI", "Tag nhập tay", "Tag ngừng dùng". Hợp đồng API: `angi-backend/docs/ANGI_API_Design_Ver1.8.xlsx`, sheet "Enum" (`tagType`), "DTO" (Tag) và "Backend API" (CAT-02).

Nhánh FE: `feat/tag-types-6`, tạo từ `origin/dev` tại `ad6a21f`. Thay đổi để nguyên chưa stage/commit/push.

## Hành vi

- CAT-02 trả `tagType` thuộc 6 giá trị: `meal_time`, `dietary`, `category`, `meal_role`, `cooking_method`, `ingredient`. API chỉ có `id`, `tagType`, `code`, `name`, nên thứ tự chip, vị trí (Mở sẵn / Xem thêm / Thêm chi tiết), tag ẩn và quy tắc tự gắn nằm trong `src/shared/tags/tag-catalog.ts`, tra theo `code`. Tag chưa có trong bảng vẫn hiện trong nhóm theo `tagType`, xếp sau theo tên.
- **Tag ẩn:** `local_sf_main` (Agent dùng để bảo đảm bữa có món chính) và `local_sf_specialty` (yêu cầu "ăn đặc sản"). Không hiện trên form chủ quán, bộ lọc, thẻ món hay màn duyệt menu.
- **Form món của chủ quán** (`owner/menu-item-editor.tsx`): Bữa ăn, Kiểu món (7 chip + "Xem thêm (7)"), Chế độ ăn luôn hiện; Vai trò trong bữa, Cách chế biến, Nguyên liệu nằm sau nút "Thêm chi tiết", chip đã chọn vẫn hiện khi thu gọn.
  - Tự gắn kèm: Thuần chay → Món chay; Món chính → `local_sf_main` (ẩn); Đủ một bữa → Món chính; Kiểu món Tráng miệng / Đồ uống / Đồ ăn vặt → vai trò cùng tên.
  - Bỏ chọn: bỏ Món chay thì bỏ Thuần chay; bỏ Món chính thì bỏ Đủ một bữa và tag ẩn; đổi Kiểu món thì bỏ kiểu cũ cùng vai trò nó gắn.
  - Món đã lưu có `local_sf_main` mà chưa có Món chính: form tự hiện Món chính và gửi kèm khi lưu.
  - Kiểu món: tối đa một; món mới (hoặc món đã có kiểu) phải có một. Món cũ chưa có kiểu chỉ được nhắc, để chủ quán gửi lại menu cũ (FE kiểm tra; BE không bắt buộc).
  - Tên hoặc mô tả có từ chỉ thủy hải sản (tôm, cá, cua, mực, ốc, "hải sản"…) mà chưa chọn Hải sản: hiện cảnh báo kèm nút "Chọn Hải sản".
  - Không tự chọn sẵn Món chính theo Kiểu món (chủ dự án chọn "Không" cho Q1, 17/11/2026).
- **Explore** (`explore/dish-list-page.tsx`): Bữa ăn, Kiểu món, Chế độ ăn luôn hiện; 3 nhóm còn lại trong "Thêm bộ lọc chi tiết" (tự mở khi đang chọn). "Không ăn" gồm Chế độ ăn và Nguyên liệu.
- **Roadmap generate**: chip ưu tiên/loại trừ theo thứ tự nhóm (Kiểu món, Chế độ ăn, Vai trò, Cách chế biến, Nguyên liệu), không có tag bữa và tag ẩn.
- **Thẻ món, chi tiết món, Roll, thực đơn quán, lộ trình, duyệt menu**: bỏ tag ẩn khi hiển thị.

## Kiểm tra (17/11/2026)

| Kiểm tra                    | Kết quả                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (`tsc --noEmit`) | Đạt                                                                                                                                                                             |
| ESLint `src tests`          | Đạt                                                                                                                                                                             |
| Unit tests                  | **536/536**, 60 file; mới: `tests/tag-catalog.test.ts` (8), quy tắc Kiểu món trong `tests/restaurant-menu.test.ts` (3), `preferenceTags` trong `tests/roadmap-generate.test.ts` |
| `npm run build`             | Biên dịch và sinh 34 trang đạt; lệnh kết thúc lỗi `SecurityFatalError` do bước kiểm tra bảo mật của Next.js với phiên bản đang cài, không liên quan thay đổi này                |
| Browser (Playwright)        | Chưa chạy (máy chưa cài trình duyệt Playwright). Đã sửa `restaurant-menu.spec.ts` (món mới chọn Kiểu món, đổi kiểu) và `explore.spec.ts` ("Không ăn" dùng tag nguyên liệu)      |
| BE thật                     | Chưa chạy: migration BE `AddMealRoleCookingMethodIngredientTagTypes` chưa sinh được trên máy này (Windows Smart App Control chặn `dotnet ef`)                                   |

Đối chiếu API Design: mở lại `ANGI_API_Design_Ver1.8.xlsx` từ đĩa sau khi sửa code (bản cùng nhánh BE `feat/tag-types-6`, đã thêm 3 giá trị): sheet "Enum" dòng 12 (`tagType`), "DTO" dòng 64 (Tag.tagType), "Backend API" dòng 18 (CAT-02 `type?`). Wire DTO giữ nguyên `id`, `tagType`, `code`, `name`; không có endpoint hay trường mới.
