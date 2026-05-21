import crypto from "crypto";
import bcrypt from "bcryptjs";
import { AttendanceDraft } from "../models/AttendanceDraft.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { ClassMembership } from "../models/ClassMembership.js";
import { ClassExam } from "../models/ClassExam.js";
import { Classroom } from "../models/Classroom.js";
import { FaceProfile } from "../models/FaceProfile.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { QrAttendanceSession } from "../models/QrAttendanceSession.js";
import { User } from "../models/User.js";
import { summarizeAttendanceRecords } from "./attendanceAnalyticsService.js";
import {
  notifyAbsentStudents,
  notifyClassCancellation,
  notifyExamAttendanceWarnings,
  sendEmailVerificationOtp
} from "./emailNotificationService.js";
import {
  createEmailOtp,
  getOtpResponseDetails
} from "./emailOtpService.js";
import {
  fetchAiHealth,
  finalizeClassroomAttendanceWithAi,
  processClassroomAttendanceWithAi
} from "./aiService.js";
import { sanitizeLeaveRequests } from "./leaveRequestService.js";
import { buildTeacherExamSummary } from "./examScheduleService.js";
import { env } from "../config/env.js";
import {
  sanitizeScheduleSlots,
  summarizeScheduleSlots
} from "../utils/schedule.js";
import {
  findStudentRollConflict,
  normalizeRollNumber
} from "../utils/studentRollNumberScope.js";
import { resolveStudentDisplayPhotoUrl } from "../utils/studentDisplayPhoto.js";
import { deleteClassroomData } from "./classroomDeletionService.js";

const ATTENDANCE_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
}

function normalizeAttendanceUnit(attendanceUnit) {
  const numericUnit = Number(attendanceUnit ?? 1);

  if (!Number.isFinite(numericUnit) || numericUnit < 1) {
    throw new Error("Attendance unit must be a positive number.");
  }

  if (!Number.isInteger(numericUnit)) {
    throw new Error("Attendance unit must be a whole number.");
  }

  if (numericUnit > 100) {
    throw new Error("Attendance unit cannot be greater than 100.");
  }

  return numericUnit;
}

function normalizeSessionType(sessionType) {
  return String(sessionType ?? "").trim().toLowerCase() === "extra"
    ? "extra"
    : "regular";
}

function normalizeEditableAttendanceStatus(status) {
  const normalizedStatus = String(status ?? "").trim().toLowerCase();

  if (normalizedStatus === "present" || normalizedStatus === "absent") {
    return normalizedStatus;
  }

  throw new Error("Attendance status must be present or absent.");
}

function buildStudentUserId(firstName, rollNumber) {
  const namePart = String(firstName ?? "").trim().replace(/\s+/g, "");
  const rollPart = normalizeRollNumber(rollNumber);

  return namePart && rollPart ? normalizeUserId(`${namePart}#${rollPart}`) : "";
}

function optionalString(value) {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || undefined;
}

function formatAttendanceStatusLabel(status) {
  if (status === "not-recorded") {
    return "Not Recorded";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  const normalizedStatus = String(status ?? "").trim();

  if (!normalizedStatus) {
    return "Not Recorded";
  }

  return `${normalizedStatus.charAt(0).toUpperCase()}${normalizedStatus.slice(1)}`;
}

const rollNumberCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base"
});

function resolveRollNumber(membership, user) {
  return (
    String(user?.rollNumber ?? membership.rollNumber ?? membership.studentUserId)
      .trim()
      .toUpperCase() || normalizeUserId(membership.studentUserId)
  );
}

function compareByRollNumber(left, right) {
  const rollComparison = rollNumberCollator.compare(
    left.rollNumber || left.studentUserId,
    right.rollNumber || right.studentUserId
  );

  if (rollComparison !== 0) {
    return rollComparison;
  }

  return String(left.studentName).localeCompare(String(right.studentName));
}

function estimateDataUrlBytes(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  const base64Payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;

  return Math.ceil((base64Payload.length * 3) / 4);
}

function isCurrentFaceProfile(faceProfile) {
  return (
    faceProfile?.status === "enrolled" &&
    faceProfile.faceModel === env.aiFaceRecognitionModel &&
    faceProfile.executionMode === env.aiExecutionMode
  );
}

function resolveFaceProfileStatus(faceProfile) {
  if (!faceProfile) {
    return "not-started";
  }

  return isCurrentFaceProfile(faceProfile) ? "enrolled" : "needs-refresh";
}

function sanitizeClassroom(classroom, attendanceSummary, studentsCount) {
  const scheduleSlots = sanitizeScheduleSlots(classroom.scheduleSlots);

  return {
    id: String(classroom._id),
    teacherUserId: classroom.teacherUserId,
    teacherName: classroom.teacherName,
    subjectName: classroom.subjectName,
    subjectCode: classroom.subjectCode,
    section: classroom.section,
    description: classroom.description,
    room: classroom.room,
    semesterLabel: classroom.semesterLabel,
    academicYear: classroom.academicYear,
    batch: classroom.batch,
    scheduleSummary: summarizeScheduleSlots(scheduleSlots, classroom.scheduleSummary),
    scheduleSlots,
    joinCode: classroom.joinCode,
    status: classroom.status,
    endedAt: classroom.endedAt ?? null,
    endedBy: classroom.endedBy ?? "",
    archiveSummary: classroom.archiveSummary ?? null,
    studentsCount,
    averageAttendance: attendanceSummary.averageAttendance,
    totalSessions: attendanceSummary.totalSessions,
    flaggedStudents: attendanceSummary.flaggedStudents,
    attendanceSubmitted: attendanceSummary.totalSessions > 0,
    lastAttendanceAt: attendanceSummary.latestSession?.recordedAt ?? null,
    createdAt: classroom.createdAt
  };
}

function buildOverview(roster, attendanceSummary) {
  const readyFaceProfiles = roster.filter(
    (student) => student.faceProfileStatus === "enrolled"
  ).length;

  return {
    studentsCount: roster.length,
    readyFaceProfiles,
    pendingFaceProfiles: Math.max(0, roster.length - readyFaceProfiles),
    averageAttendance: attendanceSummary.averageAttendance,
    totalSessions: attendanceSummary.totalSessions,
    flaggedStudents: attendanceSummary.flaggedStudents,
    lowAttendanceThreshold: 75
  };
}

function buildAttendanceHistory(attendanceSummary, rosterByStudentId = new Map()) {
  return attendanceSummary.recentSessions.map((session) => ({
    sessionId: session.sessionId,
    recordedAt: session.recordedAt,
    presentCount: session.presentCount,
    absentCount: session.absentCount,
    cancelledCount: session.cancelledCount ?? 0,
    attendanceUnit: session.attendanceUnit ?? 1,
    presentUnits: session.presentUnits ?? session.presentCount,
    absentUnits: session.absentUnits ?? session.absentCount,
    sessionType: normalizeSessionType(session.sessionType),
    students: (session.records ?? [])
      .map((record) => {
        const studentUserId = normalizeUserId(record.studentId);
        const rosterStudent = rosterByStudentId.get(studentUserId);

        return {
          studentUserId,
          studentName:
            record.studentName || rosterStudent?.studentName || record.studentId,
          rollNumber: String(
            record.rollNumber ?? rosterStudent?.rollNumber ?? ""
          )
            .trim()
            .toUpperCase(),
          avatarDataUrl: rosterStudent?.avatarDataUrl ?? "",
          faceProfilePhotoUrl: rosterStudent?.faceProfilePhotoUrl ?? "",
          profilePhotoUrl: rosterStudent?.profilePhotoUrl ?? "",
          status: record.status,
          statusLabel: formatAttendanceStatusLabel(record.status),
          verificationMethod: record.verificationMethod ?? "",
          attendanceUnit: record.attendanceUnit ?? session.attendanceUnit ?? 1,
          recordedAt: record.recordedAt ?? session.recordedAt,
          notes: record.notes ?? ""
        };
      })
      .sort(compareByRollNumber)
  }));
}

