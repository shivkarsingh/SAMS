import { ClassExam } from "../models/ClassExam.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { ClassMembership } from "../models/ClassMembership.js";
import { User } from "../models/User.js";
import { summarizeAttendanceRecords } from "./attendanceAnalyticsService.js";
import { sendEmail } from "./emailService.js";
import {
  buildAbsentNotificationTemplate,
  buildClassCancellationTemplate,
  buildEmailVerificationTemplate,
  buildExamWarningTemplate,
  buildLeaveReviewTemplate,
  buildPasswordResetTemplate,
  buildProfileEmailOtpTemplate,
  buildWelcomeTemplate
} from "./emailTemplateService.js";
import {
  getScheduleDayMeta,
  sanitizeScheduleSlots,
  timeToMinutes
} from "../utils/schedule.js";

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
}

function getStudentRecipients(student) {
  return [student?.email].filter(Boolean);
}

function getDateKey(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getStartOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function countScheduledClassesBeforeExam(scheduleSlots = [], examDate, fromDate = new Date()) {
  const sanitizedSlots = sanitizeScheduleSlots(scheduleSlots);
  const start = getStartOfDay(fromDate);
  const end = getStartOfDay(examDate);

  if (!sanitizedSlots.length || end <= start) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start);
  const currentDateKey = getDateKey(fromDate);
  const currentMinutes = fromDate.getHours() * 60 + fromDate.getMinutes();

  while (cursor < end) {
    const cursorKey = getDateKey(cursor);
    const dayMeta = [...new Set(sanitizedSlots.map((slot) => slot.day))]
      .map(getScheduleDayMeta)
      .find((meta) => meta?.index === cursor.getDay());

    if (dayMeta) {
      sanitizedSlots
        .filter((slot) => slot.day === dayMeta.id)
        .forEach((slot) => {
          if (
            cursorKey !== currentDateKey ||
            timeToMinutes(slot.startTime) > currentMinutes
          ) {
            count += 1;
          }
        });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function buildStudentExamEligibility({ exam, classroom, studentStats }) {
  const attended = Number(studentStats.presentCount ?? 0);
  const total = Number(studentStats.totalCount ?? 0);
  const currentPercentage = clampPercentage(
    Number(studentStats.attendancePercentage ?? 0)
  );
  const classesBeforeExam = countScheduledClassesBeforeExam(
    classroom.scheduleSlots ?? [],
    exam.examDate
  );
  const projectedTotalAtExam = total + classesBeforeExam;
  const minimumClassesToAttend = Math.max(
    0,
    Math.ceil(
      (exam.requiredAttendancePercentage / 100) * projectedTotalAtExam -
        attended
    )
  );

  return {
    currentPercentage,
    classesBeforeExam,
    minimumClassesToAttend
  };
}

async function getRosterBundle(classroom) {
  const memberships = await ClassMembership.find({
    classId: classroom._id
  }).lean();
  const studentIds = memberships.map((membership) =>
    normalizeUserId(membership.studentUserId)
  );
  const users = studentIds.length
    ? await User.find({
        role: "student",
        userId: { $in: studentIds }
      }).lean()
    : [];

  return {
    memberships,
    studentIds,
    usersById: new Map(users.map((user) => [normalizeUserId(user.userId), user]))
  };
}

async function sendTemplatedEmail({
  to,
  templateName,
  notificationKey,
  template,
  metadata
}) {
  return sendEmail({
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
    template: templateName,
    notificationKey,
    metadata
  });
}

export function sendEmailVerificationOtp({ user, otp, expiresAt }) {
  return sendTemplatedEmail({
    to: user.email,
    templateName: "email-verification",
    template: buildEmailVerificationTemplate({ user, otp, expiresAt }),
    metadata: {
      userId: user.userId,
      role: user.role
    }
  });
}

export function sendWelcomeEmail({ user }) {
  return sendTemplatedEmail({
    to: user.email,
    templateName: "welcome",
    notificationKey: `welcome:${user.userId}`,
    template: buildWelcomeTemplate({ user }),
    metadata: {
      userId: user.userId,
      role: user.role
    }
  });
}

export function sendPasswordResetOtp({ user, otp, expiresAt }) {
  return sendTemplatedEmail({
    to: user.email,
    templateName: "password-reset",
    template: buildPasswordResetTemplate({ user, otp, expiresAt }),
    metadata: {
      userId: user.userId,
      role: user.role
    }
  });
}

export function sendProfileEmailOtp({ user, email, otp, expiresAt }) {
  return sendTemplatedEmail({
    to: email,
    templateName: "profile-email-verification",
    template: buildProfileEmailOtpTemplate({ user, email, otp, expiresAt }),
    metadata: {
      userId: user.userId,
      role: user.role,
      email
    }
  });
}

export async function notifyLeaveReview({ leaveRequest, classroom }) {
  const student = await User.findOne({
    userId: normalizeUserId(leaveRequest.studentUserId),
    role: "student"
  }).lean();

  if (!student?.email) {
    return {
      status: "skipped",
      reason: "missing-student-email"
    };
  }

  return sendTemplatedEmail({
    to: student.email,
    templateName: "leave-review",
    notificationKey: `leave:${leaveRequest.id ?? leaveRequest._id}:${leaveRequest.status}`,
    template: buildLeaveReviewTemplate({
      student,
      classroom,
      leaveRequest
    }),
    metadata: {
      classId: String(classroom._id ?? classroom.id),
      studentUserId: student.userId,
      leaveRequestId: String(leaveRequest.id ?? leaveRequest._id),
      status: leaveRequest.status
    }
  });
}

export async function notifyAbsentStudents({ classroom, rosterBundle, records }) {
  const absentRecords = records.filter((record) => record.status === "absent");

  if (!absentRecords.length) {
    return [];
  }

  const results = await Promise.all(
    absentRecords.map(async (record) => {
      const student = rosterBundle.usersById.get(normalizeUserId(record.studentId));
      const recipients = getStudentRecipients(student);

      if (!recipients.length) {
        return {
          studentId: record.studentId,
          status: "skipped",
          reason: "missing-email"
        };
      }

      const result = await sendTemplatedEmail({
        to: recipients,
        templateName: "absent-notification",
        notificationKey: `absent:${classroom._id}:${record.studentId}:${getDateKey(record.recordedAt)}`,
        template: buildAbsentNotificationTemplate({
          student,
          classroom,
          record
        }),
        metadata: {
          classId: String(classroom._id),
          studentUserId: record.studentId,
          date: getDateKey(record.recordedAt)
        }
      });

      return {
        studentId: record.studentId,
        ...result
      };
    })
  );

  return results;
}

export async function notifyClassCancellation({ classroom, rosterBundle, cancellation }) {
  const results = await Promise.all(
    rosterBundle.memberships.map(async (membership) => {
      const normalizedStudentId = normalizeUserId(membership.studentUserId);
      const student = rosterBundle.usersById.get(normalizedStudentId);
      const recipients = getStudentRecipients(student);

      if (!recipients.length) {
        return {
          studentId: normalizedStudentId,
          status: "skipped",
          reason: "missing-email"
        };
      }

      const result = await sendTemplatedEmail({
        to: recipients,
        templateName: "class-cancellation",
        notificationKey: `cancel:${classroom._id}:${normalizedStudentId}:${getDateKey(cancellation.cancelledAt)}`,
        template: buildClassCancellationTemplate({
          student,
          classroom,
          cancellation
        }),
        metadata: {
          classId: String(classroom._id),
          studentUserId: normalizedStudentId,
          date: getDateKey(cancellation.cancelledAt)
        }
      });

      return {
        studentId: normalizedStudentId,
        ...result
      };
    })
  );

  return results;
}

export async function notifyExamAttendanceWarnings({ classroom, rosterBundle }) {
  const activeRosterBundle = rosterBundle ?? (await getRosterBundle(classroom));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exams = await ClassExam.find({
    classId: classroom._id,
    status: "active",
    examDate: { $gte: today }
  }).lean();

  if (!exams.length || !activeRosterBundle.studentIds.length) {
    return [];
  }

  const attendanceRecords = await AttendanceRecord.find({
    classId: String(classroom._id)
  }).lean();
  const attendanceSummary = summarizeAttendanceRecords(
    attendanceRecords,
    activeRosterBundle.studentIds
  );
  const results = [];

  for (const exam of exams) {
    for (const membership of activeRosterBundle.memberships) {
      const normalizedStudentId = normalizeUserId(membership.studentUserId);
      const student = activeRosterBundle.usersById.get(normalizedStudentId);
      const recipients = getStudentRecipients(student);

      if (!recipients.length) {
        results.push({
          studentId: normalizedStudentId,
          examId: String(exam._id),
          status: "skipped",
          reason: "missing-email"
        });
        continue;
      }

      const studentStats =
        attendanceSummary.studentStatsById.get(normalizedStudentId) ?? {
          presentCount: 0,
          totalCount: 0,
          attendancePercentage: 0
        };
      const eligibility = buildStudentExamEligibility({
        exam,
        classroom,
        studentStats
      });

      if (eligibility.currentPercentage >= exam.requiredAttendancePercentage) {
        continue;
      }

      const result = await sendTemplatedEmail({
        to: recipients,
        templateName: "exam-attendance-warning",
        notificationKey: `exam-warning:${exam._id}:${normalizedStudentId}:${eligibility.currentPercentage}`,
        template: buildExamWarningTemplate({
          student,
          classroom,
          exam,
          eligibility
        }),
        metadata: {
          classId: String(classroom._id),
          examId: String(exam._id),
          studentUserId: normalizedStudentId,
          currentPercentage: eligibility.currentPercentage,
          requiredPercentage: exam.requiredAttendancePercentage
        }
      });

      results.push({
        studentId: normalizedStudentId,
        examId: String(exam._id),
        ...result
      });
    }
  }

  return results;
}
