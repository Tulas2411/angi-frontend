import {
  BanknotesIcon,
  CalendarDaysIcon,
  ClockIcon,
  PencilSquareIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";
import { Alert, Button } from "@/shared/ui";
import { budgetShare, mealSlotLabels } from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import type { RoadmapBudgetDto } from "./roadmap-types";

/**
 * Budget tab of RM-03: totals use the current price of each dish (`dishes.price`).
 * `onEdit` adds the button that opens the RM-04 budget dialog.
 */
export function RoadmapBudget({
  budget,
  onEdit,
}: {
  budget: RoadmapBudgetDto;
  onEdit?: () => void;
}) {
  const { percent, over, overBy } = budgetShare(budget);
  const hasBudget = budget.budgetAmount !== null;
  return (
    <div className="roadmap-budget stack">
      <div className="roadmap-budget-heading">
        <h2>Ngân sách ăn uống</h2>
        {onEdit && (
          <Button variant="secondary" onClick={onEdit}>
            <PencilSquareIcon aria-hidden />
            {hasBudget ? "Sửa ngân sách" : "Đặt ngân sách"}
          </Button>
        )}
      </div>
      <div className="card roadmap-budget-summary">
        <p className="roadmap-budget-total">
          <span className="helper roadmap-budget-label">
            <BanknotesIcon aria-hidden />
            Chi phí dự kiến
          </span>
          <strong>{vnd(budget.totalEstimatedCost)}</strong>
        </p>
        <p className="roadmap-budget-chips">
          <span className="roadmap-budget-label">
            <WalletIcon aria-hidden />
            {budget.budgetAmount === null
              ? "Chưa đặt ngân sách"
              : `Ngân sách ${vnd(budget.budgetAmount)}`}
          </span>
          {budget.remaining !== null && !over && (
            <span>Còn lại {vnd(budget.remaining)}</span>
          )}
        </p>
        {hasBudget ? (
          <div className="stack-sm">
            <progress
              className={`roadmap-budget-bar${over ? " is-over" : ""}`}
              max={100}
              value={percent}
              aria-label="Chi phí dự kiến so với ngân sách"
            >
              {percent}%
            </progress>
            <p className="helper">
              Đã dùng {percent}% ngân sách theo giá hiện tại của các món.
            </p>
          </div>
        ) : (
          <p className="helper">
            {onEdit
              ? "Lộ trình chưa đặt ngân sách. Bấm “Đặt ngân sách” để theo dõi chi phí so với mức bạn muốn."
              : "Lộ trình chưa đặt ngân sách."}
          </p>
        )}
        {over && (
          <Alert tone="warning">
            Chi phí dự kiến vượt ngân sách {vnd(overBy)}.
          </Alert>
        )}
      </div>
      <div className="roadmap-budget-split">
        <div className="stack-sm">
          <h3 className="roadmap-budget-label">
            <CalendarDaysIcon aria-hidden />
            Chi phí theo ngày
          </h3>
          <dl className="detail-list">
            {budget.byDay.map((entry) => (
              <div key={entry.dayNumber}>
                <dt>Ngày {entry.dayNumber}</dt>
                <dd>{vnd(entry.cost)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="stack-sm">
          <h3 className="roadmap-budget-label">
            <ClockIcon aria-hidden />
            Chi phí theo bữa
          </h3>
          <dl className="detail-list">
            {budget.byMealSlot.map((entry) => (
              <div key={entry.mealSlot}>
                <dt>{mealSlotLabels[entry.mealSlot]}</dt>
                <dd>{vnd(entry.cost)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