function buildTodayAttendanceSummary(roster, attendanceRecords) {
  const { dayStart, dayEnd } = getAttendanceDayWindow(new Date());
  const latestTodayRecordByStudentId = new Map();

  attendanceRecords
    .filter((record) => {
      const recordedAt = new Date(record.recordedAt ?? record.createdAt ?? Date.now());

      return recordedAt >= dayStart && recordedAt < dayEnd;
    })
    .sort(
      (left, right) =>
        new Date(left.recordedAt ?? left.createdAt) -
        new Date(right.recordedAt ?? right.createdAt)
    )
    .forEach((record) => {
      latestTodayRecordByStudentId.set(normalizeUserId(record.studentId), record);
    });

  const presentCount = roster.filter((student) => {
    const status = latestTodayRecordByStudentId.get(student.studentUserId)?.status;

    return status === "present" || status === "late";
  }).length;
  const cancelledCount = roster.filter(
    (student) =>
      latestTodayRecordByStudentId.get(student.studentUserId)?.status === "cancelled"
  ).length;
  const recordedCount = latestTodayRecordByStudentId.size;
  const totalStudents = roster.length;
  const absentees = Math.max(0, totalStudents - presentCount - cancelledCount);
  const countedStudents = Math.max(0, totalStudents - cancelledCount);
  const todayAttendanceUnits = Array.from(latestTodayRecordByStudentId.values())
    .map((record) => Number(record.attendanceUnit ?? 1))
    .filter((unit) => Number.isFinite(unit) && unit >= 1);

  return {
    date: getLocalDateKey(new Date()),
    totalStudents,
    presentCount,
    absentees,
    cancelledCount,
    recordedCount,
    attendanceUnit: todayAttendanceUnits.length
      ? Math.max(...todayAttendanceUnits)
      : 1,
    attendancePercentage: countedStudents
      ? clampPercentage((presentCount / countedStudents) * 100)
      : 0
  };
}

function getAttendanceDraftCounts(records = []) {
  const presentCount = records.filter(
    (record) => record.status === "present" || record.status === "late"
  ).length;
  const totalStudents = records.length;

  return {
    totalStudents,
    presentCount,
    absentCount: Math.max(0, totalStudents - presentCount),
    attendancePercentage: totalStudents
      ? clampPercentage((presentCount / totalStudents) * 100)
      : 0
  };
}

function sanitizeAttendanceDraft(draft) {
  if (!draft) {
    return null;
  }

  const records = (draft.records ?? []).map((record) => ({
    studentId: normalizeUserId(record.studentId),
    studentName: record.studentName,
    rollNumber: record.rollNumber,
    status: record.status,
    source: record.source,
    confidence: record.confidence,
    aiStatus: record.aiStatus,
    notes: record.notes ?? ""
  }));

  return {
    id: String(draft._id),
    classId: String(draft.classId),
    teacherUserId: draft.teacherUserId,
    sourceSessionId: draft.sourceSessionId ?? "",
    dateKey: draft.dateKey,
    records,
    notes: draft.notes ?? "",
    attendanceUnit: Number(draft.attendanceUnit ?? 1),
    sessionType: normalizeSessionType(draft.sessionType),
    status: draft.status,
    counts: getAttendanceDraftCounts(records),
    absenteeEmailSentAt: draft.absenteeEmailSentAt,
    expiresAt: draft.expiresAt,
    finalizedAt: draft.finalizedAt,
    finalizedMode: draft.finalizedMode ?? "",
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  };
}

async function getOwnedClassroom(teacherUserId, classId) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await Classroom.findOne({
    _id: classId,
    teacherUserId: normalizedTeacherUserId
  }).lean();

  if (!classroom) {
    throw new Error("Classroom not found for this teacher.");
  }

  return classroom;
}

async function getOwnedClassroomDocument(teacherUserId, classId) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await Classroom.findOne({
    _id: classId,
    teacherUserId: normalizedTeacherUserId
  });

  if (!classroom) {
    throw new Error("Classroom not found for this teacher.");
  }

  return classroom;
}

function assertClassroomActive(classroom) {
  if (classroom.status !== "active") {
    throw new Error("This class is inactive because it has been ended.");
  }
}

function getStudentName(payload, fallbackUser = null) {
  const firstName = optionalString(payload.firstName) ?? fallbackUser?.firstName;
  const lastName = optionalString(payload.lastName) ?? fallbackUser?.lastName;
  const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim();

  if (!fullName) {
    throw new Error("Student first name and last name are required.");
  }

  return {
    firstName,
    lastName,
    fullName
  };
}

