function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function baseTemplate({ title, preview, body }) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#162033;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe4f0;">
            <tr>
              <td style="background:#07111f;color:#ffffff;padding:24px 28px;">
                <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#67e8f9;font-weight:700;">SAMS</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;">
                This is an automated Attendance Management System email. Contact your faculty or administrator if anything looks incorrect.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function infoRows(rows) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:18px 0;">
    ${rows
      .filter((row) => row.value !== undefined && row.value !== null && row.value !== "")
      .map(
        (row) => `<tr>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:13px;width:42%;">${escapeHtml(row.label)}</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#162033;font-weight:700;">${escapeHtml(row.value)}</td>
        </tr>`
      )
      .join("")}
  </table>`;
}

function otpBlock(otp, expiresAt) {
  return `<div style="margin:20px 0;padding:18px;border-radius:14px;background:#ecfeff;border:1px solid #bae6fd;text-align:center;">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0369a1;font-weight:700;">Verification OTP</div>
    <div style="font-size:34px;letter-spacing:.18em;color:#0f172a;font-weight:800;margin-top:8px;">${escapeHtml(otp)}</div>
    <div style="color:#64748b;font-size:13px;margin-top:8px;">Expires at ${escapeHtml(formatDate(expiresAt))}</div>
  </div>`;
}

export function buildEmailVerificationTemplate({ user, otp, expiresAt }) {
  const name = `${user.firstName} ${user.lastName}`.trim();

  return {
    subject: "Verify your SAMS email address",
    text: `Hi ${name}, your SAMS verification OTP is ${otp}. It expires soon.`,
    html: baseTemplate({
      title: "Verify your email",
      preview: "Use this OTP to activate your SAMS account.",
      body: `
        <p style="margin:0 0 12px;line-height:1.7;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0;line-height:1.7;">Use this OTP to verify your email and activate your SAMS account.</p>
        ${otpBlock(otp, expiresAt)}
        ${infoRows([
          { label: "Account ID", value: user.userId },
          { label: "Role", value: user.role },
          { label: "Email", value: user.email }
        ])}
      `
    })
  };
}

export function buildWelcomeTemplate({ user }) {
  const name = `${user.firstName} ${user.lastName}`.trim();

  return {
    subject: "Welcome to SAMS",
    text: `Welcome ${name}. Your SAMS account is active. Login email: ${user.email}. Account ID: ${user.userId}.`,
    html: baseTemplate({
      title: "Welcome to SAMS",
      preview: "Your Attendance Management System account is active.",
      body: `
        <p style="margin:0 0 12px;line-height:1.7;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0;line-height:1.7;">Your account is verified and ready to use.</p>
        ${infoRows([
          { label: "Name", value: name },
          { label: "Login Email", value: user.email },
          { label: "Account ID", value: user.userId },
          { label: "Role", value: user.role },
          { label: "Roll Number", value: user.rollNumber }
        ])}
      `
    })
  };
}

export function buildPasswordResetTemplate({ user, otp, expiresAt }) {
  const name = `${user.firstName} ${user.lastName}`.trim();

  return {
    subject: "Reset your SAMS password",
    text: `Hi ${name}, your SAMS password reset OTP is ${otp}. It expires soon.`,
    html: baseTemplate({
      title: "Password reset OTP",
      preview: "Use this OTP to reset your SAMS password.",
      body: `
        <p style="margin:0 0 12px;line-height:1.7;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0;line-height:1.7;">Use this OTP to set a new password. If you did not request this, you can ignore this email.</p>
        ${otpBlock(otp, expiresAt)}
      `
    })
  };
}

export function buildProfileEmailOtpTemplate({ user, email, otp, expiresAt }) {
  return {
    subject: "Confirm your SAMS profile email",
    text: `Your SAMS profile email verification OTP is ${otp}.`,
    html: baseTemplate({
      title: "Confirm profile email",
      preview: "Use this OTP to update your verified profile email.",
      body: `
        <p style="margin:0 0 12px;line-height:1.7;">Hi ${escapeHtml(`${user.firstName} ${user.lastName}`.trim())},</p>
        <p style="margin:0;line-height:1.7;">Use this OTP to confirm <strong>${escapeHtml(email)}</strong> as your verified profile email.</p>
        ${otpBlock(otp, expiresAt)}
      `
    })
  };
}

export function buildLeaveReviewTemplate({ student, classroom, leaveRequest }) {
  const statusLabel =
    leaveRequest.status === "approved" ? "approved" : "rejected";

  return {
    subject: `Leave request ${statusLabel} for ${classroom.subjectCode}`,
    text: `Your leave request for ${classroom.subjectName} on ${formatDate(leaveRequest.absenceDate)} was ${statusLabel}.`,
    html: baseTemplate({
      title: `Leave request ${statusLabel}`,
      preview: `Your ${classroom.subjectCode} leave request was ${statusLabel}.`,
      body: `
        <p style="margin:0 0 12px;line-height:1.7;">Hi ${escapeHtml(student.firstName)},</p>
        <p style="margin:0;line-height:1.7;">Your leave proof has been reviewed.</p>
        ${infoRows([
          { label: "Class", value: `${classroom.subjectCode} - ${classroom.subjectName}` },
          { label: "Absence Date", value: formatDate(leaveRequest.absenceDate) },
          { label: "Status", value: statusLabel.toUpperCase() },
          { label: "Teacher Note", value: leaveRequest.teacherNote }
        ])}
      `
    })
  };
}

export function buildExamWarningTemplate({ student, classroom, exam, eligibility }) {
  return {
    subject: `Attendance warning for ${classroom.subjectCode} exam`,
    text: `${classroom.subjectCode}: your attendance is ${eligibility.currentPercentage}%, required is ${exam.requiredAttendancePercentage}%.`,
    html: baseTemplate({
      title: "Exam attendance warning",
      preview: "Your current attendance is below the required exam eligibility percentage.",
      body: `
        <p style="margin:0 0 12px;line-height:1.7;">Hi ${escapeHtml(student.firstName)},</p>
        <p style="margin:0;line-height:1.7;">Your attendance is below the exam eligibility requirement. Please attend the required upcoming classes.</p>
        ${infoRows([
          { label: "Class", value: `${classroom.subjectCode} - ${classroom.subjectName}` },
          { label: "Exam", value: exam.title },
          { label: "Exam Date", value: formatDate(exam.examDate) },
          { label: "Current Attendance", value: `${eligibility.currentPercentage}%` },
          { label: "Required Attendance", value: `${exam.requiredAttendancePercentage}%` },
          { label: "Minimum Classes To Attend", value: eligibility.minimumClassesToAttend }
        ])}
      `
    })
  };
}

export function buildAbsentNotificationTemplate({ student, classroom, record }) {
  return {
    subject: `Absent marked for ${classroom.subjectCode}`,
    text: `${student.firstName}, you were marked absent for ${classroom.subjectName} on ${formatDate(record.recordedAt)}.`,
    html: baseTemplate({
      title: "Absent notification",
      preview: `Absent marked for ${classroom.subjectCode}.`,
      body: `
        <p style="margin:0 0 12px;line-height:1.7;">Hi ${escapeHtml(student.firstName)},</p>
        <p style="margin:0;line-height:1.7;">You were marked absent for the following class.</p>
        ${infoRows([
          { label: "Subject", value: `${classroom.subjectCode} - ${classroom.subjectName}` },
          { label: "Date", value: formatDate(record.recordedAt) },
          { label: "Class Timing", value: classroom.scheduleSummary || "Schedule not specified" },
          { label: "Note", value: record.notes }
        ])}
      `
    })
  };
}

export function buildClassCancellationTemplate({ student, classroom, cancellation }) {
  return {
    subject: `${classroom.subjectCode} class cancelled`,
    text: `${classroom.subjectName} is cancelled on ${formatDate(cancellation.cancelledAt)}. Reason: ${cancellation.reason}.`,
    html: baseTemplate({
      title: "Class cancellation notice",
      preview: `${classroom.subjectCode} has been cancelled.`,
      body: `
        <p style="margin:0 0 12px;line-height:1.7;">Hi ${escapeHtml(student.firstName)},</p>
        <p style="margin:0;line-height:1.7;">A class has been cancelled or rescheduled by the teacher.</p>
        ${infoRows([
          { label: "Subject", value: `${classroom.subjectCode} - ${classroom.subjectName}` },
          { label: "Date", value: formatDate(cancellation.cancelledAt) },
          { label: "Class Timing", value: classroom.scheduleSummary || "Schedule not specified" },
          { label: "Reason", value: cancellation.reason }
        ])}
      `
    })
  };
}
