"use client";
import { useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@/shared/ui";
import { Choice, Dialog, Field } from "@/components/ui/primitives";
import { ProvinceField } from "@/components/domain/province-field";
import type { AgentState } from "./agent-types";

/** Only explicitly confirmed fields are changed; tags, origin and scope are preserved. */
export function AgentConstraintsDialog({
  state,
  onClose,
  onSubmit,
}: {
  state: AgentState;
  onClose: () => void;
  onSubmit: (state: AgentState) => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(state.title);
  const [province, setProvince] = useState(state.province ?? "");
  const [days, setDays] = useState(String(state.numDays ?? ""));
  const [budget, setBudget] = useState(String(state.budgetAmount ?? ""));
  const [unrestricted, setUnrestricted] = useState(state.budgetUnrestricted);
  const [maxPrice, setMaxPrice] = useState(String(state.maxPricePerMeal ?? ""));
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const numberOfDays = days.trim() ? Number(days) : null;
    const amount = budget.trim() ? Number(budget) : null;
    const price = maxPrice.trim() ? Number(maxPrice) : null;
    if (!title.trim() || title.trim().length > 200) {
      setError("Tên lộ trình cần từ 1 đến 200 ký tự.");
      return;
    }
    if (
      numberOfDays !== null &&
      (!Number.isInteger(numberOfDays) || numberOfDays < 1 || numberOfDays > 30)
    ) {
      setError("Số ngày cần từ 1 đến 30.");
      return;
    }
    if (
      numberOfDays !== null &&
      state.focusDay !== null &&
      state.focusDay > numberOfDays
    ) {
      setError(
        "Ngày đang được chọn nằm ngoài số ngày mới. Hãy đổi phạm vi với trợ lý trước.",
      );
      return;
    }
    if (
      (!unrestricted &&
        amount !== null &&
        (!Number.isSafeInteger(amount) ||
          amount < 0 ||
          amount > 99999999999999)) ||
      (price !== null && (!Number.isSafeInteger(price) || price < 0))
    ) {
      setError(
        "Ngân sách cần là số nguyên từ 0 đến 99.999.999.999.999 đồng; giá mỗi món cần là số nguyên không âm.",
      );
      return;
    }
    if (province.trim().length > 100) {
      setError("Tỉnh/thành tối đa 100 ký tự.");
      return;
    }
    onSubmit({
      ...state,
      title: title.trim(),
      province: province.trim() || null,
      numDays: numberOfDays,
      budgetAmount: unrestricted ? null : amount,
      budgetUnrestricted: unrestricted,
      maxPricePerMeal: price,
    });
  }
  return (
    <Dialog
      open
      title="Xác nhận ràng buộc với trợ lý"
      onClose={onClose}
      focusField
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form={id}>
            Xác nhận và gửi
          </Button>
        </>
      }
    >
      <form id={id} className="stack" onSubmit={submit}>
        <p>
          Trợ lý sẽ dùng đúng các giá trị bạn xác nhận tại đây cho yêu cầu mới.
          Thay đổi chưa được lưu vào lộ trình.
        </p>
        {error && <Alert>{error}</Alert>}
        <Field
          label="Tên lộ trình"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
        />
        <ProvinceField
          label="Tỉnh/thành muốn khám phá"
          value={province}
          onChange={setProvince}
        />
        <Field
          label="Số ngày"
          type="number"
          min={1}
          max={30}
          step={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <Field
          label="Ngân sách cả chuyến / người (VND)"
          type="number"
          min={0}
          max={99999999999999}
          step={1}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          disabled={unrestricted}
        />
        <Choice
          label="Không giới hạn ngân sách (xóa mức đang đặt)"
          checked={unrestricted}
          onChange={setUnrestricted}
        />
        <Field
          label="Giá tối đa mỗi món (VND)"
          type="number"
          min={0}
          step={1}
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
        <p className="helper">
          Bộ lọc gồm {state.tagIds.length} tag cần có và{" "}
          {state.excludeTagIds.length} tag cần tránh, điểm xuất phát và phạm vi
          ngày/bữa được giữ nguyên. Muốn đổi chúng, hãy trao đổi rõ với trợ lý
          trước.
        </p>
      </form>
    </Dialog>
  );
}
