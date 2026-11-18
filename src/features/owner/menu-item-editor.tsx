"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpTrayIcon,
  PhotoIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Alert, Button } from "@/shared/ui";
import {
  Choice,
  ConfirmDialog,
  Dialog,
  Field,
  Media,
  SelectField,
  TextArea,
} from "@/components/ui/primitives";
import { validateRestaurantImage } from "./registration-rules";
import {
  compareTags,
  excludedTags,
  isDishKindTag,
  isHiddenTag,
  mentionsSeafood,
  normalizeTagIds,
  SEAFOOD_CODE,
  tagGroups,
  tagPlacement,
  toggleTag,
} from "@/shared/tags/tag-catalog";
import {
  dishFormLabels,
  menuErrorMessage,
  menuFieldErrors,
  menuItemRequest,
  menuItemValues,
  newMenuItemRequest,
  validateMenuItem,
} from "./menu-rules";
import type { RestaurantMenuService } from "./menu-service";
import type { DishForm, MenuItemDto, MenuTagDto } from "./menu-types";
import "./restaurant-image-upload.css";
import "./menu-item-editor.css";

/** One group of tag chips; `ids` is the whole selection, `onToggle` applies the catalogue's companion rules. */
function TagGroup({
  title,
  tags,
  ids,
  excluded,
  onToggle,
  children,
}: {
  title: string;
  tags: MenuTagDto[];
  ids: number[];
  /** Chips a chosen diet rules out; they cannot be turned on (a chosen one can still be turned off). */
  excluded: ReadonlyMap<number, string>;
  onToggle: (id: number, checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="mie-tag-group">
      <span className="mie-tag-title">{title}</span>
      <div className="mie-tag-list">
        {tags.map((tag) => (
          <Choice
            key={tag.id}
            label={tag.name}
            checked={ids.includes(tag.id)}
            disabled={excluded.has(tag.id) && !ids.includes(tag.id)}
            onChange={(checked) => onToggle(tag.id, checked)}
          />
        ))}
        {children}
      </div>
    </div>
  );
}

export function MenuItemEditor({
  item,
  submissionId,
  service,
  onSaved,
  onClose,
}: {
  item?: MenuItemDto;
  submissionId: number;
  service: RestaurantMenuService;
  onSaved: (item: MenuItemDto) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState(() => menuItemValues(item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState("");
  const [tags, setTags] = useState<MenuTagDto[]>([]);
  const [tagProblem, setTagProblem] = useState("");
  const [tagsLoading, setTagsLoading] = useState(true);
  const [moreKinds, setMoreKinds] = useState(false);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<"discard" | "image" | null>(null);
  const active = useRef(true),
    locked = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const initial = useRef(JSON.stringify(menuItemValues(item)));
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLInputElement>("input:not([type=file])")
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  async function loadTags() {
    setTagsLoading(true);
    setTagProblem("");
    try {
      const result = await service.getTags();
      if (active.current) setTags(result);
    } catch (error) {
      if (active.current) setTagProblem(menuErrorMessage(error));
    } finally {
      if (active.current) setTagsLoading(false);
    }
  }
  useEffect(() => {
    let ignore = false;
    service
      .getTags()
      .then((result) => {
        if (!ignore) {
          setTags(result);
          setTagsLoading(false);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setTagProblem(menuErrorMessage(error));
          setTagsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [service]);
  function close() {
    if (locked.current) return;
    if (JSON.stringify(values) !== initial.current) setConfirm("discard");
    else onClose();
  }
  async function upload(file?: File) {
    if (!file || locked.current) return;
    const error = validateRestaurantImage(file);
    if (error) {
      setErrors((previous) => ({ ...previous, coverMediaId: error }));
      return;
    }
    locked.current = true;
    setUploading(true);
    setProblem("");
    try {
      const media = await service.upload(file);
      if (active.current) {
        setValues((previous) => ({
          ...previous,
          coverMediaId: media.id,
          coverUrl: media.url,
        }));
        setErrors((previous) => ({ ...previous, coverMediaId: "" }));
      }
    } catch (caught) {
      if (active.current)
        setErrors((previous) => ({
          ...previous,
          coverMediaId: menuErrorMessage(caught),
        }));
    } finally {
      locked.current = false;
      if (active.current) setUploading(false);
    }
  }
  // Companion rules applied to what was saved before (hidden main-dish tag → Món chính chip).
  const tagIds = normalizeTagIds(values.tagIds, tags);
  function toggle(id: number, checked: boolean) {
    setValues((previous) => ({
      ...previous,
      tagIds: toggleTag(normalizeTagIds(previous.tagIds, tags), tags, id, checked),
    }));
  }
  async function save() {
    if (locked.current) return;
    const current = { ...values, tagIds };
    const invalid = validateMenuItem(current, item, tags);
    setErrors(invalid);
    setProblem("");
    if (Object.keys(invalid).length) return;
    const patch = menuItemRequest(current, item);
    if (item && !Object.keys(patch).length) {
      onClose();
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      const saved = item
        ? await service.update(submissionId, item.id, patch)
        : await service.add(submissionId, newMenuItemRequest(current));
      if (active.current) onSaved(saved);
    } catch (caught) {
      if (active.current) {
        setErrors(menuFieldErrors(caught));
        setProblem(menuErrorMessage(caught));
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  const disabled = busy || uploading;
  const groups = tagGroups(tags);
  const openGroups = groups.filter((group) => group.placement === "open");
  const detailGroups = groups.filter((group) => group.placement === "detail");
  const detailChosen = detailGroups.flatMap((group) =>
    group.tags.filter((tag) => tagIds.includes(tag.id)),
  );
  const excluded = excludedTags(tagIds, tags);
  const excludedNames = tags
    .filter((tag) => excluded.has(tag.id) && !isHiddenTag(tag))
    .sort(compareTags)
    .map((tag) => tag.name);
  const dietNames = [...new Set(excluded.values())];
  const seafood = tags.find((tag) => tag.code === SEAFOOD_CODE);
  const remindSeafood =
    !!seafood &&
    !tagIds.includes(seafood.id) &&
    !excluded.has(seafood.id) &&
    mentionsSeafood(`${values.name} ${values.description}`);
  const noKind =
    tags.length > 0 &&
    !tags.some((tag) => isDishKindTag(tag) && tagIds.includes(tag.id));
  return (
    <>
      <Dialog
        open
        wide
        className="mie-dialog"
        title={item ? "Sửa món trong bản nháp" : "Thêm món vào bản nháp"}
        onClose={close}
        footer={
          <>
            <Button variant="secondary" disabled={disabled} onClick={close}>
              Đóng
            </Button>
            <Button
              type="submit"
              form="menu-item-form"
              loading={busy}
              disabled={uploading}
            >
              Lưu món
            </Button>
          </>
        }
      >
        <form
          id="menu-item-form"
          ref={formRef}
          className="stack"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {problem && <Alert tone="error">{problem}</Alert>}
          <div className="mie-grid">
          <div className="mie-photo">
            <span id="menu-image-label" className="mie-label">
              Ảnh món ăn
            </span>
            {values.coverUrl ? (
              <div className="mie-photo-frame">
                <Media src={values.coverUrl} alt="Ảnh món ăn" />
                <div className="mie-photo-actions">
                  <label className="mie-photo-replace">
                    <ArrowUpTrayIcon aria-hidden /> Đổi ảnh
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Đổi ảnh món ăn"
                      aria-describedby="menu-image-help menu-image-error"
                      disabled={disabled}
                      onChange={(event) => {
                        void upload(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <Button
                    variant="icon"
                    aria-label="Bỏ ảnh món ăn"
                    disabled={disabled}
                    onClick={() => setConfirm("image")}
                  >
                    <TrashIcon aria-hidden />
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="mie-photo-empty"
                data-invalid={!!errors.coverMediaId || undefined}
              >
                <PhotoIcon aria-hidden />
                <strong>Thêm ảnh món</strong>
                <span>Bấm để chọn ảnh</span>
                <input
                  className="registration-image-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-labelledby="menu-image-label"
                  aria-describedby="menu-image-help menu-image-error"
                  aria-invalid={!!errors.coverMediaId}
                  disabled={disabled}
                  onChange={(event) => {
                    void upload(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
            )}
            {uploading ? (
              <p role="status" className="helper">
                Đang tải ảnh…
              </p>
            ) : (
              <p id="menu-image-help" className="helper">
                JPG, PNG hoặc WEBP · Tối đa 5 MB. Ảnh ngang, chụp rõ món sẽ
                hiển thị đẹp nhất.
              </p>
            )}
            <p
              id="menu-image-error"
              role={errors.coverMediaId ? "alert" : undefined}
              className="field-error"
            >
              {errors.coverMediaId}
            </p>
          </div>
          <div className="mie-main">
          <Field
            placeholder="Ví dụ: Bún bò Huế"
            label="Tên món"
            autoFocus
            required
            maxLength={200}
            value={values.name}
            disabled={disabled}
            error={errors.name}
            onChange={(event) =>
              setValues({ ...values, name: event.target.value })
            }
          />
          <TextArea
            placeholder="Nguyên liệu, khẩu vị, khẩu phần…"
            label="Mô tả món"
            required
            maxLength={2000}
            helper="Từ 30 đến 2000 ký tự; mô tả nguyên liệu và cách chế biến."
            value={values.description}
            disabled={disabled}
            error={errors.description}
            onChange={(event) =>
              setValues({ ...values, description: event.target.value })
            }
          />
          <div className="mie-numbers">
            <Field
              placeholder="Ví dụ: 45000"
              label="Giá (VND)"
              type="number"
              min={0}
              max={999999999999}
              step={1}
              required
              value={values.price}
              disabled={disabled}
              error={errors.price}
              onChange={(event) =>
                setValues({ ...values, price: event.target.value })
              }
            />
            <SelectField
              label="Loại món"
              value={values.dishForm}
              disabled={disabled}
              error={errors.dishForm}
              options={Object.entries(dishFormLabels).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(value) =>
                setValues({ ...values, dishForm: value as DishForm })
              }
            />
          <Field
            placeholder="Ví dụ: 1"
            label="Thứ tự hiển thị"
            type="number"
            min={0}
            max={32767}
            step={1}
            helper={
              item
                ? "Số nhỏ hơn được hiển thị trước."
                : "Để trống để thêm vào cuối danh sách."
            }
            value={values.sortOrder}
            disabled={disabled}
            error={errors.sortOrder}
            onChange={(event) =>
              setValues({ ...values, sortOrder: event.target.value })
            }
          />
          </div>
          </div>
          </div>
          <fieldset disabled={disabled} className="mie-tags">
            <legend>Nhãn món ăn</legend>
            <p className="helper">
              Chọn một kiểu món, rồi bữa ăn và chế độ ăn nếu phù hợp. Mở Thêm chi
              tiết để ghi vai trò trong bữa, cách chế biến và nguyên liệu.
            </p>
            {tagsLoading && <p role="status">Đang tải nhãn…</p>}
            {tagProblem && (
              <>
                <Alert tone="warning">
                  {tagProblem} Các nhãn đã chọn được giữ nguyên.
                </Alert>
                <Button variant="secondary" onClick={() => void loadTags()}>
                  Tải lại nhãn
                </Button>
              </>
            )}
            {!tagsLoading && !tagProblem && !tags.length && (
              <p>Chưa có nhãn để chọn.</p>
            )}
            {openGroups.map((group) => {
              // "Xem thêm" chips stay hidden until opened, except the ones already chosen.
              const extra = group.tags.filter((tag) => tagPlacement(tag) === "more");
              const shown = group.tags.filter(
                (tag) =>
                  moreKinds ||
                  tagPlacement(tag) !== "more" ||
                  tagIds.includes(tag.id),
              );
              return (
                <TagGroup
                  key={group.type}
                  title={group.title}
                  tags={shown}
                  ids={tagIds}
                  excluded={excluded}
                  onToggle={toggle}
                >
                  {extra.length > 0 && (
                    <Button
                      variant="tertiary"
                      aria-expanded={moreKinds}
                      onClick={() => setMoreKinds(!moreKinds)}
                    >
                      {moreKinds ? "Thu gọn" : `Xem thêm (${extra.length})`}
                    </Button>
                  )}
                </TagGroup>
              );
            })}
            {noKind && !errors.tagIds && (
              <p className="helper">
                Món này chưa có kiểu món; chọn một kiểu để khách lọc thấy món.
              </p>
            )}
            {excludedNames.length > 0 && (
              <p className="helper">
                Đã chọn {dietNames.join(" và ")} nên không chọn được{" "}
                {excludedNames.join(", ").toLocaleLowerCase("vi")}.
              </p>
            )}
            {remindSeafood && seafood && (
              <Alert tone="warning">
                Tên hoặc mô tả có nhắc tới hải sản. Hãy chọn nhãn Hải sản để
                khách bị dị ứng lọc được món này.{" "}
                <Button variant="tertiary" onClick={() => toggle(seafood.id, true)}>
                  Chọn Hải sản
                </Button>
              </Alert>
            )}
            {detailGroups.length > 0 && (
              <div className="mie-tag-details">
                <Button
                  variant="tertiary"
                  aria-expanded={details}
                  aria-controls="menu-tag-details"
                  onClick={() => setDetails(!details)}
                >
                  {details ? "Ẩn chi tiết" : "Thêm chi tiết"}
                </Button>
                <div id="menu-tag-details" className="stack">
                  {details
                    ? detailGroups.map((group) => (
                        <TagGroup
                          key={group.type}
                          title={group.title}
                          tags={group.tags}
                          ids={tagIds}
                          excluded={excluded}
                          onToggle={toggle}
                        />
                      ))
                    : detailChosen.length > 0 && (
                        <TagGroup
                          title="Đã chọn"
                          tags={detailChosen}
                          ids={tagIds}
                          excluded={excluded}
                          onToggle={toggle}
                        />
                      )}
                </div>
              </div>
            )}
            {tagIds
              .filter((id) => !tags.some((tag) => tag.id === id))
              .map((id) => (
                <Choice
                  key={id}
                  label={`Nhãn đã lưu #${id}`}
                  checked
                  onChange={() =>
                    setValues((previous) => ({
                      ...previous,
                      tagIds: previous.tagIds.filter((value) => value !== id),
                    }))
                  }
                />
              ))}
            {errors.tagIds && (
              <p role="alert" className="field-error">
                {errors.tagIds}
              </p>
            )}
          </fieldset>
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "image" ? "Bỏ ảnh món ăn?" : "Bỏ thay đổi chưa lưu?"}
        destructive
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === "image")
            setValues((previous) => ({
              ...previous,
              coverMediaId: null,
              coverUrl: null,
            }));
          else onClose();
          setConfirm(null);
        }}
      >
        <p>
          {confirm === "image"
            ? "Ảnh sẽ được bỏ khỏi món khi bạn lưu thay đổi."
            : "Thông tin vừa nhập chưa được lưu vào bản nháp."}
        </p>
      </ConfirmDialog>
    </>
  );
}
