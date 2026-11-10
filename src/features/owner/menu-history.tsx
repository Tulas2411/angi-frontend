"use client";
import { useEffect, useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/20/solid";
import { Alert, Badge, Button, Card } from "@/shared/ui";
import { EmptyState, SelectField, Skeleton } from "@/components/ui/primitives";
import { dateLabel } from "@/shared/format";
import {
  menuErrorMessage,
  menuStatusLabels,
  menuStatusTone,
} from "./menu-rules";
import type { RestaurantMenuService } from "./menu-service";
import type { MenuHistoryDto, MenuStatus } from "./menu-types";
export function MenuHistory({
  service,
  onOpen,
  disabled,
}: {
  service: RestaurantMenuService;
  onOpen: (id: number) => void;
  disabled: boolean;
}) {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    loading: boolean;
    data?: MenuHistoryDto;
    error?: string;
  }>({ loading: true });
  useEffect(() => {
    let active = true;
    async function load() {
      setState({ loading: true });
      try {
        const data = await service.history(
          page,
          5,
          status ? (status as MenuStatus) : undefined,
        );
        if (active) setState({ loading: false, data });
      } catch (error) {
        if (active)
          setState({ loading: false, error: menuErrorMessage(error) });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [service, page, status, retry]);
  return (
    <Card title="Lịch sử thực đơn" className="mn-history">
      <div className="stack">
        <div className="mn-history-filter">
        <SelectField
          label="Lọc trạng thái"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { value: "", label: "Tất cả" },
            ...Object.entries(menuStatusLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        </div>
        {state.loading ? (
          <Skeleton />
        ) : state.error ? (
          <>
            <Alert tone="error">{state.error}</Alert>
            <Button onClick={() => setRetry((value) => value + 1)}>
              Thử lại lịch sử
            </Button>
          </>
        ) : (
          state.data && (
            <>
              {!state.data.items.length ? (
                <EmptyState title="Chưa có bản thực đơn phù hợp" />
              ) : (
                <ul className="menu-list">
                  {state.data.items.map((item) => (
                    <li
                      className="menu-history-row"
                      key={item.id}
                      data-tone={menuStatusTone[item.status]}
                    >
                      <div>
                        <div className="mn-row-title">
                          <strong>Bản thực đơn #{item.id}</strong>
                          <Badge tone={menuStatusTone[item.status]}>
                            {menuStatusLabels[item.status]}
                          </Badge>
                        </div>
                        <p className="helper">
                          Tạo: {dateLabel(item.createdAt)} · Nộp:{" "}
                          {item.submittedAt
                            ? dateLabel(item.submittedAt)
                            : "Chưa nộp"}
                        </p>
                        {item.reviewNote && (
                          <p className="mn-history-note">
                            Phản hồi: {item.reviewNote}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="tertiary"
                        className="owner-ghost mn-history-open"
                        disabled={disabled}
                        onClick={() => onOpen(item.id)}
                      >
                        Xem bản #{item.id} <ChevronRightIcon aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="between menu-pagination">
                <span>
                  {state.data.totalItems} bản · Trang {state.data.page} /{" "}
                  {Math.max(1, state.data.totalPages)}
                </span>
                <div className="actions">
                  <Button
                    variant="secondary"
                    disabled={page <= 1 || disabled}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Trang trước
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={page >= state.data.totalPages || disabled}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </Card>
  );
}
