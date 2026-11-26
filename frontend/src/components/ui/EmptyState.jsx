import { FolderX } from "lucide-react";
import { Button } from "./Button";

export const EmptyState = ({
  icon: Icon = FolderX,
  title = "No data found",
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="lms-empty">
      <div className="lms-empty-icon" aria-hidden="true">
        <Icon size={20} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
