from __future__ import annotations

import html
import re
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = Path(__file__).resolve().parent
PDF_PATH = OUT_DIR / "SAMS-Beginner-Technical-Guide.pdf"
MD_PATH = OUT_DIR / "SAMS-Beginner-Technical-Guide.md"


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="TitleCenter",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=25,
        leading=31,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=20,
    )
)
styles.add(
    ParagraphStyle(
        name="SubtitleCenter",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=12,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#475569"),
        spaceAfter=8,
    )
)
styles["Heading1"].fontName = "Helvetica-Bold"
styles["Heading1"].fontSize = 19
styles["Heading1"].leading = 24
styles["Heading1"].spaceBefore = 10
styles["Heading1"].spaceAfter = 10
styles["Heading1"].textColor = colors.HexColor("#0f172a")
styles["Heading2"].fontName = "Helvetica-Bold"
styles["Heading2"].fontSize = 14
styles["Heading2"].leading = 19
styles["Heading2"].spaceBefore = 12
styles["Heading2"].spaceAfter = 7
styles["Heading2"].textColor = colors.HexColor("#1e293b")
styles["Heading3"].fontName = "Helvetica-Bold"
styles["Heading3"].fontSize = 11.5
styles["Heading3"].leading = 15
styles["Heading3"].spaceBefore = 8
styles["Heading3"].spaceAfter = 5
styles["Heading3"].textColor = colors.HexColor("#334155")
styles["BodyText"].fontName = "Helvetica"
styles["BodyText"].fontSize = 9.5
styles["BodyText"].leading = 14
styles["BodyText"].alignment = TA_JUSTIFY
styles["BodyText"].spaceAfter = 6
styles.add(
    ParagraphStyle(
        name="Small",
        parent=styles["BodyText"],
        fontSize=8.5,
        leading=12,
        alignment=TA_LEFT,
        textColor=colors.HexColor("#475569"),
    )
)
styles.add(
    ParagraphStyle(
        name="TableCell",
        parent=styles["BodyText"],
        fontSize=7.6,
        leading=10,
        alignment=TA_LEFT,
        spaceAfter=0,
    )
)
styles.add(
    ParagraphStyle(
        name="TableHead",
        parent=styles["TableCell"],
        fontName="Helvetica-Bold",
        textColor=colors.white,
    )
)
styles.add(
    ParagraphStyle(
        name="CodeBlock",
        parent=styles["Code"],
        fontName="Courier",
        fontSize=7.2,
        leading=9.1,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f8fafc"),
    )
)


story = []
markdown_lines: list[str] = []
chapter_counter = 0


def esc(text: object) -> str:
    return html.escape(str(text), quote=False)


def add_md(text: str = "") -> None:
    markdown_lines.append(text)


def para(text: str, style_name: str = "BodyText") -> None:
    story.append(Paragraph(esc(text), styles[style_name]))
    add_md(text)
    add_md()


def title(text: str) -> None:
    story.append(Paragraph(esc(text), styles["TitleCenter"]))
    add_md(f"# {text}")
    add_md()


def subtitle(text: str) -> None:
    story.append(Paragraph(esc(text), styles["SubtitleCenter"]))
    add_md(text)
    add_md()


def h1(text: str, page_break: bool = True) -> None:
    global chapter_counter
    chapter_counter += 1
    if page_break and story:
        story.append(PageBreak())
    heading = f"Chapter {chapter_counter}: {text}"
    story.append(Paragraph(esc(heading), styles["Heading1"]))
    add_md(f"# {heading}")
    add_md()


def h2(text: str) -> None:
    story.append(Paragraph(esc(text), styles["Heading2"]))
    add_md(f"## {text}")
    add_md()


def h3(text: str) -> None:
    story.append(Paragraph(esc(text), styles["Heading3"]))
    add_md(f"### {text}")
    add_md()


def space(height: float = 0.18) -> None:
    story.append(Spacer(1, height * cm))


def bullets(items: list[str]) -> None:
    flow = ListFlowable(
        [
            ListItem(Paragraph(esc(item), styles["BodyText"]), leftIndent=8)
            for item in items
        ],
        bulletType="bullet",
        start="circle",
        leftIndent=14,
    )
    story.append(flow)
    story.append(Spacer(1, 0.08 * cm))
    for item in items:
        add_md(f"- {item}")
    add_md()


def code_block(text: str, language: str = "text") -> None:
    story.append(Preformatted(text.rstrip(), styles["CodeBlock"], maxLineLength=95))
    story.append(Spacer(1, 0.16 * cm))
    add_md(f"```{language}")
    add_md(text.rstrip())
    add_md("```")
    add_md()


def make_cell(value: object, head: bool = False) -> Paragraph:
    style = styles["TableHead"] if head else styles["TableCell"]
    return Paragraph(esc(value), style)