function validateStudentFields(payload, existingUser = null) {
  const { firstName, lastName, fullName } = getStudentName(payload, existingUser);
  const rollNumber = normalizeRollNumber(payload.rollNumber ?? existingUser?.rollNumber);

  if (!firstName || firstName.length < 2 || !lastName || lastName.length < 2) {
    throw new Error("Student first name and last name must be at least 2 characters.");
  }

  if (!rollNumber) {
    throw new Error("Roll number is required.");
  }

  if (!/^\d+$/.test(rollNumber)) {
    throw new Error("Roll number must contain numbers only.");
  }

  const email = optionalString(payload.email ?? existingUser?.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  return {
    firstName,
    lastName,
    fullName,
    rollNumber,
    email,
    department: optionalString(payload.department ?? existingUser?.department),
    batch: optionalString(payload.batch ?? existingUser?.batch),
    semesterLabel: optionalString(
      payload.semesterLabel ?? existingUser?.semesterLabel
    )
  };
}

async function findExistingStudentRollConflict(candidate, excludeUserId = "") {
  const studentsWithRollNumber = await User.find({
    role: "student",
    rollNumber: candidate.rollNumber
  }).lean();

  return findStudentRollConflict(studentsWithRollNumber, candidate, excludeUserId);
}

async function getClassroomRosterBundle(classId) {
  const memberships = await ClassMembership.find({
    classId
  })
    .sort({ studentName: 1 })
    .lean();
  const studentIds = memberships.map((membership) =>
    normalizeUserId(membership.studentUserId)
  );

  if (!studentIds.length) {
    return {
      memberships,
      studentIds,
      usersById: new Map(),
      faceProfilesById: new Map()
    };
  }

  const [users, faceProfiles] = await Promise.all([
    User.find({
      userId: { $in: studentIds },
      role: "student"
    }).lean(),
    FaceProfile.find({
      studentUserId: { $in: studentIds }
    }).lean()
  ]);

  return {
    memberships,
    studentIds,
    usersById: new Map(
      users.map((user) => [normalizeUserId(user.userId), user])
    ),
    faceProfilesById: new Map(
      faceProfiles.map((profile) => [
        normalizeUserId(profile.studentUserId),
        profile
      ])
    )
  };
}

function buildRoster(
  rosterBundle,
  attendanceSummary,
  attendanceRecords,
  leaveRequests,
  classroomFallbackBatch = ""
) {
  const recordsByStudentId = new Map();
  const leaveRequestsByStudentId = new Map();

  attendanceRecords.forEach((record) => {
    const normalizedStudentUserId = normalizeUserId(record.studentId);
    const currentRecords = recordsByStudentId.get(normalizedStudentUserId) ?? [];

    currentRecords.push(record);
    recordsByStudentId.set(normalizedStudentUserId, currentRecords);
  });

  leaveRequests.forEach((request) => {
    const normalizedStudentUserId = normalizeUserId(request.studentUserId);
    const currentRequests = leaveRequestsByStudentId.get(normalizedStudentUserId) ?? [];

    currentRequests.push(request);
    leaveRequestsByStudentId.set(normalizedStudentUserId, currentRequests);
  });

  return rosterBundle.memberships.map((membership) => {
    const normalizedStudentUserId = normalizeUserId(membership.studentUserId);
    const user = rosterBundle.usersById.get(normalizedStudentUserId);
    const faceProfile = rosterBundle.faceProfilesById.get(normalizedStudentUserId);
    const attendanceStats =
      attendanceSummary.studentStatsById.get(normalizedStudentUserId) ?? {
        presentCount: 0,
        totalCount: 0,
        attendancePercentage: 0,
        lastStatus: "not-recorded",
        lastMarkedAt: null
      };

    return {
      studentUserId: normalizedStudentUserId,
      studentName: membership.studentName,
      rollNumber: resolveRollNumber(membership, user),
      batch: user?.batch ?? classroomFallbackBatch ?? "",
      department: user?.department ?? "",
      semesterLabel: user?.semesterLabel ?? "",
      email: user?.email ?? "",
      joinedAt: membership.createdAt,
      faceProfileStatus: resolveFaceProfileStatus(faceProfile),
      faceQualityScore: clampPercentage(
        (faceProfile?.averageQualityScore ?? 0) * 100
      ),
      enrolledImageCount: faceProfile?.uploadedImageCount ?? 0,
      faceEmbeddingCount: faceProfile?.embeddingCount ?? 0,
      avatarDataUrl: user?.avatarDataUrl ?? "",
      faceProfilePhotoUrl: faceProfile?.profilePhotoUrl ?? "",
      profilePhotoUrl: resolveStudentDisplayPhotoUrl(user, faceProfile),
      sessionsAttended: attendanceStats.presentCount,
      sessionsHeld: attendanceStats.totalCount,
      attendancePercentage: attendanceStats.attendancePercentage,
      latestStatus: formatAttendanceStatusLabel(attendanceStats.lastStatus),
      lastMarkedAt: attendanceStats.lastMarkedAt,
      leaveRequests: sanitizeLeaveRequests(
        (leaveRequestsByStudentId.get(normalizedStudentUserId) ?? [])
          .slice()
          .sort(
            (left, right) =>
              new Date(right.submittedAt ?? right.createdAt) -
              new Date(left.submittedAt ?? left.createdAt)
          )
      ),
      attendanceCalendar: (recordsByStudentId.get(normalizedStudentUserId) ?? [])
        .sort(
          (left, right) =>
            new Date(left.recordedAt ?? left.createdAt) -
            new Date(right.recordedAt ?? right.createdAt)
        )
        .map((record) => ({
          sessionId: record.sessionId,
          date: getLocalDateKey(record.recordedAt ?? record.createdAt),
          recordedAt: record.recordedAt ?? record.createdAt,
          status: record.status,
          statusLabel: formatAttendanceStatusLabel(record.status),
          verificationMethod: record.verificationMethod,
          notes: record.notes ?? ""
        }))
    };
  }).sort(compareByRollNumber);
}

function mapAttendanceSourceToVerificationMethod(source) {
  if (source === "ai-auto") {
    return "face-recognition";
  }

  if (source === "teacher-confirmed") {
    return "teacher-confirmed";
  }

  if (source === "manual-add") {
    return "manual-add";
  }

  return "system-derived";
}

function buildAiReadinessMessage(aiHealth) {
  const details = [
    aiHealth.message,
    ...(Array.isArray(aiHealth.warnings) ? aiHealth.warnings : [])
  ].filter(Boolean);
  const suffix = details.length ? ` ${details.join(" ")}` : "";

  return `AI service is not ready to analyze attendance right now.${suffix}`;
}

function validateClassroomCaptureImages(images) {
  if (!Array.isArray(images) || !images.length) {
    throw new Error("Upload at least one classroom capture image to continue.");
  }

  if (images.length > env.maxClassroomCaptureImages) {
    throw new Error(
      `Use ${env.maxClassroomCaptureImages} or fewer classroom capture images for one attendance run.`
    );
  }

  return images.map((image, index) => {
    const label = `Image ${index + 1}`;
    if (
      !image ||
      typeof image.fileName !== "string" ||
      !image.fileName.trim() ||
      typeof image.dataUrl !== "string" ||
      !image.dataUrl.startsWith("data:image/")
    ) {
      throw new Error(`${label} is not a valid image capture.`);
    }

    if (estimateDataUrlBytes(image.dataUrl) > env.maxClassroomImageBytes) {
      throw new Error(
        `${image.fileName} is too large after compression. Retake or upload a smaller classroom image.`
      );
    }

    return {
      fileName: image.fileName.trim(),
      dataUrl: image.dataUrl
    };
  });
}

export async function getTeacherClassroomDetails({ teacherUserId, classId }) {
  const classroom = await getOwnedClassroom(teacherUserId, classId);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);
  await finalizeExpiredAttendanceDrafts({
    classroom,
    rosterBundle
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [
    attendanceRecords,
    leaveRequests,
    todayAttendanceDraft,
    upcomingExamRecord
  ] = await Promise.all([
    AttendanceRecord.find({
      classId: String(classroom._id)
    }).lean(),
    LeaveRequest.find({
      classId: classroom._id
    })
      .sort({ submittedAt: -1 })
      .lean(),
    AttendanceDraft.findOne({
      classId: classroom._id,
      teacherUserId: classroom.teacherUserId,
      dateKey: getLocalDateKey(),
      status: "draft"
    }).lean(),
    ClassExam.findOne({
      classId: classroom._id,
      teacherUserId: classroom.teacherUserId,
      status: "active",
      examDate: { $gte: today }
    })
      .sort({ examDate: 1 })
      .lean()
  ]);
  const attendanceSummary = summarizeAttendanceRecords(
    attendanceRecords,
    rosterBundle.studentIds
  );
  const roster = buildRoster(
    rosterBundle,
    attendanceSummary,
    attendanceRecords,
    leaveRequests,
    classroom.batch
  );
  const pendingLeaveRequests = leaveRequests.filter(
    (request) => request.status === "pending"
  ).length;

  return {
    classroom: {
      ...sanitizeClassroom(
        classroom,
        attendanceSummary,
        rosterBundle.studentIds.length
      ),
      upcomingExam: buildTeacherExamSummary({
        exam: upcomingExamRecord,
        classroom,
        attendanceSummary,
        studentIds: rosterBundle.studentIds
      })
    },
    overview: buildOverview(roster, attendanceSummary),
    todayAttendance: buildTodayAttendanceSummary(roster, attendanceRecords),
    todayAttendanceDraft: sanitizeAttendanceDraft(todayAttendanceDraft),
    roster,
    leaveRequests: sanitizeLeaveRequests(leaveRequests),
    pendingLeaveRequests,
    attendanceHistory: buildAttendanceHistory(
      attendanceSummary,
      new Map(roster.map((student) => [normalizeUserId(student.studentUserId), student]))
    ),
    attentionNotes: [
      pendingLeaveRequests
        ? `${pendingLeaveRequests} leave request${pendingLeaveRequests === 1 ? "" : "s"} need teacher review.`
        : "No pending leave requests right now.",
      roster.length
        ? roster.some((student) => student.faceProfileStatus !== "enrolled")
          ? `${roster.filter((student) => student.faceProfileStatus !== "enrolled").length} students still need a ready face profile before camera-based attendance becomes fully reliable.`
          : "All joined students have a ready face profile for camera-assisted attendance."
        : "No students have joined this class yet.",
      attendanceSummary.totalSessions
        ? attendanceSummary.flaggedStudents
          ? `${attendanceSummary.flaggedStudents} students are currently below the safe attendance range.`
          : "Attendance is currently in the safe range for every joined student."
        : "No attendance sessions have been finalized for this class yet."
    ]
  };
}

export async function addTeacherClassroomStudent({
  teacherUserId,
  classId,
  student
}) {
  const classroom = await getOwnedClassroom(teacherUserId, classId);
  assertClassroomActive(classroom);
  const generatedStudentUserId = buildStudentUserId(
    student?.firstName,
    student?.rollNumber
  );
  const submittedStudentUserId = normalizeUserId(student?.userId);
  const normalizedStudentUserId = submittedStudentUserId || generatedStudentUserId;

  if (!normalizedStudentUserId) {
    throw new Error("Student ID requires first name and roll number.");
  }

  let studentUser = await User.findOne({
    userId: normalizedStudentUserId,
    role: "student"
  });
  const isNewStudent = !studentUser;
  const validatedStudent = validateStudentFields(student, studentUser);

  if (isNewStudent) {
    if (!String(student?.password ?? "")) {
      throw new Error("Password is required for a new student.");
    }

    if (String(student?.confirmPassword ?? "") !== String(student.password ?? "")) {
      throw new Error("Password and confirm password must match.");
    }

    const existingRollNumber = await findExistingStudentRollConflict({
      rollNumber: validatedStudent.rollNumber,
      department: validatedStudent.department,
      semesterLabel: validatedStudent.semesterLabel
    });

    if (existingRollNumber) {
      throw new Error(
        "A student with this roll number already exists in the same branch and semester."
      );
    }

    studentUser = await User.create({
      role: "student",
      userId: normalizedStudentUserId,
      firstName: validatedStudent.firstName,
      lastName: validatedStudent.lastName,
      rollNumber: validatedStudent.rollNumber,
      passwordHash: await bcrypt.hash(student.password, 10),
      email: validatedStudent.email,
      emailVerified: false,
      emailVerifiedAt: null,
      emailVerificationRequired: true,
      department: validatedStudent.department,
      batch: validatedStudent.batch,
      semesterLabel: validatedStudent.semesterLabel
    });
  }

  const existingMembership = await ClassMembership.findOne({
    classId: classroom._id,
    studentUserId: normalizedStudentUserId
  });

  if (existingMembership) {
    throw new Error("This student is already added to the class.");
  }

  await ClassMembership.create({
    classId: classroom._id,
    studentUserId: normalizedStudentUserId,
    studentName: validatedStudent.fullName,
    rollNumber: validatedStudent.rollNumber
  });

  let verification = null;

  if (isNewStudent && studentUser.email) {
    const otpDetails = await createEmailOtp({
      role: studentUser.role,
      userId: studentUser.userId,
      email: studentUser.email,
      purpose: "email-verification"
    });
    const emailStatus = await sendEmailVerificationOtp({
      user: studentUser,
      otp: otpDetails.otp,
      expiresAt: otpDetails.expiresAt
    });

    verification = getOtpResponseDetails({
      otp: otpDetails.otp,
      expiresAt: otpDetails.expiresAt,
      emailStatus
    });
  }

  return {
    createdStudent: isNewStudent,
    verification,
    classroom: await getTeacherClassroomDetails({ teacherUserId, classId })
  };
}

export async function updateTeacherClassroomStudent({
  teacherUserId,
  classId,
  studentId,
  updates
}) {
  const classroom = await getOwnedClassroom(teacherUserId, classId);
  assertClassroomActive(classroom);
  const normalizedStudentUserId = normalizeUserId(studentId);
  const membership = await ClassMembership.findOne({
    classId: classroom._id,
    studentUserId: normalizedStudentUserId
  });

  if (!membership) {
    throw new Error("Student is not part of this class.");
  }

  const studentUser = await User.findOne({
    userId: normalizedStudentUserId,
    role: "student"
  });

  if (!studentUser) {
    throw new Error("Student account not found.");
  }

  const requestedRollNumber = normalizeRollNumber(
    updates.rollNumber ?? studentUser.rollNumber
  );

  if (requestedRollNumber !== normalizeRollNumber(studentUser.rollNumber)) {
    throw new Error("Roll number can only be changed by admin.");
  }

  const validatedStudent = validateStudentFields(
    {
      ...updates,
      rollNumber: studentUser.rollNumber
    },
    studentUser
  );

  studentUser.firstName = validatedStudent.firstName;
  studentUser.lastName = validatedStudent.lastName;
  studentUser.email = validatedStudent.email;
  studentUser.department = validatedStudent.department;
  studentUser.batch = validatedStudent.batch;
  studentUser.semesterLabel = validatedStudent.semesterLabel;

  if (updates.password) {
    if (String(updates.confirmPassword ?? "") !== String(updates.password)) {
      throw new Error("Password and confirm password must match.");
    }

    studentUser.passwordHash = await bcrypt.hash(updates.password, 10);
  }

  await studentUser.save();

  membership.studentName = validatedStudent.fullName;
  membership.rollNumber = studentUser.rollNumber;
  await membership.save();

  return getTeacherClassroomDetails({ teacherUserId, classId });
}

export async function deleteTeacherClassroomStudent({
  teacherUserId,
  classId,
  studentId
}) {
  const classroom = await getOwnedClassroom(teacherUserId, classId);
  assertClassroomActive(classroom);
  const normalizedStudentUserId = normalizeUserId(studentId);
  const result = await ClassMembership.deleteOne({
    classId: classroom._id,
    studentUserId: normalizedStudentUserId
  });

  if (!result.deletedCount) {
    throw new Error("Student is not part of this class.");
  }

  return getTeacherClassroomDetails({ teacherUserId, classId });
}

export async function archiveTeacherClassroom({
  teacherUserId,
  classId
}) {
  const classroom = await getOwnedClassroomDocument(teacherUserId, classId);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);
  const attendanceRecords = await AttendanceRecord.find({
    classId: String(classroom._id)
  }).lean();
  const attendanceSummary = summarizeAttendanceRecords(
    attendanceRecords,
    rosterBundle.studentIds
  );
  const endedAt = new Date();

  classroom.status = "archived";
  classroom.endedAt = classroom.endedAt ?? endedAt;
  classroom.endedBy = normalizeUserId(teacherUserId);
  classroom.archiveSummary = {
    endedAt: (classroom.endedAt ?? endedAt).toISOString(),
    studentsCount: rosterBundle.studentIds.length,
    totalSessions: attendanceSummary.totalSessions,
    averageAttendance: attendanceSummary.averageAttendance,
    flaggedStudents: attendanceSummary.flaggedStudents,
    latestSessionAt: attendanceSummary.latestSession?.recordedAt ?? null
  };
  await classroom.save();

  await QrAttendanceSession.updateMany(
    {
      classId: String(classroom._id),
      teacherUserId: classroom.teacherUserId,
      status: "active"
    },
    {
      $set: {
        status: "closed"
      }
    }
  );

  return {
    classroom: sanitizeClassroom(
      classroom.toObject(),
      attendanceSummary,
      rosterBundle.studentIds.length
    ),
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId,
      classId: String(classroom._id)
    })
  };
}

