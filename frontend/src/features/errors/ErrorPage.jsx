import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./error-page.css";

export default function ErrorPage({ code, label, title, description }) {
  useEffect(() => {
    document.title = `${code} ${label} | University LMS`;
  }, [code, label]);

  return (
    <div className="lms-workspace error-page">
      <main id="main-content" className="error-main" tabIndex={-1}>
        <section className="error-card" aria-labelledby="error-title">
          <p className="error-code">{code}</p>
          <p className="error-label">{label}</p>
          <h1 id="error-title">{title}</h1>
          {description && <p className="error-description">{description}</p>}
          <div className="error-actions">
            <Link to="/" className="lms-button lms-button--primary lms-button--md">
              <ArrowLeft size={15} aria-hidden="true" />
              Back to Home
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
