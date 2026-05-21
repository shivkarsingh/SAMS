import { useEffect, useMemo, useRef, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { PageBackground } from "../../components/common/PageBackground";
import { fetchPlatformHealth } from "../../services/api";
import "./HomePage.css";

const navLinks = [
  { label: "Features", id: "features" },
  { label: "How To Use", id: "working" },
  { label: "Testimonials", id: "testimonials" },
  { label: "About Us", id: "footer" },
  { label: "Status", id: "status" }
];

const modelFeatureCards = [
  {
    label: "Detection",
    title: "InsightFace SCRFD Detection",
    description:
      "Real ONNX face detection from the active InsightFace pack, tuned for classroom photos and multi-face captures.",
    points: ["multi-face detection", "fast CPU runtime", "bbox and keypoint support"]
  },
  {
    label: "Tracking",
    title: "Embedding Centroid Tracking",
    description:
      "Associates faces across uploaded frames using embedding similarity so the same person is treated as one attendance track.",
    points: ["stable face tracks", "multi-frame support", "duplicate prevention"]
  },
  {
    label: "Recognition",
    title: "ArcFace Recognition",
    description:
      "Angular-margin face embeddings give the system a strong base for profile matching, verification confidence, and review-aware recognition.",
    points: ["discriminative embeddings", "cosine similarity matching", "identity verification ready"]
  },
  {
    label: "Runtime",
    title: "Antelopev2 First",
    description:
      "The AI service prefers ArcFace ResNet100 on antelopev2 and falls back to buffalo_l only if the preferred pack is unavailable.",
    points: ["real model assets", "512-D embeddings", "no simulation mode"]
  }
];

const projectFeatureCards = [
  {
    title: "Secure Role Access",
    description:
      "Students and teachers use separate dashboards, verified accounts, OTP email activation, and protected profile updates.",
    tags: ["student login", "teacher login", "email OTP"]
  },
  {
    title: "Teacher Class Workspace",
    description:
      "Teachers create classes, share join codes, manage rosters, view student details, and keep daily class work in one place.",
    tags: ["class creation", "join code", "student details"]
  },
  {
    title: "Student Analytics Dashboard",
    description:
      "Students see joined classes, attendance percentage, present and absent totals, class detail pages, and useful progress signals.",
    tags: ["joined classes", "attendance %", "class analytics"]
  },
  {
    title: "AI Photo Attendance",
    description:
      "Teachers upload or capture classroom photos, run face verification, and get a roster-based preliminary attendance list.",
    tags: ["camera capture", "face recognition", "roster match"]
  },
  {
    title: "Today Attendance Data",
    description:
      "Photo results move into a 12-hour review section where teachers can mark Present, Absent, or Late before final submission.",
    tags: ["draft review", "absent alerts", "final submission"]
  },
  {
    title: "Manual And QR Attendance",
    description:
      "When photo verification is not needed, teachers can mark manually, cancel a class, or generate a short-lived QR attendance code.",
    tags: ["manual mark", "QR scan", "class cancel"]
  },
  {
    title: "Exam Planning And Eligibility",
    description:
      "Teachers set exam dates and required attendance. Students see eligibility, warnings, and minimum classes to attend.",
    tags: ["exam calendar", "eligibility", "required %"]
  },
  {
    title: "Attendance Calculator",
    description:
      "Students can enter an exam date and required percentage to estimate how many upcoming classes they must attend safely.",
    tags: ["what-if planning", "safe target", "student control"]
  },
  {
    title: "Leave And Medical Proof",
    description:
      "Students upload PDF or image proof for absence reasons. Teachers preview files online and approve or reject requests.",
    tags: ["PDF preview", "medical report", "approve reject"]
  },
  {
    title: "Email Notifications",
    description:
      "Professional emails cover welcome, verification, password reset, absence alerts, leave status, exam warnings, and class changes.",
    tags: ["SMTP ready", "templates", "delivery logs"]
  },
  {
    title: "Class Materials",
    description:
      "Notes, assignments, submissions, and class discussion tools keep learning context connected to every classroom.",
    tags: ["notes", "assignments", "discussion"]
  },
  {
    title: "Reports And Export",
    description:
      "Teachers can inspect attendance history, monitor class summaries, and download date-range CSV reports for records.",
    tags: ["history", "CSV export", "summaries"]
  }
];

const workflowSteps = [
  {
    id: "01",
    title: "Create and verify account",
    description:
      "Sign up as a student or teacher, verify email with OTP, then log in to the correct dashboard."
  },
  {
    id: "02",
    title: "Create or join classes",
    description:
      "Teachers create classrooms and share join codes. Students join classes and see each class on their dashboard."
  },
  {
    id: "03",
    title: "Prepare attendance",
    description:
      "Students keep face enrollment ready. Teachers can use photo attendance, QR scan, or manual marking based on the situation."
  },
  {
    id: "04",
    title: "Review today attendance",
    description:
      "AI photo results go to Today Attendance Data, absentees get early email, and teachers correct the list before final submission."
  },
  {
    id: "05",
    title: "Plan exams and leave",
    description:
      "Teachers set exam eligibility rules. Students use eligibility alerts, attendance calculator, and leave proof uploads."
  },
  {
    id: "06",
    title: "Track and export",
    description:
      "Dashboards update with analytics, class detail pages, notifications, and downloadable attendance records."
  }
];

const testimonials = [
  {
    quote:
      "The student side feels clean and easy to understand, especially for checking attendance and class updates.",
    name: "Akash",
    role: "Student"
  },
  {
    quote:
      "The interface looks modern and the attendance flow feels much better than manual handling.",
    name: "Ashutosh",
    role: "Student"
  },
  {
    quote:
      "It feels like a proper product, not just a simple project page, and the overall UI is easy to use.",
    name: "Gaurav",
    role: "Student"
  },
  {
    quote:
      "The teacher workflow is practical because it keeps review and control in the hands of faculty.",
    name: "Manik Sir",
    role: "Professor"
  },
  {
    quote:
      "The platform has a strong product feel and the attendance features are presented in a very clear way.",
    name: "Pawan Sir",
    role: "Professor"
  },
  {
    quote:
      "The system connects dashboards, attendance, and class management in a way that feels organized and scalable.",
    name: "Girish Sir",
    role: "Professor"
  },
  {
    quote:
      "AI-assisted attendance with teacher confirmation is a very sensible direction for this kind of platform.",
    name: "Natthan Sir",
    role: "Professor"
  }
];

function getServiceStatusValue(status) {
  if (status && typeof status === "object") {
    if (status.ready === false) {
      return status.status ?? "degraded";
    }

    return status.status ?? "unknown";
  }

  return status;
}

function isHealthyStatus(status) {
  const normalized = String(getServiceStatusValue(status) ?? "")
    .trim()
    .toLowerCase();

  return ["ok", "online", "connected"].includes(normalized);
}

function getStatusTone(status) {
  const normalized = String(getServiceStatusValue(status) ?? "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "checking") {
    return "neutral";
  }

  return isHealthyStatus(normalized) ? "success" : "warning";
}

function formatStatusLabel(status) {
  const normalized = String(getServiceStatusValue(status) ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "checking";
  }

  if (isHealthyStatus(normalized)) {
    return "online";
  }

  return normalized.replace(/-/g, " ");
}

export function HomePage() {
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const pageRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreviewData() {
      try {
        const platformHealth = await fetchPlatformHealth();

        if (cancelled) {
          return;
        }

        setHealth(platformHealth);
        setHealthError("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setHealth(null);
        setHealthError(
          error instanceof Error
            ? error.message
            : "Unable to load platform health."
        );
      }
    }

    void loadPreviewData();

    const intervalId = window.setInterval(loadPreviewData, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let frameId = 0;

    function updatePointer(x, y) {
      if (!pageRef.current) {
        return;
      }

      pageRef.current.style.setProperty("--pointer-x", `${x}%`);
      pageRef.current.style.setProperty("--pointer-y", `${y}%`);
    }

    function handlePointerMove(event) {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;

      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        updatePointer(x, y);
      });
    }

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  const liveStatus = useMemo(() => {
    if (!health) {
      return {
        label: healthError ? "Status unavailable" : "Checking services",
        tone: healthError ? "warning" : "neutral"
      };
    }

    const coreServices = [
      health.services?.backend,
      health.services?.aiService,
      health.services?.database
    ];
    const isOnline =
      health.ready !== false &&
      coreServices.every((service) => isHealthyStatus(service));

    return isOnline
      ? {
          label: "All core services online",
          tone: "success"
        }
      : {
          label: "Some services need attention",
          tone: "warning"
        };
  }, [health, healthError]);

  const serviceItems = useMemo(
    () => [
      {
        label: "Frontend",
        status: "online"
      },
      {
        label: "Backend",
        status: health?.services?.backend ?? (healthError ? "unavailable" : "checking")
      },
      {
        label: "AI Service",
        status:
          health?.services?.aiService ?? (healthError ? "unavailable" : "checking")
      },
      {
        label: "MongoDB",
        status:
          health?.services?.database ?? (healthError ? "unavailable" : "checking")
      },
      {
        label: "Email Alerts",
        status: health?.services?.email ?? (healthError ? "unavailable" : "checking")
      }
    ],
    [health, healthError]
  );

  const repeatedTestimonials = useMemo(
    () => [...testimonials, ...testimonials],
    []
  );

  function handleFeaturePointerMove(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;

    event.currentTarget.style.setProperty("--card-light-x", `${x}px`);
    event.currentTarget.style.setProperty("--card-light-y", `${y}px`);
  }

  function handleFeaturePointerLeave(event) {
    event.currentTarget.style.removeProperty("--card-light-x");
    event.currentTarget.style.removeProperty("--card-light-y");
  }

  return (
    <div
      ref={pageRef}
      className="page-shell markin-landing"
      style={{
        "--pointer-x": "50%",
        "--pointer-y": "50%"
      }}
    >
      <PageBackground />
      <div className="markin-grid-field" />
      <div className="markin-spotlight" />
      <div className="markin-glow markin-glow-one" />
      <div className="markin-glow markin-glow-two" />
      <div className="markin-glow markin-glow-three" />

      <header className="topbar">
        <AppBrand href="#/" subtitle="Smart Attendance Management System" />

        <nav className="nav">
          {navLinks.map((link) => (
            <a key={`${link.label}-${link.id}`} href={`#${link.id}`}>
              {link.label}
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
        <section className="landing-hero" id="hero">
          <div className="landing-copy">
            <span className="section-kicker">Smart Attendance Management System</span>
            <h1>MarkIn Smart Attendance</h1>
            <p className="landing-subheading">
              Run AI photo attendance, review today&apos;s draft before it becomes
              official, notify absentees early, manage leave proof, and help
              students plan exam eligibility from one focused platform.
            </p>

            <div className="hero-actions">
              <a className="primary-button large" href="#features">
                Explore Features
              </a>
              <a className="secondary-button large" href="#/login">
                Open Platform
              </a>
              <span className={`live-chip ${liveStatus.tone}`}>
                {liveStatus.label}
              </span>
            </div>

            <div className="hero-workflow-strip">
              <article className="hero-workflow-card">
                <span>01</span>
                <strong>Verify</strong>
                <p>Sign up, confirm email by OTP, and enter the correct workspace.</p>
              </article>
              <article className="hero-workflow-card">
                <span>02</span>
                <strong>Capture</strong>
                <p>Use classroom photos, manual marking, or QR scan for attendance.</p>
              </article>
              <article className="hero-workflow-card">
                <span>03</span>
                <strong>Finalize</strong>
                <p>Review Today Attendance Data, correct errors, then submit.</p>
              </article>
            </div>

            <div className="hero-insight-panel">
              <div className="hero-insight-copy">
                <span className="metric-eyebrow">Unified workflow</span>
                <strong>From verified account to exam-ready attendance planning.</strong>
                <p>
                  The platform connects onboarding, photo verification, early
                  absence alerts, teacher correction, leave proof, exam eligibility,
                  and reporting in one continuous product flow.
                </p>
              </div>

              <div className="hero-insight-rail">
                <div className="hero-insight-line">
                  <span>Teacher control</span>
                  <strong>12-hour draft review</strong>
                </div>
                <div className="hero-insight-line">
                  <span>Student clarity</span>
                  <strong>Attendance and eligibility visible</strong>
                </div>
                <div className="hero-insight-line">
                  <span>Email layer</span>
                  <strong>OTP, alerts, and status updates</strong>
                </div>
              </div>
            </div>
          </div>

          <article className="glass-card hero-preview">
            <div className="hero-preview-body">
              <div className="hero-preview-copy">
                <span className="metric-eyebrow">Platform snapshot</span>
                <h2>Built for daily attendance, useful student insight, and teacher control.</h2>
                <p>
                  A polished product surface for teachers and students, supported by
                  secure OTP workflows, AI-backed verification, attendance history,
                  leave proof, exam warnings, and dashboard analytics.
                </p>
              </div>

              <div className="hero-visual">
                <div className="hero-premium-board">
                  <article className="preview-card premium-card premium-card-primary">
                    <span>Today Attendance Data</span>
                    <strong>AI result first becomes an editable teacher draft</strong>
                    <p>Absentees are notified early, then teachers correct and finalize.</p>
                  </article>

                  <div className="hero-premium-grid">
                    <article className="preview-card premium-card">
                      <span>Teacher side</span>
                      <strong>Classes, rosters, exams, leave review</strong>
                    </article>
                    <article className="preview-card premium-card">
                      <span>Student side</span>
                      <strong>Joined classes, analytics, calculator</strong>
                    </article>
                    <article className="preview-card premium-card">
                      <span>Email layer</span>
                      <strong>OTP, absence, leave, exam alerts</strong>
                    </article>
                    <article className="preview-card premium-card">
                      <span>Analytics</span>
                      <strong>History, CSV, percentages, eligibility</strong>
                    </article>
                  </div>

                  <div className="hero-premium-footer">
                    <span className="hero-dot" />
                    <p>Designed around the real daily loop of class, correction, warning, and record keeping.</p>
                  </div>
                </div>

                <div className="preview-stack hero-preview-stack">
                  <article className="preview-card premium-inline-card">
                    <span>Verification</span>
                    <strong>Email OTP for signup, password recovery, and profile email changes</strong>
                  </article>
                  <article className="preview-card premium-inline-card">
                    <span>Student planning</span>
                    <strong>Exam calendar, attendance alerts, and required-class guidance</strong>
                  </article>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="section-block" id="features">
          <div className="section-heading landing-heading">
            <p className="section-kicker">Features</p>
            <h2>Everything needed for attendance, review, proof, and eligibility.</h2>
            <p>
              The landing page now mirrors the product: verified accounts, AI and
              non-AI attendance paths, teacher correction, student analytics, leave
              proof, exam planning, and professional email notifications.
            </p>
          </div>

          <div className="features-grid">
            {projectFeatureCards.map((feature, index) => (
              <article
                key={feature.title}
                className="feature-card home-feature-card"
                onPointerMove={handleFeaturePointerMove}
                onPointerLeave={handleFeaturePointerLeave}
              >
                <span className="feature-card-light" aria-hidden="true" />
                <span className="feature-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <div className="feature-tag-list">
                  {feature.tags.map((tag) => (
                    <span key={tag} className="feature-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block working-section" id="working">
          <div className="section-heading landing-heading">
            <p className="section-kicker">How To Use</p>
            <h2>One clear flow for teachers and students.</h2>
            <p>
              Start with verified access, then move through class setup, attendance
              capture, review, notifications, exam planning, and records without
              jumping between disconnected tools.
            </p>
          </div>

          <div className="workflow-flow">
            <div className="workflow-rail" aria-hidden="true" />
            {workflowSteps.map((step, index) => (
              <article
                key={step.id}
                className={`workflow-step ${index % 2 === 0 ? "is-left" : "is-right"}`}
              >
                <div className="workflow-step-node">
                  <span>{step.id}</span>
                </div>

                <div className="workflow-step-body">
                  <p className="workflow-step-kicker">Step {step.id}</p>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" id="testimonials">
          <div className="section-heading landing-heading">
            <p className="section-kicker">Testimonials</p>
            <h2>Clean, practical feedback for the product direction.</h2>
            <p>
              Feedback from students and professors around usability, product feel,
              and the overall attendance workflow experience.
            </p>
          </div>

          <div className="testimonials-marquee">
            <div className="testimonials-track">
              {repeatedTestimonials.map((testimonial, index) => (
                <article
                  key={`${testimonial.name}-${index}`}
                  className="testimonial-card home-testimonial-card"
                >
                  <p className="testimonial-quote">"{testimonial.quote}"</p>
                  <div className="testimonial-author">
                    <strong>{testimonial.name}</strong>
                    <span>{testimonial.role}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <footer className="footer landing-footer" id="footer">
          <div className="footer-layout">
            <div className="footer-brand-column footer-card footer-card-brand">
              <AppBrand href="#/" subtitle="Smart Attendance Management System" />
              <p>
                MarkIn is a focused attendance platform with teacher and student
                dashboards, AI-backed photo review, leave proof, exam eligibility,
                email alerts, and MongoDB-powered records.
              </p>

              <div className="footer-button-row">
                <a className="primary-button" href="#/signup">
                  Sign Up
                </a>
                <a className="secondary-button" href="#/login">
                  Login
                </a>
              </div>
            </div>

            <div className="footer-column footer-card footer-card-connect">
              <strong>Connect</strong>
              <div className="footer-link-list">
                <a href="https://github.com/shivkarsingh" target="_blank" rel="noreferrer">
                  GitHub
                </a>
                <a
                  href="https://www.linkedin.com/in/shivkar-singh/"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
                <a href="tel:+918209292868">+91 8209292868</a>
                <a href="mailto:shivkarcse@gmail.com">shivkarcse@gmail.com</a>
              </div>
            </div>

            <div className="footer-column footer-card footer-card-nav">
              <strong>Navigate</strong>
              <div className="footer-link-list">
                {navLinks.map((link) => (
                  <a key={`${link.label}-${link.id}`} href={`#${link.id}`}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="footer-column footer-card footer-status-column" id="status">
              <div className="footer-status-head">
                <strong>System Status</strong>
              </div>

              <div className="status-stack footer-status-stack">
                {serviceItems.map((service) => (
                  <div key={service.label} className="status-row footer-status-row">
                    <span>{service.label}</span>
                    <strong className={`status-text ${getStatusTone(service.status)}`}>
                      {formatStatusLabel(service.status)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="footer-bottom-line footer-card footer-card-closing">
              <span>Made with love ❤️ for smarter attendance experiences.</span>
              <span>© 2026 MarkIn. All rights reserved.</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