export async function deleteTeacherClassroom({
  teacherUserId,
  classId
}) {
  const classroom = await getOwnedClassroomDocument(teacherUserId, classId);
  const classroomSnapshot = {
    id: String(classroom._id),
    subjectName: classroom.subjectName,
    subjectCode: classroom.subjectCode,
    teacherUserId: classroom.teacherUserId
  };
  const deleted = await deleteClassroomData(classroom);

  return {
    deleted,
    classroom: classroomSnapshot
  };
}

function getLocalDateKey(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getAttendanceDayWindow(value = new Date()) {
  const dayStart = new Date(value);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  return {
    dayStart,
    dayEnd
  };
}

function getDailyAttendanceSessionId(classId, value = new Date()) {
  return `daily-${String(classId)}-${getLocalDateKey(value)}`;
}

function getExtraAttendanceSessionId(classId, value = new Date()) {
  return `extra-${String(classId)}-${getLocalDateKey(value)}-${new Date(value).getTime()}`;
}

function getAttendanceRosterRecord({
  membership,
  user,
  classroom,
  status,
  sessionId,
  recordedAt,
  notes,
  source,
  verificationMethod = "manual",
  confidence = null,
  attendanceUnit = 1,
  sessionType = "regular"
}) {
  return {
    sessionId,
    teacherUserId: classroom.teacherUserId,
    studentId: normalizeUserId(membership.studentUserId),
    studentName: membership.studentName,
    rollNumber: resolveRollNumber(membership, user),
    classId: String(classroom._id),
    className: classroom.subjectName,
    status,
    verificationMethod,
    source,
    confidence,
    attendanceUnit: normalizeAttendanceUnit(attendanceUnit),
    sessionType: normalizeSessionType(sessionType),
    recordedAt,
    notes
  };
}

function resolveDailyStatus(existingStatus, nextStatus) {
  const normalizedExistingStatus = String(existingStatus ?? "").trim().toLowerCase();
  const normalizedNextStatus = String(nextStatus ?? "").trim().toLowerCase();

  if (normalizedNextStatus === "present") {
    return "present";
  }

  if (normalizedNextStatus === "late") {
    return normalizedExistingStatus === "present" ? "present" : "late";
  }

  if (["present", "late"].includes(normalizedExistingStatus)) {
    return normalizedExistingStatus;
  }

  if (normalizedNextStatus === "cancelled") {
    return "cancelled";
  }

  return ["absent", "cancelled"].includes(normalizedNextStatus)
    ? normalizedNextStatus
    : "absent";
}

async function runEmailWorkflow(workflow) {
  try {
    return await workflow();
  } catch (error) {
    return {
      status: "failed",
      reason:
        error instanceof Error
          ? error.message
          : "Email workflow failed."
    };
  }
}

async function mergeDailyAttendanceRecords({
  classroom,
  rosterBundle,
  proposedRecords,
  recordedAt,
  notes,
  forceStatus = "",
  attendanceUnit = 1,
  sessionType = "regular"
}) {
  const normalizedAttendanceUnit = normalizeAttendanceUnit(attendanceUnit);
  const normalizedSessionType = normalizeSessionType(sessionType);
  const { dayStart, dayEnd } = getAttendanceDayWindow(recordedAt);
  const dailySessionId =
    normalizedSessionType === "extra"
      ? getExtraAttendanceSessionId(classroom._id, recordedAt)
      : getDailyAttendanceSessionId(classroom._id, recordedAt);
  const existingRecords = await AttendanceRecord.find({
    classId: String(classroom._id),
    recordedAt: {
      $gte: dayStart,
      $lt: dayEnd
    }
  }).lean();
  const matchingExistingRecords =
    normalizedSessionType === "regular"
      ? existingRecords.filter(
          (record) => normalizeSessionType(record.sessionType) === "regular"
        )
      : [];
  const existingByStudentId = new Map();
  const proposedByStudentId = new Map(
    proposedRecords.map((record) => [normalizeUserId(record.studentId), record])
  );

  matchingExistingRecords
    .sort(
      (left, right) =>
        new Date(left.recordedAt ?? left.createdAt) -
        new Date(right.recordedAt ?? right.createdAt)
    )
    .forEach((record) => {
      existingByStudentId.set(normalizeUserId(record.studentId), record);
    });

  const mergedRecords = rosterBundle.memberships.map((membership) => {
    const normalizedStudentUserId = normalizeUserId(membership.studentUserId);
    const user = rosterBundle.usersById.get(normalizedStudentUserId);
    const proposedRecord =
      proposedByStudentId.get(normalizedStudentUserId) ??
      getAttendanceRosterRecord({
        membership,
        user,
        classroom,
        status: "absent",
        sessionId: dailySessionId,
        recordedAt,
        notes,
        source: "manual",
        attendanceUnit: normalizedAttendanceUnit,
        sessionType: normalizedSessionType
      });
    const existingRecord = existingByStudentId.get(normalizedStudentUserId);
    const resolvedStatus = forceStatus
      ? forceStatus
      : resolveDailyStatus(existingRecord?.status, proposedRecord.status);
    const keepExistingStatus =
      existingRecord &&
      !forceStatus &&
      resolvedStatus === existingRecord.status &&
      proposedRecord.status !== "present" &&
      proposedRecord.status !== "late";
    const sourceRecord = keepExistingStatus ? existingRecord : proposedRecord;

    return {
      sessionId: dailySessionId,
      teacherUserId: classroom.teacherUserId,
      studentId: normalizedStudentUserId,
      studentName: membership.studentName,
      rollNumber: resolveRollNumber(membership, user),
      classId: String(classroom._id),
      className: classroom.subjectName,
      status: resolvedStatus,
      verificationMethod: sourceRecord.verificationMethod ?? "manual",
      source: sourceRecord.source ?? "manual",
      confidence: sourceRecord.confidence ?? null,
      attendanceUnit: normalizedAttendanceUnit,
      sessionType: normalizedSessionType,
      recordedAt,
      notes: keepExistingStatus
        ? sourceRecord.notes ?? ""
        : String(notes ?? sourceRecord.notes ?? "").trim()
    };
  });

  if (normalizedSessionType === "regular") {
    await AttendanceRecord.deleteMany({
      classId: String(classroom._id),
      recordedAt: {
        $gte: dayStart,
        $lt: dayEnd
      },
      $or: [
        { sessionType: "regular" },
        { sessionType: { $exists: false } },
        { sessionType: "" }
      ]
    });
  } else {
    await AttendanceRecord.deleteMany({
      classId: String(classroom._id),
      sessionId: dailySessionId
    });
  }

  if (mergedRecords.length) {
    await AttendanceRecord.insertMany(mergedRecords);
  }

  return {
    sessionId: dailySessionId,
    records: mergedRecords
  };
}

function buildDraftRecordsFromAiRecognition({
  classroom,
  rosterBundle,
  recognition
}) {
  const suggestedByStudentId = new Map();
  const reviewByStudentId = new Map();

  (recognition.recognizedStudents ?? []).forEach((student) => {
    if (!student.personId) {
      return;
    }

    const normalizedStudentId = normalizeUserId(student.personId);
    const existingStudent = suggestedByStudentId.get(normalizedStudentId);

    if (
      student.status === "present-suggested" &&
      (!existingStudent ||
        Number(student.confidence ?? 0) > Number(existingStudent.confidence ?? 0))
    ) {
      suggestedByStudentId.set(normalizedStudentId, student);
    }
  });

  (recognition.reviewQueue ?? []).forEach((student) => {
    if (!student.personId) {
      return;
    }

    const normalizedStudentId = normalizeUserId(student.personId);
    const existingStudent = reviewByStudentId.get(normalizedStudentId);

    if (
      !existingStudent ||
      Number(student.confidence ?? 0) > Number(existingStudent.confidence ?? 0)
    ) {
      reviewByStudentId.set(normalizedStudentId, student);
    }
  });

  return rosterBundle.memberships.map((membership) => {
    const normalizedStudentId = normalizeUserId(membership.studentUserId);
    const user = rosterBundle.usersById.get(normalizedStudentId);
    const suggestedStudent = suggestedByStudentId.get(normalizedStudentId);
    const reviewStudent = reviewByStudentId.get(normalizedStudentId);

    return {
      studentId: normalizedStudentId,
      studentName: membership.studentName,
      rollNumber: resolveRollNumber(membership, user),
      status: suggestedStudent ? "present" : "absent",
      source: "ai-suggested",
      confidence: suggestedStudent?.confidence ?? reviewStudent?.confidence ?? null,
      aiStatus: suggestedStudent
        ? "present-suggested"
        : reviewStudent
          ? "needs-review"
          : "absent-candidate",
      notes: suggestedStudent
        ? "AI suggested present from classroom photo."
        : reviewStudent
          ? "AI saw a possible match. Teacher review needed."
          : "Not detected in classroom photo."
    };
  });
}

function applyDraftStatusUpdates(records = [], statuses = {}) {
  const normalizedStatuses = statuses && typeof statuses === "object" ? statuses : {};

  return records.map((record) => {
    const plainRecord =
      typeof record?.toObject === "function" ? record.toObject() : record;
    const studentId = normalizeUserId(record.studentId);
    const nextStatus = String(normalizedStatuses[studentId] ?? record.status)
      .trim()
      .toLowerCase();

    if (!["present", "absent", "late"].includes(nextStatus)) {
      return plainRecord;
    }

    if (nextStatus === record.status) {
      return plainRecord;
    }

    return {
      ...plainRecord,
      studentId,
      status: nextStatus,
      source: "teacher-edited"
    };
  });
}

async function sendDraftAbsenteeEmails({ classroom, rosterBundle, draft }) {
  const recordedAt = draft.createdAt ?? new Date();
  const sessionType = normalizeSessionType(draft.sessionType);
  const sessionId =
    sessionType === "extra"
      ? getExtraAttendanceSessionId(classroom._id, recordedAt)
      : getDailyAttendanceSessionId(classroom._id, recordedAt);
  const emailStatus = await runEmailWorkflow(() =>
    notifyAbsentStudents({
      classroom,
      rosterBundle,
      records: (draft.records ?? []).map((record) => ({
        sessionId,
        studentId: normalizeUserId(record.studentId),
        studentName: record.studentName,
        rollNumber: record.rollNumber,
        classId: String(classroom._id),
        className: classroom.subjectName,
        status: record.status,
        sessionType,
        recordedAt,
        notes:
          "Preliminary attendance notice. Contact your teacher quickly if this looks incorrect."
      }))
    })
  );

  await AttendanceDraft.updateOne(
    {
      _id: draft._id
    },
    {
      $set: {
        absenteeEmailSentAt: new Date()
      }
    }
  );

  return emailStatus;
}

async function createTodayAttendanceDraftFromAi({
  classroom,
  rosterBundle,
  recognition
}) {
  const createdAt = new Date();
  const dateKey = getLocalDateKey(createdAt);

  await AttendanceDraft.updateMany(
    {
      classId: classroom._id,
      teacherUserId: classroom.teacherUserId,
      dateKey,
      status: "draft"
    },
    {
      $set: {
        status: "finalized",
        finalizedAt: createdAt,
        finalizedMode: "auto",
        notes: "Replaced by a newer AI attendance draft before final submission."
      }
    }
  );

  const draft = await AttendanceDraft.create({
    classId: classroom._id,
    teacherUserId: classroom.teacherUserId,
    sourceSessionId: recognition.sessionId,
    dateKey,
    records: buildDraftRecordsFromAiRecognition({
      classroom,
      rosterBundle,
      recognition
    }),
    notes: "Created from classroom photo verification.",
    attendanceUnit: 1,
    sessionType: "regular",
    status: "draft",
    expiresAt: new Date(createdAt.getTime() + ATTENDANCE_DRAFT_TTL_MS)
  });

  return {
    draft: draft.toObject()
  };
}

async function finalizeAttendanceDraftRecord({
  classroom,
  rosterBundle,
  draft,
  statuses = {},
  notes = "",
  attendanceUnit = draft?.attendanceUnit ?? 1,
  sessionType = draft?.sessionType ?? "regular",
  mode = "teacher"
}) {
  if (!draft || draft.status !== "draft") {
    throw new Error("No open today attendance draft was found.");
  }

  const recordedAt = new Date();
  const normalizedAttendanceUnit = normalizeAttendanceUnit(attendanceUnit);
  const normalizedSessionType = normalizeSessionType(sessionType);
  const updatedRecords = applyDraftStatusUpdates(draft.records ?? [], statuses);
  const recordsByStudentId = new Map(
    updatedRecords.map((record) => [normalizeUserId(record.studentId), record])
  );
  const sessionId = getDailyAttendanceSessionId(classroom._id, recordedAt);
  const proposedRecords = rosterBundle.memberships.map((membership) => {
    const normalizedStudentId = normalizeUserId(membership.studentUserId);
    const user = rosterBundle.usersById.get(normalizedStudentId);
    const draftRecord = recordsByStudentId.get(normalizedStudentId);

    return getAttendanceRosterRecord({
      membership,
      user,
      classroom,
      status: draftRecord?.status ?? "absent",
      sessionId,
      recordedAt,
      notes: String(notes ?? draft.notes ?? "").trim(),
      source: draftRecord?.source === "teacher-edited" ? "teacher-confirmed" : "ai-auto",
      verificationMethod:
        draftRecord?.source === "teacher-edited"
          ? "teacher-confirmed"
          : "face-recognition",
      confidence: draftRecord?.confidence ?? null,
      attendanceUnit: normalizedAttendanceUnit,
      sessionType: normalizedSessionType
    });
  });
  const dailyAttendance = await mergeDailyAttendanceRecords({
    classroom,
    rosterBundle,
    proposedRecords,
    recordedAt,
    notes: String(notes ?? draft.notes ?? "").trim(),
    attendanceUnit: normalizedAttendanceUnit,
    sessionType: normalizedSessionType
  });

  await AttendanceDraft.updateOne(
    {
      _id: draft._id,
      status: "draft"
    },
    {
      $set: {
        records: updatedRecords,
        notes: String(notes ?? draft.notes ?? "").trim(),
        attendanceUnit: normalizedAttendanceUnit,
        sessionType: normalizedSessionType,
        status: "finalized",
        finalizedAt: recordedAt,
        finalizedMode: mode
      }
    }
  );

  const totalPresent = dailyAttendance.records.filter(
    (record) => record.status === "present"
  ).length;
  const totalLate = dailyAttendance.records.filter(
    (record) => record.status === "late"
  ).length;
  return {
    finalizedAttendance: {
      sessionId: dailyAttendance.sessionId,
      totalPresent: totalPresent + totalLate,
      totalAbsent: Math.max(0, dailyAttendance.records.length - totalPresent - totalLate),
      attendanceUnit: normalizedAttendanceUnit,
      sessionType: normalizedSessionType,
      finalizedAt: recordedAt.toISOString(),
      mode
    }
  };
}

async function finalizeExpiredAttendanceDrafts({ classroom, rosterBundle }) {
  const expiredDrafts = await AttendanceDraft.find({
    classId: classroom._id,
    teacherUserId: classroom.teacherUserId,
    status: "draft",
    expiresAt: { $lte: new Date() }
  }).lean();

  for (const draft of expiredDrafts) {
    await finalizeAttendanceDraftRecord({
      classroom,
      rosterBundle,
      draft,
      notes: draft.notes || "Auto-finalized after 12 hours.",
      mode: "auto"
    });
  }
}

export async function finalizeExpiredTeacherAttendanceDrafts() {
  const expiredDrafts = await AttendanceDraft.find({
    status: "draft",
    expiresAt: { $lte: new Date() }
  }).lean();
  let finalizedCount = 0;
  const errors = [];

  for (const draft of expiredDrafts) {
    try {
      const classroom = await Classroom.findOne({
        _id: draft.classId,
        status: "active"
      }).lean();

      if (!classroom) {
        await AttendanceDraft.updateOne(
          {
            _id: draft._id,
            status: "draft"
          },
          {
            $set: {
              status: "finalized",
              finalizedAt: new Date(),
              finalizedMode: "auto",
              notes:
                draft.notes ||
                "Auto-closed because the linked classroom is no longer active."
            }
          }
        );
        finalizedCount += 1;
        continue;
      }

      const rosterBundle = await getClassroomRosterBundle(classroom._id);

      await finalizeAttendanceDraftRecord({
        classroom,
        rosterBundle,
        draft,
        notes: draft.notes || "Auto-finalized after 12 hours.",
        mode: "auto"
      });
      finalizedCount += 1;
    } catch (error) {
      errors.push({
        draftId: String(draft._id),
        message:
          error instanceof Error
            ? error.message
            : "Unable to auto-finalize attendance draft."
      });
    }
  }

  return {
    checkedCount: expiredDrafts.length,
    finalizedCount,
    errors
  };
}

export async function submitTeacherManualAttendance({
  teacherUserId,
  classId,
  statuses,
  notes,
  attendanceUnit = 1,
  sessionType = "regular"
}) {
  const classroom = await getOwnedClassroom(teacherUserId, classId);
  assertClassroomActive(classroom);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);

  if (!rosterBundle.memberships.length) {
    throw new Error("Add students to this class before marking attendance.");
  }

  const normalizedStatuses = statuses && typeof statuses === "object" ? statuses : {};
  const recordedAt = new Date();
  const normalizedAttendanceUnit = normalizeAttendanceUnit(attendanceUnit);
  const normalizedSessionType = normalizeSessionType(sessionType);
  const sessionId = getDailyAttendanceSessionId(classroom._id, recordedAt);
  const attendanceRecords = rosterBundle.memberships.map((membership) => {
    const normalizedStudentUserId = normalizeUserId(membership.studentUserId);
    const rawStatus = String(normalizedStatuses[normalizedStudentUserId] ?? "absent")
      .trim()
      .toLowerCase();
    const status = ["present", "absent", "late"].includes(rawStatus)
      ? rawStatus
      : "absent";

    return getAttendanceRosterRecord({
      membership,
      user: rosterBundle.usersById.get(normalizedStudentUserId),
      classroom,
      status,
      sessionId,
      recordedAt,
      notes: String(notes ?? "").trim(),
      source: "manual",
      attendanceUnit: normalizedAttendanceUnit,
      sessionType: normalizedSessionType
    });
  });
  const dailyAttendance = await mergeDailyAttendanceRecords({
    classroom,
    rosterBundle,
    proposedRecords: attendanceRecords,
    recordedAt,
    notes: String(notes ?? "").trim(),
    attendanceUnit: normalizedAttendanceUnit,
    sessionType: normalizedSessionType
  });
  const totalPresent = dailyAttendance.records.filter(
    (record) => record.status === "present"
  ).length;
  const totalLate = dailyAttendance.records.filter(
    (record) => record.status === "late"
  ).length;
  const totalCountedPresent = totalPresent + totalLate;

  return {
    finalizedAttendance: {
      sessionId: dailyAttendance.sessionId,
      totalPresent: totalCountedPresent,
      totalAbsent: Math.max(0, dailyAttendance.records.length - totalCountedPresent),
      attendanceUnit: normalizedAttendanceUnit,
      sessionType: normalizedSessionType,
      finalizedAt: recordedAt.toISOString(),
      mode: "manual"
    },
    classroomDetails: await getTeacherClassroomDetails({ teacherUserId, classId })
  };
}

