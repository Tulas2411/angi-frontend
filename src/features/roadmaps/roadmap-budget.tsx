import { Alert } from "@/shared/ui";
import { budgetShare, mealSlotLabels } from "./roadmap-detail-rules";
import { vnd } from "./roadmap-list-rules";
import type { RoadmapBudgetDto } from "./roadmap-types";

/** Budget tab of RM-03: totals use the current price of each dish (`dishes.price`). */
export function RoadmapBudget({ budget }: { budget: RoadmapBudgetDto }) {
  const { percent, over, overBy } = budgetShare(budget);
  const hasBudget = budget.budgetAmount !== null;
  return (
    <div className="roadmap-budget stack">
      <h2>Ngân sách ăn uống</h2>
      <div className="card roadmap-budget-summary">
        <p className="roadmap-budget-total">
          <span className="helper">Chi phí dự kiến</span>
          <strong>{vnd(budget.totalEstimatedCost)}</strong>
        </p>
        <p className="roadmap-budget-chips">
          <span>
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
            Lộ trình chưa đặt ngân sách. Bạn có thể đặt ngân sách khi sửa thông
            tin lộ trình.
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
          <h3>Chi phí theo ngày</h3>
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
          <h3>Chi phí theo bữa</h3>
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
