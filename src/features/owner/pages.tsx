"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import {
  ActionLink,
  Choice,
  ConfirmDialog,
  DataTable,
  Dialog,
  Field,
  Media,
  SelectField,
  Tabs,
  TextArea,
  UploadField,
  type UploadedFile,
} from "@/components/ui/primitives";
import {
  RestaurantStatuses,
  ReviewContent,
  submissionLabels,
} from "@/components/domain/cards";
import { PageHeading, useWorkspace } from "@/components/layout/workspace";
import { usePlatform } from "@/features/platform/provider";
import { dateLabel, money } from "@/features/platform/rules";
import type { Dish } from "@/features/platform/contracts";
import { EmptyState } from "@/components/ui/primitives";
import { RestaurantRegistrationPage } from "./restaurant-registration-page";
import { RestaurantProfilePage } from "./restaurant-profile-page";
import { RestaurantBusinessHoursPage } from "./restaurant-business-hours-page";
import { RestaurantOperatingStatusPage } from "./restaurant-operating-status-page";

export function OwnerOverview() {
  const { data } = usePlatform(),
    { base } = useWorkspace(),
    restaurant = data.restaurants.find((r) => r.id === data.ownerRestaurantId),
    menu = data.submissions.find((s) => s.kind === "menu");
  if (!restaurant)
    return (
      <div className="stack">
        <PageHeading
          title="Chào bạn, bắt đầu với nhà hàng của mình nhé."
          description="Đăng ký thông tin nhà hàng trước khi quản lý thực đơn và gửi hồ sơ xác minh."
        />
        <Card>
          <EmptyState
            title="Bạn chưa có nhà hàng"
            action={
              <ActionLink href={`${base}/profile`}>Đăng ký nhà hàng</ActionLink>
            }
          />
        </Card>
      </div>
    );
  return (
    <div className="stack">
      <PageHeading
        title={`Một ngày mới tại ${restaurant.name}.`}
        description="Những việc cần làm và trạng thái nhà hàng, rõ ràng tại một nơi."
      />
      <Card className="elevated">
        <div className="profile-card">
          <Media src={restaurant.image} alt={restaurant.name} />
          <div className="stack-sm">
            <h2>{restaurant.name}</h2>
            <p>{restaurant.address}</p>
            <p className="helper">Cập nhật minh họa: 03/10/2026 · 09:20</p>
            <ActionLink href={`${base}/profile`} secondary>
              Quản lý nhà hàng
            </ActionLink>
          </div>
        </div>
      </Card>
      <RestaurantStatuses restaurant={restaurant} />
      {menu && (
        <Alert tone="info">
          Bạn có một bản thực đơn · {submissionLabels[menu.status]}. Thực đơn
          hiện tại vẫn phục vụ khách trong khi bạn chỉnh sửa.
        </Alert>
      )}
      <div className="grid-2">
        <Card className="elevated" title="Tiếp tục thực đơn">
          <p>Hoàn tất nội dung, kiểm tra thay đổi rồi gửi duyệt.</p>
          <ActionLink href={`${base}/menu`}>Tiếp tục thực đơn</ActionLink>
        </Card>
        <Card className="elevated" title="Lắng nghe thực khách">
          <p>Đọc đánh giá và trả lời trong đúng ngữ cảnh.</p>
          <ActionLink href={`${base}/reviews`} secondary>
            Xem đánh giá
          </ActionLink>
        </Card>
      </div>
      <div className="actions">
        <ActionLink href={`${base}/profile?tab=hours`} secondary>
          Giờ mở cửa
        </ActionLink>
        <ActionLink href={`${base}/profile?tab=photos`} secondary>
          Hình ảnh nhà hàng
        </ActionLink>
        <ActionLink href={`${base}/notifications`} secondary>
          Thông báo ·{" "}
          {
            data.notices.filter((n) => n.role === "RESTAURANT_OWNER" && !n.read)
              .length
          }{" "}
          chưa đọc
        </ActionLink>
      </div>
    </div>
  );
}
export function OwnerRestaurant({
  initialTab = "information",
}: {
  initialTab?: string;
}) {
  const { data } = usePlatform();
  // Keep the onboarding component mounted when its mutation publishes the new restaurant.
  const [registering] = useState(
    () =>
      !data.restaurants.some(
        (restaurant) => restaurant.id === data.ownerRestaurantId,
      ),
  );
  if (registering) return <RestaurantRegistrationPage />;
  if (initialTab === "hours") return <RestaurantBusinessHoursPage />;
  if (initialTab === "status") return <RestaurantOperatingStatusPage />;
  return <RestaurantProfilePage initialTab={initialTab} />;
}

