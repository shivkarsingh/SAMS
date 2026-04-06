import { useEffect, useMemo, useRef, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { PageBackground } from "../../components/common/PageBackground";
import { fetchPlatformHealth } from "../../services/api";
import "./HomePage.css";

const navLinks = [
  { label: "Features", id: "features" },
  { label: "Working", id: "working" },
  { label: "Testimonials", id: "testimonials" },
  { label: "About Us", id: "footer" },
  { label: "Status", id: "footer" }
];

const modelFeatureCards = [
  {
    label: "Detection",
    title: "SCRFD Face Detection",
    description:
      "Efficient face detection for classroom capture pipelines, with strong accuracy-speed tradeoffs and lightweight deployment options.",
    points: ["high-accuracy detection", "fast CPU-friendly variants", "bbox and keypoint support"]
  },
  {
    label: "Tracking",
    title: "ByteTrack Face Tracking",
    description:
      "Associates almost every detection box across frames, helping preserve identities even when confidence drops or faces are briefly occluded.",
    points: ["stable multi-face tracking", "low-score recovery", "realtime pipeline fit"]
  },
  {
    label: "Recognition",
    title: "ArcFace Recognition",
    description:
      "Angular-margin face embeddings give the system a strong base for profile matching, verification confidence, and review-aware recognition.",
    points: ["discriminative embeddings", "cosine similarity matching", "identity verification ready"]
  },
  {
    label: "Liveness",
    title: "MediaPipe Face Landmarker",
    description:
      "Useful for active liveness signals like blink and head movement, with live-stream support and detailed landmark outputs.",
    points: ["live-stream processing", "facial landmarks", "blendshape and motion signals"]
  },
  {
    label: "Security",
    title: "MiniFASNetV2 Anti-Spoof",
    description:
      "A compact silent face anti-spoofing choice for separating real captures from suspicious presentation attacks.",
    points: ["passive spoof checks", "lightweight runtime", "camera-first verification"]
  }
];

const projectFeatureCards = [
  {
    title: "Role-Based Access",
    description:
      "Separate login, student workspace, and teacher workspace flows keep access clean and secure.",
    tags: ["student login", "teacher login", "session handling"]
  },
  {
    title: "Teacher Dashboard",
    description:
      "Teachers can create classes, generate join links, monitor sections, and manage roster-ready attendance workflows.",
    tags: ["class creation", "join code", "join link"]
  },
  {
    title: "Student Dashboard",
    description:
      "Students can join classes, track attendance, open schedules, and keep face enrollment ready from one place.",
    tags: ["class join", "attendance view", "face profile"]
  },
  {
    title: "AI Attendance Verification",
    description:
      "The AI service supports detection, tracking, recognition, liveness, and anti-spoof checks for attendance sessions.",
    tags: ["recognition", "liveness", "anti-spoof"]
  },
  {
    title: "Teacher Review Flow",
    description:
      "Attendance is suggested first, then reviewed, corrected, and finalized by the teacher for safer results.",
    tags: ["manual review", "finalize attendance", "session notes"]
  },
  {
    title: "Reports And Analytics",
    description:
      "Attendance summaries, trends, class comparison, flagged-student insights, and history views are built into the flow.",
    tags: ["attendance trend", "watchlist", "history"]
  },
  {
    title: "Schedules And Planning",
    description:
      "Both teacher and student dashboards surface today's schedule, weekly schedule, and next-class context.",
    tags: ["today view", "weekly schedule", "next class"]
  },
  {
    title: "Alerts And Academic Signals",
    description:
      "The product already includes alerts, goals, achievements, quick insights, and watchlist-driven follow-up prompts.",
    tags: ["alerts", "goals", "achievements"]
  },
  {
    title: "Notes And Attendance Records",
    description:
      "Teachers can keep attendance notes while finalizing sessions, and the system maintains reusable face-profile notes as well.",
    tags: ["teacher notes", "profile notes", "record history"]
  },
  {
    title: "Geo And Expansion Ready",
    description:
      "The architecture is prepared for geo-fencing, stronger reporting layers, and future academic modules as the platform grows.",
    tags: ["geo-ready", "scalable services", "future modules"]
  },
  {
    title: "Live Marks And Notes",
    description:
      "The platform direction already supports academic add-ons like live marks, reusable notes, and class-linked learning context.",
    tags: ["marks", "notes", "academic flow"]
  },
  {
    title: "Roster And Invite Control",
    description:
      "Join codes, invite links, class rosters, and class-level setup tools help teachers onboard students without friction.",
    tags: ["roster", "invite links", "onboarding"]
  }
];

const workflowSteps = [
  {
    id: "01",
    title: "Choose your role",
    description:
      "Teachers and students enter through dedicated authentication and dashboard flows."
  },
  {
    id: "02",
    title: "Create or join a class",
    description:
      "Teachers create classrooms and students join using the generated join code or link."
  },
  {
    id: "03",
    title: "Prepare verification",
    description:
      "Students enroll a face profile and the teacher captures attendance session images when needed."
  },
  {
    id: "04",
    title: "Review and finalize",
    description:
      "The AI service suggests matches, then the teacher verifies and submits the final attendance record."
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

function isHealthyStatus(status) {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  return ["ok", "online", "connected"].includes(normalized);
}

function getStatusTone(status) {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "checking") {
    return "neutral";
  }

  return isHealthyStatus(normalized) ? "success" : "warning";
}

function formatStatusLabel(status) {
  const normalized = String(status ?? "")
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
    async function loadPreviewData() {
      const healthResult = await Promise.allSettled([fetchPlatformHealth()]);

      const [platformHealth] = healthResult;

      if (platformHealth.status === "fulfilled") {
        setHealth(platformHealth.value);
      } else {
        setHealthError(
          platformHealth.reason instanceof Error
            ? platformHealth.reason.message
            : "Unable to load platform health."
        );
      }
    }

    void loadPreviewData();
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

    const services = Object.values(health.services ?? {});
    const isOnline = services.every((service) => isHealthyStatus(service));

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
            <a key={link.id} href={`#${link.id}`}>
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
            <h1>Smart Attendance Management Made Effortless</h1>
            <p className="landing-subheading">
              Track, manage, and analyze attendance in real-time with secure,
              automated, and AI-powered solutions.
            </p>

            <div className="hero-actions">
              <a className="primary-button large" href="#features">
                Explore Features
              </a>
              <a className="secondary-button large" href="#/login">
                Open Platform
              </a>
            </div>

            <div className="hero-workflow-strip">
              <article className="hero-workflow-card">
                <span>01</span>
                <strong>Login</strong>
                <p>Enter as student or teacher with a dedicated workspace.</p>
              </article>
              <article className="hero-workflow-card">
                <span>02</span>
                <strong>Verify</strong>
                <p>Use face enrollment and AI-assisted attendance review flow.</p>
              </article>
              <article className="hero-workflow-card">
                <span>03</span>
                <strong>Track</strong>
                <p>Monitor attendance, schedules, alerts, and class insights.</p>
              </article>
            </div>

            <div className="hero-insight-panel">
              <div className="hero-insight-copy">
                <span className="metric-eyebrow">Unified workflow</span>
                <strong>From secure access to final attendance submission.</strong>
                <p>
                  The platform connects onboarding, verification, attendance review,
                  and reporting in one continuous product flow.
                </p>
              </div>

              <div className="hero-insight-rail">
                <div className="hero-insight-line">
                  <span>Teacher control</span>
                  <strong>Always in review loop</strong>
                </div>
                <div className="hero-insight-line">
                  <span>Student onboarding</span>
                  <strong>Join class and enroll once</strong>
                </div>
                <div className="hero-insight-line">
                  <span>Attendance records</span>
                  <strong>History, notes, and insights ready</strong>
                </div>
              </div>
            </div>
          </div>

          <article className="glass-card hero-preview">
            <div className="hero-preview-body">
              <div className="hero-preview-copy">
                <span className="metric-eyebrow">Platform snapshot</span>
                <h2>Built for clean operations, strong visibility, and confident attendance review.</h2>
                <p>
                  A polished product surface for teachers and students, supported by
                  secure workflows, attendance history, schedules, and AI-backed
                  verification.
                </p>
              </div>

              <div className="hero-visual">
                <div className="hero-premium-board">
                  <article className="preview-card premium-card premium-card-primary">
                    <span>Attendance workspace</span>
                    <strong>Teacher-controlled review with AI assistance</strong>
                    <p>From classroom capture to final submission in one focused flow.</p>
                  </article>

                  <div className="hero-premium-grid">
                    <article className="preview-card premium-card">
                      <span>Teacher side</span>
                      <strong>Classes, rosters, schedules</strong>
                    </article>
                    <article className="preview-card premium-card">
                      <span>Student side</span>
                      <strong>Join, enroll, track progress</strong>
                    </article>
                    <article className="preview-card premium-card">
                      <span>AI layer</span>
                      <strong>Detection, recognition, liveness</strong>
                    </article>
                    <article className="preview-card premium-card">
                      <span>Analytics</span>
                      <strong>History, alerts, trends, watchlists</strong>
                    </article>
                  </div>

                  <div className="hero-premium-footer">
                    <span className="hero-dot" />
                    <p>Designed to feel like a real product, not a generic project landing page.</p>
                  </div>
                </div>

                <div className="preview-stack hero-preview-stack">
                  <article className="preview-card premium-inline-card">
                    <span>Secure login</span>
                    <strong>Role-based access for students and teachers</strong>
                  </article>
                  <article className="preview-card premium-inline-card">
                    <span>Attendance records</span>
                    <strong>History, notes, and review-ready workflows</strong>
                  </article>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="section-block" id="features">
          <div className="section-heading landing-heading">
            <p className="section-kicker">Features</p>
            <h2>Everything needed for a modern attendance platform.</h2>
            <p>
              Built for teachers, students, and AI-assisted attendance workflows with
              the core tools required for daily academic operations.
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
            <p className="section-kicker">Working</p>
            <h2>Simple on the surface. Structured underneath.</h2>
            <p>
              The product flow follows the same sequence as the implementation:
              authentication, classroom access, face enrollment, AI review, and final
              attendance submission.
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
                dashboards, AI-backed verification, and MongoDB-powered record flow.
              </p>

              <div className="footer-button-row">
                <a className="primary-button" href="#/signup">
                  Sign In
                </a>
                <a className="secondary-button" href="#/login">
                  Login
                </a>
              </div>
            </div>

            <div className="footer-column footer-card footer-card-connect">
              <strong>Connect</strong>
              <div className="footer-link-list">
                <a href="https://github.com/" target="_blank" rel="noreferrer">
                  GitHub
                </a>
                <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
                <a href="tel:+910000000000">+91 00000 00000</a>
                <a href="mailto:contact@markin.app">contact@markin.app</a>
              </div>
            </div>

            <div className="footer-column footer-card footer-card-nav">
              <strong>Navigate</strong>
              <div className="footer-link-list">
                {navLinks.map((link) => (
                  <a key={link.id} href={`#${link.id}`}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="footer-column footer-card footer-status-column">
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
