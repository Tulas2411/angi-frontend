# Toast thông báo (Sonner)

Thông báo ngắn về một thao tác vừa làm (đã lưu, đã gửi, đã xóa) hiện thành toast ở giữa đáy màn hình. Thư viện: [Sonner](https://sonner.emilkowal.ski/) `2.0.8`, chạy ở chế độ `unstyled` và vẽ theo giao diện ANGI.

Mã nguồn:

- `src/components/ui/app-toaster.tsx` + `app-toaster.css`: `<AppToaster />`, gắn một lần trong `src/app/layout.tsx`, nên toast vẫn còn khi chuyển trang (ví dụ tạo lộ trình ở trang chủ rồi sang trang lộ trình).
- `src/shared/ui/notify.ts`: `notify.success | info | warning | error`. Các màn chỉ gọi `notify`, không import `sonner` trực tiếp.

## Khi nào dùng toast, khi nào để inline

| Loại thông báo                                                                                                                                                  | Hiển thị                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Xác nhận thao tác ngắn: lưu hồ sơ, lưu giờ mở cửa, cập nhật trạng thái, gửi báo cáo, gửi đánh giá/phản hồi, xóa bài/lộ trình/món, đánh dấu đã đọc, đổi mật khẩu | **Toast** (`notify.success`, hoặc `notify.info` khi việc đã có sẵn, ví dụ báo cáo trước đó còn chờ xử lý) |
| Lỗi của thao tác nhanh không gắn với form (đánh dấu đã đọc thất bại…)                                                                                           | **Toast** (`notify.error(caught)`, thông điệp lấy theo `errorCode` qua `getErrorMessage`)                 |
| Lỗi của từng trường, lỗi khi gửi form                                                                                                                           | Inline, cạnh trường/form, để người dùng sửa và gửi lại                                                    |
| Lỗi tải trang có nút "Thử lại"                                                                                                                                  | Inline (`Alert` + nút)                                                                                    |
| Trạng thái kéo dài: hồ sơ chờ duyệt, vượt ngân sách, đang tạo lộ trình…                                                                                         | Inline                                                                                                    |
| Mọi thông báo bên trong `<dialog>` modal                                                                                                                        | Inline: `showModal()` đưa dialog lên top layer, che mất toast                                             |
| Cảnh báo trong một ngày của lộ trình (chưa đổi thứ tự được, chưa xóa được món, đọc lại thất bại)                                                                | Inline trong ngày (`.roadmap-day-notice`), không tự ẩn                                                    |

## Hành vi

- Vị trí `bottom-center` (không che header và chuông), tối đa 3 toast cùng lúc. Vùng chứa có nhãn "Thông báo".
- Toast **chỉ hiển thị thông điệp**: không có nút đóng, không có nút hành động. Toast tự ẩn; vuốt để bỏ sớm (mặc định của Sonner).
- Thành công/thông tin tự ẩn sau 3,5 giây, cảnh báo/lỗi sau 6 giây. Di chuột vào hoặc focus vào toast thì dừng đếm (mặc định của Sonner).
- Cùng một nội dung gọi lại (lưu hai lần liên tiếp) thay toast cũ chứ không xếp thêm một bản: id mặc định là chính đoạn chữ.
- Toast có thể kèm `description` (dòng phụ, màu muted), ví dụ "Các phiên đăng nhập khác đã bị đăng xuất." sau khi đổi mật khẩu.
- Khi toast thay cho thẻ vừa giữ focus (xóa món khỏi ngày), focus chuyển về nút tiêu đề của ngày đó, không chuyển vào toast.
- `prefers-reduced-motion: reduce`: toast chỉ hiện/mờ dần, không trượt.

## Giao diện

Thẻ trắng (`--card`), viền `--line`, bo `--radius-md`, bóng `--shadow-pop`, rộng tối đa 420px (màn hẹp: chiều ngang trừ 32px). Icon heroicons 20/solid theo loại: thành công `--success-ink`, lỗi `--error-ink`, cảnh báo `--warning-ink`, thông tin `--muted`. Nền thẻ không đổi màu theo loại, giống các thẻ khác của web.

## Test

Sonner render chữ của toast trong DOM, nên browser test vẫn dùng `page.getByText("…")`. Các test trước đây kiểm `.roadmap-day-notice` cho xác nhận xóa món đã đổi sang kiểm toast (`tests/browser/roadmap-add-item.spec.ts`).