export function VerificationPage() {
  const { data, mutate, busy } = usePlatform(),
    [tab, setTab] = useState("status"),
    [legalName, setLegalName] = useState("Hộ kinh doanh Bếp Nhà"),
    [license, setLicense] = useState("01A8023456"),
    [tax, setTax] = useState(""),
    [note, setNote] = useState(""),
    [types, setTypes] = useState<Record<string, string>>({}),
    [documents, setDocuments] = useState<UploadedFile[]>([]),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const records = data.submissions.filter((s) => s.kind === "verification"),
    pending = records.some((s) => s.status === "pending");
  return (
    <div className="stack">
      <PageHeading
        title="Xác minh nhà hàng"
        description="Chuẩn bị giấy phép kinh doanh và thông tin pháp lý của nhà hàng."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "status", label: "Trạng thái và lịch sử" },
          { value: "new", label: "Hồ sơ xác minh" },
        ]}
      />
      {tab === "status" ? (
        <>
          <RestaurantStatuses restaurant={data.restaurants[0]} />
          <Card title="Lịch sử hồ sơ">
            <DataTable
              caption="Lịch sử xác minh"
              rows={records}
              columns={[
                { label: "Ngày gửi", render: (s) => dateLabel(s.date) },
                { label: "Tên pháp lý", render: (s) => s.legalName },
                {
                  label: "Trạng thái",
                  render: (s) => <Badge>{submissionLabels[s.status]}</Badge>,
                },
                { label: "Ghi chú", render: (s) => s.note },
              ]}
            />
            {pending && (
              <Alert tone="info">
                Hồ sơ đang chờ chỉ xem, không thể sửa hoặc hủy.
              </Alert>
            )}
          </Card>
        </>
      ) : pending ? (
        <Alert tone="warning">
          Có hồ sơ đang chờ duyệt. Xem trạng thái và lịch sử trước khi tạo hồ sơ
          mới.
        </Alert>
      ) : (
        <Card title="Hồ sơ xác minh">
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !documents.some(
                  (f) =>
                    (types[f.id] ?? "Giấy phép kinh doanh") ===
                    "Giấy phép kinh doanh",
                )
              ) {
                setError("Tải ít nhất một giấy phép kinh doanh.");
                return;
              }
              setError("");
              setConfirm(true);
            }}
          >
            <Field
              label="Tên pháp lý"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              maxLength={255}
              required
            />
            <Field
              label="Số giấy phép kinh doanh"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              maxLength={50}
              required
            />
            <Field
              label="Mã số thuế"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
              maxLength={20}
            />
            <UploadField
              label="Tài liệu xác minh *"
              documents
              max={5}
              files={documents}
              onChange={setDocuments}
            />
            {documents.map((file) => (
              <SelectField
                key={file.id}
                label={`Loại tài liệu · ${file.name}`}
                value={types[file.id] ?? "Giấy phép kinh doanh"}
                onChange={(value) =>
                  setTypes((t) => ({ ...t, [file.id]: value }))
                }
                options={[
                  "Giấy phép kinh doanh",
                  "Giấy chứng nhận an toàn thực phẩm",
                  "Tài liệu khác",
                ].map((value) => ({ value, label: value }))}
              />
            ))}
            <TextArea
              label="Ghi chú của bạn"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
            {error && <Alert>{error}</Alert>}
            <Alert tone="info">
              Tài liệu chỉ được dùng cho việc xác minh. Bản minh họa không gửi
              tài liệu ra ngoài.
            </Alert>
            <Button type="submit">Gửi hồ sơ xác minh</Button>
          </form>
        </Card>
      )}
      <ConfirmDialog
        open={confirm}
        title="Gửi hồ sơ xác minh?"
        loading={busy}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await mutate((d) => {
            d.submissions.unshift({
              id: crypto.randomUUID(),
              kind: "verification",
              restaurantId: "bep-nha",
              status: "pending",
              date: "2026-10-09",
              note,
              legalName,
              license,
              taxCode: tax,
              documents: documents.map((f) => ({
                type: types[f.id] ?? "Giấy phép kinh doanh",
                name: f.name,
              })),
            });
            d.restaurants[0].verification = "pending";
          });
          setConfirm(false);
          setTab("status");
        }}
      >
        <p>Sau khi gửi, hồ sơ đang chờ chỉ xem.</p>
      </ConfirmDialog>
    </div>
  );
}
function DishEditor({
  dish,
  onClose,
  onSave,
}: {
  dish: Dish;
  onClose: () => void;
  onSave: (dish: Dish) => Promise<void>;
}) {
  const [form, setForm] = useState(dish),
    [files, setFiles] = useState<UploadedFile[]>(
      dish.image
        ? [
            {
              id: "dish-photo",
              name: "Ảnh món",
              url: dish.image,
              size: 1258291,
              type: "image/png",
            },
          ]
        : [],
    ),
    [error, setError] = useState("");
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (form.description.trim().length < 30) {
          setError("Mô tả cần từ 30 đến 2.000 ký tự.");
          return;
        }
        await onSave({
          ...form,
          name: form.name.trim(),
          image: files[0]?.url ?? "",
        });
        onClose();
      }}
    >
      <Field
        label="Tên món"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        required
        minLength={1}
        maxLength={200}
      />
      <TextArea
        label="Mô tả"
        value={form.description}
        onChange={(e) =>
          setForm((f) => ({ ...f, description: e.target.value }))
        }
        minLength={30}
        maxLength={2000}
        required
        error={error}
      />
      <Field
        label="Giá"
        type="number"
        min={0}
        value={form.price}
        onChange={(e) =>
          setForm((f) => ({ ...f, price: Number(e.target.value) }))
        }
        required
        helper="Đồng · Giá không âm"
      />
      <SelectField
        label="Dạng món *"
        value={form.kind}
        onChange={(v) => setForm((f) => ({ ...f, kind: v as Dish["kind"] }))}
        options={[
          { value: "water", label: "Món nước" },
          { value: "dry", label: "Món khô" },
          { value: "other", label: "Khác" },
        ]}
      />
      <UploadField
        label="Ảnh món · Không bắt buộc"
        files={files}
        onChange={setFiles}
      />
      <fieldset>
        <legend>Thẻ món · Không bắt buộc</legend>
        <div className="actions">
          {[
            "Bữa sáng",
            "Bữa trưa",
            "Bữa tối",
            "Món Việt",
            "Ăn chay",
            "Tráng miệng",
          ].map((tag) => (
            <Choice
              key={tag}
              label={tag}
              checked={form.tags.includes(tag)}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  tags: v ? [...f.tags, tag] : f.tags.filter((t) => t !== tag),
                }))
              }
            />
          ))}
        </div>
      </fieldset>
      <div className="actions">
        <Button type="submit">Lưu món</Button>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </form>
  );
}
export function OwnerMenuPage() {
  const { data, mutate, busy } = usePlatform(),
    [tab, setTab] = useState("current"),
    [edit, setEdit] = useState<Dish | null>(null),
    [remove, setRemove] = useState<string | null>(null),
    [confirm, setConfirm] = useState<"submit" | "cancel" | null>(null),
    [note, setNote] = useState(
      "Bổ sung món tráng miệng và cập nhật giá phở bò.",
    );
  const submission = data.submissions.find((s) => s.kind === "menu"),
    editable = submission?.status === "draft",
    rows = (tab === "current" ? data.dishes : data.menuDraft).filter(
      (d) => d.restaurantId === "bep-nha",
    );
  const updateDraft = async (dish: Dish) =>
    mutate((d) => {
      const i = d.menuDraft.findIndex((x) => x.id === dish.id);
      if (i < 0) d.menuDraft.push(dish);
      else d.menuDraft[i] = dish;
    });
  async function move(id: string, delta: number) {
    await mutate((d) => {
      const i = d.menuDraft.findIndex((x) => x.id === id),
        to = i + delta;
      if (to >= 0 && to < d.menuDraft.length)
        [d.menuDraft[i], d.menuDraft[to]] = [d.menuDraft[to], d.menuDraft[i]];
    });
  }
  return (
    <div className="stack">
      <PageHeading
        title={
          tab === "current"
            ? "Thực đơn hiện tại"
            : tab === "history"
              ? "Lịch sử gửi duyệt"
              : "Bản chỉnh sửa thực đơn"
        }
        description="Tên, mô tả, giá, ảnh, thẻ và thứ tự món được gửi duyệt. Trạng thái phục vụ cập nhật ngay."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "current", label: "Thực đơn hiện tại" },
          { value: "draft", label: "Bản chỉnh sửa" },
          { value: "review", label: "Kiểm tra và gửi duyệt" },
          { value: "history", label: "Lịch sử gửi duyệt" },
        ]}
      />
      <Alert tone="info">
        Thực đơn đang công khai chỉ thay đổi sau khi bản gửi được phê duyệt.
      </Alert>
      {tab === "history" ? (
        <Card title="Lịch sử">
          <DataTable
            rows={data.submissions.filter((s) => s.kind === "menu")}
            caption="Lịch sử thực đơn"
            columns={[
              { label: "Ngày gửi", render: (s) => dateLabel(s.date) },
              {
                label: "Trạng thái",
                render: (s) => submissionLabels[s.status],
              },
              { label: "Ghi chú", render: (s) => s.note },
            ]}
          />
        </Card>
      ) : tab === "review" ? (
        <>
          <Card title="Các thay đổi sẽ được gửi">
            {data.menuDraft.map((dish) => {
              const before = data.dishes.find((d) => d.id === dish.id);
              return (
                <div key={dish.id} className="stack-sm">
                  <h3>
                    {dish.name} ·{" "}
                    {before
                      ? before.price === dish.price
                        ? "Không đổi"
                        : "Đã sửa"
                      : "Mới"}
                  </h3>
                  <p>
                    Giá: {before ? money(before.price) + " → " : ""}
                    {money(dish.price)}
                  </p>
                </div>
              );
            })}
            {data.dishes
              .filter(
                (d) =>
                  d.restaurantId === "bep-nha" &&
                  !data.menuDraft.some((x) => x.id === d.id),
              )
              .map((d) => (
                <Alert tone="warning" key={d.id}>
                  {d.name} sẽ bị bỏ sau khi duyệt.
                </Alert>
              ))}
          </Card>
          <Card title="Ghi chú gửi duyệt">
            <TextArea
              label="Ghi chú của bạn"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              readOnly={!editable}
            />
            <Button
              disabled={!editable || !data.menuDraft.length}
              onClick={() => setConfirm("submit")}
            >
              Gửi duyệt
            </Button>
          </Card>
        </>
      ) : (
        <>
          {tab === "draft" && (
            <div className="between">
              <Badge>
                {submission
                  ? submissionLabels[submission.status]
                  : "Chưa có bản chỉnh sửa"}
              </Badge>
              <div className="actions">
                {editable ? (
                  <>
                    <Button
                      onClick={() =>
                        setEdit({
                          id: crypto.randomUUID(),
                          restaurantId: "bep-nha",
                          name: "",
                          description: "",
                          price: 0,
                          image: "",
                          kind: "dry",
                          tags: [],
                          serving: true,
                          moderation: "visible",
                        })
                      }
                    >
                      Thêm món
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setTab("review")}
                    >
                      Kiểm tra và gửi duyệt
                    </Button>
                  </>
                ) : (
                  submission?.status !== "pending" && (
                    <Button
                      onClick={() =>
                        void mutate((d) => {
                          d.menuDraft = structuredClone(
                            d.dishes.filter(
                              (dish) => dish.restaurantId === "bep-nha",
                            ),
                          );
                          d.submissions.unshift({
                            id: crypto.randomUUID(),
                            kind: "menu",
                            restaurantId: "bep-nha",
                            status: "draft",
                            date: "2026-10-09",
                            note: "",
                          });
                        })
                      }
                    >
                      Tạo bản chỉnh sửa mới
                    </Button>
                  )
                )}
                {(editable || submission?.status === "pending") && (
                  <Button
                    variant="tertiary"
                    onClick={() => setConfirm("cancel")}
                  >
                    Hủy bản chỉnh sửa
                  </Button>
                )}
              </div>
            </div>
          )}
          <Card
            title={`${rows.length} món ${tab === "current" ? "trong thực đơn" : "sau chỉnh sửa"}`}
          >
            {rows.map((dish, index) => (
              <div className="menu-row" key={dish.id}>
                <Media src={dish.image} alt={dish.name} />
                <div className="description stack-sm">
                  <strong>{dish.name}</strong>
                  <span className="helper">{dish.tags.join(" · ")}</span>
                  {dish.moderation === "hidden" && (
                    <span className="helper">Hiển thị: Bị ẩn</span>
                  )}
                </div>
                <span className="price">{money(dish.price)}</span>
                {tab === "current" ? (
                  <Choice
                    kind="switch"
                    label={dish.serving ? "Đang phục vụ" : "Tạm hết món"}
                    checked={dish.serving}
                    onChange={(v) =>
                      void mutate((d) => {
                        d.dishes.find((x) => x.id === dish.id)!.serving = v;
                      })
                    }
                  />
                ) : (
                  editable && (
                    <div className="actions">
                      <Button
                        variant="secondary"
                        disabled={index === 0}
                        onClick={() => void move(dish.id, -1)}
                      >
                        Lên
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={index === rows.length - 1}
                        onClick={() => void move(dish.id, 1)}
                      >
                        Xuống
                      </Button>
                      <Button variant="secondary" onClick={() => setEdit(dish)}>
                        Sửa
                      </Button>
                      <Button
                        variant="tertiary"
                        onClick={() => setRemove(dish.id)}
                      >
                        Bỏ
                      </Button>
                    </div>
                  )
                )}
                <Badge>Thứ tự {index + 1}</Badge>
              </div>
            ))}
          </Card>
        </>
      )}
      <Dialog
        open={!!edit}
        onClose={() => setEdit(null)}
        title={
          data.menuDraft.some((d) => d.id === edit?.id) ? "Sửa món" : "Thêm món"
        }
      >
        {edit && (
          <DishEditor
            key={edit.id}
            dish={edit}
            onSave={updateDraft}
            onClose={() => setEdit(null)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!remove}
        title="Bỏ món khỏi bản chỉnh sửa?"
        destructive
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          await mutate((d) => {
            d.menuDraft = d.menuDraft.filter((dish) => dish.id !== remove);
          });
          setRemove(null);
        }}
      >
        <p>Thực đơn hiện tại vẫn giữ món cho đến khi được duyệt.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm === "submit"
            ? "Gửi toàn bộ bản thực đơn?"
            : "Hủy bản chỉnh sửa?"
        }
        destructive={confirm === "cancel"}
        loading={busy}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await mutate((d) => {
            const s = d.submissions.find((s) => s.kind === "menu")!;
            s.status = confirm === "submit" ? "pending" : "cancelled";
            s.note = note;
          });
          setConfirm(null);
          setTab("draft");
        }}
      >
        <p>
          {confirm === "submit"
            ? "Bản gửi chỉ xem sau khi gửi. Bạn không tự phê duyệt thực đơn."
            : "Bản chỉnh sửa sẽ bị hủy. Thực đơn hiện tại giữ nguyên."}
        </p>
      </ConfirmDialog>
    </div>
  );
}
export function OwnerReviewsPage() {
  const { data, mutate, busy } = usePlatform(),
    [filter, setFilter] = useState("all"),
    [stars, setStars] = useState("all"),
    [reply, setReply] = useState<string | null>(null),
    [text, setText] = useState("");
  const rows = data.reviews.filter(
    (r) =>
      (filter === "all" || !r.reply) &&
      (stars === "all" || r.rating === Number(stars)),
  );
  return (
    <div className="stack">
      <PageHeading
        title="Lắng nghe thực khách"
        description="Đọc đánh giá và phản hồi từng trải nghiệm."
      />
      <div className="grid-2">
        <SelectField
          label="Phản hồi"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "unanswered", label: "Chưa phản hồi" },
          ]}
        />
        <SelectField
          label="Số sao"
          value={stars}
          onChange={setStars}
          options={[
            { value: "all", label: "Mọi mức sao" },
            ...[1, 2, 3, 4, 5].map((v) => ({
              value: String(v),
              label: `${v} sao`,
            })),
          ]}
        />
      </div>
      <Card title={`${rows.length} đánh giá minh họa`}>
        {rows.map((r) => (
          <article className="review" key={r.id}>
            <ReviewContent review={r} />
            <Button
              variant="secondary"
              disabled={r.moderation !== "visible"}
              onClick={() => {
                setReply(r.id);
                setText(r.reply ?? "");
              }}
            >
              {r.reply ? "Sửa phản hồi" : "Phản hồi"}
            </Button>
            {r.moderation !== "visible" && (
              <p className="helper">Chỉ phản hồi đánh giá đang hiển thị.</p>
            )}
          </article>
        ))}
      </Card>
      <Dialog
        open={!!reply}
        onClose={() => setReply(null)}
        title="Phản hồi thực khách"
      >
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            await mutate((d) => {
              const r = d.reviews.find((r) => r.id === reply)!;
              r.reply = text.trim();
              r.replyModeration = "visible";
            });
            setReply(null);
          }}
        >
          <TextArea
            label="Phản hồi của nhà hàng"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            required
          />
          <Button type="submit" loading={busy}>
            Lưu phản hồi
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
