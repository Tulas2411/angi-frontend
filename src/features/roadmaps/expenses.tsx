"use client";
import { useState } from "react";
import { Alert, Button, Card } from "@/shared/ui";
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  SelectField,
} from "@/components/ui/primitives";
import { usePlatform } from "@/features/platform/provider";
import { dateLabel, money } from "@/features/platform/rules";
export function TripExpenses({
  id,
  readOnly,
}: {
  id: string;
  readOnly: boolean;
}) {
  const { data, mutate, busy } = usePlatform(),
    trip = data.trips.find((t) => t.id === id)!;
  const [open, setOpen] = useState(false),
    [category, setCategory] = useState("Ăn uống"),
    [date, setDate] = useState(trip.start),
    [name, setName] = useState(""),
    [amount, setAmount] = useState(""),
    [sort, setSort] = useState("new"),
    [remove, setRemove] = useState<string | null>(null);
  const records = [...(trip.expenses ?? [])].sort((a, b) =>
    sort === "high"
      ? b.amount - a.amount
      : sort === "low"
        ? a.amount - b.amount
        : sort === "category"
          ? a.category.localeCompare(b.category, "vi")
          : sort === "old"
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date),
  );
  return (
    <Card title="Chi phí ăn uống">
      <div className="between">
        <strong>
          Tổng đã ghi: {money(records.reduce((sum, r) => sum + r.amount, 0))}
        </strong>
        {!readOnly && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            ＋ Thêm chi phí
          </Button>
        )}
      </div>
      <SelectField
        label="Sắp xếp chi phí"
        value={sort}
        onChange={setSort}
        options={[
          { value: "new", label: "Ngày mới nhất" },
          { value: "old", label: "Ngày cũ nhất" },
          { value: "high", label: "Số tiền cao nhất" },
          { value: "low", label: "Số tiền thấp nhất" },
          { value: "category", label: "Danh mục" },
        ]}
      />
      {records.length ? (
        records.map((record) => (
          <div className="between expense-row" key={record.id}>
            <div>
              <strong>{record.name}</strong>
              <p className="helper">
                {record.category} · {dateLabel(record.date)}
              </p>
            </div>
            <span>{money(record.amount)}</span>
            {!readOnly && (
              <Button
                variant="tertiary"
                onClick={() => setRemove(record.id)}
                aria-label={`Xóa chi phí ${record.name}`}
              >
                Xóa
              </Button>
            )}
          </div>
        ))
      ) : (
        <EmptyState title="Chưa ghi nhận chi phí ăn uống" />
      )}
      <p className="helper">
        Chi phí bạn ghi riêng với dự chi theo món. Dữ liệu minh họa.
      </p>
      <Dialog open={open} title="Thêm chi phí" onClose={() => setOpen(false)}>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await mutate((d) => {
              const target = d.trips.find((t) => t.id === id)!;
              target.expenses ??= [];
              target.expenses.push({
                id: crypto.randomUUID(),
                name: name.trim(),
                amount: Number(amount),
                category,
                date,
              });
            });
            setOpen(false);
            setName("");
            setAmount("");
          }}
        >
          <SelectField
            label="Chọn khoản chi"
            value={category}
            onChange={setCategory}
            options={["Ăn uống", "Đồ uống", "Ăn vặt"].map((value) => ({
              value,
              label: value,
            }))}
          />
          <Field
            label="Tên khoản chi"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Số tiền"
            required
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            helper="VNĐ"
          />
          <Field
            label="Ngày chi"
            required
            type="date"
            min={trip.start}
            max={trip.end}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Alert tone="info">
            Khoản chi minh họa do bạn nhập; không phải thanh toán tại quán.
          </Alert>
          <Button type="submit" loading={busy}>
            Lưu chi phí
          </Button>
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!remove}
        title="Xóa khoản chi?"
        destructive
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          await mutate((d) => {
            const target = d.trips.find((t) => t.id === id)!;
            target.expenses = target.expenses?.filter((e) => e.id !== remove);
          });
          setRemove(null);
        }}
      >
        <p>Khoản chi sẽ được xóa khỏi bản minh họa.</p>
      </ConfirmDialog>
    </Card>
  );
}
