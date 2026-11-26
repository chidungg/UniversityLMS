import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export const ErrorBanner = ({
  message = "Something went wrong. Please try again.",
  onRetry,
  className = "",
}) => {
  return (
    <div role="alert" className={`lms-error-banner ${className}`.trim()}>
      <div className="lms-banner-content">
        <AlertCircle size={17} aria-hidden="true" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} icon={RefreshCw}>
          Retry
        </Button>
      )}
    </div>
  );
};