export async function cancelTeacherClassToday({
  teacherUserId,
  classId,
  reason
}) {
  const classroom = await getOwnedClassroom(teacherUserId, classId);
  assertClassroomActive(classroom);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);

  if (!rosterBundle.memberships.length) {
    throw new Error("Add students to this class before cancelling today's class.");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const existingCancellation = await AttendanceRecord.findOne({
    classId: String(classroom._id),
    status: "cancelled",
    recordedAt: {
      $gte: todayStart,
      $lt: tomorrowStart
    }
  }).lean();

  if (existingCancellation) {
    throw new Error("Today's class is already marked as cancelled.");
  }

  await QrAttendanceSession.updateMany(
    {
      classId: String(classroom._id),
      teacherUserId: classroom.teacherUserId,
      status: "active"
    },
    {
      $set: {
        status: "closed"
      }
    }
  );

  const recordedAt = new Date();
  const sessionId = getDailyAttendanceSessionId(classroom._id, recordedAt);
  const cancelNote =
    String(reason ?? "").trim() || "Class cancelled by teacher.";
  const attendanceRecords = rosterBundle.memberships.map((membership) => {
    const normalizedStudentUserId = normalizeUserId(membership.studentUserId);

    return getAttendanceRosterRecord({
      membership,
      user: rosterBundle.usersById.get(normalizedStudentUserId),
      classroom,
      status: "cancelled",
      sessionId,
      recordedAt,
      notes: cancelNote,
      source: "class-cancelled"
    });
  });
  const dailyAttendance = await mergeDailyAttendanceRecords({
    classroom,
    rosterBundle,
    proposedRecords: attendanceRecords,
    recordedAt,
    notes: cancelNote,
    forceStatus: "cancelled"
  });
  const cancelledSession = {
    sessionId: dailyAttendance.sessionId,
    totalStudents: dailyAttendance.records.length,
    cancelledAt: recordedAt.toISOString(),
    reason: cancelNote
  };
  const cancellationEmails = await runEmailWorkflow(() =>
    notifyClassCancellation({
      classroom,
      rosterBundle,
      cancellation: cancelledSession
    })
  );

  return {
    cancelledSession,
    emailStatus: {
      cancellationEmails
    },
    classroomDetails: await getTeacherClassroomDetails({ teacherUserId, classId })
  };
}

