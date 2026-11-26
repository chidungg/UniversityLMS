import { useId } from "react";
import { Input } from "../ui/Input";
import { getMaterialWeek, titleWithWeek } from "../../utils/materialWeeks";

export function TeachingWeekField({ title, week, onChange, disabled }) {
  const helpId = useId();
  return (
    <Input
      label="Teaching week"
      type="number"
      min="1"
      step="1"
      placeholder="Optional"
      value={week ?? getMaterialWeek(title) ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      aria-describedby={helpId}
      helperText={
        title.trim() && week !== null ? (
          <span id={helpId}>Saved as: {titleWithWeek(title, week)}</span>
        ) : (
          <span id={helpId}>Optional (e.g. 1, 2, 3).</span>
        )
      }
    />
  );
}
