import { Link } from "react-router-dom";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "../components/ui/Button";

export const NotFoundPage = () => {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          backgroundColor: "var(--color-danger-bg)",
          color: "var(--color-danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
        }}
      >
        <AlertCircle size={32} />
      </div>
      <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text)", marginBottom: "8px" }}>
        Page Not Found (404)
      </h1>
      <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", maxWidth: "420px", marginBottom: "20px" }}>
        The page or academic resource you are looking for does not exist or has been moved.
      </p>
      <Link to="/student/dashboard">
        <Button variant="primary" icon={Home}>
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
};