export async function createTeacherQrAttendanceSession({
  teacherUserId,
  classId
}) {
  const classroom = await getOwnedClassroom(teacherUserId, classId);
  assertClassroomActive(classroom);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);

  if (!rosterBundle.memberships.length) {
    throw new Error("Add students to this class before generating a QR code.");
  }

  const { dayStart, dayEnd } = getAttendanceDayWindow(new Date());
  const existingCancellation = await AttendanceRecord.findOne({
    classId: String(classroom._id),
    status: "cancelled",
    recordedAt: {
      $gte: dayStart,
      $lt: dayEnd
    }
  }).lean();

  if (existingCancellation) {
    throw new Error("Today's class is cancelled, so QR attendance cannot be generated.");
  }

  await QrAttendanceSession.updateMany(
    {
      classId: String(classroom._id),
      teacherUserId: classroom.teacherUserId,
      status: "active"
    },
    {
      $set: {
        status: "closed"
      }
    }
  );

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const qrSession = await QrAttendanceSession.create({
    token: crypto.randomBytes(24).toString("hex"),
    classId: String(classroom._id),
    teacherUserId: classroom.teacherUserId,
    expiresAt
  });

  return {
    token: qrSession.token,
    classId: String(classroom._id),
    subjectName: classroom.subjectName,
    subjectCode: classroom.subjectCode,
    expiresAt: expiresAt.toISOString()
  };
}

