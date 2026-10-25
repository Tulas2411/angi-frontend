"use client";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/shared/ui";
import { ConfirmDialog } from "@/components/ui/primitives";
import { dayTitle, mealSlotLabels } from "./roadmap-detail-rules";
import {
  removeItemError,
  type RemoveOutcome,
} from "./roadmap-remove-item-rules";
import type { RoadmapItemService } from "./roadmap-service";
import type { RoadmapDayDto, RoadmapItemDto } from "./roadmap-types";

/** F-28: confirm, then delete one item of a day (RM-09). Other items are left as they are. */
export function RoadmapRemoveItemDialog({
  roadmapId,
  day,
  item,
  service,
  onRemoved,
  onClose,
}: {
  roadmapId: number;
  day: RoadmapDayDto;
  item: RoadmapItemDto;
  service: Pick<RoadmapItemService, "deleteItem">;
  /** The item is gone (deleted now, or already gone); the parent reloads the roadmap. */
  onRemoved: (outcome: RemoveOutcome) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deleting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function confirm() {
    if (deleting.current) return;
    deleting.current = true;
    setBusy(true);
    setError("");
    try {
      await service.deleteItem(roadmapId, item.id);
      if (mounted.current) onRemoved("removed");
    } catch (caught) {
      if (!mounted.current) return;
      const failure = removeItemError(caught);
      if (failure.gone) onRemoved("already-gone");
      else setError(failure.message);
    } finally {
      deleting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open
      destructive
      loading={busy}
      title="Xóa món khỏi lộ trình?"
      label="Xóa món"
      cancelLabel="Giữ món"
      onClose={() => {
        if (!busy) onClose();
      }}
      onConfirm={() => void confirm()}
    >
      <div className="stack-sm">
        <p>
          <strong>{item.dish.name}</strong> ({item.dish.restaurant.name}) sẽ bị
          xóa khỏi {mealSlotLabels[item.mealSlot].toLowerCase()} của{" "}
          {dayTitle(day)}.
        </p>
        <p className="helper">
          Các món khác trong lộ trình không bị ảnh hưởng. Đánh giá bạn đã gửi
          cho món này (nếu có) vẫn được giữ.
        </p>
        {error && <Alert>{error}</Alert>}
      </div>
    </ConfirmDialog>
  );
}
