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

function getLocalDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isAttendedStatus(status) {
  return status === "present" || status === "late";
}

function getAttendanceStatus(record) {
  const status = String(record?.status ?? "").trim().toLowerCase();

  if (["present", "absent", "late", "cancelled"].includes(status)) {
    return status;
  }

  return "absent";
}

function getAttendanceUnit(record) {
  const numericUnit = Number(record?.attendanceUnit ?? 1);

  if (!Number.isFinite(numericUnit) || numericUnit < 1) {
    return 1;
  }

  return Math.max(1, Math.round(numericUnit));
}

function getSessionType(record) {
  return record?.sessionType === "extra" ? "extra" : "regular";
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
        presentSessions: 0,
        totalSessions: 0,
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
    const status = getAttendanceStatus(record);
    const attendanceUnit = getAttendanceUnit(record);
    const sessionType = getSessionType(record);

    const sessionRecord = sessionsById.get(sessionId) ?? {
      sessionId,
      recordedAt: timestamp.toISOString(),
      presentCount: 0,
      absentCount: 0,
      cancelledCount: 0,
      attendanceUnit,
      presentUnits: 0,
      absentUnits: 0,
      sessionType,
      records: []
    };

    sessionRecord.recordedAt = timestamp.toISOString();
    sessionRecord.sessionType =
      sessionRecord.sessionType === "extra" || sessionType === "extra"
        ? "extra"
        : "regular";
    sessionRecord.attendanceUnit = Math.max(
      Number(sessionRecord.attendanceUnit ?? 1),
      attendanceUnit
    );
    sessionRecord.records.push({
      studentId: normalizedStudentId,
      studentName: record.studentName ?? "",
      rollNumber: record.rollNumber ?? "",
      status,
      verificationMethod: record.verificationMethod ?? "",
      source: record.source ?? "",
      confidence: record.confidence ?? null,
      attendanceUnit,
      sessionType,
      recordedAt: timestamp.toISOString(),
      notes: record.notes ?? ""
    });

    if (isAttendedStatus(status)) {
      sessionRecord.presentCount += 1;
      sessionRecord.presentUnits += attendanceUnit;
    } else if (status === "cancelled") {
      sessionRecord.cancelledCount += 1;
    } else {
      sessionRecord.absentCount += 1;
      sessionRecord.absentUnits += attendanceUnit;
    }
    sessionsById.set(sessionId, sessionRecord);

    if (!studentStatsById.has(normalizedStudentId)) {
      return;
    }

    const currentStats = studentStatsById.get(normalizedStudentId);
    if (status === "cancelled") {
      currentStats.lastStatus = status;
      currentStats.lastMarkedAt = timestamp.toISOString();
      return;
    }

    currentStats.totalCount += attendanceUnit;
    currentStats.totalSessions += 1;
    if (isAttendedStatus(status)) {
      currentStats.presentCount += attendanceUnit;
      currentStats.presentSessions += 1;
    }
    currentStats.attendancePercentage = currentStats.totalCount
      ? clampPercentage((currentStats.presentCount / currentStats.totalCount) * 100)
      : 0;
    currentStats.lastStatus = status;
    currentStats.lastMarkedAt = timestamp.toISOString();
  });

  const studentStats = normalizedRosterIds.map(
    (studentId) =>
      studentStatsById.get(studentId) ?? {
        studentId,
        presentCount: 0,
        totalCount: 0,
        presentSessions: 0,
        totalSessions: 0,
        attendancePercentage: 0,
        lastStatus: "not-recorded",
        lastMarkedAt: null
      }
  );
  const sessions = Array.from(sessionsById.values());
  const attendanceSessionDateKeys = Array.from(
    new Set(sessions.map((session) => getLocalDateKey(session.recordedAt)))
  ).sort();
  const classTakenDateKeys = Array.from(
    new Set(
      sessions
        .filter((session) => session.presentCount > 0 || session.absentCount > 0)
        .map((session) => getLocalDateKey(session.recordedAt))
    )
  ).sort();
  const cancelledDateKeys = Array.from(
    new Set(
      sessions
        .filter(
          (session) =>
            session.cancelledCount > 0 &&
            session.presentCount === 0 &&
            session.absentCount === 0
        )
        .map((session) => getLocalDateKey(session.recordedAt))
    )
  ).sort();
  const recentSessions = sessions
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
    attendanceSessionDateKeys,
    classTakenDateKeys,
    cancelledDateKeys,
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
