import mongoose from "mongoose";
import { ClassExam } from "../models/ClassExam.js";
import { Classroom } from "../models/Classroom.js";
import {
  getScheduleDayMeta,
  sanitizeScheduleSlots,
  timeToMinutes
} from "../utils/schedule.js";

const DEFAULT_EXAM_ATTENDANCE_PERCENTAGE = 75;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
}

function assertObjectId(value, label) {
  const normalizedValue = String(value ?? "").trim();

  if (!mongoose.Types.ObjectId.isValid(normalizedValue)) {
    throw new Error(`${label} is invalid.`);
  }

  return normalizedValue;
}

function getStartOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getLocalDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function normalizeExamDate(value) {
  const examDate = getStartOfDay(value);

  if (!Number.isFinite(examDate.getTime())) {
    throw new Error("Choose a valid exam date.");
  }

  if (examDate < getStartOfDay(new Date())) {
    throw new Error("Exam date cannot be in the past.");
  }

  return examDate;
}

function normalizeRequiredAttendancePercentage(value) {
  const numericValue = Number(value ?? DEFAULT_EXAM_ATTENDANCE_PERCENTAGE);

  if (!Number.isFinite(numericValue)) {
    throw new Error("Required attendance percentage must be a number.");
  }

  if (numericValue < 0 || numericValue > 100) {
    throw new Error("Required attendance percentage must be between 0 and 100.");
  }

  return Math.round(numericValue);
}

function normalizeExamTitle(title, classroom) {
  const normalizedTitle = String(title ?? "").trim();

  if (normalizedTitle.length > 80) {
    throw new Error("Exam title must be 80 characters or fewer.");
  }

  return normalizedTitle || `${classroom.subjectCode} Exam`;
}

function normalizeExamNote(note) {
  return String(note ?? "").trim().slice(0, 220);
}

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getDaysUntilExam(examDate, fromDate = new Date()) {
  const start = getStartOfDay(fromDate);
  const end = getStartOfDay(examDate);

  return Math.max(0, Math.ceil((end - start) / DAY_IN_MS));
}

