"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Avatar,
  Breadcrumbs,
  Choice,
  Combobox,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Media,
  SelectField,
  Skeleton,
  Tabs,
  TextArea,
  Tooltip,
  UploadField,
  type UploadedFile,
} from "@/components/ui/primitives";
import {
  DishCard,
  RestaurantCard,
  RestaurantStatuses,
  ReviewContent,
  BlogCard,
} from "@/components/domain/cards";
import { MapPicker } from "@/components/domain/map-picker";
import { usePlatform } from "./provider";
import { effectivePermission } from "./rules";
export function ComponentGallery() {
  const { data, mutate, notify, busy } = usePlatform(),
    [text, setText] = useState("Hà Nội"),
    [choice, setChoice] = useState(true),
    [tab, setTab] = useState("default"),
    [dialog, setDialog] = useState(""),
    [files, setFiles] = useState<UploadedFile[]>([]),
    [documents, setDocuments] = useState<UploadedFile[]>([]),
    [page, setPage] = useState(1),
    [permission, setPermission] = useState("inherit");
  return (
    <div className="container workspace stack">
      <h1>Thư viện thành phần ANGI</h1>
      <p className="helper">
        Chỉ dành cho phát triển · biến thể theo Component Refinement 462:5031.
      </p>
      <div className="actions">
        <ActionLink href="/demo" secondary>
          Về bản minh họa
        </ActionLink>
        <ActionLink href="/dev/scenarios" secondary>
          Trạng thái nghiệp vụ
        </ActionLink>
        <Button
          variant="secondary"
          onClick={() =>
            notify("Thông báo minh họa được đóng tự động sau 6 giây.")
          }
        >
          Hiện toast
        </Button>
      </div>
      <Card title="Nút và trạng thái">
        <div className="actions">
          {(
            ["primary", "secondary", "tertiary", "destructive", "icon"] as const
          ).map((variant) => (
            <Button
              variant={variant}
              key={variant}
              aria-label={variant === "icon" ? "Thêm mục" : undefined}
              onClick={() => notify("Đã chọn nút minh họa.")}
            >
              {variant === "icon"
                ? "＋"
                : variant === "destructive"
                  ? "Xóa mục"
                  : variant === "primary"
                    ? "Lưu thay đổi"
                    : "Xem thêm"}
            </Button>
          ))}
          <Button disabled>Không khả dụng</Button>
          <Button loading>Đang lưu</Button>
        </div>
      </Card>
      <Card title="Trường nhập">
        <div className="grid-3">
          <Field
            label="Tên hiển thị"
            value={text}
            onChange={(e) => setText(e.target.value)}
            helper="Từ 2 đến 100 ký tự."
            required
          />
          <Field
            label="Email có lỗi"
            type="email"
            defaultValue="chua-hop-le"
            error="Nhập email hợp lệ."
          />
          <Field label="Chỉ xem" value="Tuấn Nguyễn Minh" readOnly />
          <Field
            label="Ngân sách"
            type="number"
            defaultValue={3500000}
            min={0}
            step={1000}
            helper="Đơn vị: đồng"
          />
          <Field label="Ngày bắt đầu" type="date" defaultValue="2026-09-25" />
          <Field label="Ngày kết thúc" type="date" defaultValue="2026-10-04" />
          <Combobox
            label="Điểm đến"
            value={text}
            onChange={setText}
            options={["Hà Nội", "Đà Nẵng", "Đà Lạt"]}
          />
          <SelectField
            label="Lựa chọn"
            value={tab}
            onChange={setTab}
            options={[
              { value: "default", label: "Mặc định" },
              { value: "selected", label: "Đã chọn" },
            ]}
          />
          <Field label="Không khả dụng" disabled value="Chờ API" />
        </div>
        <TextArea
          label="Mô tả"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
        />
        <div className="actions">
          <Choice label="Chọn khẩu vị" checked={choice} onChange={setChoice} />
          <Choice
            label="Đang mở cửa"
            kind="switch"
            checked={choice}
            onChange={setChoice}
          />
          <Choice
            label="Người khám phá"
            kind="radio"
            name="gallery-role"
            checked={choice}
            onChange={() => setChoice(true)}
          />
          <Choice
            label="Chủ nhà hàng"
            kind="radio"
            name="gallery-role"
            checked={!choice}
            onChange={() => setChoice(false)}
          />
          <Choice
            label="Không thể chọn"
            disabled
            checked={false}
            onChange={() => {}}
          />
        </div>
      </Card>
      <Card title="Tab, popover, tooltip và đối thoại">
        <Breadcrumbs
          items={[
            { label: "ANGI", href: "/demo" },
            { label: "Thư viện thành phần" },
          ]}
        />
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "default", label: "Mặc định" },
            { value: "selected", label: "Đã chọn" },
          ]}
        />
        <div className="actions">
          <Button onClick={() => setDialog("dialog")}>Mở hộp thoại</Button>
          <Button variant="secondary" onClick={() => setDialog("drawer")}>
            Mở drawer
          </Button>
          <Button variant="destructive" onClick={() => setDialog("confirm")}>
            Xác nhận xóa
          </Button>
          <Button variant="secondary" onClick={() => setDialog("map")}>
            Chọn vị trí trên bản đồ
          </Button>
          <Tooltip text="Dùng phím Tab để đọc trợ giúp.">
            <span>Trợ giúp ⓘ</span>
          </Tooltip>
          <details className="account-menu">
            <summary className="button button-secondary">Mở menu</summary>
            <div>
              <button onClick={() => notify("Đã chọn mục trong menu.")}>
                Lựa chọn minh họa
              </button>
            </div>
          </details>
        </div>
      </Card>
      <div className="grid-2">
        <Card title="Phản hồi">
          <Alert tone="info">Thông tin hỗ trợ quyết định.</Alert>
          <Alert tone="success">Đã lưu thành công.</Alert>
          <Alert tone="warning">Cần kiểm tra thông tin trước khi gửi.</Alert>
          <Alert>Không lưu được dữ liệu. Thử lại.</Alert>
          <div className="actions">
            <Badge>Đang chờ</Badge>
            <Badge tone="success">Đã xác minh</Badge>
            <Badge tone="error">Bị từ chối</Badge>
            <Badge tone="warning">Cần bổ sung</Badge>
          </div>
        </Card>
        <Card title="Tải, trống và không có ảnh">
          <Skeleton rows={2} />
          <EmptyState
            title="Chưa có lịch ăn"
            action={
              <ActionLink href="/demo/traveler/roadmaps/new">
                Tạo lịch ăn
              </ActionLink>
            }
          />
          <Media alt="Ảnh chưa được cung cấp" />
          <div className="actions">
            <Avatar name="Tuấn" />
            <Avatar name="Mai" />
          </div>
        </Card>
      </div>
      <Card title="Tải ảnh và tài liệu">
        <UploadField
          label="Ảnh món ăn"
          files={files}
          onChange={setFiles}
          max={10}
        />
        <UploadField
          label="Tài liệu xác minh"
          files={documents}
          onChange={setDocuments}
          documents
          max={5}
        />
      </Card>
      <Card title="Bảng, bộ lọc và phân trang">
        <Field
          label="Tìm nhà hàng"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPage(1);
          }}
        />
        <DataTable
          rows={data.restaurants.filter(
            (r) =>
              r.name
                .toLocaleLowerCase("vi")
                .includes(text.toLocaleLowerCase("vi")) || text === "Hà Nội",
          )}
          caption="Nhà hàng minh họa"
          page={page}
          onPage={setPage}
          size={2}
          columns={[
            { label: "Nhà hàng", render: (r) => r.name },
            { label: "Địa chỉ", render: (r) => r.address },
            {
              label: "Trạng thái",
              render: (r) => (
                <Badge>
                  {r.operating === "open" ? "Đang mở" : "Đang đóng"}
                </Badge>
              ),
            },
          ]}
        />
      </Card>
      <div className="grid-3">
        <DishCard
          dish={data.dishes[0]}
          href="/demo/traveler/restaurants/bep-nha"
        />
        <RestaurantCard
          restaurant={data.restaurants[0]}
          href="/demo/traveler/restaurants/bep-nha"
        />
        <BlogCard blog={data.blogs[0]} href="/demo/traveler/guides/guide-1" />
      </div>
      <RestaurantStatuses restaurant={data.restaurants[0]} />
      <Card title="Đánh giá và phản hồi">
        <ReviewContent review={data.reviews[1]} />
      </Card>
      <Card title="Quyền kế thừa / cho phép / từ chối">
        <SelectField
          label="Quyền xem tổng quan"
          value={permission}
          onChange={setPermission}
          options={[
            { value: "inherit", label: "Kế thừa" },
            { value: "allow", label: "Cho phép" },
            { value: "deny", label: "Từ chối" },
          ]}
        />
        <p>
          Hiệu lực:{" "}
          {effectivePermission(
            data.permissions[12],
            permission as "inherit" | "allow" | "deny",
          )
            ? "Cho phép"
            : "Không có quyền"}
        </p>
      </Card>
      <Card title="Trạng thái nghiệp vụ để kiểm tra">
        <p className="helper">
          Các điều khiển này chỉ xuất hiện trong thư viện phát triển.
        </p>
        <div className="actions">
          <Button
            loading={busy}
            onClick={() =>
              void mutate((d) => {
                d.submissions.find((s) => s.kind === "menu")!.status = "draft";
              })
            }
          >
            Thực đơn ở bản nháp
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void mutate((d) => {
                d.submissions.find((s) => s.kind === "menu")!.status =
                  "pending";
              })
            }
          >
            Thực đơn chờ duyệt
          </Button>
          <Button variant="secondary" onClick={() => setDialog("readonly")}>
            Ngữ cảnh không khả dụng
          </Button>
        </div>
        <p>
          Trạng thái thực đơn:{" "}
          {data.submissions.find((s) => s.kind === "menu")?.status}
        </p>
      </Card>
      <Dialog
        open={
          dialog === "dialog" || dialog === "drawer" || dialog === "readonly"
        }
        drawer={dialog === "drawer"}
        onClose={() => setDialog("")}
        title={
          dialog === "readonly" ? "Ngữ cảnh chỉ xem" : "Thông tin chi tiết"
        }
        footer={<Button onClick={() => setDialog("")}>Đóng</Button>}
      >
        {dialog === "readonly" ? (
          <Alert tone="warning">
            Không có nguồn đọc riêng cho bài viết và bình luận bị ẩn. Metadata
            hiện có chỉ xem.
          </Alert>
        ) : (
          <div className="stack">
            <Field label="Tên hiển thị" defaultValue="Tuấn Nguyễn Minh" />
            <p>
              Nội dung cuộn trong hộp thoại; Escape đóng và trả tiêu điểm về nút
              mở.
            </p>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={dialog === "confirm"}
        title="Xóa mục minh họa?"
        destructive
        onClose={() => setDialog("")}
        onConfirm={() => {
          setDialog("");
          notify("Đã xác nhận thao tác trong thư viện.");
        }}
      >
        <p>Chọn Hủy để giữ nội dung.</p>
      </ConfirmDialog>
      <MapPicker
        open={dialog === "map"}
        onClose={() => setDialog("")}
        onSelect={() => {
          setDialog("");
          notify("Đã chọn tọa độ minh họa.");
        }}
      />
    </div>
  );
}
