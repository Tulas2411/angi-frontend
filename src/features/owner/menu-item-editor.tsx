"use client";
import { useEffect, useRef, useState } from "react";
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
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus(),
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
  async function save() {
    if (locked.current) return;
    const invalid = validateMenuItem(values, item);
    setErrors(invalid);
    setProblem("");
    if (Object.keys(invalid).length) return;
    const patch = menuItemRequest(values, item);
    if (item && !Object.keys(patch).length) {
      onClose();
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      const saved = item
        ? await service.update(submissionId, item.id, patch)
        : await service.add(submissionId, newMenuItemRequest(values));
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
  return (
    <>
      <Dialog
        open
        wide
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
          <Field
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
          <div className="grid-2">
            <Field
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
          </div>
          <Field
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
          <fieldset disabled={disabled} className="stack-sm">
            <legend>Nhãn món ăn</legend>
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
            <div className="menu-tags">
              {tags.map((tag) => (
                <Choice
                  key={tag.id}
                  label={tag.name}
                  checked={values.tagIds.includes(tag.id)}
                  onChange={(checked) =>
                    setValues((previous) => ({
                      ...previous,
                      tagIds: checked
                        ? [...previous.tagIds, tag.id]
                        : previous.tagIds.filter((id) => id !== tag.id),
                    }))
                  }
                />
              ))}
            </div>
            {values.tagIds
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
          <div className="registration-image-upload stack-sm">
            <span id="menu-image-label">Ảnh món ăn</span>
            <p id="menu-image-help" className="helper">
              JPG, PNG hoặc WEBP · Tối đa 5 MB.
            </p>
            <div className="upload-grid">
              {values.coverUrl ? (
                <div className="upload-tile">
                  <Media src={values.coverUrl} alt="Ảnh món ăn" />
                  <Button
                    variant="icon"
                    aria-label="Bỏ ảnh món ăn"
                    disabled={disabled}
                    onClick={() => setConfirm("image")}
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <div className="registration-image-add">
                  <span aria-hidden>+</span>
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
            </div>
            {uploading && <p role="status">Đang tải ảnh…</p>}
            <p
              id="menu-image-error"
              role={errors.coverMediaId ? "alert" : undefined}
              className="field-error"
            >
              {errors.coverMediaId}
            </p>
          </div>
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
