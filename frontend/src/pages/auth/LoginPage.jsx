import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, ArrowRight } from "lucide-react";
import { useAuth } from "../../app/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("student01@lms-demo.test");
  const [password, setPassword] = useState("Bin2005.");

  const handleSubmit = (e) => {
    e.preventDefault();
    login(email, password);
    navigate("/student/dashboard");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-page)",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-md)",
          padding: "32px 28px",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "10px",
              backgroundColor: "var(--color-primary-700)",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <GraduationCap size={28} />
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-text)", marginBottom: "4px" }}>
            University LMS
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Student Workspace Testing Portal
          </p>
        </div>

        {/* One-Click Direct Access */}
        <Link to="/student/dashboard" style={{ textDecoration: "none" }}>
          <Button
            variant="primary"
            size="lg"
            icon={ArrowRight}
            style={{ width: "100%", marginBottom: "16px", fontSize: "15px" }}
          >
            Enter Student Workspace Directly
          </Button>
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: "16px 0",
            color: "var(--color-text-muted)",
            fontSize: "12px",
          }}
        >
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--color-border)" }} />
          <span>or sign in as specific student</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--color-border)" }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. student01@lms-demo.test"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />

          <Button type="submit" variant="secondary" size="md" style={{ width: "100%" }}>
            Sign In & Open Dashboard
          </Button>
        </form>
      </div>
    </div>
  );
};
