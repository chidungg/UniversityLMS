import { ChevronRight } from "lucide-react";
import { getMaterialWeek } from "../../utils/materialWeeks";
import "./materialList.css";

export function WeekViewToggle({ byWeek, onChange, allLabel = "All Materials" }) {
  return (
    <div className="material-view-toggle" role="group" aria-label="Group by teaching week">
      <button
        type="button"
        className={byWeek ? "lms-pill-tab" : "lms-pill-tab active"}
        aria-pressed={!byWeek}
        onClick={() => onChange(false)}
      >
        {allLabel}
      </button>
      <button
        type="button"
        className={byWeek ? "lms-pill-tab active" : "lms-pill-tab"}
        aria-pressed={byWeek}
        onClick={() => onChange(true)}
      >
        By Week
      </button>
    </div>
  );
}

export function WeekList({ items, byWeek, expandAll, singular = "material", plural = "materials", unassignedHint, children }) {
  if (!byWeek) return children(items);

  const itemsByWeek = new Map();
  const uncategorized = [];

  for (const item of items) {
    const week = getMaterialWeek(item.title);
    if (week === null) {
      uncategorized.push(item);
    } else {
      if (!itemsByWeek.has(week)) itemsByWeek.set(week, []);
      itemsByWeek.get(week).push(item);
    }
  }

  const groups = [...itemsByWeek.entries()].sort(([firstWeek], [secondWeek]) => firstWeek - secondWeek);
  if (uncategorized.length) groups.unshift([null, uncategorized]);

  return (
    <div className="material-week-list">
      {unassignedHint && !itemsByWeek.size && <p className="week-assignment-hint">{unassignedHint}</p>}
      {groups.map(([week, items], index) => (
        <details className="material-week-group" key={week ?? "uncategorized"} open={expandAll || index === 0}>
          <summary>
            <ChevronRight size={16} aria-hidden="true" />
            <span>{week === null ? "Uncategorized" : `Week ${String(week).padStart(2, "0")}`}</span>
            <span className="material-week-count">
              {items.length} {items.length === 1 ? singular : plural}
            </span>
          </summary>
          {children(items)}
        </details>
      ))}
    </div>
  );
}
