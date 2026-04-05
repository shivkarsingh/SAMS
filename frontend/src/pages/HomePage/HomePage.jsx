import { useEffect, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchAttendanceSummary,
  fetchPlatformHealth
} from "../../services/api";
import "./HomePage.css";

const navLinks = ["Features", "How It Works", "Testimonials", "Contact"];

const featureCards = [
  {
    title: "Face + Smart Verification",
    description:
      "Run face recognition, liveness validation, and multi-step approval flows without slowing down classroom entry.",
    accent: "Realtime AI"
  },
  {
    title: "Live Attendance Command Center",
    description:
      "Track sessions, low-attendance trends, late arrivals, and department-level alerts from one intelligent dashboard.",
    accent: "Admin Visibility"
  },
  {
    title: "Role-Based Experience",
    description:
      "Support teacher and student journeys with personalized dashboards, quick actions, and transparent history.",
    accent: "Secure Access"
  },
  {
    title: "Analytics That Keep Growing",
    description:
      "Start with operational insights today and expand into anomaly detection, absentee forecasting, and retention intelligence.",
    accent: "Future Ready"
  }
];

const workflowSteps = [
  {
    id: "01",
    title: "Create Verified Accounts",
    description:
      "Students and teachers get dedicated signup flows with database-backed identity records from day one."
  },
  {
    id: "02",
    title: "Log In Securely",
    description:
      "Users access separate login pages and the backend verifies role, ID, and password against MongoDB."
  },
  {
    id: "03",
    title: "Manage Attendance Smarter",
    description:
      "After authentication, the platform expands into attendance workflows, analytics, and AI-assisted features."
  }
];

const testimonials = [
  {
    quote:
      "The product feels polished enough to trust, and the auth flow already looks like a real platform instead of a college project.",
    name: "Aarav Menon",
    role: "Academic Operations Lead"
  },
  {
    quote:
      "Having separate student and teacher access makes the system feel much more believable from day one.",
    name: "Meera Kapoor",
    role: "Student Experience Coordinator"
  },
  {
    quote:
      "This foundation is clean: React on the front, Express plus MongoDB in the middle, and Python AI waiting for the next phase.",
    name: "Rohan Sethi",
    role: "Technical Program Advisor"
  }
];

const footerLinks = ["Privacy", "Security", "Documentation", "Support"];

