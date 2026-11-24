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
      placeholder="Uncategorized"
      value={week ?? getMaterialWeek(title) ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      aria-describedby={helpId}
      helperText={<span id={helpId}>{title.trim() && week !== null
        ? `Title after saving: ${titleWithWeek(title, week)}`
        : "Optional. Choosing a week adds its number to the title."}</span>}
    />
  );
}
