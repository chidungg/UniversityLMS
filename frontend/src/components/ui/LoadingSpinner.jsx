import { Loader2 } from "lucide-react";

export const LoadingSpinner = ({ message = "Loading...", size = 24 }) => {
  return (
    <div className="lms-loading" role="status">
      <Loader2 size={size} className="lms-button-spin" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};