export function HomePage() {
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadDashboardPreview() {
      try {
        const [healthResponse, summaryResponse] = await Promise.all([
          fetchPlatformHealth(),
          fetchAttendanceSummary()
        ]);

        setHealth(healthResponse);
        setSummary(summaryResponse);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load backend services."
        );
      }
    }

    void loadDashboardPreview();
  }, []);

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="topbar">
        <AppBrand href="#/" />

        <nav className="nav">
          {navLinks.map((link) => (
            <a key={link} href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}>
              {link}
            </a>
          ))}
        </nav>

        <div className="topbar-actions">
          <a className="ghost-button" href="#/signup">
            Sign Up
          </a>
          <a className="primary-button" href="#/login">
            Login
          </a>
        </div>
      </header>

      <main className="content-shell">
        <section className="home-hero" id="hero">
          <div className="home-hero-copy">
            <p className="section-kicker">Dark, intelligent, campus-ready platform</p>
            <h1>Attendance that looks modern, feels fast, and knows every user.</h1>
            <p className="home-hero-description">
              A polished landing page, separate teacher and student access, and
              dedicated dashboards built for the real product experience.
            </p>

            <div className="hero-actions">
              <a className="primary-button large" href="#/signup">
                Create Account
              </a>
              <a className="secondary-button large" href="#how-it-works">
                See Workflow
              </a>
            </div>

            <div className="home-microstats">
              <div>
                <strong>{summary?.totalStudents ?? "500+"}</strong>
                <span>Student-ready scale</span>
              </div>
              <div>
                <strong>{summary?.presentToday ?? "98%"}</strong>
                <span>Realtime sync feel</span>
              </div>
              <div>
                <strong>2 Dashboards</strong>
                <span>Teacher + student workspaces</span>
              </div>
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="glass-card home-status-card">
              <div className="panel-header">
                <span className="pill">Live Status</span>
                <span className="panel-meta">System heartbeat</span>
              </div>

              {health ? (
                <div className="status-stack">
                  <div className="status-row">
                    <span>Frontend Experience</span>
                    <strong>online</strong>
                  </div>
                  <div className="status-row">
                    <span>Backend API</span>
                    <strong>{health.services.backend}</strong>
                  </div>
                  <div className="status-row">
                    <span>AI Service</span>
                    <strong>{health.services.aiService}</strong>
                  </div>
                  <div className="status-row">
                    <span>MongoDB</span>
                    <strong>{health.services.database}</strong>
                  </div>
                </div>
              ) : (
                <p className="panel-fallback">
                  {error ?? "Loading service telemetry..."}
                </p>
              )}
            </div>

            <div className="glass-card home-floating-card">
              <span className="metric-eyebrow">Account Access</span>
              <strong>separate pages</strong>
              <p>
                Signup, login, student dashboard, and teacher dashboard all live
                in their own focused screens.
              </p>
            </div>
          </div>
        </section>

        <section className="home-trust-strip">
          <div className="trust-item">
            <strong>Responsive by default</strong>
            <span>Desktop, tablet, and mobile-friendly layouts</span>
          </div>
          <div className="trust-item">
            <strong>Database-backed auth</strong>
            <span>Teacher and student accounts are verified from MongoDB</span>
          </div>
          <div className="trust-item">
            <strong>Ready for advanced models</strong>
            <span>Inference endpoints already separated cleanly</span>
          </div>
        </section>

        <section className="section-block" id="features">
          <div className="section-heading">
            <p className="section-kicker">Features</p>
            <h2>Everything a serious homepage should communicate at first glance.</h2>
            <p>
              The homepage now sells capability, trust, polish, secure access,
              and technical direction all at once.
            </p>
          </div>

          <div className="home-feature-grid">
            {featureCards.map((feature) => (
              <article key={feature.title} className="feature-card">
                <span className="feature-accent">{feature.accent}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block home-split-layout" id="how-it-works">
          <div className="section-heading home-compact-copy">
            <p className="section-kicker">How It Works</p>
            <h2>A product flow that feels structured, not generic.</h2>
            <p>
              Users register first, get validated through the backend and
              database, then move into their dedicated attendance workspace.
            </p>
          </div>

          <div className="workflow-list">
            {workflowSteps.map((step) => (
              <article key={step.id} className="workflow-card">
                <span>{step.id}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block home-spotlight-grid">
          <article className="glass-card home-deep-card">
            <p className="section-kicker">Why This UI Direction</p>
            <h2>Dark theme with contrast, glow, depth, and product confidence.</h2>
            <p>
              This visual language gives us a strong foundation for both the
              marketing surface and the actual product dashboards.
            </p>
          </article>

          <article className="glass-card home-mini-metrics-card">
            <div className="mini-metric">
              <span>Recognition</span>
              <strong>{summary?.recognitionEnabled ? "Enabled" : "Pending"}</strong>
            </div>
            <div className="mini-metric">
              <span>Anomaly Detection</span>
              <strong>
                {summary?.anomalyDetectionEnabled ? "Enabled" : "Pending"}
              </strong>
            </div>
            <div className="mini-metric">
              <span>REST Communication</span>
              <strong>Active</strong>
            </div>
          </article>
        </section>

        <section className="section-block" id="testimonials">
          <div className="section-heading">
            <p className="section-kicker">Testimonials</p>
            <h2>Social proof makes the landing page feel complete and credible.</h2>
          </div>

          <div className="home-testimonial-grid">
            {testimonials.map((testimonial) => (
              <article key={testimonial.name} className="testimonial-card">
                <p className="testimonial-quote">“{testimonial.quote}”</p>
                <div className="testimonial-author">
                  <strong>{testimonial.name}</strong>
                  <span>{testimonial.role}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="cta-banner" id="contact">
          <div>
            <p className="section-kicker">Ready To Build</p>
            <h2>Strong UI first. Smart features next. Advanced models when the product is ready.</h2>
          </div>
          <div className="cta-actions">
            <a className="primary-button large" href="#/signup">
              Get Started
            </a>
            <a className="secondary-button large" href="#/login">
              Explore Access
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <strong>SAMS</strong>
          <p>
            A modern attendance platform designed for clean operations,
            intelligent automation, and future AI-led growth.
          </p>
        </div>

        <div className="footer-links">
          {footerLinks.map((link) => (
            <a key={link} href="#/">
              {link}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