def table(headers: list[str], rows: list[list[object]], widths: list[float] | None = None) -> None:
    data = [[make_cell(header, True) for header in headers]]
    data.extend([[make_cell(cell) for cell in row] for row in rows])
    if widths:
        col_widths = [width * cm for width in widths]
    else:
        available = 17.0 / len(headers)
        col_widths = [available * cm for _ in headers]
    tbl = Table(data, repeatRows=1, colWidths=col_widths, hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 0.2 * cm))
    add_md("| " + " | ".join(headers) + " |")
    add_md("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in rows:
        add_md("| " + " | ".join(str(cell).replace("\n", " ") for cell in row) + " |")
    add_md()


def note_box(title_text: str, body: str) -> None:
    box = Table(
        [
            [Paragraph(esc(title_text), styles["TableHead"])],
            [Paragraph(esc(body), styles["BodyText"])],
        ],
        colWidths=[17 * cm],
        hAlign="LEFT",
    )
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#eff6ff")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#93c5fd")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(KeepTogether([box, Spacer(1, 0.15 * cm)]))
    add_md(f"> {title_text}: {body}")
    add_md()


TECH_STACK = [
    ["Frontend", "React 18, Parcel, JavaScript, CSS", "Builds the browser UI and dashboards. Parcel keeps setup simple for a beginner project while React makes screens reusable."],
    ["Backend", "Node.js, Express, Mongoose", "Owns the REST API, authentication, business rules, MongoDB reads/writes, email, and AI integration."],
    ["Database", "MongoDB", "Stores flexible documents such as users, classrooms, attendance records, drafts, exams, leave requests, OTPs, and email logs."],
    ["AI service", "Python, FastAPI, InsightFace, ONNX Runtime", "Runs face enrollment, face detection, face recognition, and classroom attendance inference."],
    ["Email", "Nodemailer with SMTP", "Sends OTPs, welcome emails, leave updates, absence alerts, exam warnings, and class cancellation messages."],
    ["DevOps", "Docker Compose", "Runs frontend, backend, AI service, and MongoDB together during local or hosted deployment."],
]


DB_MODELS = [
    ["User", "Student, teacher, and admin accounts. Stores role, name, user ID, roll number for students, password hash, email verification state, and profile data.", "Authentication, dashboards, roster display, email notifications."],
    ["Classroom", "A teacher-owned class with subject, code, section, room, schedule, join code, status, and archive summary.", "Joining classes, dashboards, attendance, exams, and class lifecycle."],
    ["ClassMembership", "The link between one student and one classroom.", "Roster building, student class list, attendance summaries."],
    ["AttendanceRecord", "Final attendance history after a manual, QR, AI, or cancelled class action.", "Analytics, exports, student percentages, teacher summaries."],
    ["AttendanceDraft", "Today Attendance Data. A temporary editable draft created from AI/manual attendance before final submission.", "Correction window, early absence email, auto-finalization."],
    ["QrAttendanceSession", "A short-lived QR token for a class attendance session.", "Student scans QR; backend validates token and membership."],
    ["FaceProfile", "Metadata about a student's enrolled face profile and model information.", "Student enrollment status and AI attendance readiness."],
    ["ClassExam", "Upcoming exam date and required attendance percentage for one class.", "Eligibility alerts, calendar UI, attendance calculator."],
    ["LeaveRequest", "Student uploaded proof/reason for absence, with teacher approve/reject state.", "Medical reports, leave proof, and teacher review."],
    ["ClassAssignment", "Teacher-created assignment with instructions, deadline, and attachments.", "Class workspace learning material."],
    ["ClassAssignmentSubmission", "Student assignment submission with files and comments.", "Submission tracking."],
    ["ClassDiscussionMessage", "Class discussion posts, replies, likes, and dislikes.", "Class communication."],
    ["EmailOtp", "Hashed OTP records for email verification, password reset, and profile email update.", "Secure account activation and recovery."],
    ["EmailDeliveryLog", "Status record for every important email attempt.", "Debugging and audit trail for notifications."],
]


API_ENDPOINTS = [
    ["GET", "/health", "Backend, database, AI, and email readiness."],
    ["GET", "/email/status", "Safe email service status without credentials."],
    ["POST", "/email/verify", "Force SMTP verification."],
    ["POST", "/email/test", "Send a protected test email."],
    ["POST", "/auth/signup", "Create student or teacher account and send verification OTP."],
    ["POST", "/auth/login", "Login with role, user ID, and password."],
    ["POST", "/auth/verify-email", "Activate account after signup OTP."],
    ["POST", "/auth/resend-verification", "Resend signup OTP after cooldown."],
    ["POST", "/auth/password-reset/request", "Send password reset OTP."],
    ["POST", "/auth/password-reset/verify", "Verify reset OTP and issue reset session."],
    ["POST", "/auth/password-reset/confirm", "Set new password after reset session."],
    ["GET", "/students/:userId/dashboard", "Student dashboard data."],
    ["POST", "/students/:studentId/classes/join", "Join a class using join code."],
    ["POST", "/students/:studentId/classes/:classId/leave-requests", "Submit leave/medical proof."],
    ["GET", "/students/:studentId/face-profile", "Get face enrollment status."],
    ["POST", "/students/:studentId/face-profile/enroll", "Enroll student face images."],
    ["GET", "/teachers/:userId/dashboard", "Teacher dashboard data."],
    ["POST", "/teachers/:teacherId/classes", "Create a class."],
    ["PATCH", "/teachers/:teacherId/classes/:classId/exam", "Set exam date and attendance rule."],
    ["GET", "/teachers/:teacherId/classes/:classId", "Load teacher class workspace."],
    ["PATCH", "/teachers/:teacherId/classes/:classId/archive", "End/archive a class and save summary."],
    ["POST", "/teachers/:teacherId/classes/:classId/students", "Add a student to teacher class roster."],
    ["PATCH", "/teachers/:teacherId/classes/:classId/students/:studentId", "Update a roster student."],
    ["DELETE", "/teachers/:teacherId/classes/:classId/students/:studentId", "Remove a roster student."],
    ["POST", "/teachers/:teacherId/classes/:classId/attendance/manual", "Submit manual attendance."],
    ["POST", "/teachers/:teacherId/classes/:classId/cancel-today", "Cancel today's class and notify students."],
    ["POST", "/teachers/:teacherId/classes/:classId/attendance/qr-session", "Create QR attendance token."],
    ["POST", "/students/attendance/qr-scan", "Student marks attendance through QR scan."],
    ["POST", "/teachers/:teacherId/classes/:classId/attendance/session", "Run AI classroom photo attendance."],
    ["PATCH", "/teachers/:teacherId/classes/:classId/attendance/today-draft/:draftId", "Edit Today Attendance Data."],
    ["POST", "/teachers/:teacherId/classes/:classId/attendance/today-draft/:draftId/finalize", "Finalize draft attendance."],
    ["PATCH", "/teachers/:teacherId/classes/:classId/leave-requests/:requestId", "Approve or reject leave request."],
    ["GET", "/admins/:adminId/dashboard", "Admin dashboard."],
    ["DELETE", "/admins/:adminId/classes/:classId", "Delete class and related data."],
    ["PATCH", "/admins/:adminId/classes/:classId/status", "Activate/archive a class."],
    ["DELETE", "/admins/:adminId/users/:role/:userId", "Delete student or teacher and related data."],
]


FRONTEND_ROUTES = [
    ["/", "HomePage", "Landing page with feature explanation and service status."],
    ["/login", "AuthPage login", "Student, teacher, and admin login."],
    ["/signup", "AuthPage signup", "Student/teacher registration with email OTP."],
    ["/reset-password", "AuthPage reset", "OTP reset with resend cooldown and password confirmation."],
    ["/student-dashboard", "StudentDashboardPage", "Main student overview with metrics and tools."],
    ["/student-classes", "StudentDashboardToolsPage", "Student class list and analytics tools."],
    ["/student-performance", "StudentDashboardToolsPage", "Attendance performance and recovery plan."],
    ["/student-schedule", "StudentDashboardToolsPage", "Student timetable view."],
    ["/student-exams", "StudentDashboardToolsPage", "Exam calendar and eligibility details."],
    ["/student-notifications", "StudentDashboardToolsPage", "Notification page including alerts."],
    ["/student-classroom", "StudentClassDetailPage", "Detailed page for one joined class."],
    ["/student-face-enrollment", "StudentFaceEnrollmentPage", "Face profile enrollment workflow."],
    ["/teacher-dashboard", "TeacherDashboardPage", "Teacher overview, classes, exams, schedules."],
    ["/teacher-classroom", "TeacherClassroomPage", "Class workspace."],
    ["/teacher-classroom-attendance", "TeacherClassroomPage attendanceOnly", "Focused attendance page."],
    ["/teacher-classroom-sessions", "TeacherClassroomSessionsPage", "Attendance session history."],
    ["/teacher-classroom-students", "TeacherClassroomStudentsPage", "Roster management."],
    ["/admin-dashboard", "AdminDashboardPage", "Admin record control panel."],
]


GLOSSARY = [
    ["API", "A set of URLs the frontend can call to ask the backend for work."],
    ["Backend", "The server-side code that validates requests, talks to the database, sends email, and calls AI."],
    ["Controller", "A backend function that receives an HTTP request and returns an HTTP response."],
    ["Service", "Backend business logic separated from controllers so it can be reused and tested."],
    ["Model", "A database schema definition that says what fields a document can have."],
    ["Mongoose", "A library that lets Node.js work with MongoDB using schemas and models."],
    ["Document", "One stored MongoDB object, similar to one row in a SQL database."],
    ["Collection", "A group of MongoDB documents, similar to a table."],
    ["OTP", "One time password. A temporary code sent to email to prove account ownership."],
    ["SMTP", "The email protocol used by the backend to send real emails."],
    ["Hash", "A one-way representation of a password or OTP. The original value is not stored."],
    ["Embedding", "A vector of numbers representing a face in a way a model can compare."],
    ["Cosine similarity", "A score that measures how close two embeddings point in vector space."],
    ["Threshold", "A chosen cut-off value. If confidence is above it, the system accepts a match."],
    ["Draft", "Editable temporary attendance data before final records are saved."],
    ["Finalization", "The step that writes permanent attendance records."],
    ["Roster", "The list of students belonging to one class."],
    ["Join code", "A teacher-generated code students use to join a class."],
    ["CORS", "Browser security rule controlling which frontend origins can call the backend."],
    ["Environment variable", "A runtime setting stored outside code, such as database URL or SMTP host."],
]


WEB_CONCEPTS = [
    ["HTTP request", "A message sent from browser or client to a server. It has a method, URL, headers, and sometimes a body."],
    ["HTTP response", "The answer from the server. It has a status code and usually JSON data in this project."],
    ["GET", "An HTTP method for reading data. Example: load student dashboard."],
    ["POST", "An HTTP method for creating or triggering work. Example: signup or create class."],
    ["PATCH", "An HTTP method for partial updates. Example: approve leave or update draft attendance."],
    ["DELETE", "An HTTP method for deleting a record. Example: admin deletes a class."],
    ["JSON", "A text format for structured data. Frontend and backend use it to talk."],
    ["Status code 200", "Success. The request worked."],
    ["Status code 201", "Created. A new record was successfully created."],
    ["Status code 400", "Bad request. The user sent missing or invalid data."],
    ["Status code 401", "Unauthorized. Login or credentials failed."],
    ["Status code 404", "Not found. The requested record does not exist."],
    ["Status code 500", "Server error. Something unexpected happened."],
    ["CORS", "Browser rule that decides which frontend origins can call this backend."],
    ["React state", "Data stored inside a component. When state changes, the UI re-renders."],
    ["useEffect", "React hook used to run side effects such as fetching dashboard data after the page loads."],
    ["Component", "A reusable piece of UI written as a JavaScript function."],
    ["Props", "Values passed from a parent component into a child component."],
    ["Hash route", "A frontend URL route after #, such as #/student-dashboard."],
    ["Mongoose schema", "A JavaScript definition of fields, validation, defaults, and indexes for MongoDB."],
    ["Index", "A database helper structure that makes lookups faster and can enforce uniqueness."],
    ["Lean query", "A Mongoose query that returns plain objects instead of full model documents."],
    ["Data URL", "A base64 encoded file stored as text, often used for small image or PDF attachments in this project."],
    ["Scheduler", "A background process that periodically checks pending work, such as old attendance drafts."],
    ["Gateway", "A service that forwards a request to another service. The backend acts as an AI gateway."],
]


FEATURE_DEEP_DIVES = [
    {
        "name": "Student registration and email verification",
        "goal": "Create a real account only after the student or teacher proves ownership of the email address.",
        "files": "AuthPage.jsx, SignupForm.jsx, authController.js, authService.js, emailOtpService.js, emailNotificationService.js, User.js, EmailOtp.js.",
        "steps": [
            "Frontend collects role, name, ID, password, email, and profile fields.",
            "Backend validates required fields and checks unique user ID and student roll number.",
            "Password is hashed with bcrypt before saving.",
            "User is saved with emailVerified=false.",
            "OTP is generated, hashed, saved, and emailed.",
            "User enters OTP; backend verifies hash and expiry; account becomes verified.",
        ],
        "edge": "If SMTP is down, the account may be created but the email status will show error or skipped. In development, devOtp may be exposed if configured, but production should disable that.",
    },
    {
        "name": "Login",
        "goal": "Allow only the correct role and credentials into the correct dashboard.",
        "files": "LoginForm.jsx, AuthPage.jsx, session.js, authController.js, authService.js, User.js.",
        "steps": [
            "User selects role and enters ID and password.",
            "Backend searches User by role and normalized userId.",
            "Backend blocks login if verification is required and email is not verified.",
            "bcrypt compares submitted password with stored hash.",
            "Frontend stores the returned user session and routes to student, teacher, or admin dashboard.",
        ],
        "edge": "If a student tries teacher role with the same ID, login fails because role is part of the search.",
    },
    {
        "name": "Forgot password with OTP",
        "goal": "Recover access without exposing old passwords or allowing unlimited OTP spam.",
        "files": "ResetPasswordForm.jsx, AuthPage.jsx, authController.js, authService.js, emailOtpService.js, EmailOtp.js.",
        "steps": [
            "User requests reset OTP for role and account ID.",
            "Backend creates password-reset OTP and sends email.",
            "Frontend disables resend for 60 seconds.",
            "Backend also enforces resend cooldown.",
            "User verifies OTP and receives a short-lived reset session token.",
            "User enters new password twice; backend checks match and hashes new password.",
        ],
        "edge": "The reset token prevents the app from keeping the OTP reusable during the password entry step.",
    },
    {
        "name": "Teacher class creation",
        "goal": "Let teachers create structured classes students can join.",
        "files": "TeacherClassCreationSection.jsx, classroomController.js, classroomService.js, Classroom.js.",
        "steps": [
            "Teacher fills subject, code, section, room, batch, semester, and schedule slots.",
            "Backend verifies teacher account.",
            "Backend generates a unique join code.",
            "Classroom document is saved.",
            "Teacher dashboard reloads and displays the class.",
        ],
        "edge": "Schedule data is normalized so later calculations, such as exam classes before date, can work reliably.",
    },
    {
        "name": "Student joins class",
        "goal": "Connect a student account to a teacher classroom using a join code.",
        "files": "JoinClassPage.jsx, StudentClassroomSection.jsx, classroomController.js, classroomService.js, ClassMembership.js.",
        "steps": [
            "Student enters join code.",
            "Backend finds active Classroom by normalized join code.",
            "Backend verifies student exists.",
            "ClassMembership is created with classId and studentUserId.",
            "Student dashboard now includes the class.",
        ],
        "edge": "A unique membership index prevents duplicate joins.",
    },
    {
        "name": "Face enrollment",
        "goal": "Build a reusable student face profile for future AI attendance.",
        "files": "StudentFaceEnrollmentPage.jsx, faceProfileController.js, faceProfileService.js, aiService.js, enrollment_pipeline.py, face_recognition_service.py.",
        "steps": [
            "Student uploads several reference images.",
            "Backend validates student account and forwards images to AI service.",
            "AI rejects unusable images and creates embeddings for valid single-face images.",
            "AI averages embeddings and stores enrollment profile.",
            "Backend saves FaceProfile metadata for dashboard readiness.",
        ],
        "edge": "If the model changes later, old embeddings may be incompatible and re-enrollment is required.",
    },
    {
        "name": "AI classroom attendance",
        "goal": "Suggest present students from a classroom image without making final records immediately.",
        "files": "TeacherClassroomPage.jsx, teacherClassroomService.js, aiService.js, classroom_attendance_pipeline.py.",
        "steps": [
            "Teacher captures/uploads classroom photo.",
            "Frontend compresses and sends image to backend.",
            "Backend builds class roster payload for AI.",
            "AI detects faces, creates tracks, compares against roster profiles, and returns suggestions.",
            "Backend creates Today Attendance Data draft.",
            "Absentees receive early email notification.",
        ],
        "edge": "Students not enrolled or faces with low confidence go to notes/review instead of automatic final attendance.",
    },
    {
        "name": "Today Attendance Data correction",
        "goal": "Give teacher a correction window between AI suggestion and final permanent attendance.",
        "files": "TeacherClassroomPage.jsx, teacherClassroomService.js, AttendanceDraft.js, AttendanceRecord.js.",
        "steps": [
            "Teacher reviews draft list.",
            "Teacher changes absent/present/late status when needed.",
            "Teacher saves draft updates.",
            "Teacher finalizes or scheduler finalizes after configured time.",
            "Backend writes final AttendanceRecord documents.",
        ],
        "edge": "Drafts make wrong AI suggestions recoverable before they affect analytics.",
    },
    {
        "name": "Manual attendance",
        "goal": "Allow teacher-controlled attendance without AI or QR dependency.",
        "files": "TeacherClassroomPage.jsx, teacherClassroomService.js, AttendanceRecord.js.",
        "steps": [
            "Teacher marks each roster student.",
            "Frontend submits statuses and notes.",
            "Backend validates ownership and active class.",
            "AttendanceRecord documents are saved.",
            "Dashboards update through attendance analytics.",
        ],
        "edge": "Manual attendance is the emergency fallback if camera, AI, or QR fails.",
    },
    {
        "name": "QR attendance",
        "goal": "Let students self-mark attendance through a short-lived scan token.",
        "files": "TeacherClassroomPage.jsx, QrAttendancePage.jsx, teacherClassroomService.js, QrAttendanceSession.js.",
        "steps": [
            "Teacher creates QR session.",
            "Backend saves token and expiry.",
            "Frontend renders QR code with scan URL.",
            "Student scans and submits identity.",
            "Backend verifies token, expiry, and membership before saving attendance.",
        ],
        "edge": "Expired or closed QR tokens should not create records.",
    },
    {
        "name": "Leave proof upload and review",
        "goal": "Let students explain absence with documents and let teachers approve or reject.",
        "files": "StudentClassDetailPage.jsx, TeacherClassroomPage.jsx, leaveRequestService.js, LeaveRequest.js, emailNotificationService.js.",
        "steps": [
            "Student selects class, date, type, reason, and attachment.",
            "Backend verifies student membership.",
            "LeaveRequest is saved with pending status.",
            "Teacher opens class workspace and views attachment online.",
            "Teacher approves/rejects with note.",
            "Student receives email status update.",
        ],
        "edge": "Attachment size and file data should be controlled to protect database size.",
    },
    {
        "name": "Exam rule and eligibility",
        "goal": "Convert attendance and schedule into eligibility and recovery advice.",
        "files": "TeacherExamsSection.jsx, StudentExamSection.jsx, examScheduleService.js, ClassExam.js.",
        "steps": [
            "Teacher sets exam title, date, required percentage, and note.",
            "Backend validates date and percentage.",
            "Dashboards count scheduled classes before exam.",
            "Backend calculates current eligibility and minimum classes to attend.",
            "Students see action text and warnings.",
        ],
        "edge": "If no scheduled classes remain, the system tells the student to talk to the teacher instead of pretending recovery is possible.",
    },
    {
        "name": "Class cancellation",
        "goal": "Record that a class did not happen and notify students.",
        "files": "TeacherClassroomPage.jsx, teacherClassroomService.js, emailNotificationService.js, AttendanceRecord.js.",
        "steps": [
            "Teacher cancels today's class with a reason.",
            "Backend writes cancelled records or cancellation status.",
            "Email notification is sent to class students.",
            "Attendance analytics do not count cancelled class against students.",
        ],
        "edge": "Cancelled is different from absent. A student should not lose percentage for a class that was not held.",
    },
    {
        "name": "Class archive",
        "goal": "Freeze a completed class while keeping its history.",
        "files": "TeacherClassesPanel.jsx, teacherClassroomService.js, Classroom.js, teacherDashboardService.js.",
        "steps": [
            "Teacher clicks End Class.",
            "Backend computes archive summary from attendance and roster.",
            "Classroom status becomes archived.",
            "Active attendance operations are blocked.",
            "Dashboard still shows historical summary.",
        ],
        "edge": "Archive is normal lifecycle. Delete should be reserved for admin cleanup or wrong data.",
    },
]


BACKEND_SERVICE_DEEP_DIVES = [
    ["authService.js", "Owns account creation, login, email verification, password reset, default admin seed, and user sanitization.", "This service protects identity. It normalizes user IDs, validates signup data, hashes passwords, creates OTPs, and prevents login before verification."],
    ["classroomService.js", "Creates classes, generates join codes, joins students, and lists classes for dashboards.", "This service connects users to classrooms. It is the start of nearly every attendance feature."],
    ["teacherClassroomService.js", "Large service for the teacher class workspace.", "It handles roster updates, manual attendance, QR, AI attendance sessions, drafts, finalization, cancellation, leave review, exam setting, and archive guards."],
    ["studentDashboardService.js", "Builds the rich student dashboard response.", "It joins class memberships, attendance records, leave requests, face profile, exams, schedule, alerts, and recovery calculations."],
    ["teacherDashboardService.js", "Builds the teacher dashboard response.", "It calculates classes managed, flagged students, schedules, upcoming exams, attendance averages, and archived class information."],
    ["attendanceAnalyticsService.js", "Converts raw attendance records into percentages and sessions.", "It decides how present, late, absent, and cancelled records affect totals and dashboard metrics."],
    ["examScheduleService.js", "Owns exam rules and eligibility calculations.", "It counts remaining scheduled classes and calculates whether each student can reach the required percentage."],
    ["emailService.js", "Low-level email delivery engine.", "It creates the SMTP transporter, verifies connection, queues sends, retries failures, and stores delivery logs."],
    ["emailNotificationService.js", "High-level notification events.", "It chooses who receives which template for OTP, welcome, absent, leave, exam warning, and cancellation emails."],
    ["aiService.js", "Backend gateway to AI service.", "It adds timeouts, retries, error normalization, and keeps the frontend from talking directly to model endpoints."],
    ["adminService.js", "Admin dashboard and destructive record cleanup.", "It calculates admin metrics, sorts students by roll number, deletes users/classes, and cleans linked records."],
]


DEBUG_RECIPES = [
    ["Signup OTP not arriving", "Check /api/v1/email/status. Confirm EMAIL_ENABLED, EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, and EMAIL_PASSWORD are set. Check spam folder. Check EmailDeliveryLog status. Do not print the password."],
    ["User sees verify email error on login", "Open the User document and check emailVerified. If false, verify OTP or use admin email verification toggle during development."],
    ["Forgot password resend button disabled", "This is expected for 60 seconds. Backend also enforces cooldown, so refreshing the browser should not bypass it."],
    ["Dashboard shows no classes", "For students, check ClassMembership. For teachers, check Classroom.teacherUserId. Make sure userId is uppercase-normalized."],
    ["Join code not working", "Check Classroom.joinCode, class status, and whether the student already has a membership."],
    ["AI says missing face profiles", "The student has not completed FaceProfile/enrollment or AI local enrollment store does not contain the profile."],
    ["AI says re-enrollment required", "The stored embedding model or dimensions do not match current ArcFace model settings."],
    ["Photo attendance detects no faces", "Use clearer image, better lighting, less blur, front-facing students, and make sure AI service /ready is true."],
    ["Wrong student suggested present", "Check confidence and margin. Use draft correction before finalization. Consider improving enrollment photos."],
    ["Attendance percentage too low", "Check total counted classes and whether absences were final. Remember cancelled classes should not count."],
    ["Exam eligibility says at risk", "Check required percentage, present count, total count, and remaining scheduled classes before exam date."],
    ["Teacher cannot take attendance", "Class may be archived. Active operations are intentionally blocked for archived classes."],
    ["Admin delete feels incomplete", "Check adminService deletion summary and related collections. Add cleanup for any new collection introduced later."],
    ["Email timeout appears", "SMTP server did not answer before timeout. Network, firewall, Gmail, or port can be the cause."],
    ["Frontend route opens landing page unexpectedly", "Check App.jsx route string and URL hash. Hash routes must use #/route-name."],
]


VIVA_QUESTIONS = [
    ["What problem does SAMS solve?", "It records attendance and makes it useful through analytics, alerts, exam eligibility, leave proof, and teacher-reviewed AI attendance."],
    ["Why are there three services?", "React handles UI, Express handles business rules and database, and FastAPI handles AI inference. This separation keeps responsibilities clean."],
    ["Why does the frontend not call AI directly?", "The backend must validate teacher, class, roster, and finalization rules before and after AI inference."],
    ["Why use MongoDB?", "It stores flexible documents such as schedules, drafts, attachments, email metadata, AI notes, and dashboard-related records."],
    ["What is a Mongoose model?", "A schema-backed JavaScript model used by the backend to read and write MongoDB documents."],
    ["Why hash passwords?", "So the original password is not stored. Login compares the submitted password with the stored hash using bcrypt."],
    ["Why is email verification required?", "It proves the user owns the email address before the account becomes active."],
    ["Why is OTP hashed?", "If the database leaks, active OTP codes should not be directly readable."],
    ["Why add OTP resend cooldown?", "To reduce spam, abuse, and accidental repeated mail requests."],
    ["What is Today Attendance Data?", "An editable AttendanceDraft created before final attendance records are saved."],
    ["Why not directly save AI attendance?", "AI can make mistakes. Teacher correction protects students from wrong final records."],
    ["Why send absent email before finalization?", "It allows students to report mistakes early while the teacher can still correct the draft."],
    ["What is ArcFace?", "A face recognition method that creates embeddings useful for comparing whether two face images belong to the same person."],
    ["What is an embedding?", "A vector of numbers that represents identity-related face features."],
    ["Why use multiple enrollment images?", "To build a more reliable average embedding and reject poor images."],
    ["What happens if a student is not enrolled?", "AI may list them as missing profile or absent; teacher can still mark manually."],
    ["What is recognition threshold?", "A confidence cutoff for accepting a face match automatically."],
    ["What is recognition margin?", "A gap between best and second-best matches to reduce confused identity matches."],
    ["Why can a class be archived?", "To preserve history after the semester while blocking new attendance actions."],
    ["Why is cancelled class separate from absent?", "Cancelled means class did not happen, so students should not lose attendance percentage."],
    ["How is attendance percentage calculated?", "Present or late count divided by total counted classes, multiplied by 100."],
    ["How is exam eligibility calculated?", "The system counts remaining scheduled classes before exam and calculates minimum classes needed to reach required percentage."],
    ["What is ClassMembership?", "A link document connecting one student to one classroom."],
    ["What is the role of EmailDeliveryLog?", "It records sent, skipped, or failed email attempts for debugging and audit."],
    ["What is the admin panel for?", "System record cleanup and account/class control, not normal teaching workflows."],
]


def add_cover() -> None:
    story.append(Spacer(1, 2.2 * cm))
    title("SAMS / MarkIn Beginner Technical Guide")
    subtitle("A complete, beginner-friendly explanation of the Smart Attendance Management System")
    subtitle(f"Generated on {date.today().isoformat()}")
    space(0.5)
    note_box(
        "Purpose of this PDF",
        "This guide is written for a beginner who knows little or nothing about the project. It explains what each part does, why it exists, how data moves, how attendance is calculated, how AI face recognition works, and how to debug the system without exposing secrets.",
    )
    para(
        "The project is a full-stack attendance management system. It has a React frontend, an Express backend, a MongoDB database, and a Python FastAPI AI service. Teachers create classes, students join them, attendance can be taken manually, through QR code, or from classroom photos, and both students and teachers see analytics. Email OTP and notification flows make the system closer to a real project."
    )
    para(
        "This PDF intentionally explains basic ideas before technical details. If you already know web development, you can skim the beginner boxes. If you are new, read slowly from the start: the same concepts repeat in different features, so the project will become clearer chapter by chapter."
    )
    code_block(
        """
Important safety note:
- This guide never prints real secrets from .env files.
- Use placeholder values such as EMAIL_PASSWORD=<gmail-app-password>.
- Do not paste real database URLs, app passwords, or OTPs in reports.
""".strip()
    )


def add_contents_overview() -> None:
    story.append(PageBreak())
    story.append(Paragraph("Contents Overview", styles["Heading1"]))
    add_md("# Contents Overview")
    add_md()
    para(
        "This is a study map for the guide. Page numbers are intentionally omitted because the editable source and generated PDF can change when new sections are added."
    )
    bullets(
        [
            "How to read this guide and the big picture of SAMS / MarkIn.",
            "Architecture, service boundaries, technology stack, and folder tour.",
            "Frontend routing, React patterns, beginner web concepts, and backend service structure.",
            "Database models, sample documents, and data lifecycles.",
            "Authentication, OTP, password reset, class management, attendance, AI, email, and exam eligibility.",
            "Student journey, teacher journey, admin controls, deployment, testing, troubleshooting, and security.",
            "API examples, complete day-in-the-life walkthrough, viva question bank, glossary, and code reading workbook.",
        ]
    )


def add_how_to_read() -> None:
    h1("How To Read This Guide", page_break=False)
    para(
        "A software project can look frightening because many files work together. The trick is to stop reading file by file and start reading flow by flow. A flow means a real action, such as login, joining a class, taking attendance, sending an OTP, or calculating exam eligibility. Once you understand the flow, the files become easier to remember."
    )
    h2("The simplest mental model")
    para(
        "Think of SAMS as four cooperating workers. The browser worker shows buttons and dashboards. The backend worker checks rules and protects the data. The database worker remembers everything. The AI worker looks at face images and returns suggestions. No single worker does everything."
    )
    code_block(
        """
User clicks button in browser
        |
        v
React frontend calls backend REST API
        |
        v
Express backend validates request and applies rules
        |
        +--> MongoDB stores or reads documents
        |
        +--> FastAPI AI service runs face recognition when needed
        |
        +--> SMTP email service sends OTPs and notifications
        |
        v
Frontend receives JSON and updates the dashboard
""".strip()
    )
    h2("Recommended reading path")
    bullets(
        [
            "First read Chapters 1 to 4 to understand the architecture and folder structure.",
            "Then read the authentication, class, and attendance chapters because they explain the core project.",
            "Read the AI chapter slowly. It explains face detection, face recognition, embeddings, thresholds, and alternatives.",
            "Use the appendices as quick references when you are looking at code.",
        ]
    )
    h2("What beginner words mean")
    para(
        "A route is a URL handled by the backend. A controller is the function that receives the request for that route. A service is where the real work is done. A model is a database schema. A component is a reusable frontend UI function. A dashboard is not only design; it is a screen built from API data."
    )


def add_big_picture() -> None:
    h1("Project Overview")
    para(
        "SAMS, also called MarkIn in the product wording, is a Smart Attendance Management System. The word smart does not only mean AI. It means the system tries to make attendance useful after it is recorded. Students see percentages, weak classes, upcoming exams, recovery plans, and alerts. Teachers see rosters, attendance drafts, pending actions, class schedules, and students who need attention. Admins can clean incorrect classes and accounts."
    )
    h2("Main user roles")
    table(
        ["Role", "Main goal", "Important screens", "Important backend data"],
        [
            ["Student", "Join classes, track attendance, enroll face, submit leave proof, watch exam eligibility.", "Student dashboard, class detail, face enrollment, notifications, profile.", "User, ClassMembership, AttendanceRecord, FaceProfile, LeaveRequest, ClassExam."],
            ["Teacher", "Create classes, manage roster, take attendance, review leave, set exams, archive finished classes.", "Teacher dashboard, class workspace, students page, sessions page, exam section.", "Classroom, ClassMembership, AttendanceDraft, AttendanceRecord, LeaveRequest, ClassExam."],
            ["Admin", "Control system records and remove wrong or old data.", "Admin dashboard.", "User, Classroom, linked data across attendance and class collections."],
        ],
        [2.2, 4.2, 5.1, 5.5],
    )
    h2("Main features in plain language")
    bullets(
        [
            "Account system: students and teachers register, verify email through OTP, and then log in.",
            "Password reset: user requests OTP, waits one minute before resend, verifies OTP, then enters the new password twice.",
            "Class management: teachers create classes with subject details, room, schedule, and join code.",
            "Student joining: students join a teacher class using a join code.",
            "Face enrollment: students upload multiple face images so the AI service can build an identity profile.",
            "Attendance methods: teacher can mark manually, create a QR attendance session, or run AI on a classroom photo.",
            "Today Attendance Data: AI result becomes an editable draft before final attendance is saved.",
            "Absence email: as soon as draft attendance marks a student absent, the student gets an email so mistakes can be reported early.",
            "Exam eligibility: teacher sets exam date and required attendance percentage; students see whether they are eligible and how many future classes they must attend.",
            "Leave proof: students upload PDF/image documents for absence reason; teacher reviews and approves or rejects.",
            "Class archive: when a semester/class is over, teacher can end the class and save summary data.",
        ]
    )
    h2("Why this is not a single app file")
    para(
        "A beginner often asks why the project is split into frontend, backend, database, and AI service. The reason is responsibility. The frontend should not store passwords or talk directly to AI model files. The backend should not perform heavy image recognition inside the same process that handles every dashboard request. MongoDB should store data, not business rules. The AI service should focus on model loading and inference. This separation makes the system easier to debug and safer to grow."
    )


def add_architecture() -> None:
    h1("Architecture And Service Boundaries")
    para(
        "Architecture means the way the project is divided into pieces and how those pieces communicate. In SAMS, the pieces are intentionally separated. This makes it easier to replace one piece later. For example, if the AI service becomes slow, it can be moved to a stronger server without rewriting the React dashboard."
    )
    code_block(
        """
                         +------------------------------+
                         |          React Frontend       |
                         |  Dashboards, forms, camera UI |
                         +---------------+--------------+
                                         |
                                         | REST JSON
                                         v
                         +---------------+--------------+
                         |        Express Backend        |
                         | Auth, rules, emails, reports  |
                         +-------+---------------+------+
                                 |               |
                      Mongoose   |               | REST JSON
                                 v               v
                    +------------+----+   +------+----------------+
                    |    MongoDB      |   |   FastAPI AI Service  |
                    | Users, classes, |   | Face detection,       |
                    | attendance, OTP |   | embeddings, matching  |
                    +-----------------+   +-----------------------+
""".strip()
    )
    h2("Frontend boundary")
    para(
        "The frontend lives in frontend/. It is a React application. It should ask the backend for data and render the answer. It should not decide whether a password is correct, whether an OTP is valid, whether a student is in a class, or whether a face match is accepted. Those decisions belong to backend and AI service logic."
    )
    h2("Backend boundary")
    para(
        "The backend lives in backend/. It is an Express REST API. It is the source of truth for users, classes, attendance records, leave requests, exam rules, email notifications, and admin actions. It also acts as a gateway to the AI service. The frontend never directly calls the AI service in the current architecture."
    )
    h2("AI service boundary")
    para(
        "The AI service lives in ai-service/. It is written in Python using FastAPI. It loads InsightFace models, creates face embeddings, compares those embeddings, and returns recognition suggestions. It does not decide the final attendance record. The teacher and backend still control finalization."
    )
    h2("Database boundary")
    para(
        "MongoDB stores documents. The backend uses Mongoose models to define the shape of those documents. MongoDB does not know what a teacher dashboard is; it only stores collections such as users, classrooms, attendance records, and OTP records. The backend combines those documents into useful dashboard responses."
    )
    h2("Why REST JSON")
    para(
        "REST JSON is a simple communication style. The frontend sends an HTTP request to a URL, usually with JSON data. The backend returns JSON. This is beginner friendly because you can test the same URL with curl or Postman. Alternatives include GraphQL, gRPC, WebSockets, or server-rendered pages. REST is selected here because the workflows are request-response based and easy to debug."
    )


def add_technology_stack() -> None:
    h1("Technology Stack")
    table(["Layer", "Technology", "Why it is used"], TECH_STACK, [2.5, 4.3, 9.8])
    h2("Alternatives and why this project uses the current choices")
    table(
        ["Area", "Current choice", "Alternatives", "Why current choice is reasonable here"],
        [
            ["Frontend", "React + Parcel", "Vue, Angular, Next.js, plain HTML/JS", "React is common, component-based, and fits dashboards. Parcel avoids a heavy config file, which is useful for a college project."],
            ["Backend", "Express", "NestJS, Fastify, Django, Spring Boot", "Express is small and direct. Controllers, services, and routes are easy for beginners to trace."],
            ["Database", "MongoDB", "PostgreSQL, MySQL, SQLite, Firebase", "Attendance documents have many related shapes: drafts, exams, attachments, discussion, logs. MongoDB is flexible and pairs naturally with Node/Mongoose."],
            ["AI API", "FastAPI", "Flask, Django REST, Node Python bridge", "FastAPI gives type-friendly request schemas and automatic docs, and Python is the natural ecosystem for ML libraries."],
            ["Face recognition", "InsightFace ArcFace", "OpenCV LBPH, Dlib, FaceNet, DeepFace wrapper, custom CNN", "ArcFace embeddings are strong for identity matching and do not require training a model from scratch for this project."],
            ["Email", "SMTP through Nodemailer", "SendGrid, Mailgun, SES, Brevo API", "SMTP can work with free Gmail app passwords and keeps the project usable without paid services."],
        ],
        [2.3, 3.2, 4.1, 6.4],
    )
    h2("Beginner explanation: library vs framework")
    para(
        "A library is code you call when you need it. A framework often calls your code according to its rules. React is often described as a UI library, while Express is a minimal web framework. In practice, both help avoid writing everything from zero. Mongoose is a library for MongoDB models, Nodemailer is a library for email, and InsightFace is a model toolkit for face analysis."
    )
    h2("Why not keep everything inside one MERN server")
    para(
        "The MERN stack normally means MongoDB, Express, React, and Node. SAMS adds a Python AI service because deep learning libraries and ONNX Runtime support are stronger in Python. Keeping AI separate prevents the Node backend from becoming large, slow, and hard to deploy. The backend becomes a coordinator rather than a model host."
    )


def add_project_structure() -> None:
    h1("Project Folder Tour")
    para(
        "Before understanding code, you should understand where to look. A beginner mistake is opening random files and getting lost. Use the folder names as a map."
    )
    code_block(
        """
SAMS/
  frontend/        React application shown in the browser
  backend/         Express API, MongoDB models, services, email, auth
  ai-service/      Python FastAPI service for face recognition
  shared/          Shared API contract examples
  docs/            Architecture notes and diagrams
  reports/         Generated reports and PDF guides
  docker-compose.yml
  package.json
""".strip()
    )
    h2("Frontend folders")
    table(
        ["Path", "Meaning"],
        [
            ["frontend/src/App.jsx", "Hash-based router that chooses which page component to show."],
            ["frontend/src/pages/AuthPage", "Signup, login, reset password, OTP forms."],
            ["frontend/src/pages/StudentDashboardPage", "Student dashboard, tools, class analytics, schedule, notifications."],
            ["frontend/src/pages/TeacherDashboardPage", "Teacher dashboard, class creation, profile, exams, schedules."],
            ["frontend/src/pages/TeacherClassroomPage", "Class workspace, camera/photo attendance, manual attendance, Today Attendance Data."],
            ["frontend/src/pages/AdminDashboardPage", "Admin controls for users/classes."],
            ["frontend/src/services/api.js", "All frontend REST calls to the backend."],
            ["frontend/src/services/session.js", "Local browser session storage helpers."],
        ],
        [6.0, 10.6],
    )
    h2("Backend folders")
    table(
        ["Path", "Meaning"],
        [
            ["backend/src/routes/index.js", "Maps API URLs to controller functions."],
            ["backend/src/controllers", "Thin request/response layer."],
            ["backend/src/services", "Business logic: auth, dashboards, attendance, email, AI gateway."],
            ["backend/src/models", "Mongoose schemas for MongoDB collections."],
            ["backend/src/config", "Environment and database connection."],
            ["backend/src/app.js", "Express app, CORS, JSON parser, router."],
            ["backend/src/server.js", "Database connect, admin seed, email check, scheduler, listen."],
        ],
        [6.0, 10.6],
    )
    h2("AI service folders")
    table(
        ["Path", "Meaning"],
        [
            ["ai-service/app/api/routes.py", "FastAPI endpoints for models, enrollment, recognition, verification, finalization."],
            ["ai-service/app/pipelines", "High-level AI workflows: enrollment, classroom attendance, live verification."],
            ["ai-service/app/services", "Face detection and recognition model logic."],
            ["ai-service/app/storage", "Local JSON stores for enrolled profiles and AI sessions."],
            ["ai-service/app/schemas", "Pydantic request/response models."],
            ["ai-service/app/core/config.py", "AI thresholds, model pack names, model directories, providers."],
        ],
        [6.0, 10.6],
    )


def add_frontend() -> None:
    h1("Frontend Explained")
    para(
        "The frontend is the part the user sees. It runs in the browser at the development URL, usually http://localhost:5173. It is built with React, which means each screen is made from components. A component is a JavaScript function that returns UI."
    )
    h2("Routing")
    para(
        "The project uses hash routing. A URL like http://localhost:5173/#/student-dashboard tells App.jsx to render StudentDashboardPage. Hash routing is simple because the development server can serve the same index.html for every route. The browser handles the part after #."
    )
    table(["Route", "Component", "Purpose"], FRONTEND_ROUTES, [4.0, 5.2, 7.2])
    h2("Frontend data pattern")
    code_block(
        """
Component loads
   |
   v
useEffect calls a function from frontend/src/services/api.js
   |
   v
api.js uses fetch() to call backend
   |
   v
Backend returns JSON
   |
   v
Component saves JSON in useState
   |
   v
React re-renders the page with updated dashboard data
""".strip()
    )
    h2("Why api.js matters")
    para(
        "The frontend does not write fetch code everywhere. Most API calls are collected in frontend/src/services/api.js. This is good because if the backend base URL changes, or if error handling changes, the project can update one service file instead of every page."
    )
    h2("Session storage")
    para(
        "After login, the frontend stores the user session in browser storage through frontend/src/services/session.js. This is not the same as strong production authentication with secure HTTP-only cookies or JWT refresh tokens. For this project it is a simple way to remember who is logged in. The frontend checks the saved session and redirects if it becomes invalid."
    )
    h2("Student dashboard design")
    para(
        "The student dashboard is meant to answer practical questions: How many classes have I joined? Which class is weak? What is my attendance percentage? Do I need to attend more classes before an exam? What notifications need attention? This is why separate tool pages exist for classes, performance, schedule, exams, insights, and notifications. It avoids putting every tool on one crowded page."
    )
    h2("Teacher dashboard design")
    para(
        "The teacher dashboard is focused on action. A teacher creates classes, sees managed classes, sets exams, checks schedules, and opens class workspaces. The class workspace is where high-risk operations happen: attendance, draft correction, finalization, student roster changes, QR sessions, cancellation, leave review, and export."
    )
    h2("Admin dashboard design")
    para(
        "The admin dashboard is intentionally simpler than a teacher dashboard. It should not show teacher-only or student-only metrics such as leave requests or upcoming exams as primary cards. Admin features focus on deleting incorrect users/classes, toggling email verification, and checking overall record counts."
    )


def add_beginner_web_concepts() -> None:
    h1("Beginner Web Development Concepts")
    para(
        "This chapter explains the web development ideas that appear again and again in the project. If you understand these, the code will feel much less mysterious."
    )
    table(["Concept", "Meaning"], WEB_CONCEPTS, [4.2, 12.3])
    h2("What actually happens when you click a button")
    para(
        "A button in React is usually connected to an event handler such as onClick or onSubmit. The handler may update local state, validate form data, or call an API function. If it calls the backend, the browser sends an HTTP request. The backend route receives it, a controller calls a service, the service reads or writes MongoDB, and the response returns to the component."
    )
    code_block(
        """
React button
  -> event handler
  -> api.js function
  -> fetch()
  -> Express route
  -> controller
  -> service
  -> Mongoose model
  -> MongoDB
  -> JSON response
  -> setState()
  -> updated UI
""".strip()
    )
    h2("Why the frontend should not trust itself")
    para(
        "The frontend can make the user experience nicer, but it cannot be the only security layer. A user can edit browser JavaScript, call APIs manually, or bypass disabled buttons. That is why important rules also exist on the backend. Example: OTP resend has a frontend timer, but backend also rejects early resend. Archive blocks are also checked on the backend."
    )
    h2("Why JSON responses are shaped for dashboards")
    para(
        "The backend often sends dashboard-ready objects instead of raw database documents. For example, the student dashboard response can include classPerformance, comparison, upcomingClasses, alerts, and exams. This keeps the React component focused on display instead of doing heavy calculations in the browser."
    )
    h2("Frontend error messages")
    para(
        "The API helper reads JSON error responses and throws JavaScript Error objects. Components catch these errors and show messages. This pattern makes errors visible to the user while keeping the fetch details inside api.js."
    )


def add_feature_deep_dives() -> None:
    h1("Feature By Feature Deep Dive")
    para(
        "This chapter explains each major feature as a complete story. For every feature, focus on goal, files, steps, and edge cases. That is how developers understand large systems."
    )
    for index, feature in enumerate(FEATURE_DEEP_DIVES):
        if index:
            story.append(PageBreak())
            add_md("---")
            add_md()
        h2(feature["name"])
        para(f"Goal: {feature['goal']}")
        para(f"Important files: {feature['files']}")
        bullets(feature["steps"])
        para(f"Edge case to remember: {feature['edge']}")
        note_box(
            "Beginner checkpoint",
            "After reading this feature, try to say out loud which frontend page starts it, which backend service owns it, and which MongoDB model stores the result.",
        )


def add_backend_service_deep_dive() -> None:
    h1("Backend Services Deep Dive")
    para(
        "Services are the muscles of the backend. Controllers are small because services do the hard work. This chapter explains why each important service exists."
    )
    for index, (service, responsibility, explanation) in enumerate(BACKEND_SERVICE_DEEP_DIVES):
        if index:
            story.append(PageBreak())
            add_md("---")
            add_md()
        h2(service)
        para(f"Main responsibility: {responsibility}")
        para(explanation)
        if service == "teacherClassroomService.js":
            para(
                "This is one of the largest services because a class workspace has many actions. When reading it, do not try to memorize everything. Read one flow at a time: get classroom, add student, manual attendance, QR attendance, AI session, draft update, draft finalize, leave review, exam setting, archive."
            )
        elif service == "studentDashboardService.js":
            para(
                "This service is a good example of dashboard aggregation. It does not merely return User plus ClassMembership. It calculates useful derived data: attendance trend, class comparison, recovery plan, AI coach notes, weekly schedule, upcoming classes, cancellation alerts, low attendance alerts, and exam alerts."
            )
        elif service == "emailService.js":
            para(
                "This service is intentionally lower level than emailNotificationService. It should not know what a leave request means. It only knows how to send mail, retry, queue, and log results."
            )
        elif service == "examScheduleService.js":
            para(
                "This service shows why business logic belongs outside the component. Exam eligibility involves dates, schedules, percentages, and edge cases. Keeping it in the backend makes student and teacher dashboards consistent."
            )
        bullets(
            [
                "Find the exported function names in this file.",
                "Find which controller calls those functions.",
                "Find which models are imported at the top.",
                "Find the validation errors thrown by the service.",
            ]
        )


def add_data_lifecycle_examples() -> None:
    h1("Data Lifecycle Examples")
    para(
        "A data lifecycle explains how one piece of data is born, changes, and gets used later. Understanding lifecycle is more powerful than memorizing fields."
    )
    h2("Lifecycle of a student account")
    code_block(
        """
Signup form data
  -> User document created with passwordHash and emailVerified=false
  -> EmailOtp document created for email-verification
  -> OTP verified and consumed
  -> User emailVerified=true
  -> Student joins classes through ClassMembership
  -> Student enrolls face profile through FaceProfile and AI enrollment store
  -> Student accumulates AttendanceRecord documents
  -> Student dashboard summarizes records into useful analytics
""".strip()
    )
    h2("Lifecycle of one attendance day")
    code_block(
        """
Teacher starts attendance
  -> AI/manual/QR source creates attendance information
  -> AI path creates AttendanceDraft first
  -> Absentee email notification is sent from draft
  -> Teacher edits draft if needed
  -> Final submission writes AttendanceRecord documents
  -> Attendance analytics recompute percentages
  -> Student dashboard and teacher dashboard show updated data
  -> Exam eligibility may change because present/total counts changed
""".strip()
    )
    h2("Lifecycle of an exam rule")
    code_block(
        """
Teacher sets exam date and required percentage
  -> ClassExam document saved or updated
  -> Student dashboard fetch includes upcoming exam
  -> examScheduleService counts remaining scheduled classes
  -> Eligibility object is created for each student
  -> Email warning can be sent if attendance is below requirement
  -> Teacher dashboard summarizes eligible/recoverable/at-risk students
""".strip()
    )
    h2("Lifecycle of a leave request")
    code_block(
        """
Student submits reason and document
  -> LeaveRequest status=pending
  -> Teacher views attachment in class workspace
  -> Teacher approves or rejects
  -> LeaveRequest status changes and teacherNote is saved
  -> Student receives email notification
  -> Student class detail shows updated status
""".strip()
    )
    h2("Lifecycle of an email")
    code_block(
        """
Feature triggers notification
  -> emailNotificationService picks recipient and template
  -> emailTemplateService builds professional subject/text/html
  -> emailService checks duplicate notificationKey if present
  -> email job enters queue
  -> Nodemailer sends through SMTP with timeout and retry
  -> EmailDeliveryLog records sent, skipped, or failed
""".strip()
    )


def add_ai_algorithm_details() -> None:
    h1("AI Algorithm Details For Beginners")
    para(
        "This chapter explains the AI logic more slowly. You do not need to know advanced mathematics to understand the pipeline, but you should know what each term means."
    )
    h2("Step 1: image loading")
    para(
        "The AI service receives images as references, often data URLs. It must decode the image, check size limits, and load it into a format the model can process. This step can fail if the file is not an image, too large, corrupt, or unreachable."
    )
    h2("Step 2: face detection")
    para(
        "The detector scans the image and returns bounding boxes for faces. A bounding box is a rectangle around a face. Detection quality matters because recognition only works on the cropped face. If the detector misses a face, the recognizer never gets a chance to identify that student."
    )
    h2("Step 3: face crop and quality")
    para(
        "After detection, the service crops the face region, often with a margin around it. It also calculates quality signals. Blurry, tiny, side-facing, or unclear faces can be rejected or flagged. This protects the system from confidently matching bad evidence."
    )
    h2("Step 4: embedding creation")
    para(
        "The recognition model converts a face crop into a numerical vector. In this project, the embedding dimension is configured as 512. A 512-dimensional embedding is not a picture. It is a mathematical identity representation created by the neural network."
    )
    h2("Step 5: similarity comparison")
    para(
        "To compare two faces, the service compares their embeddings. Cosine similarity is commonly used. A score closer to 1 means more similar. A score closer to 0 means less similar. The project combines average embedding similarity and reference embedding similarity for more stable matching."
    )
    h2("Step 6: threshold and margin")
    para(
        "A threshold says how high the similarity must be before the system accepts a match. A margin says the best match must be clearly better than the second-best match. Without a margin, two similar students could cause a wrong automatic match."
    )
    h2("Step 7: one-student-one-track")
    para(
        "If multiple detected faces match the same enrolled student, only the strongest track can be automatically suggested for that student. Other detections go to manual review. This avoids marking one student present multiple times."
    )
    h2("Step 8: notes and review queue")
    para(
        "Good AI systems explain uncertainty. SAMS returns notes such as missing face profiles, re-enrollment required, no faces detected, low confidence, or manual review. The UI filters noisy notes and shows useful ones so the teacher can act."
    )
    h2("Where thresholds live")
    table(
        ["Setting", "Meaning"],
        [
            ["RECOGNITION_THRESHOLD", "Minimum confidence for automatic recognition."],
            ["RECOGNITION_MIN_MARGIN", "How much better the best match must be than the next match."],
            ["REVIEW_THRESHOLD", "Lower threshold where a possible match can go to manual review."],
            ["ENROLLMENT_MIN_QUALITY_SCORE", "Minimum quality for an enrollment image to be used."],
            ["LOW_QUALITY_FACE_THRESHOLD", "Quality value below which detected face is flagged."],
            ["TRACKING_SIMILARITY_THRESHOLD", "Similarity needed to group detections into one track."],
        ],
        [5.5, 11.0],
    )
    h2("How to explain the AI in one minute")
    para(
        "Students first enroll their faces. The AI stores mathematical face representations called embeddings. Later, a teacher uploads a classroom photo. The AI detects faces in the photo, converts each face to an embedding, compares those embeddings only against students in that class roster, and returns suggested present students. The teacher reviews and finalizes."
    )


def add_troubleshooting_cookbook() -> None:
    h1("Troubleshooting Cookbook")
    para(
        "Use this chapter when something breaks. Each row gives a symptom, likely cause, and first places to inspect."
    )
    table(["Symptom", "First investigation"], DEBUG_RECIPES, [5.0, 11.5])
    h2("How to read backend errors")
    para(
        "Backend services usually throw Error objects with user-readable messages. Controllers catch them and return JSON. If the frontend shows a message, search that exact message in backend/src to find where it was thrown. This is one of the fastest debugging tricks."
    )
    h2("How to read frontend errors")
    para(
        "React development errors often show the component stack and file line. Start at the topmost project file, not inside React internals. If the error says duplicate key, find the .map call rendering a list and check the key prop. If the error says cannot read property of undefined, inspect the data shape and loading state."
    )
    h2("How to debug API calls")
    bullets(
        [
            "Open browser developer tools and the Network tab.",
            "Click the action again.",
            "Check the request URL, method, payload, and status code.",
            "Read the JSON response message.",
            "Find the backend route for that URL in routes/index.js.",
            "Open the controller and service called by that route.",
        ]
    )
    h2("How to debug data")
    para(
        "When a dashboard looks wrong, identify which model should contain the data. For class list, check ClassMembership and Classroom. For attendance percentage, check AttendanceRecord. For exam eligibility, check ClassExam and Classroom scheduleSlots. For leave proof, check LeaveRequest."
    )


def add_code_reading_workbook() -> None:
    h1("Code Reading Workbook")
    para(
        "This workbook is for studying the project. It gives small reading tasks that build confidence."
    )
    h2("Task 1: trace login")
    bullets(
        [
            "Open frontend/src/pages/AuthPage/AuthPage.jsx.",
            "Find handleLoginSubmit.",
            "See it call loginUser from services/api.js.",
            "Open backend/src/routes/index.js and find /auth/login.",
            "Open authController.js and find login.",
            "Open authService.js and find loginUser.",
            "Find the bcrypt password comparison.",
            "Return to AuthPage and see how route changes after login.",
        ]
    )
    h2("Task 2: trace student dashboard")
    bullets(
        [
            "Open StudentDashboardPage.jsx and find the fetch function.",
            "Find fetchStudentDashboard in api.js.",
            "Find GET /students/:userId/dashboard in routes/index.js.",
            "Open studentController.js.",
            "Open studentDashboardService.js.",
            "Find where ClassMembership, AttendanceRecord, ClassExam, LeaveRequest, and FaceProfile are combined.",
        ]
    )
    h2("Task 3: trace AI attendance")
    bullets(
        [
            "Open TeacherClassroomPage.jsx and find handleRunAttendance.",
            "Find processTeacherAttendance in api.js.",
            "Find the backend route /attendance/session.",
            "Open teacherClassroomController.js and teacherClassroomService.js.",
            "Find processClassroomAttendanceWithAi in aiService.js.",
            "Open ai-service/app/api/routes.py and find /attendance/classroom-recognition.",
            "Open classroom_attendance_pipeline.py and read process().",
        ]
    )
    h2("Task 4: trace exam eligibility")
    bullets(
        [
            "Open TeacherExamsSection.jsx to see teacher input.",
            "Find setClassExam in api.js and backend routes.",
            "Open examScheduleService.js.",
            "Find buildStudentExamEligibility.",
            "Manually calculate one example and compare it with the code.",
        ]
    )
    h2("Task 5: trace email")
    bullets(
        [
            "Open emailNotificationService.js.",
            "Find the event you care about, such as sendPasswordResetOtp or notifyAbsentStudents.",
            "Open emailTemplateService.js and find the matching template.",
            "Open emailService.js and find sendEmail.",
            "Find where EmailDeliveryLog is created.",
        ]
    )


def add_sample_json_documents() -> None:
    h1("Sample Data Documents")
    para(
        "This chapter shows simplified sample documents. They are not copied from your database and contain no secrets. They help you understand what MongoDB stores."
    )
    h2("Sample User document")
    code_block(
        """
{
  "_id": "665000000000000000000001",
  "role": "student",
  "firstName": "Asha",
  "lastName": "Kumar",
  "userId": "STU-1001",
  "rollNumber": "CSE-041",
  "passwordHash": "<bcrypt-hash>",
  "email": "student@example.com",
  "emailVerified": true,
  "emailVerificationRequired": true,
  "department": "Computer Science",
  "batch": "2022-2026"
}
""".strip(),
        "json",
    )
    h2("Sample Classroom document")
    code_block(
        """
{
  "_id": "665000000000000000000101",
  "teacherUserId": "TCH-1001",
  "teacherName": "Dr. Meera Singh",
  "subjectName": "Artificial Intelligence",
  "subjectCode": "CSE-AI-301",
  "section": "A",
  "room": "Lab 2",
  "joinCode": "AI301A",
  "status": "active",
  "scheduleSlots": [
    { "day": "mon", "startTime": "10:00", "endTime": "11:00" },
    { "day": "wed", "startTime": "10:00", "endTime": "11:00" }
  ]
}
""".strip(),
        "json",
    )
    h2("Sample ClassMembership document")
    code_block(
        """
{
  "_id": "665000000000000000000201",
  "classId": "665000000000000000000101",
  "studentUserId": "STU-1001",
  "studentName": "Asha Kumar",
  "rollNumber": "CSE-041"
}
""".strip(),
        "json",
    )
    h2("Sample AttendanceDraft document")
    code_block(
        """
{
  "_id": "665000000000000000000301",
  "classId": "665000000000000000000101",
  "teacherUserId": "TCH-1001",
  "dateKey": "2026-05-20",
  "status": "draft",
  "records": [
    {
      "studentId": "STU-1001",
      "studentName": "Asha Kumar",
      "rollNumber": "CSE-041",
      "status": "present",
      "source": "ai-suggested",
      "confidence": 0.86
    },
    {
      "studentId": "STU-1002",
      "studentName": "Ravi Patel",
      "rollNumber": "CSE-042",
      "status": "absent",
      "source": "ai-suggested"
    }
  ],
  "absenteeEmailSentAt": "2026-05-20T10:10:00.000Z",
  "expiresAt": "2026-05-20T22:10:00.000Z"
}
""".strip(),
        "json",
    )
    h2("Sample final AttendanceRecord document")
    code_block(
        """
{
  "_id": "665000000000000000000401",
  "sessionId": "CSE-AI-301-2026-05-20",
  "teacherUserId": "TCH-1001",
  "studentId": "STU-1001",
  "studentName": "Asha Kumar",
  "rollNumber": "CSE-041",
  "classId": "665000000000000000000101",
  "className": "Artificial Intelligence",
  "status": "present",
  "verificationMethod": "face-recognition",
  "source": "teacher-confirmed",
  "confidence": 0.86,
  "recordedAt": "2026-05-20T10:15:00.000Z"
}
""".strip(),
        "json",
    )
    h2("Sample ClassExam document")
    code_block(
        """
{
  "_id": "665000000000000000000501",
  "classId": "665000000000000000000101",
  "teacherUserId": "TCH-1001",
  "title": "Mid Semester Exam",
  "examDate": "2026-06-10T00:00:00.000Z",
  "requiredAttendancePercentage": 75,
  "status": "active"
}
""".strip(),
        "json",
    )
    h2("Sample LeaveRequest document")
    code_block(
        """
{
  "_id": "665000000000000000000601",
  "classId": "665000000000000000000101",
  "teacherUserId": "TCH-1001",
  "studentUserId": "STU-1001",
  "studentName": "Asha Kumar",
  "requestType": "medical",
  "absenceDate": "2026-05-18T00:00:00.000Z",
  "reason": "Medical appointment",
  "attachments": [
    {
      "fileName": "medical-report.pdf",
      "fileType": "application/pdf",
      "fileSize": 120000,
      "dataUrl": "data:application/pdf;base64,<omitted>"
    }
  ],
  "status": "pending"
}
""".strip(),
        "json",
    )
    h2("Sample EmailOtp document")
    code_block(
        """
{
  "_id": "665000000000000000000701",
  "role": "student",
  "userId": "STU-1001",
  "email": "student@example.com",
  "purpose": "password-reset",
  "otpHash": "<bcrypt-hash-of-otp>",
  "attempts": 0,
  "consumedAt": null,
  "expiresAt": "2026-05-20T10:20:00.000Z"
}
""".strip(),
        "json",
    )


def add_api_examples() -> None:
    h1("Example API Requests And Responses")
    para(
        "These examples use dummy data. They show the shape of requests and responses so you can understand how frontend and backend communicate."
    )
    h2("Signup request")
    code_block(
        """
POST /api/v1/auth/signup
Content-Type: application/json

{
  "role": "student",
  "firstName": "Asha",
  "lastName": "Kumar",
  "userId": "STU-1001",
  "rollNumber": "CSE-041",
  "password": "strongpass123",
  "email": "student@example.com",
  "department": "Computer Science"
}
""".strip(),
        "http",
    )
    h2("Signup response")
    code_block(
        """
{
  "message": "Account created. Verify your email OTP before logging in.",
  "user": {
    "role": "student",
    "firstName": "Asha",
    "userId": "STU-1001",
    "emailVerified": false
  },
  "verification": {
    "expiresAt": "2026-05-20T10:20:00.000Z",
    "emailStatus": { "status": "sent" }
  }
}
""".strip(),
        "json",
    )
    h2("Verify password reset OTP")
    code_block(
        """
POST /api/v1/auth/password-reset/verify
Content-Type: application/json

{
  "role": "student",
  "userId": "STU-1001",
  "otp": "123456"
}

Response:
{
  "message": "OTP verified. Enter your new password.",
  "resetSession": {
    "resetToken": "<temporary-reset-token>",
    "expiresAt": "2026-05-20T10:30:00.000Z"
  }
}
""".strip(),
        "http",
    )
    h2("Create class")
    code_block(
        """
POST /api/v1/teachers/TCH-1001/classes
Content-Type: application/json

{
  "subjectName": "Artificial Intelligence",
  "subjectCode": "CSE-AI-301",
  "section": "A",
  "room": "Lab 2",
  "scheduleSlots": [
    { "day": "mon", "startTime": "10:00", "endTime": "11:00" },
    { "day": "wed", "startTime": "10:00", "endTime": "11:00" }
  ]
}
""".strip(),
        "http",
    )
    h2("Run AI attendance")
    code_block(
        """
POST /api/v1/teachers/TCH-1001/classes/665000000000000000000101/attendance/session
Content-Type: application/json

{
  "captureImages": [
    "data:image/jpeg;base64,<omitted>"
  ]
}

Response includes:
- recognizedStudents
- reviewQueue
- unknownDetections
- absentStudents
- todayAttendanceDraft
- absenteeNotificationSummary
""".strip(),
        "http",
    )
    h2("Set exam")
    code_block(
        """
PATCH /api/v1/teachers/TCH-1001/classes/665000000000000000000101/exam
Content-Type: application/json

{
  "title": "Mid Semester Exam",
  "examDate": "2026-06-10",
  "requiredAttendancePercentage": 75,
  "note": "Students below 75 percent must improve attendance."
}
""".strip(),
        "http",
    )


def add_day_in_life_walkthrough() -> None:
    h1("Complete Day In The Life Walkthrough")
    para(
        "This chapter follows a realistic day from morning setup to final attendance analytics. It connects many features into one story."
    )
    h2("Morning: teacher checks dashboard")
    para(
        "The teacher logs in and opens the teacher dashboard. The frontend calls GET /teachers/:userId/dashboard. The backend loads the teacher, managed classes, memberships, attendance summaries, and upcoming exams. The dashboard shows today's schedule and which classes need attention."
    )
    h2("Before class: students join and enroll")
    para(
        "New students enter the join code. This creates ClassMembership documents. Students who have not enrolled face profiles open the face enrollment page and upload multiple reference images. The AI service builds embeddings and the backend saves FaceProfile metadata."
    )
    h2("During class: teacher takes photo")
    para(
        "The teacher opens the class workspace and takes a classroom photo. The frontend uses the camera, converts the image into a payload, and calls the backend. The backend checks class ownership and active status before forwarding to AI."
    )
    h2("AI processing")
    para(
        "The AI service detects visible faces and compares them against the enrolled profiles of only that class roster. It returns recognized students, low-confidence review items, unknown detections, and absent students. This response is not final attendance."
    )
    h2("Draft creation and early email")
    para(
        "The backend creates an AttendanceDraft. Students marked absent receive email. This email is intentionally early so a present student can report the mistake before final records are saved."
    )
    h2("Teacher correction")
    para(
        "The teacher checks the draft. Maybe one student was hidden behind another student and got marked absent. The teacher changes that student to present and saves the draft. The source can show teacher-edited so later readers know AI was corrected."
    )
    h2("Final submission")
    para(
        "The teacher clicks final submission. The backend converts the draft into AttendanceRecord documents. Dashboards now use those final records to update percentages, flagged students, trends, and exam eligibility."
    )
    h2("After class: student checks dashboard")
    para(
        "A student opens the dashboard and sees that attendance changed. If an upcoming exam exists, the eligibility card recalculates how many future classes must be attended. If attendance is below requirement, alerts guide the student."
    )
    h2("End of semester")
    para(
        "When the subject is finished, the teacher archives the class. The summary remains visible but new attendance actions are blocked. This keeps historical data clean."
    )


def add_viva_question_bank() -> None:
    h1("Viva And Presentation Question Bank")
    para(
        "Use these questions for practice before explaining the project to a teacher, examiner, or teammate."
    )
    table(["Question", "Short answer"], VIVA_QUESTIONS, [6.5, 10.0])
    h2("Long answer structure")
    para(
        "For any feature question, answer in this order: purpose, user action, frontend file, backend route, service logic, database model, edge cases, and improvement. This structure makes your explanation sound organized."
    )
    h2("Example long answer: AI attendance")
    para(
        "Purpose: reduce manual effort while keeping teacher control. User action: teacher captures classroom photo. Frontend file: TeacherClassroomPage handles image capture and API call. Backend route: /teachers/:teacherId/classes/:classId/attendance/session. Service logic: teacherClassroomService validates ownership and active class, builds roster payload, calls aiService, creates AttendanceDraft, sends absent emails. AI logic: FastAPI detects faces, builds embeddings, matches roster profiles using ArcFace and thresholds. Database: AttendanceDraft first, AttendanceRecord after finalization. Edge case: missing enrollment or low confidence requires manual review. Improvement: add audit log and model confidence calibration dashboard."
    )


def add_backend() -> None:
    h1("Backend Explained")
    para(
        "The backend is the project's rule keeper. If a student tries to join a class, the backend checks the join code and creates a ClassMembership. If a teacher finalizes attendance, the backend writes AttendanceRecord documents. If a password is reset, the backend checks OTP rules and hashes the new password. This is why the backend is the most important part of the system."
    )
    h2("Backend startup")
    code_block(
        """
server.js startup sequence:
1. create Express app
2. connect to MongoDB
3. ensure default admin account exists
4. verify email service in background
5. start attendance draft scheduler
6. listen on configured backend port
""".strip()
    )
    h2("Controller-service-model pattern")
    para(
        "SAMS uses a common pattern. Routes decide which controller handles a URL. Controllers read request data and return JSON. Services contain the real business logic. Models talk to MongoDB. This separation helps the project stay readable."
    )
    code_block(
        """
HTTP Request
   |
   v
Route in backend/src/routes/index.js
   |
   v
Controller in backend/src/controllers/*.js
   |
   v
Service in backend/src/services/*.js
   |
   v
Mongoose Model in backend/src/models/*.js
   |
   v
MongoDB document collection
""".strip()
    )
    h2("API endpoint summary")
    table(["Method", "Endpoint", "Purpose"], API_ENDPOINTS, [1.6, 7.5, 7.2])
    h2("Why services are useful")
    para(
        "A beginner might ask why controller code cannot directly create database documents. It can, but then controllers become huge. For example, teacher attendance has to validate the teacher, validate class status, call AI, build a draft, send absent emails, and return a clean response. That logic belongs in a service because it is more than just reading a request and returning a response."
    )
    h2("Important backend services")
    table(
        ["Service file", "Main responsibility"],
        [
            ["authService.js", "Registration, login, admin seed, email verification OTP, password reset OTP/session."],
            ["classroomService.js", "Create classes, join classes, list teacher/student classes."],
            ["teacherClassroomService.js", "Teacher class workspace, roster, attendance, drafts, QR, cancellation, archive."],
            ["studentDashboardService.js", "Combines memberships, attendance, exams, leave, face profile into student dashboard data."],
            ["teacherDashboardService.js", "Combines managed classes, rosters, attendance summaries, exams into teacher dashboard data."],
            ["attendanceAnalyticsService.js", "Calculates class averages, student percentages, sessions, flagged students."],
            ["examScheduleService.js", "Exam date rules and eligibility math."],
            ["emailService.js", "SMTP transporter, queue, retries, delivery logs, service status."],
            ["emailNotificationService.js", "Builds and sends notification events using email templates."],
            ["aiService.js", "Backend gateway for AI service calls and timeout/retry handling."],
        ],
        [6.0, 10.6],
    )


def add_database() -> None:
    h1("Database Models Explained")
    para(
        "MongoDB stores data as documents. Mongoose models describe the expected fields for each kind of document. This chapter explains every important model in beginner language."
    )
    table(["Model", "What it stores", "Used for"], DB_MODELS, [3.8, 7.0, 5.8])
    h2("Entity relationship diagram")
    code_block(
        """
User(student) ----< ClassMembership >---- Classroom ----< AttendanceRecord
      |                    |                   |
      |                    |                   +---- ClassExam
      |                    |                   +---- AttendanceDraft
      |                    |                   +---- LeaveRequest
      |                    |                   +---- ClassAssignment
      |                    |                   +---- ClassDiscussionMessage
      |
      +---- FaceProfile
      +---- EmailOtp

EmailDeliveryLog is linked by notification metadata rather than one fixed relation.
QrAttendanceSession belongs to one Classroom and expires after use/time.
""".strip()
    )
    h2("User model")
    para(
        "The User model contains students, teachers, and admins. The role field decides which type of user it is. A student has a roll number. Teachers have profile fields such as designation and specialization. Passwords are stored as passwordHash, not plain text. This is important: the system should never store a readable password."
    )
    h2("Classroom and membership")
    para(
        "Classroom stores one teacher-owned class. ClassMembership stores which students joined that class. This is better than storing all student objects directly inside Classroom because membership can be queried independently. For example, to list all classes for one student, the backend can search ClassMembership by studentUserId."
    )
    h2("AttendanceRecord vs AttendanceDraft")
    para(
        "AttendanceRecord is final history. AttendanceDraft is temporary Today Attendance Data. The draft exists because AI can make mistakes. A photo result should not immediately become permanent attendance. Instead, it becomes editable. Students marked absent are emailed early, the teacher can correct the list, and final records are written only after final submission or auto-finalization."
    )
    h2("OTP and email logs")
    para(
        "EmailOtp stores hashed OTP records and expiration times. OTP records have a purpose such as email-verification or password-reset. EmailDeliveryLog stores whether an email was sent, skipped, or failed. This is very useful for debugging because email systems fail for network, SMTP, credential, or duplicate-notification reasons."
    )
    h2("Why MongoDB is acceptable here")
    para(
        "Attendance systems can be built on SQL too. PostgreSQL would be excellent for strict relational data and complex reports. MongoDB is acceptable in this project because many records are document-like and can evolve: class schedules, archive summaries, email metadata, attachment arrays, AI notes, and dashboard objects. Mongoose still provides schema structure so the database does not become uncontrolled."
    )


def add_authentication() -> None:
    h1("Authentication, OTP, And Password Reset")
    para(
        "Authentication is the process of proving who the user is. SAMS uses role, user ID, password, and email OTP verification. A student and teacher can register. Admin is seeded by the backend. Email verification is required before login for accounts that need it."
    )
    h2("Signup flow")
    code_block(
        """
Student/teacher fills signup form
        |
        v
Frontend POST /auth/signup
        |
        v
Backend validates required fields and unique user ID
        |
        v
Backend hashes password with bcrypt
        |
        v
Backend saves User with emailVerified=false
        |
        v
Backend creates EmailOtp for email-verification
        |
        v
Email service sends OTP
        |
        v
User enters OTP and POST /auth/verify-email activates account
""".strip()
    )
    h2("Password hashing")
    para(
        "When a user creates a password, the backend hashes it using bcrypt. A hash is one-way. During login, the backend hashes the submitted password in a comparable way and checks whether it matches the stored hash. This protects users if the database is leaked because attackers do not immediately see the original passwords."
    )
    h2("OTP cooldown")
    para(
        "The OTP system has a resend cooldown. The frontend shows a timer before the resend button can be used again, and the backend also blocks early OTP creation. This matters because frontend-only timers can be bypassed. Real protection belongs on the backend."
    )
    h2("Password reset flow")
    code_block(
        """
1. User opens Forgot Password.
2. User selects student/teacher and enters account ID.
3. Backend sends password reset OTP.
4. User must wait 60 seconds before resend.
5. User enters OTP.
6. Backend verifies OTP and returns a short-lived reset session token.
7. User enters new password twice.
8. Backend checks both passwords match and hashes the new password.
9. User can log in with the new password.
""".strip()
    )
    h2("Why not reset password immediately after OTP request")
    para(
        "Requesting OTP only proves that a code was sent. It does not prove the user owns the mailbox until the user enters the correct OTP. That is why the flow separates request, verify, and password update. This also gives the UI a clearer beginner-friendly sequence."
    )
    h2("Admin account")
    para(
        "The backend creates or updates a default admin account during startup. Admin login is separate in the UI and does not show student/teacher signup or forgot password links. In a production system, default admin credentials should be changed and protected with stronger access controls."
    )


def add_class_management() -> None:
    h1("Class Management")
    para(
        "Class management begins with the teacher. A teacher creates a classroom with subject name, code, section, room, schedule, academic details, and a join code. Students use the join code to become members."
    )
    h2("Class creation flow")
    code_block(
        """
Teacher fills class creation form
        |
        v
Frontend POST /teachers/:teacherId/classes
        |
        v
Backend checks teacher account
        |
        v
Backend generates unique join code
        |
        v
Backend saves Classroom document
        |
        v
Teacher dashboard reloads with new class
""".strip()
    )
    h2("Join code flow")
    para(
        "A join code is a simple way for students to join the correct class. The student enters the code, the backend normalizes it, finds the Classroom, checks that the student exists, and creates a ClassMembership. A unique index prevents the same student from joining the same class multiple times."
    )
    h2("Roster management")
    para(
        "Teachers can add, update, or remove students in their class workspace. The backend checks that the class belongs to the teacher before changing the roster. This prevents one teacher from editing another teacher's class."
    )
    h2("Archiving a class")
    para(
        "When a semester or class is over, the teacher can archive it. Archiving saves summary data such as student count, total sessions, average attendance, flagged students, and latest session date. Archived classes become inactive for attendance actions. This protects old records while keeping history visible."
    )
    h2("Why archive instead of delete")
    para(
        "Delete removes data. Archive preserves history but stops new actions. For academic records, archiving is usually safer. Admin still has delete controls for incorrect or unwanted data, but normal class lifecycle should use archive."
    )


def add_attendance() -> None:
    h1("Attendance Workflows")
    para(
        "Attendance is the core feature. SAMS supports manual attendance, QR attendance, AI photo attendance, cancellation, drafts, finalization, and export. The important idea is that final attendance should be trustworthy, not just fast."
    )
    h2("Manual attendance")
    para(
        "Manual attendance is the fallback and control method. A teacher selects present, absent, or late for each roster student and submits. The backend writes AttendanceRecord documents. Manual attendance is useful when AI is not available, QR failed, or the teacher wants direct control."
    )
    h2("QR attendance")
    code_block(
        """
Teacher creates QR session
        |
        v
Backend creates QrAttendanceSession with token and expiry
        |
        v
Frontend turns token URL into QR image
        |
        v
Student scans QR
        |
        v
Backend validates token, expiry, class, and membership
        |
        v
AttendanceRecord is saved for that student
""".strip()
    )
    h2("AI classroom photo attendance")
    para(
        "AI attendance is not final automatically. The teacher captures or uploads a classroom photo. The frontend compresses/resizes the image to keep payload size manageable. The backend sends roster and image data to the AI service. The AI service detects faces, matches them only against students in that class roster, and returns suggested present students, unknown faces, review candidates, and absent students."
    )
    h2("Today Attendance Data")
    code_block(
        """
AI result from classroom photo
        |
        v
Backend creates AttendanceDraft for today's class
        |
        v
Draft records show present/absent/late students
        |
        v
Absent students receive email early
        |
        v
Teacher can add/remove/change students in draft
        |
        v
Teacher clicks Final Submission
        |
        v
Backend writes final AttendanceRecord documents
""".strip()
    )
    h2("Why absent email is sent before finalization")
    para(
        "The early absent email is a correction mechanism. If a student was actually present but AI missed them, the student can tell the teacher before final submission. This is better than silently saving a wrong final record. The teacher still controls the final list."
    )
    h2("Auto finalization after 12 hours")
    para(
        "The attendance draft scheduler checks old drafts. If a draft stays open too long, it can be automatically finalized. This prevents Today's Attendance Data from staying pending forever. In a real institution, the auto-finalization time can be changed according to policy."
    )
    h2("Cancelled class")
    para(
        "If a class is cancelled, the backend records cancelled status and sends class cancellation email. Cancelled attendance should not hurt a student's percentage because it is not a class the student missed. This distinction is handled in attendance analytics by ignoring cancelled records for the student's attended/total count."
    )
    h2("Attendance formula")
    code_block(
        """
attendance percentage = (present_or_late_count / total_count) * 100

Example:
present_or_late_count = 18
total_count = 24
percentage = (18 / 24) * 100 = 75%

Cancelled class is not counted as total_count.
Absent class is counted in total_count but not present_or_late_count.
""".strip()
    )
    h2("Finalization checklist")
    bullets(
        [
            "Make sure the roster is correct before attendance.",
            "Check AI suggested present students.",
            "Check review candidates and unknown detections.",
            "Add students who were present but missed by AI.",
            "Remove students wrongly suggested as present.",
            "Read relevant verification notes, especially missing enrollment or low confidence notes.",
            "Finalize only when the draft represents the real class.",
        ]
    )


def add_ai() -> None:
    h1("AI Service And Face Recognition")
    para(
        "The AI service is the most technical part of SAMS, but it can be understood step by step. The AI does not magically know names from a photo. It compares the face in a classroom photo with face profiles that students enrolled earlier."
    )
    h2("Core idea: detection then recognition")
    para(
        "Face detection asks: where are the faces in this image? Face recognition asks: whose face is this? These are different tasks. A detector can find a face without knowing the person's identity. A recognizer needs enrolled references to compare against."
    )
    code_block(
        """
Classroom photo
   |
   v
Face detection: find face boxes
   |
   v
Crop each detected face
   |
   v
Face recognition model converts each face to an embedding
   |
   v
Compare embedding with enrolled student embeddings
   |
   v
Return present suggestions, review candidates, and unknown detections
""".strip()
    )
    h2("What is an embedding")
    para(
        "An embedding is a list of numbers that represents important features of a face. You do not read the numbers directly. The model creates them. If two embeddings are close, the faces are probably the same person. If they are far apart, they are probably different people. SAMS uses cosine similarity to compare embeddings."
    )
    h2("Selected model stack")
    table(
        ["Task", "Selected model", "Reason"],
        [
            ["Face detection", "RetinaFace/SCRFD-10GF from InsightFace pack", "Strong multi-face detection and widely used in modern face analysis pipelines."],
            ["Face tracking", "Embedding centroid tracker", "Groups repeated detections across captures using embedding similarity."],
            ["Face recognition", "ArcFace ResNet100@Glint360K from antelopev2", "Produces strong 512-dimensional identity embeddings for face matching."],
            ["Fallback", "buffalo_l pack with ArcFace ResNet50@WebFace600K", "Keeps service usable when preferred antelopev2 files are missing."],
        ],
        [3.0, 5.7, 7.8],
    )
    h2("Why ArcFace")
    para(
        "ArcFace is designed for face verification and recognition. It learns an embedding space where faces of the same person are close and faces of different people are separated. For this project, that is exactly what is needed. The system does not need to train a new model for every class. It only needs to store student reference embeddings and compare classroom detections against them."
    )
    h2("Model alternatives")
    table(
        ["Alternative", "What it is", "Why not primary choice here"],
        [
            ["OpenCV Haar cascades", "Old face detection method based on hand-designed features.", "Fast but weak in varied classroom angles and lighting. It detects faces, not identity."],
            ["OpenCV LBPH", "Traditional local texture face recognition.", "Useful for simple controlled images but not strong enough for modern classroom photos."],
            ["Dlib face recognition", "Popular 128-dimensional face embeddings.", "Good learning option, but InsightFace/ArcFace generally offers stronger modern performance."],
            ["FaceNet", "Deep learning embedding approach.", "Good alternative, but current code and metadata are centered on ArcFace embedding compatibility."],
            ["DeepFace wrapper", "Python wrapper around multiple face models.", "Convenient, but less direct control over production thresholds and model readiness."],
            ["Custom CNN", "Train your own neural network.", "Requires large labeled dataset, training infrastructure, evaluation, and fairness testing. Not practical for this project."],
        ],
        [3.0, 5.8, 7.8],
    )
    h2("Enrollment flow")
    code_block(
        """
Student uploads 6-10 face images
        |
        v
AI service checks each image
        |
        +--> reject if no face
        +--> reject if multiple faces unless configured
        +--> reject if quality too low
        |
        v
Each usable face becomes an embedding
        |
        v
Average embedding is calculated
        |
        v
Profile is stored with model name and execution mode
""".strip()
    )
    h2("Why require multiple enrollment images")
    para(
        "One photo is fragile. Lighting, angle, blur, glasses, or expression can change the embedding. Multiple reference images make the average embedding more stable. The backend asks for more images than the minimum because some images may be rejected for quality."
    )
    h2("Recognition thresholds")
    para(
        "The AI service uses thresholds from ai-service/app/core/config.py. Recognition threshold decides when a match is strong enough to suggest present. Review threshold allows lower-confidence matches to appear in manual review. Recognition minimum margin helps avoid accepting a match when the best and second-best students are too close."
    )
    h2("Why teacher review remains necessary")
    para(
        "AI can fail. A face can be hidden, blurry, turned away, or confused with a similar-looking person. Lighting can reduce quality. A student may not be enrolled. That is why SAMS treats AI output as a suggestion. The teacher still confirms final attendance."
    )
    h2("Model compatibility")
    para(
        "Embeddings from different models should not be mixed. A FaceNet embedding and an ArcFace embedding do not live in the same vector space. The AI service stores model metadata with the profile and checks compatibility. If the profile was created with an older or different model, the student should re-enroll."
    )
    h2("Privacy and ethics")
    para(
        "Face recognition is sensitive. A real deployment should ask for consent, explain data use, protect stored embeddings, limit access, and define deletion policy. The project stores metadata and local AI profile data for development, but a production system should use stronger storage protection, audit logs, and institutional approval."
    )


def add_email() -> None:
    h1("Email Notification System")
    para(
        "Email makes the project feel like a real system. Instead of only showing messages inside the dashboard, SAMS can notify users about OTPs, welcome messages, password reset, leave status, absence, exam warnings, and class cancellation."
    )
    h2("SMTP in simple words")
    para(
        "SMTP is the protocol used to send email. The backend connects to an SMTP server such as Gmail SMTP. Nodemailer is the Node.js library that creates the email transporter and sends messages. Gmail requires an app password, not the normal Gmail login password."
    )
    h2("Email service architecture")
    code_block(
        """
Feature needs email
        |
        v
emailNotificationService chooses template and recipient
        |
        v
emailTemplateService builds subject, text, and HTML
        |
        v
emailService queues job
        |
        v
Nodemailer sends through SMTP
        |
        v
EmailDeliveryLog records sent/skipped/failed status
""".strip()
    )
    h2("Notification events")
    table(
        ["Event", "Recipient", "Why it matters"],
        [
            ["Signup verification OTP", "Student or teacher", "Activates account only after email ownership is proven."],
            ["Welcome email", "Verified user", "Confirms account is ready."],
            ["Password reset OTP", "Student or teacher", "Allows secure recovery."],
            ["Profile email OTP", "New email address", "Prevents accidental or fake profile email changes."],
            ["Leave approved/rejected", "Student", "Keeps student informed about uploaded absence proof."],
            ["Absent notification", "Student", "Allows quick correction before final attendance submission."],
            ["Exam warning", "Student", "Warns when attendance is below required exam percentage."],
            ["Class cancellation", "Students in class", "Prevents confusion about schedule changes."],
        ],
        [4.0, 4.0, 8.5],
    )
    h2("Queue and retries")
    para(
        "Sending email can be slow. The backend uses a delivery queue with limited concurrency so many emails do not overload the SMTP provider. It also retries transient failures. Delivery logs make it possible to see whether a message was sent, skipped because email was disabled, skipped because the recipient was missing, or failed because SMTP had an error."
    )
    h2("SMTP timeout")
    para(
        "SMTP timeout means the backend tried to connect or send through the mail server but did not get a response in time. It can happen because of weak network, blocked port, slow SMTP server, wrong SMTP configuration, or too short a timeout setting. It does not mean the whole app is broken; it means the email service needs attention."
    )


def add_exam_calculator() -> None:
    h1("Exam Eligibility And Attendance Calculator")
    para(
        "Exam eligibility turns attendance data into an action plan. Instead of only saying 'you have 68 percent', the system tells the student whether they are eligible, how many scheduled classes remain before the exam, and how many of those classes they must attend."
    )
    h2("Teacher exam rule")
    para(
        "A teacher sets an exam date and required attendance percentage, for example 75 percent. This creates a ClassExam record. Student and teacher dashboards both show upcoming exam information."
    )
    h2("Eligibility formula")
    code_block(
        """
Inputs:
P = present count
T = total counted classes so far
R = required percentage / 100
F = scheduled classes before exam

Projected total at exam = T + F
Minimum classes to attend = ceil(R * (T + F) - P)

If minimum classes to attend <= F:
    student can still qualify by attending enough future classes
else:
    student cannot reach required percentage through normal scheduled classes
""".strip()
    )
    h2("Worked example")
    para(
        "Suppose a student has attended 18 out of 26 classes. Current attendance is 69 percent. The teacher requires 75 percent. There are 8 scheduled classes before the exam. Projected total is 34. Required attended classes at exam time is ceil(0.75 * 34) = ceil(25.5) = 26. The student already has 18, so they must attend 8 more. Since 8 classes remain, they can qualify only if they attend every remaining class."
    )
    h2("Why schedule matters")
    para(
        "Without the class schedule, the calculator would not know how many classes remain before the exam. That is why Classroom stores scheduleSlots. The exam service counts scheduled slots between now and the exam date."
    )
    h2("Student-entered calculator")
    para(
        "The student attendance calculator can also take an exam date and required percentage input from the student. It uses current attendance percentage and schedule-based future class count to estimate safe attendance requirements. This helps students plan even before the teacher creates the official exam rule."
    )


def add_student_journey() -> None:
    h1("Student Journey")
    para(
        "The student journey starts at signup and ends with useful awareness: joined classes, attendance analytics, exam eligibility, documents, notifications, and profile control."
    )
    h2("Student signup to dashboard")
    code_block(
        """
Signup -> Email OTP verification -> Login -> Student dashboard
        |
        +--> Join class using code
        +--> Enroll face profile
        +--> Open class detail page
        +--> Submit leave/medical document
        +--> Check attendance analytics
        +--> Check exam eligibility
        +--> Read notifications
""".strip()
    )
    h2("What the student dashboard answers")
    table(
        ["Question", "Dashboard data used", "Why useful"],
        [
            ["How many classes have I joined?", "ClassMembership + Classroom", "Shows academic scope."],
            ["What is my attendance in each class?", "AttendanceRecord summaries", "Identifies weak classes."],
            ["Am I safe for an exam?", "ClassExam + attendance + schedule", "Turns raw percentage into action."],
            ["How many classes must I attend?", "Eligibility formula", "Gives a concrete target."],
            ["Was I marked absent recently?", "AttendanceRecord + notifications", "Lets student act quickly."],
            ["Is my face profile ready?", "FaceProfile", "Shows whether AI attendance can recognize student."],
            ["What leave documents did I submit?", "LeaveRequest", "Tracks approval state."],
        ],
        [4.0, 5.0, 7.5],
    )
    h2("Leave document upload")
    para(
        "A student can submit a leave request for a class and attach a PDF/image style file as a data URL. The teacher sees the request in the class details section and can approve or reject it. The file is viewable online from stored data, so the teacher does not need to download it just to inspect it."
    )
    h2("Notifications")
    para(
        "Notifications are meant to pull attention to important things: low attendance, exam risk, absence, class changes, and pending profile work. A notification bell or notification page is useful because students should not hunt through many panels to find urgent information."
    )


def add_teacher_journey() -> None:
    h1("Teacher Journey")
    para(
        "The teacher journey is about control and correction. The teacher creates classes, gets students into rosters, takes attendance, reviews AI results, handles leave, sets exam rules, and archives completed classes."
    )
    h2("Teacher class workflow")
    code_block(
        """
Teacher login
   |
   v
Create class with schedule and join code
   |
   v
Students join through code or teacher adds them
   |
   v
Students enroll face profiles
   |
   v
Teacher takes attendance
   |
   +--> manual
   +--> QR
   +--> AI classroom photo -> Today Attendance Data draft
   |
   v
Teacher finalizes attendance
   |
   v
Teacher reviews analytics, leave, exams, and archives class when done
""".strip()
    )
    h2("Class workspace")
    para(
        "The teacher class workspace is the operational center. It loads classroom information, roster, overview metrics, today's attendance, active draft, recent sessions, leave requests, exam rule, QR status, and face profile readiness. This page is large because one class has many workflows."
    )
    h2("Correction responsibility")
    para(
        "The teacher must not blindly trust AI. The system helps by showing confidence, review queue, unknown detections, relevant verification notes, and draft editing controls. The final attendance should represent the teacher-reviewed truth, not only the model's guess."
    )
    h2("End of semester")
    para(
        "When a class is completed, the teacher archives it. Archived classes remain in historical views but active operations are blocked. This prevents accidental attendance submission into an old semester."
    )


def add_admin() -> None:
    h1("Admin Controls")
    para(
        "The admin panel is not for normal teaching work. It is for system control. Admin can remove incorrect classes, students, or teachers, and can toggle email verification state if required."
    )
    h2("Why admin features are dangerous")
    para(
        "Deleting a class or user can cascade into many related records: memberships, attendance, drafts, exams, leave requests, assignments, discussions, OTPs, and email logs. That is why admin actions should show confirmation dialogs and summarize deleted counts."
    )
    h2("Admin dashboard should stay focused")
    para(
        "The admin dashboard should not show teacher-specific cards like pending leave or student-specific cards like exam eligibility as primary metrics. Admin needs clean record counts, lists sorted predictably, and destructive actions with clear confirmation."
    )
    h2("Production improvement")
    para(
        "In production, admin access should be protected more strongly than the default project seed. Use a strong password, role-based middleware, audit logging for admin actions, and possibly two-factor authentication."
    )


def add_deployment() -> None:
    h1("Running And Deployment")
    para(
        "Running a full-stack app means starting several services. In SAMS, the frontend, backend, AI service, and MongoDB may run separately or through Docker Compose."
    )
    h2("Local development ports")
    table(
        ["Service", "Typical local URL", "What to check"],
        [
            ["Frontend", "http://localhost:5173", "Browser UI loads."],
            ["Backend", "http://localhost:4000/api/v1/health", "Health returns JSON."],
            ["AI service", "http://localhost:8000/health", "Model readiness and warnings."],
            ["MongoDB", "mongodb://localhost:27017/sams", "Backend can connect."],
        ],
        [3.0, 5.5, 8.0],
    )
    h2("Environment variables")
    para(
        "Environment variables keep runtime settings outside code. Examples include MONGO_URI, AI_SERVICE_URL, EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, EMAIL_OTP_EXPIRES_MINUTES, and FRONTEND_ORIGIN. Never include real secrets in reports, Git commits, screenshots, or public chats."
    )
    h2("Docker Compose")
    para(
        "docker-compose.yml defines four services: frontend, backend, ai-service, and mongo. Compose is useful because it starts the whole stack with correct network names. The backend can call ai-service by container name instead of localhost when running inside Docker."
    )
    h2("Health checks")
    para(
        "The backend health endpoint checks not only whether Express is alive, but also database, AI readiness, and email service state. A service can be alive but degraded. For example, AI may be running but missing model files, or email may be configured but SMTP verification may time out."
    )


def add_testing_debugging() -> None:
    h1("Testing And Debugging Guide")
    para(
        "Debugging means finding where the flow stopped. Do not guess randomly. Follow the request path."
    )
    h2("General debugging path")
    code_block(
        """
1. Is the frontend route loading?
2. Does browser console show an error?
3. Is the frontend calling the correct backend URL?
4. Does the backend route exist?
5. Does the controller return a clear error?
6. Does the service validation fail?
7. Is MongoDB connected?
8. If AI is involved, is AI /ready true?
9. If email is involved, is email status online?
10. Does the database contain the expected document?
""".strip()
    )
    h2("Common problems")
    table(
        ["Problem", "Likely cause", "Where to check"],
        [
            ["Login fails", "Wrong role, ID, password, or unverified email.", "AuthPage, authService.js, User document."],
            ["OTP not received", "SMTP config, timeout, spam folder, email disabled.", "email/status, email logs, backend .env without printing secrets."],
            ["Student cannot join class", "Wrong join code, class archived, duplicate membership.", "classroomService.js, ClassMembership."],
            ["AI attendance empty", "No face profiles, bad photo, AI service not ready, incompatible embeddings.", "AI /models, FaceProfile, AI notes."],
            ["Attendance percentage wrong", "Cancelled class counted wrongly, duplicate session, absent/present statuses misunderstood.", "AttendanceRecord and attendanceAnalyticsService.js."],
            ["Exam eligibility strange", "Schedule missing or exam date too near.", "Classroom scheduleSlots and ClassExam."],
            ["Admin delete missing related data", "Cascade rules need update.", "adminService.js delete summaries."],
        ],
        [4.0, 6.0, 6.5],
    )
    h2("Recommended tests")
    bullets(
        [
            "Signup student, verify OTP, login.",
            "Signup teacher, verify OTP, login.",
            "Request password reset OTP, verify OTP, enter new password twice, login with new password.",
            "Create class, student joins by code.",
            "Enroll face with good images and reject bad image cases.",
            "Run manual attendance and check student dashboard percentage.",
            "Run QR attendance with valid and expired token cases.",
            "Run AI attendance and verify draft correction before final submission.",
            "Submit leave proof, teacher approves/rejects, student receives status.",
            "Set exam rule and check eligibility calculations.",
            "Archive class and confirm attendance actions are blocked.",
            "Admin deletes test class/user and verifies linked records are removed.",
        ]
    )


def add_security_limitations() -> None:
    h1("Security, Limitations, And Future Improvements")
    h2("Current security strengths")
    bullets(
        [
            "Passwords are hashed with bcrypt.",
            "Email verification is required before login where configured.",
            "OTP records expire and are consumed after successful verification.",
            "OTP resend cooldown exists on both frontend and backend.",
            "Teacher class actions check class ownership.",
            "Admin destructive actions are separated from normal dashboards.",
            "Email status avoids exposing SMTP password.",
        ]
    )
    h2("Current limitations")
    bullets(
        [
            "Frontend session storage is simple and not as strong as production secure cookie authentication.",
            "AI local JSON stores should be moved to durable database/object storage for production.",
            "Attachments stored as data URLs are simple but can grow database size; object storage is better long term.",
            "Face recognition needs consent, privacy policy, deletion flow, and access audit in real deployment.",
            "Role-based middleware could be stronger and centralized.",
            "Automated test coverage should be expanded across backend services and frontend flows.",
        ]
    )
    h2("Future roadmap")
    table(
        ["Priority", "Improvement", "Why"],
        [
            ["High", "JWT or secure cookie authentication", "Stronger production login sessions."],
            ["High", "Central role middleware", "Avoid repeating authorization checks."],
            ["High", "Object storage for attachments/images", "Prevents MongoDB from storing very large base64 data."],
            ["Medium", "OpenAPI contract generation", "Keeps frontend/backend payloads synchronized."],
            ["Medium", "Background worker for emails and auto-finalization", "More scalable than in-process jobs."],
            ["Medium", "Audit logs for attendance edits", "Shows who changed what and when."],
            ["Medium", "AI confidence calibration dashboard", "Helps tune thresholds using real data."],
            ["Low", "Parent/guardian portal if required by institute", "Optional extension, not necessary for current flow."],
        ],
        [2.0, 6.0, 8.5],
    )


def add_appendices() -> None:
    h1("Appendices")
    h2("Quick command reference")
    code_block(
        """
# Install Node workspaces
npm install

# Run all services
npm run dev

# Run frontend only
npm run dev:frontend

# Run backend only
npm run dev:backend

# Run AI service
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend production build
npm --workspace frontend run build

# Backend health
curl http://localhost:4000/api/v1/health
""".strip(),
        "bash",
    )
    h2("Glossary")
    table(["Term", "Meaning"], GLOSSARY, [4.0, 12.5])
    h2("Beginner learning checklist")
    bullets(
        [
            "Explain the four services without looking at the diagram.",
            "Trace signup from frontend form to User and EmailOtp models.",
            "Trace teacher class creation to Classroom model.",
            "Trace student joining class to ClassMembership model.",
            "Calculate attendance percentage manually from sample records.",
            "Explain why AI creates suggestions, not final records.",
            "Explain what an embedding is in one sentence.",
            "Explain why OTP must expire and be hashed.",
            "Explain why archive is safer than delete for old classes.",
            "Open backend routes and identify controller and service for one endpoint.",
        ]
    )
    h2("Files to read after this guide")
    table(
        ["File", "Why read it"],
        [
            ["frontend/src/App.jsx", "Understand every page route."],
            ["frontend/src/services/api.js", "See all frontend-backend calls."],
            ["backend/src/routes/index.js", "See every backend endpoint."],
            ["backend/src/services/authService.js", "Understand signup, login, OTP, password reset."],
            ["backend/src/services/teacherClassroomService.js", "Understand attendance and class workspace logic."],
            ["backend/src/services/studentDashboardService.js", "Understand how student dashboard data is built."],
            ["backend/src/services/attendanceAnalyticsService.js", "Understand attendance percentage calculations."],
            ["backend/src/services/examScheduleService.js", "Understand exam eligibility math."],
            ["ai-service/app/pipelines/classroom_attendance_pipeline.py", "Understand AI attendance flow."],
            ["ai-service/app/services/face_recognition_service.py", "Understand embeddings, thresholds, and model compatibility."],
        ],
        [7.0, 9.5],
    )


def add_deep_model_pages() -> None:
    h1("Model By Model Deep Dive")
    for index, (model, what, used_for) in enumerate(DB_MODELS):
        if index:
            story.append(PageBreak())
            add_md("---")
            add_md()
        h2(model)
        para(f"What it stores: {what}")
        para(f"Why it exists: {used_for}")
        if model == "User":
            bullets(
                [
                    "role controls whether the user is student, teacher, or admin.",
                    "userId is uppercase and unique, so login can find one account.",
                    "passwordHash stores the bcrypt hash instead of the original password.",
                    "emailVerified and emailVerificationRequired protect login until OTP verification.",
                    "rollNumber is required only for student accounts.",
                ]
            )
        elif model == "AttendanceRecord":
            bullets(
                [
                    "One final record belongs to one student, one class, and one session/date.",
                    "status can be present, absent, late, or cancelled.",
                    "verificationMethod tells how the record was created, such as manual, QR, or face recognition.",
                    "source explains whether the record came from AI auto, teacher confirmation, manual add, or cancellation.",
                    "These records power dashboard percentages and exports.",
                ]
            )
        elif model == "AttendanceDraft":
            bullets(
                [
                    "Draft records are editable and temporary.",
                    "They store status, AI confidence, source, notes, and absentee email timestamp.",
                    "A draft can be finalized by teacher or automatically after the configured window.",
                    "Drafts make AI safer because the teacher can correct mistakes before permanent records.",
                ]
            )
        elif model == "ClassExam":
            bullets(
                [
                    "Stores examDate and requiredAttendancePercentage.",
                    "Only one active exam rule exists per class because of a partial unique index.",
                    "Student dashboards use it to calculate eligibility and minimum classes to attend.",
                    "Teacher dashboards use it to count eligible, recoverable, and at-risk students.",
                ]
            )
        elif model == "FaceProfile":
            bullets(
                [
                    "Stores metadata about enrollment, not the full AI profile logic in MongoDB.",
                    "faceModel and executionMode help detect stale or incompatible enrollments.",
                    "averageQualityScore helps show whether enrollment quality was good.",
                    "lastEnrolledAt tells when the student last completed enrollment.",
                ]
            )
        else:
            bullets(
                [
                    "This model keeps one feature's data separate so it can be queried and maintained clearly.",
                    "Indexes are used where repeated lookup is expected, such as by class, student, status, or date.",
                    "The backend service sanitizes this data before sending it to the frontend.",
                ]
            )
        space(0.05)


def build_document() -> None:
    add_cover()
    add_contents_overview()
    add_how_to_read()
    add_big_picture()
    add_architecture()
    add_technology_stack()
    add_project_structure()
    add_frontend()
    add_beginner_web_concepts()
    add_backend()
    add_backend_service_deep_dive()
    add_database()
    add_deep_model_pages()
    add_sample_json_documents()
    add_data_lifecycle_examples()
    add_authentication()
    add_class_management()
    add_attendance()
    add_feature_deep_dives()
    add_ai()
    add_ai_algorithm_details()
    add_email()
    add_exam_calculator()
    add_student_journey()
    add_teacher_journey()
    add_admin()
    add_deployment()
    add_testing_debugging()
    add_troubleshooting_cookbook()
    add_security_limitations()
    add_code_reading_workbook()
    add_api_examples()
    add_day_in_life_walkthrough()
    add_viva_question_bank()
    add_appendices()


def page_header_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(1.6 * cm, A4[1] - 1.0 * cm, "SAMS / MarkIn Beginner Technical Guide")
    canvas.drawRightString(A4[0] - 1.6 * cm, 0.85 * cm, f"Page {doc.page}")
    canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
    canvas.line(1.6 * cm, A4[1] - 1.15 * cm, A4[0] - 1.6 * cm, A4[1] - 1.15 * cm)
    canvas.restoreState()


def write_markdown() -> None:
    MD_PATH.write_text("\n".join(markdown_lines).strip() + "\n", encoding="utf-8")


def count_pdf_pages(path: Path) -> int:
    data = path.read_bytes()
    return len(re.findall(rb"/Type\s*/Page\b", data))


def main() -> None:
    build_document()
    write_markdown()
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        rightMargin=1.7 * cm,
        leftMargin=1.7 * cm,
        topMargin=1.55 * cm,
        bottomMargin=1.35 * cm,
        title="SAMS Beginner Technical Guide",
        author="Codex",
        subject="Smart Attendance Management System beginner technical guide",
    )
    doc.build(story, onFirstPage=page_header_footer, onLaterPages=page_header_footer)
    print(f"Wrote {PDF_PATH}")
    print(f"Wrote {MD_PATH}")
    print(f"Approx pages: {count_pdf_pages(PDF_PATH)}")


if __name__ == "__main__":
    main()
