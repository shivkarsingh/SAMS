import { AttendanceRecord } from "../models/AttendanceRecord.js";

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeUserId(userId) {
  return String(userId).trim().toUpperCase();
}

function getSessionIdentifier(record) {
  if (record.sessionId) {
    return String(record.sessionId);
  }

  const timestamp = record.recordedAt ?? record.createdAt ?? new Date().toISOString();
  return `legacy-${String(record.classId)}-${new Date(timestamp).toISOString().slice(0, 10)}`;
}

function getRecordTimestamp(record) {
  return new Date(record.recordedAt ?? record.createdAt ?? Date.now());
}

export function summarizeAttendanceRecords(records, rosterStudentIds = []) {
  const normalizedRosterIds = Array.from(
    new Set(rosterStudentIds.map((studentId) => normalizeUserId(studentId)))
  );
  const studentStatsById = new Map(
    normalizedRosterIds.map((studentId) => [
      studentId,
      {
        studentId,
        presentCount: 0,
        totalCount: 0,
        attendancePercentage: 0,
        lastStatus: "not-recorded",
        lastMarkedAt: null
      }
    ])
  );
  const sessionsById = new Map();
  const sortedRecords = [...records].sort(
    (left, right) => getRecordTimestamp(left) - getRecordTimestamp(right)
  );

  sortedRecords.forEach((record) => {
    const timestamp = getRecordTimestamp(record);
    const sessionId = getSessionIdentifier(record);
    const normalizedStudentId = normalizeUserId(record.studentId);

    const sessionRecord = sessionsById.get(sessionId) ?? {
      sessionId,
      recordedAt: timestamp.toISOString(),
      presentCount: 0,
      absentCount: 0
    };

    sessionRecord.recordedAt = timestamp.toISOString();
    if (record.status === "present") {
      sessionRecord.presentCount += 1;
    } else {
      sessionRecord.absentCount += 1;
    }
    sessionsById.set(sessionId, sessionRecord);

    if (!studentStatsById.has(normalizedStudentId)) {
      return;
    }

    const currentStats = studentStatsById.get(normalizedStudentId);
    currentStats.totalCount += 1;
    if (record.status === "present") {
      currentStats.presentCount += 1;
    }
    currentStats.attendancePercentage = currentStats.totalCount
      ? clampPercentage((currentStats.presentCount / currentStats.totalCount) * 100)
      : 0;
    currentStats.lastStatus = record.status;
    currentStats.lastMarkedAt = timestamp.toISOString();
  });

  const studentStats = normalizedRosterIds.map(
    (studentId) =>
      studentStatsById.get(studentId) ?? {
        studentId,
        presentCount: 0,
        totalCount: 0,
        attendancePercentage: 0,
        lastStatus: "not-recorded",
        lastMarkedAt: null
      }
  );
  const recentSessions = Array.from(sessionsById.values())
    .sort(
      (left, right) => new Date(right.recordedAt) - new Date(left.recordedAt)
    )
    .slice(0, 5);
  const studentsWithRecordedAttendance = studentStats.filter(
    (student) => student.totalCount > 0
  );
  const averageAttendance = studentsWithRecordedAttendance.length
    ? clampPercentage(
        studentsWithRecordedAttendance.reduce(
          (total, currentStudent) => total + currentStudent.attendancePercentage,
          0
        ) / studentsWithRecordedAttendance.length
      )
    : 0;

  return {
    averageAttendance,
    totalSessions: sessionsById.size,
    flaggedStudents: studentStats.filter(
      (student) =>
        student.totalCount > 0 && student.attendancePercentage < 75
    ).length,
    latestSession: recentSessions[0] ?? null,
    recentSessions,
    studentStatsById
  };
}

export async function getAttendanceSummariesByClass(
  classIds,
  rosterStudentIdsByClass
) {
  const normalizedClassIds = Array.from(
    new Set((classIds ?? []).map((classId) => String(classId)))
  );

  if (!normalizedClassIds.length) {
    return new Map();
  }

  const attendanceRecords = await AttendanceRecord.find({
    classId: { $in: normalizedClassIds }
  }).lean();
  const recordsByClassId = new Map();

  attendanceRecords.forEach((record) => {
    const classId = String(record.classId);
    const currentRecords = recordsByClassId.get(classId) ?? [];
    currentRecords.push(record);
    recordsByClassId.set(classId, currentRecords);
  });

  return new Map(
    normalizedClassIds.map((classId) => [
      classId,
      summarizeAttendanceRecords(
        recordsByClassId.get(classId) ?? [],
        rosterStudentIdsByClass.get(classId) ?? []
      )
    ])
  );
}
