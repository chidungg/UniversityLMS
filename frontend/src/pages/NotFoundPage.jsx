import { Link } from "react-router-dom";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "../components/ui/Button";

export const NotFoundPage = () => {
  return (
    <main className="lms-workspace session-page">
      <section className="session-card" style={{ textAlign: "center", justifyItems: "center" }}>
        <div className="lms-empty-icon" aria-hidden="true">
          <AlertCircle size={22} />
        </div>
        <h1>Page Not Found (404)</h1>
        <p>The page you are looking for does not exist or has been moved.</p>
        <Link to="/">
          <Button variant="primary" icon={Home}>
            Back to Home
          </Button>
        </Link>
      </section>
    </main>
  );
};
