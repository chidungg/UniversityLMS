import { CheckCircle2, X } from "lucide-react";

export const SuccessBanner = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div role="status" className="lms-success-banner">
      <div className="lms-banner-content">
        <CheckCircle2 size={17} aria-hidden="true" />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="lms-banner-dismiss"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
