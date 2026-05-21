import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAttendanceRecords } from "../src/services/attendanceAnalyticsService.js";

test("includes student records in recent attendance sessions", () => {
  const summary = summarizeAttendanceRecords(
    [
      {
        sessionId: "session-1",
        classId: "class-1",
        studentId: "s-001",
        studentName: "Asha Rao",
        rollNumber: "1",
        status: "present",
        attendanceUnit: 1,
        sessionType: "regular",
        recordedAt: "2026-05-20T04:30:00.000Z"
      },
      {
        sessionId: "session-1",
        classId: "class-1",
        studentId: "s-002",
        studentName: "Dev Singh",
        rollNumber: "2",
        status: "absent",
        attendanceUnit: 1,
        sessionType: "regular",
        recordedAt: "2026-05-20T04:30:01.000Z"
      }
    ],
    ["s-001", "s-002"]
  );

  assert.equal(summary.recentSessions.length, 1);
  assert.deepEqual(summary.attendanceSessionDateKeys, ["2026-05-20"]);
  assert.deepEqual(summary.classTakenDateKeys, ["2026-05-20"]);
  assert.deepEqual(summary.cancelledDateKeys, []);
  assert.deepEqual(
    summary.recentSessions[0].records.map((record) => ({
      studentId: record.studentId,
      studentName: record.studentName,
      rollNumber: record.rollNumber,
      status: record.status
    })),
    [
      {
        studentId: "S-001",
        studentName: "Asha Rao",
        rollNumber: "1",
        status: "present"
      },
      {
        studentId: "S-002",
        studentName: "Dev Singh",
        rollNumber: "2",
        status: "absent"
      }
    ]
  );
});

test("separates cancelled attendance days from class-taken days", () => {
  const summary = summarizeAttendanceRecords(
    [
      {
        sessionId: "session-cancelled",
        classId: "class-1",
        studentId: "s-001",
        studentName: "Asha Rao",
        rollNumber: "1",
        status: "cancelled",
        recordedAt: "2026-05-21T04:30:00.000Z"
      },
      {
        sessionId: "session-cancelled",
        classId: "class-1",
        studentId: "s-002",
        studentName: "Dev Singh",
        rollNumber: "2",
        status: "cancelled",
        recordedAt: "2026-05-21T04:30:01.000Z"
      }
    ],
    ["s-001", "s-002"]
  );

  assert.deepEqual(summary.attendanceSessionDateKeys, ["2026-05-21"]);
  assert.deepEqual(summary.classTakenDateKeys, []);
  assert.deepEqual(summary.cancelledDateKeys, ["2026-05-21"]);
});
