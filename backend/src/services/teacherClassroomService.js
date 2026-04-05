import crypto from "crypto";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { ClassMembership } from "../models/ClassMembership.js";
import { Classroom } from "../models/Classroom.js";
import { FaceProfile } from "../models/FaceProfile.js";
import { User } from "../models/User.js";
import {
  getAttendanceSummariesByClass,
  summarizeAttendanceRecords
} from "./attendanceAnalyticsService.js";
import {
  finalizeClassroomAttendanceWithAi,
  processClassroomAttendanceWithAi
} from "./aiService.js";

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeUserId(userId) {
  return String(userId).trim().toUpperCase();
}

function formatAttendanceStatusLabel(status) {
  if (status === "not-recorded") {
    return "Not Recorded";
  }

  const normalizedStatus = String(status ?? "").trim();

  if (!normalizedStatus) {
    return "Not Recorded";
  }

  return `${normalizedStatus.charAt(0).toUpperCase()}${normalizedStatus.slice(1)}`;
}

function sanitizeClassroom(classroom, attendanceSummary, studentsCount) {
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
    scheduleSummary: classroom.scheduleSummary,
    joinCode: classroom.joinCode,
    joinLink: classroom.joinLink,
    status: classroom.status,
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

function buildAttendanceHistory(attendanceSummary) {
  return attendanceSummary.recentSessions.map((session) => ({
    sessionId: session.sessionId,
    recordedAt: session.recordedAt,
    presentCount: session.presentCount,
    absentCount: session.absentCount
  }));
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
  classroomFallbackBatch = ""
) {
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
      batch: user?.batch ?? classroomFallbackBatch ?? "",
      department: user?.department ?? "",
      email: user?.email ?? "",
      joinedAt: membership.createdAt,
      faceProfileStatus: faceProfile?.status ?? "not-started",
      faceQualityScore: clampPercentage(
        (faceProfile?.averageQualityScore ?? 0) * 100
      ),
      enrolledImageCount: faceProfile?.uploadedImageCount ?? 0,
      sessionsAttended: attendanceStats.presentCount,
      sessionsHeld: attendanceStats.totalCount,
      attendancePercentage: attendanceStats.attendancePercentage,
      latestStatus: formatAttendanceStatusLabel(attendanceStats.lastStatus),
      lastMarkedAt: attendanceStats.lastMarkedAt
    };
  });
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

export async function getTeacherClassroomDetails({ teacherUserId, classId }) {
  const classroom = await getOwnedClassroom(teacherUserId, classId);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);
  const attendanceSummary =
    (
      await getAttendanceSummariesByClass(
        [String(classroom._id)],
        new Map([[String(classroom._id), rosterBundle.studentIds]])
      )
    ).get(String(classroom._id)) ??
    summarizeAttendanceRecords([], rosterBundle.studentIds);
  const roster = buildRoster(
    rosterBundle,
    attendanceSummary,
    classroom.batch
  );

  return {
    classroom: sanitizeClassroom(
      classroom,
      attendanceSummary,
      rosterBundle.studentIds.length
    ),
    overview: buildOverview(roster, attendanceSummary),
    roster,
    attendanceHistory: buildAttendanceHistory(attendanceSummary),
    attentionNotes: [
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

export async function processTeacherClassAttendance({
  teacherUserId,
  classId,
  images
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
  const rosterBundle = await getClassroomRosterBundle(classroom._id);

  if (!rosterBundle.studentIds.length) {
    throw new Error(
      "Students need to join this class before attendance can be captured."
    );
  }

  const validImages = (Array.isArray(images) ? images : []).filter(
    (image) =>
      image &&
      typeof image.fileName === "string" &&
      typeof image.dataUrl === "string" &&
      image.dataUrl.startsWith("data:image/")
  );

  if (!validImages.length) {
    throw new Error("Upload at least one classroom capture image to continue.");
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
    }))
  });

  return {
    session: recognition,
    captureImageCount: validImages.length
  };
}

export async function finalizeTeacherClassAttendance({
  teacherUserId,
  classId,
  sessionId,
  confirmedPresentIds,
  manuallyAddedPresentIds,
  rejectedTrackIds,
  notes
}) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await getOwnedClassroom(normalizedTeacherUserId, classId);
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

  await AttendanceRecord.deleteMany({
    sessionId: finalizedAttendance.sessionId
  });
  await AttendanceRecord.insertMany(
    finalizedAttendance.records.map((record) => {
      const normalizedStudentId = normalizeUserId(record.personId);
      const membership = rosterById.get(normalizedStudentId);

      return {
        sessionId: finalizedAttendance.sessionId,
        teacherUserId: normalizedTeacherUserId,
        studentId: normalizedStudentId,
        studentName: membership?.studentName ?? normalizedStudentId,
        classId: String(classroom._id),
        className: `${classroom.subjectCode} ${classroom.section}`.trim(),
        status: record.status,
        verificationMethod: mapAttendanceSourceToVerificationMethod(record.source),
        source: record.source,
        confidence: null,
        recordedAt: finalizedAttendance.finalizedAt
      };
    })
  );

  return {
    finalizedAttendance,
    classroomDetails: await getTeacherClassroomDetails({
      teacherUserId: normalizedTeacherUserId,
      classId: String(classroom._id)
    })
  };
}