export async function markStudentQrAttendance({
  studentUserId,
  token
}) {
  const normalizedStudentUserId = normalizeUserId(studentUserId);
  const qrSession = await QrAttendanceSession.findOne({
    token: String(token ?? "").trim(),
    status: "active",
    expiresAt: {
      $gt: new Date()
    }
  }).lean();

  if (!qrSession) {
    throw new Error("This QR attendance code is invalid or expired.");
  }

  const classroom = await Classroom.findOne({
    _id: qrSession.classId,
    status: "active"
  });

  if (!classroom) {
    throw new Error("Classroom not found for this QR attendance code.");
  }

  const membership = await ClassMembership.findOne({
    classId: classroom._id,
    studentUserId: normalizedStudentUserId
  }).lean();

  if (!membership) {
    throw new Error("You are not added to this class roster.");
  }

  const rosterBundle = await getClassroomRosterBundle(classroom._id);
  const recordedAt = new Date();
  const sessionId = getDailyAttendanceSessionId(classroom._id, recordedAt);
  const proposedRecord = getAttendanceRosterRecord({
    membership,
    user: rosterBundle.usersById.get(normalizedStudentUserId),
    classroom,
    status: "present",
    sessionId,
    recordedAt,
    notes: "Marked present by student QR scan.",
    source: "manual"
  });
  const dailyAttendance = await mergeDailyAttendanceRecords({
    classroom,
    rosterBundle,
    proposedRecords: [proposedRecord],
    recordedAt,
    notes: "Marked present by student QR scan."
  });
  const totalPresent = dailyAttendance.records.filter(
    (record) => record.status === "present"
  ).length;
  const totalLate = dailyAttendance.records.filter(
    (record) => record.status === "late"
  ).length;

  return {
    message: "Attendance marked successfully.",
    classId: String(classroom._id),
    subjectName: classroom.subjectName,
    subjectCode: classroom.subjectCode,
    studentId: normalizedStudentUserId,
    markedAt: recordedAt.toISOString(),
    totalPresent: totalPresent + totalLate,
    totalStudents: dailyAttendance.records.length
  };
}