export function countScheduledClassesBeforeExam(
  scheduleSlots = [],
  examDate,
  fromDate = new Date()
) {
  const sanitizedSlots = sanitizeScheduleSlots(scheduleSlots);
  const start = getStartOfDay(fromDate);
  const end = getStartOfDay(examDate);

  if (!sanitizedSlots.length || end <= start) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start);
  const currentDateKey = getLocalDateKey(fromDate);
  const currentMinutes = fromDate.getHours() * 60 + fromDate.getMinutes();

  while (cursor < end) {
    const cursorKey = getLocalDateKey(cursor);
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

function getAttendanceCounts(studentStats = {}) {
  const attended = Number(studentStats.presentCount ?? 0);
  const total = Number(studentStats.totalCount ?? 0);

  return {
    attended: Number.isFinite(attended) ? Math.max(0, attended) : 0,
    total: Number.isFinite(total) ? Math.max(0, total) : 0,
    currentPercentage: clampPercentage(Number(studentStats.attendancePercentage ?? 0))
  };
}

export function buildStudentExamEligibility({
  exam,
  classroom,
  studentStats,
  now = new Date()
}) {
  const { attended, total, currentPercentage } = getAttendanceCounts(studentStats);
  const requiredPercentage = exam.requiredAttendancePercentage;
  const classesBeforeExam = countScheduledClassesBeforeExam(
    classroom.scheduleSlots ?? [],
    exam.examDate,
    now
  );
  const projectedTotalAtExam = total + classesBeforeExam;
  const requiredFraction = requiredPercentage / 100;
  const rawClassesNeeded = Math.ceil(
    requiredFraction * projectedTotalAtExam - attended
  );
  const minimumClassesToAttend = Math.max(0, rawClassesNeeded);
  const canQualifyByExam = minimumClassesToAttend <= classesBeforeExam;
  const isEligibleNow = total > 0 && currentPercentage >= requiredPercentage;
  const projectedIfAttendAll = projectedTotalAtExam
    ? clampPercentage(((attended + classesBeforeExam) / projectedTotalAtExam) * 100)
    : 0;
  const projectedIfMissAll = projectedTotalAtExam
    ? clampPercentage((attended / projectedTotalAtExam) * 100)
    : 0;
  const tone = isEligibleNow
    ? "positive"
    : canQualifyByExam
      ? "warning"
      : "danger";
  const statusLabel = isEligibleNow
    ? "Eligible"
    : canQualifyByExam
      ? "Needs Attendance"
      : "At Risk";
  const action =
    minimumClassesToAttend <= 0
      ? "You are eligible based on recorded attendance."
      : canQualifyByExam
        ? `Attend at least ${minimumClassesToAttend} of the next ${classesBeforeExam} scheduled class${classesBeforeExam === 1 ? "" : "es"} before the exam.`
        : classesBeforeExam
          ? `Even attending all ${classesBeforeExam} remaining class${classesBeforeExam === 1 ? "" : "es"} may not reach ${requiredPercentage}%. Talk to your teacher now.`
          : `No scheduled class remains before the exam. Talk to your teacher about eligibility.`;

  return {
    requiredAttendancePercentage: requiredPercentage,
    currentPercentage,
    attended,
    total,
    classesBeforeExam,
    minimumClassesToAttend,
    canQualifyByExam,
    isEligibleNow,
    projectedIfAttendAll,
    projectedIfMissAll,
    statusLabel,
    tone,
    action
  };
}

function summarizeTeacherExamRoster({
  exam,
  classroom,
  attendanceSummary,
  studentIds = []
}) {
  const rosterSummary = studentIds.map((studentId) => {
    const normalizedStudentId = normalizeUserId(studentId);
    const studentStats =
      attendanceSummary.studentStatsById.get(normalizedStudentId) ?? {
        presentCount: 0,
        totalCount: 0,
        attendancePercentage: 0
      };

    return buildStudentExamEligibility({
      exam,
      classroom,
      studentStats
    });
  });

  return {
    studentsCount: studentIds.length,
    eligibleStudents: rosterSummary.filter((item) => item.isEligibleNow).length,
    canQualifyStudents: rosterSummary.filter(
      (item) => !item.isEligibleNow && item.canQualifyByExam
    ).length,
    atRiskStudents: rosterSummary.filter(
      (item) => !item.isEligibleNow && !item.canQualifyByExam
    ).length
  };
}

export function sanitizeClassExam(exam, classroom = null) {
  if (!exam) {
    return null;
  }

  return {
    id: String(exam._id),
    classId: String(exam.classId),
    teacherUserId: exam.teacherUserId,
    title: exam.title,
    examDate: exam.examDate,
    examDateLabel: formatDateLabel(exam.examDate),
    examDateKey: getLocalDateKey(exam.examDate),
    daysUntilExam: getDaysUntilExam(exam.examDate),
    requiredAttendancePercentage: exam.requiredAttendancePercentage,
    note: exam.note ?? "",
    status: exam.status,
    subjectCode: classroom?.code ?? classroom?.subjectCode ?? "",
    subjectName: classroom?.title ?? classroom?.subjectName ?? "",
    section: classroom?.section ?? "",
    semesterLabel: classroom?.semesterLabel ?? "",
    room: classroom?.room ?? "",
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt
  };
}

export function buildStudentExamSummary({
  exam,
  classroom,
  studentStats
}) {
  const sanitizedExam = sanitizeClassExam(exam, classroom);

  if (!sanitizedExam) {
    return null;
  }

  return {
    ...sanitizedExam,
    eligibility: buildStudentExamEligibility({
      exam,
      classroom,
      studentStats
    })
  };
}

export function buildTeacherExamSummary({
  exam,
  classroom,
  attendanceSummary,
  studentIds
}) {
  const sanitizedExam = sanitizeClassExam(exam, classroom);

  if (!sanitizedExam) {
    return null;
  }

  const eligibility = summarizeTeacherExamRoster({
    exam,
    classroom,
    attendanceSummary,
    studentIds
  });
  const classesBeforeExam = countScheduledClassesBeforeExam(
    classroom.scheduleSlots ?? [],
    exam.examDate
  );

  return {
    ...sanitizedExam,
    classesBeforeExam,
    eligibility
  };
}

export function sortUpcomingExams(left, right) {
  return (
    new Date(left.examDate) - new Date(right.examDate) ||
    String(left.subjectCode).localeCompare(String(right.subjectCode))
  );
}

async function getOwnedClassroom(teacherUserId, classId) {
  const normalizedClassId = assertObjectId(classId, "Classroom ID");
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await Classroom.findOne({
    _id: normalizedClassId,
    teacherUserId: normalizedTeacherUserId,
    status: "active"
  }).lean();

  if (!classroom) {
    throw new Error("You can only set exams for classes you teach.");
  }

  return {
    classroom,
    normalizedTeacherUserId
  };
}

export async function setTeacherClassExam({
  teacherUserId,
  classId,
  title,
  examDate,
  requiredAttendancePercentage,
  note
}) {
  const { classroom, normalizedTeacherUserId } = await getOwnedClassroom(
    teacherUserId,
    classId
  );
  const normalizedExamDate = normalizeExamDate(examDate);

  const exam = await ClassExam.findOneAndUpdate(
    {
      classId: classroom._id,
      teacherUserId: normalizedTeacherUserId,
      status: "active"
    },
    {
      $set: {
        title: normalizeExamTitle(title, classroom),
        examDate: normalizedExamDate,
        requiredAttendancePercentage:
          normalizeRequiredAttendancePercentage(requiredAttendancePercentage),
        note: normalizeExamNote(note),
        status: "active"
      }
    },
    {
      new: true,
      runValidators: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).lean();
  return sanitizeClassExam(exam, classroom);
}