export async function processTeacherClassAttendance({
  teacherUserId,
  classId,
  images
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  assertClassroomActive(classroom);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);

  if (!rosterBundle.studentIds.length) {
    throw new Error(
      "Students need to join this class before attendance can be captured."
    );
  }

  const readyFaceProfileCount = rosterBundle.memberships.filter((membership) => {
    const normalizedStudentUserId = normalizeUserId(membership.studentUserId);
    return isCurrentFaceProfile(
      rosterBundle.faceProfilesById.get(normalizedStudentUserId)
    );
  }).length;

  if (!readyFaceProfileCount) {
    throw new Error(
      "At least one student needs a current face enrollment before AI attendance can run for this class."
    );
  }

  const validImages = validateClassroomCaptureImages(images);
  const aiHealth = await fetchAiHealth();
  if (aiHealth.ready === false) {
    throw new Error(buildAiReadinessMessage(aiHealth));
  }

  const sessionId = crypto.randomUUID();
  const recognition = await processClassroomAttendanceWithAi({
    sessionId,
    classId: String(classroom._id),
    teacherId: normalizedTeacherUserId,
    captureImages: validImages.map((image) => image.dataUrl),
    classRoster: rosterBundle.memberships.map((membership) => ({
      personId: normalizeUserId(membership.studentUserId),
      fullName: membership.studentName
    })),
    maxFaces: Math.min(100, Math.max(readyFaceProfileCount + 10, rosterBundle.studentIds.length))
  });
  const attendanceDraft = await createTodayAttendanceDraftFromAi({
    classroom,
    rosterBundle,
    recognition
  });

  return {
    session: recognition,
    captureImageCount: validImages.length,
    todayAttendanceDraft: sanitizeAttendanceDraft(attendanceDraft.draft),
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}

export async function updateTeacherTodayAttendanceDraft({
  teacherUserId,
  classId,
  draftId,
  statuses,
  notes,
  attendanceUnit,
  sessionType
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  assertClassroomActive(classroom);
  const draft = await AttendanceDraft.findOne({
    _id: draftId,
    classId: classroom._id,
    teacherUserId: normalizedTeacherUserId,
    status: "draft"
  });

  if (!draft) {
    throw new Error("No open today attendance draft was found.");
  }

  draft.records = applyDraftStatusUpdates(draft.records ?? [], statuses);
  draft.notes = String(notes ?? draft.notes ?? "").trim();
  if (attendanceUnit !== undefined) {
    draft.attendanceUnit = normalizeAttendanceUnit(attendanceUnit);
  }
  if (sessionType !== undefined) {
    draft.sessionType = normalizeSessionType(sessionType);
  }
  await draft.save();

  return {
    todayAttendanceDraft: sanitizeAttendanceDraft(draft.toObject()),
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}

export async function discardTeacherTodayAttendanceDraft({
  teacherUserId,
  classId,
  draftId
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  assertClassroomActive(classroom);
  const closedAt = new Date();
  const result = await AttendanceDraft.updateOne(
    {
      _id: draftId,
      classId: classroom._id,
      teacherUserId: normalizedTeacherUserId,
      status: "draft"
    },
    {
      $set: {
        status: "finalized",
        finalizedAt: closedAt,
        finalizedMode: "auto",
        notes: "Discarded by teacher before retaking attendance verification."
      }
    }
  );

  if (!result.matchedCount) {
    throw new Error("No open today attendance draft was found.");
  }

  return {
    discardedDraftId: String(draftId),
    discardedAt: closedAt.toISOString(),
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}

export async function sendTeacherTodayDraftAbsenteeEmails({
  teacherUserId,
  classId,
  draftId,
  statuses,
  notes,
  attendanceUnit,
  sessionType
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  assertClassroomActive(classroom);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);
  const draft = await AttendanceDraft.findOne({
    _id: draftId,
    classId: classroom._id,
    teacherUserId: normalizedTeacherUserId,
    status: "draft"
  });

  if (!draft) {
    throw new Error("No open today attendance draft was found.");
  }

  draft.records = applyDraftStatusUpdates(draft.records ?? [], statuses);
  draft.notes = String(notes ?? draft.notes ?? "").trim();
  if (attendanceUnit !== undefined) {
    draft.attendanceUnit = normalizeAttendanceUnit(attendanceUnit);
  }
  if (sessionType !== undefined) {
    draft.sessionType = normalizeSessionType(sessionType);
  }
  await draft.save();

  const emailStatus = await sendDraftAbsenteeEmails({
    classroom,
    rosterBundle,
    draft: draft.toObject()
  });
  const updatedDraft = await AttendanceDraft.findById(draft._id).lean();

  return {
    emailStatus: {
      absenteeNotifications: emailStatus
    },
    todayAttendanceDraft: sanitizeAttendanceDraft(updatedDraft),
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}

export async function finalizeTeacherTodayAttendanceDraft({
  teacherUserId,
  classId,
  draftId,
  statuses,
  notes,
  attendanceUnit,
  sessionType
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  assertClassroomActive(classroom);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);
  const draft = await AttendanceDraft.findOne({
    _id: draftId,
    classId: classroom._id,
    teacherUserId: normalizedTeacherUserId,
    status: "draft"
  }).lean();
  const result = await finalizeAttendanceDraftRecord({
    classroom,
    rosterBundle,
    draft,
    statuses,
    notes,
    attendanceUnit: attendanceUnit ?? draft?.attendanceUnit ?? 1,
    sessionType: sessionType ?? draft?.sessionType ?? "regular",
    mode: "teacher"
  });

  return {
    ...result,
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}

export async function sendTeacherAttendanceAbsenteeEmails({
  teacherUserId,
  classId,
  sessionId = ""
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  assertClassroomActive(classroom);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);
  const normalizedSessionId = String(sessionId ?? "").trim();
  const recordQuery = {
    classId: String(classroom._id)
  };

  if (normalizedSessionId) {
    recordQuery.sessionId = normalizedSessionId;
  } else {
    const { dayStart, dayEnd } = getAttendanceDayWindow(new Date());
    recordQuery.recordedAt = {
      $gte: dayStart,
      $lt: dayEnd
    };
  }

  const attendanceRecords = await AttendanceRecord.find(recordQuery).lean();
  const absentNotifications = await runEmailWorkflow(() =>
    notifyAbsentStudents({
      classroom,
      rosterBundle,
      records: attendanceRecords
    })
  );

  return {
    emailStatus: {
      absentNotifications
    },
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}

export async function updateTeacherSessionAttendanceRecord({
  teacherUserId,
  classId,
  sessionId,
  studentUserId,
  status
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  const normalizedSessionId = String(sessionId ?? "").trim();
  const normalizedStudentUserId = normalizeUserId(studentUserId);
  const normalizedStatus = normalizeEditableAttendanceStatus(status);

  if (!normalizedSessionId) {
    throw new Error("A session ID is required to update attendance.");
  }

  if (!normalizedStudentUserId) {
    throw new Error("A student ID is required to update attendance.");
  }

  const membership = await ClassMembership.findOne({
    classId: classroom._id,
    studentUserId: normalizedStudentUserId
  }).lean();

  if (!membership) {
    throw new Error("This student is not in the class roster.");
  }

  const updatedRecord = await AttendanceRecord.findOneAndUpdate(
    {
      classId: String(classroom._id),
      sessionId: normalizedSessionId,
      studentId: normalizedStudentUserId
    },
    {
      $set: {
        status: normalizedStatus,
        studentName: membership.studentName,
        source: "teacher-confirmed",
        verificationMethod: "teacher-confirmed",
        notes: "Attendance corrected by teacher from recent sessions."
      }
    },
    {
      new: true
    }
  ).lean();

  if (!updatedRecord) {
    throw new Error("Attendance record not found for this session.");
  }

  return {
    attendanceRecord: {
      sessionId: updatedRecord.sessionId,
      studentUserId: normalizeUserId(updatedRecord.studentId),
      studentName: updatedRecord.studentName,
      rollNumber: updatedRecord.rollNumber ?? "",
      status: updatedRecord.status,
      statusLabel: formatAttendanceStatusLabel(updatedRecord.status),
      recordedAt: updatedRecord.recordedAt ?? updatedRecord.createdAt
    },
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}

export async function sendTeacherExamAttendanceWarningEmails({
  teacherUserId,
  classId
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  assertClassroomActive(classroom);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);
  const examWarnings = await runEmailWorkflow(() =>
    notifyExamAttendanceWarnings({
      classroom,
      rosterBundle
    })
  );

  return {
    emailStatus: {
      examWarnings
    },
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}

export async function finalizeTeacherClassAttendance({
  teacherUserId,
  classId,
  sessionId,
  confirmedPresentIds,
  manuallyAddedPresentIds,
  rejectedTrackIds,
  notes,
  attendanceUnit = 1,
  sessionType = "regular"
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  assertClassroomActive(classroom);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);
  const rosterById = new Map(
    rosterBundle.memberships.map((membership) => [
      normalizeUserId(membership.studentUserId),
      membership
    ])
  );
  const finalizedAttendance = await finalizeClassroomAttendanceWithAi({
    sessionId,
    classId: String(classroom._id),
    teacherId: normalizedTeacherUserId,
    confirmedPresentIds: (confirmedPresentIds ?? []).map(normalizeUserId),
    manuallyAddedPresentIds: (manuallyAddedPresentIds ?? []).map(normalizeUserId),
    rejectedTrackIds: (rejectedTrackIds ?? []).map((trackId) => String(trackId)),
    notes
  });

  const recordedAt = new Date(finalizedAttendance.finalizedAt ?? Date.now());
  const normalizedAttendanceUnit = normalizeAttendanceUnit(attendanceUnit);
  const normalizedSessionType = normalizeSessionType(sessionType);
  const proposedRecords = finalizedAttendance.records.map((record) => {
    const normalizedStudentId = normalizeUserId(record.personId);
    const membership = rosterById.get(normalizedStudentId);

    return {
      sessionId: getDailyAttendanceSessionId(classroom._id, recordedAt),
      teacherUserId: normalizedTeacherUserId,
      studentId: normalizedStudentId,
      studentName: membership?.studentName ?? normalizedStudentId,
      rollNumber: resolveRollNumber(
        membership ?? {
          studentUserId: normalizedStudentId,
          rollNumber: normalizedStudentId
        },
        rosterBundle.usersById.get(normalizedStudentId)
      ),
      classId: String(classroom._id),
      className: `${classroom.subjectCode} ${classroom.section}`.trim(),
      status: record.status,
      verificationMethod: mapAttendanceSourceToVerificationMethod(record.source),
      source: record.source,
      confidence: record.confidence ?? null,
      attendanceUnit: normalizedAttendanceUnit,
      sessionType: normalizedSessionType,
      recordedAt,
      notes: String(notes ?? "").trim()
    };
  });
  const dailyAttendance = await mergeDailyAttendanceRecords({
    classroom,
    rosterBundle,
    proposedRecords,
    recordedAt,
    notes: String(notes ?? "").trim(),
    attendanceUnit: normalizedAttendanceUnit,
    sessionType: normalizedSessionType
  });
  const totalPresent = dailyAttendance.records.filter(
    (record) => record.status === "present"
  ).length;
  const totalLate = dailyAttendance.records.filter(
    (record) => record.status === "late"
  ).length;
  const totalCountedPresent = totalPresent + totalLate;

  return {
    finalizedAttendance: {
      ...finalizedAttendance,
      sessionId: dailyAttendance.sessionId,
      totalPresent: totalCountedPresent,
      totalAbsent: Math.max(0, dailyAttendance.records.length - totalCountedPresent),
      attendanceUnit: normalizedAttendanceUnit,
      sessionType: normalizedSessionType,
      finalizedAt: recordedAt.toISOString()
    },
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}
