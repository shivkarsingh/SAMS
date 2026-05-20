import { ClassMembership } from "../models/ClassMembership.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { ClassExam } from "../models/ClassExam.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { User } from "../models/User.js";
import {
  getAttendanceSummariesByClass,
  summarizeAttendanceRecords
} from "./attendanceAnalyticsService.js";
import { getStudentJoinedClasses } from "./classroomService.js";
import { getFaceProfile } from "./faceProfileService.js";
import {
  buildStudentExamSummary,
  sortUpcomingExams
} from "./examScheduleService.js";
import { sanitizeLeaveRequests } from "./leaveRequestService.js";
import {
  getCurrentScheduleDayId,
  scheduleDays
} from "../utils/schedule.js";

const SAFE_ATTENDANCE_PERCENTAGE = 75;

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDateLabel(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatAttendanceStatus(status) {
  const normalizedStatus = String(status ?? "").trim();

  if (!normalizedStatus || normalizedStatus === "not-recorded") {
    return "Not recorded";
  }

  return `${normalizedStatus.charAt(0).toUpperCase()}${normalizedStatus.slice(1)}`;
}

function getAttendanceTone(status) {
  if (status === "present" || status === "late") {
    return "positive";
  }

  if (status === "absent") {
    return "danger";
  }

  return "neutral";
}

function getAttendanceRecordTimestamp(record) {
  return new Date(record.recordedAt ?? record.createdAt ?? Date.now());
}

function formatStudentAttendanceRecord(record) {
  const timestamp = getAttendanceRecordTimestamp(record);

  return {
    id: record._id ? String(record._id) : `${record.classId}-${timestamp.toISOString()}`,
    sessionId: record.sessionId ?? "",
    classId: String(record.classId),
    status: record.status,
    statusLabel: formatAttendanceStatus(record.status),
    statusTone: getAttendanceTone(record.status),
    recordedAt: timestamp.toISOString(),
    recordedLabel: formatDateLabel(timestamp),
    verificationMethod: record.verificationMethod ?? "manual",
    source: record.source ?? "",
    confidence: record.confidence ?? null,
    notes: record.notes ?? ""
  };
}

function getClassStatus(percentage, total) {
  if (!total) {
    return {
      label: "No records yet",
      tone: "neutral"
    };
  }

  if (percentage < SAFE_ATTENDANCE_PERCENTAGE) {
    return {
      label: "Below range",
      tone: "danger"
    };
  }

  if (percentage < 85) {
    return {
      label: "Needs care",
      tone: "warning"
    };
  }

  return {
    label: "Healthy",
    tone: "positive"
  };
}

function getClassesNeededForSafeRange(attended, total) {
  if (!total || total && (attended / total) * 100 >= SAFE_ATTENDANCE_PERCENTAGE) {
    return 0;
  }

  const threshold = SAFE_ATTENDANCE_PERCENTAGE / 100;

  return Math.max(0, Math.ceil((threshold * total - attended) / (1 - threshold)));
}

function getSafeMissesAvailable(attended, total) {
  if (!total || (attended / total) * 100 < SAFE_ATTENDANCE_PERCENTAGE) {
    return 0;
  }

  const threshold = SAFE_ATTENDANCE_PERCENTAGE / 100;

  return Math.max(0, Math.floor(attended / threshold - total));
}

function projectAfterNext(attended, total, willAttend) {
  const nextAttended = willAttend ? attended + 1 : attended;
  const nextTotal = total + 1;

  return clampPercentage((nextAttended / nextTotal) * 100);
}

function getNextScheduleSlot(joinedClass) {
  const todayId = getCurrentScheduleDayId();
  const todaysSlots = (joinedClass.scheduleSlots ?? [])
    .filter((slot) => slot.day === todayId)
    .sort((left, right) => left.startTime.localeCompare(right.startTime));

  return todaysSlots[0] ?? (joinedClass.scheduleSlots ?? [])[0] ?? null;
}

function buildClassPerformance(
  joinedClasses,
  summariesByClass,
  studentUserId,
  attendanceRecords = [],
  leaveRequests = [],
  examRecords = []
) {
  const normalizedStudentUserId = String(studentUserId).trim().toUpperCase();
  const recordsByClassId = new Map();
  const leaveRequestsByClassId = new Map();
  const examsByClassId = new Map(
    examRecords.map((exam) => [String(exam.classId), exam])
  );

  attendanceRecords.forEach((record) => {
    const classId = String(record.classId);
    const currentRecords = recordsByClassId.get(classId) ?? [];
    currentRecords.push(record);
    recordsByClassId.set(classId, currentRecords);
  });

  leaveRequests.forEach((request) => {
    const classId = String(request.classId);
    const currentRequests = leaveRequestsByClassId.get(classId) ?? [];
    currentRequests.push(request);
    leaveRequestsByClassId.set(classId, currentRequests);
  });

  return joinedClasses.map((joinedClass) => {
    const attendanceSummary =
      summariesByClass.get(String(joinedClass.id)) ??
      summarizeAttendanceRecords([], [normalizedStudentUserId]);
    const studentStats =
      attendanceSummary.studentStatsById.get(normalizedStudentUserId) ?? {
        presentCount: 0,
        totalCount: 0,
        attendancePercentage: 0,
        lastStatus: "not-recorded",
        lastMarkedAt: null
    };
    const attended = studentStats.presentCount;
    const total = studentStats.totalCount;
    const absent = Math.max(0, total - attended);
    const studentPercentage = studentStats.attendancePercentage;
    const status = getClassStatus(studentPercentage, total);
    const nextSlot = getNextScheduleSlot(joinedClass);
    const classRecords = (recordsByClassId.get(String(joinedClass.id)) ?? [])
      .slice()
      .sort(
        (left, right) =>
          getAttendanceRecordTimestamp(right) - getAttendanceRecordTimestamp(left)
      );
    const classLeaveRequests = (leaveRequestsByClassId.get(String(joinedClass.id)) ?? [])
      .slice()
      .sort(
        (left, right) =>
          new Date(right.submittedAt ?? right.createdAt) -
          new Date(left.submittedAt ?? left.createdAt)
      );
    const upcomingExam = buildStudentExamSummary({
      exam: examsByClassId.get(String(joinedClass.id)),
      classroom: joinedClass,
      studentStats
    });

    return {
      id: joinedClass.id,
      code: joinedClass.subjectCode,
      title: joinedClass.subjectName,
      faculty: joinedClass.teacherName,
      attended,
      absent,
      total,
      studentPercentage,
      classAverage: attendanceSummary.averageAttendance,
      room: joinedClass.room || "Room update pending",
      nextClass: joinedClass.scheduleSummary || "Schedule to be announced",
      scheduleSlots: joinedClass.scheduleSlots ?? [],
      joinCode: joinedClass.joinCode,
      lastStatus: formatAttendanceStatus(studentStats.lastStatus),
      lastMarkedAt: studentStats.lastMarkedAt,
      lastMarkedLabel: formatDateLabel(studentStats.lastMarkedAt),
      statusLabel: status.label,
      statusTone: status.tone,
      classesNeededForSafeRange: getClassesNeededForSafeRange(attended, total),
      safeMissesAvailable: getSafeMissesAvailable(attended, total),
      projectedAfterPresent: total ? projectAfterNext(attended, total, true) : 100,
      projectedAfterAbsent: total ? projectAfterNext(attended, total, false) : 0,
      recentAttendance: classRecords.map(formatStudentAttendanceRecord).slice(0, 8),
      leaveRequests: sanitizeLeaveRequests(classLeaveRequests),
      upcomingExam,
      nextSlot: nextSlot
        ? {
            day: nextSlot.shortDayLabel,
            time: nextSlot.timeLabel
          }
        : null
    };
  });
}

function buildAttendanceTrend(records, studentUserId) {
  const normalizedStudentUserId = String(studentUserId).trim().toUpperCase();
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_item, index) => {
    const bucketEnd = new Date(now);
    bucketEnd.setDate(now.getDate() - (5 - index) * 7);
    const bucketStart = new Date(bucketEnd);
    bucketStart.setDate(bucketEnd.getDate() - 6);

    return {
      label: `W${index + 1}`,
      start: bucketStart,
      end: bucketEnd,
      attended: 0,
      total: 0
    };
  });

  records
    .filter(
      (record) =>
        String(record.studentId).trim().toUpperCase() === normalizedStudentUserId &&
        record.status !== "cancelled"
    )
    .forEach((record) => {
      const recordedAt = new Date(record.recordedAt ?? record.createdAt ?? Date.now());
      const bucket = buckets.find(
        (currentBucket) =>
          recordedAt >= currentBucket.start && recordedAt <= currentBucket.end
      );

      if (!bucket) {
        return;
      }

      bucket.total += 1;

      if (record.status === "present" || record.status === "late") {
        bucket.attended += 1;
      }
    });

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: bucket.total
      ? clampPercentage((bucket.attended / bucket.total) * 100)
      : 0,
    sessions: bucket.total
  }));
}

function buildComparison(classPerformance) {
  const recordedClasses = classPerformance.filter((course) => course.total > 0);
  const weightedAttended = recordedClasses.reduce(
    (total, course) => total + course.attended,
    0
  );
  const weightedTotal = recordedClasses.reduce(
    (total, course) => total + course.total,
    0
  );
  const overallAttendance = weightedTotal
    ? clampPercentage((weightedAttended / weightedTotal) * 100)
    : 0;
  const classAverage = recordedClasses.length
    ? clampPercentage(
        recordedClasses.reduce((total, course) => total + course.classAverage, 0) /
          recordedClasses.length
      )
    : 0;
  const bestClass = recordedClasses.length
    ? Math.max(...recordedClasses.map((course) => course.studentPercentage))
    : 0;
  const weakestClass = recordedClasses.length
    ? Math.min(...recordedClasses.map((course) => course.studentPercentage))
    : 0;

  return {
    overallAttendance,
    items: [
      { label: "You", value: overallAttendance },
      { label: "Class Avg", value: classAverage },
      { label: "Best Subject", value: bestClass },
      { label: "Lowest Subject", value: weakestClass }
    ]
  };
}

function buildRecoveryPlan(classPerformance) {
  return [...classPerformance]
    .sort((left, right) => {
      if (left.total === 0 && right.total > 0) {
        return -1;
      }

      if (right.total === 0 && left.total > 0) {
        return 1;
      }

      return (
        right.classesNeededForSafeRange - left.classesNeededForSafeRange ||
        left.studentPercentage - right.studentPercentage
      );
    })
    .slice(0, 4)
    .map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      percentage: course.studentPercentage,
      statusLabel: course.statusLabel,
      statusTone: course.statusTone,
      action:
        course.total === 0
          ? "Attend the first recorded session to start this subject cleanly."
          : course.classesNeededForSafeRange > 0
            ? `Attend the next ${course.classesNeededForSafeRange} class${course.classesNeededForSafeRange === 1 ? "" : "es"} to reach ${SAFE_ATTENDANCE_PERCENTAGE}%.`
            : course.safeMissesAvailable > 0
              ? `You can miss ${course.safeMissesAvailable} class${course.safeMissesAvailable === 1 ? "" : "es"} and stay above ${SAFE_ATTENDANCE_PERCENTAGE}%.`
              : "Stay present in the next class to protect your safe range."
    }));
}

function buildAiCoach({ classPerformance, upcomingClasses, faceProfile }) {
  if (!classPerformance.length) {
    return {
      tone: "warning",
      title: "Join classes to unlock your attendance plan",
      message:
        "Paste a teacher's join code first. Once attendance starts, this panel will calculate recovery and safe leave guidance.",
      nextBestAction: "Join your first classroom from the Classroom Hub."
    };
  }

  const belowRange = classPerformance.filter(
    (course) => course.total > 0 && course.studentPercentage < SAFE_ATTENDANCE_PERCENTAGE
  );
  const noRecords = classPerformance.filter((course) => course.total === 0);
  const priorityCourse =
    belowRange.sort(
      (left, right) =>
        right.classesNeededForSafeRange - left.classesNeededForSafeRange ||
        left.studentPercentage - right.studentPercentage
    )[0] ?? noRecords[0] ?? classPerformance[0];

  if (belowRange.length) {
    return {
      tone: "warning",
      title: `${priorityCourse.code} needs attention first`,
      message: `${priorityCourse.title} is at ${priorityCourse.studentPercentage}%. Attend the next ${priorityCourse.classesNeededForSafeRange} class${priorityCourse.classesNeededForSafeRange === 1 ? "" : "es"} to recover to the safe range.`,
      nextBestAction: upcomingClasses.length
        ? `Today's next class is ${upcomingClasses[0].code} at ${upcomingClasses[0].time}.`
        : "Check the timetable and prioritize the next scheduled weak subject."
    };
  }

  if (noRecords.length) {
    return {
      tone: "warning",
      title: "Some joined classes have no attendance yet",
      message: `${noRecords[0].code} has not recorded attendance. Attend the first session so your dashboard becomes fully accurate.`,
      nextBestAction: "Watch the weekly timetable for the first recorded session."
    };
  }

  return {
    tone: "positive",
    title: "Attendance is in the safe zone",
    message:
      faceProfile.status === "enrolled"
        ? "All recorded subjects are safe and your face profile is ready for classroom checks."
        : "All recorded subjects are safe. Complete face enrollment to avoid issues during attendance capture.",
    nextBestAction: upcomingClasses.length
      ? `Protect your streak by attending ${upcomingClasses[0].code} at ${upcomingClasses[0].time}.`
      : "Review tomorrow's timetable and keep every subject above the safe range."
  };
}

function buildWeeklySchedule(joinedClasses) {
  return scheduleDays.map((day) => {
    const items = joinedClasses
      .flatMap((joinedClass) =>
        (joinedClass.scheduleSlots ?? [])
          .filter((slot) => slot.day === day.id)
          .map((slot) => ({
            id: `${joinedClass.id}-${slot.day}-${slot.startTime}`,
            title: joinedClass.subjectName,
            code: joinedClass.subjectCode,
            time: slot.timeLabel,
            startTime: slot.startTime,
            faculty: joinedClass.teacherName,
            room: joinedClass.room || "Room update pending"
          }))
      )
      .sort((left, right) => left.startTime.localeCompare(right.startTime));

    return {
      day: day.shortLabel,
      dayLabel: day.label,
      items
    };
  });
}

function buildUpcomingClasses(joinedClasses) {
  const todayId = getCurrentScheduleDayId();

  return joinedClasses
    .flatMap((joinedClass) =>
      (joinedClass.scheduleSlots ?? [])
        .filter((slot) => slot.day === todayId)
        .map((slot) => ({
          id: `${joinedClass.id}-${slot.day}-${slot.startTime}`,
          title: joinedClass.subjectName,
          code: joinedClass.subjectCode,
          time: slot.timeLabel,
          startTime: slot.startTime,
          faculty: joinedClass.teacherName,
          room: joinedClass.room || "Room update pending",
          status: `Join code: ${joinedClass.joinCode}`
        }))
    )
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function buildCancellationAlerts(records, joinedClasses) {
  const classById = new Map(
    joinedClasses.map((joinedClass) => [String(joinedClass.id), joinedClass])
  );
  const seenKeys = new Set();

  return records
    .filter((record) => record.status === "cancelled")
    .sort(
      (left, right) =>
        new Date(right.recordedAt ?? right.createdAt) -
        new Date(left.recordedAt ?? left.createdAt)
    )
    .map((record) => {
      const dateKey = new Date(record.recordedAt ?? record.createdAt)
        .toISOString()
        .slice(0, 10);
      const dedupeKey = `${record.classId}-${dateKey}`;

      if (seenKeys.has(dedupeKey)) {
        return null;
      }

      seenKeys.add(dedupeKey);

      const joinedClass = classById.get(String(record.classId));
      const classCode = joinedClass?.subjectCode ?? record.className ?? "Class";

      return {
        tone: "warning",
        title: `${classCode} cancelled`,
        message: `${joinedClass?.subjectName ?? "Class"} was cancelled on ${formatDateLabel(record.recordedAt ?? record.createdAt)}.${record.notes ? ` ${record.notes}` : ""}`
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function buildLowAttendanceAlerts(classPerformance) {
  return classPerformance
    .filter(
      (course) =>
        course.total > 0 &&
        course.studentPercentage < SAFE_ATTENDANCE_PERCENTAGE
    )
    .sort((left, right) => left.studentPercentage - right.studentPercentage)
    .slice(0, 4)
    .map((course) => ({
      tone: "warning",
      title: `${course.code} low attendance warning`,
      message: `${course.title} is at ${course.studentPercentage}%. ${course.classesNeededForSafeRange ? `Attend the next ${course.classesNeededForSafeRange} class${course.classesNeededForSafeRange === 1 ? "" : "es"} to reach ${SAFE_ATTENDANCE_PERCENTAGE}%.` : "Stay present in the next class to protect your percentage."}`
    }));
}

function buildExamAlerts(upcomingExams = []) {
  return upcomingExams
    .filter((exam) => exam.eligibility?.tone !== "positive")
    .sort(sortUpcomingExams)
    .slice(0, 3)
    .map((exam) => ({
      tone: exam.eligibility?.tone === "danger" ? "warning" : "warning",
      title: `${exam.subjectCode} exam eligibility alert`,
      message: `${exam.examDateLabel}: ${exam.eligibility.action}`
    }));
}

export async function getStudentDashboard(userId) {
  const normalizedUserId = String(userId).trim().toUpperCase();
  const student = await User.findOne({
    userId: normalizedUserId,
    role: "student"
  }).lean();

  if (!student) {
    throw new Error("Student account not found for dashboard.");
  }

  const [joinedClasses, faceProfile] = await Promise.all([
    getStudentJoinedClasses(normalizedUserId),
    getFaceProfile(normalizedUserId)
  ]);
  const classIds = joinedClasses.map((joinedClass) => String(joinedClass.id));
  const memberships = await ClassMembership.find({
    classId: { $in: classIds }
  }).lean();
  const rosterIdsByClass = new Map();

  memberships.forEach((membership) => {
    const classId = String(membership.classId);
    const currentRosterIds = rosterIdsByClass.get(classId) ?? [];
    currentRosterIds.push(String(membership.studentUserId).trim().toUpperCase());
    rosterIdsByClass.set(classId, currentRosterIds);
  });

  const summariesByClass = await getAttendanceSummariesByClass(
    classIds,
    rosterIdsByClass
  );
  const studentAttendanceRecords = classIds.length
    ? await AttendanceRecord.find({
        classId: { $in: classIds },
        studentId: normalizedUserId
      })
        .sort({ recordedAt: -1 })
        .lean()
    : [];
  const studentLeaveRequests = classIds.length
    ? await LeaveRequest.find({
        classId: { $in: classIds },
        studentUserId: normalizedUserId
      })
        .sort({ submittedAt: -1 })
        .lean()
    : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const studentExamRecords = classIds.length
    ? await ClassExam.find({
        classId: { $in: classIds },
        status: "active",
        examDate: { $gte: today }
      })
        .sort({ examDate: 1 })
        .lean()
    : [];
  const classPerformance = buildClassPerformance(
    joinedClasses,
    summariesByClass,
    normalizedUserId,
    studentAttendanceRecords,
    studentLeaveRequests,
    studentExamRecords
  );
  const upcomingExams = classPerformance
    .map((course) => course.upcomingExam)
    .filter(Boolean)
    .sort(sortUpcomingExams);
  const upcomingClasses = buildUpcomingClasses(joinedClasses);
  const weeklySchedule = buildWeeklySchedule(joinedClasses);
  const comparison = buildComparison(classPerformance);
  const recordedClasses = classPerformance.filter((course) => course.total > 0);
  const safeClasses = recordedClasses.filter(
    (course) => course.studentPercentage >= SAFE_ATTENDANCE_PERCENTAGE
  ).length;
  const belowRangeClasses = recordedClasses.filter(
    (course) => course.studentPercentage < SAFE_ATTENDANCE_PERCENTAGE
  ).length;
  const noRecordClasses = classPerformance.filter((course) => course.total === 0).length;
  const attendedSessions = classPerformance.reduce(
    (total, course) => total + course.attended,
    0
  );
  const totalRecordedSessions = classPerformance.reduce(
    (total, course) => total + course.total,
    0
  );
  const missedSessions = totalRecordedSessions - attendedSessions;
  const pendingLeaveRequests = studentLeaveRequests.filter(
    (request) => request.status === "pending"
  ).length;
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const missedClassesThisMonth = studentAttendanceRecords.filter((record) => {
    const recordedAt = new Date(record.recordedAt ?? record.createdAt ?? Date.now());

    return (
      recordedAt >= thisMonthStart &&
      record.status !== "present" &&
      record.status !== "late" &&
      record.status !== "cancelled"
    );
  }).length;
  const recoveryPlan = buildRecoveryPlan(classPerformance);
  const aiCoach = buildAiCoach({
    classPerformance,
    upcomingClasses,
    faceProfile
  });
  const strongestClass = recordedClasses.length
    ? [...recordedClasses].sort(
        (left, right) => right.studentPercentage - left.studentPercentage
      )[0]
    : null;
  const priorityClass = recoveryPlan[0] ?? null;
  const cancellationAlerts = buildCancellationAlerts(
    studentAttendanceRecords,
    joinedClasses
  );
  const lowAttendanceAlerts = buildLowAttendanceAlerts(classPerformance);
  const examAlerts = buildExamAlerts(upcomingExams);
  const baseAlerts = classPerformance.length
    ? [
        ...examAlerts,
        ...cancellationAlerts,
        ...lowAttendanceAlerts,
        {
          tone: belowRangeClasses ? "warning" : "positive",
          title: belowRangeClasses
            ? `${belowRangeClasses} subject${belowRangeClasses === 1 ? "" : "s"} below safe range`
            : "All recorded subjects are safe",
          message: belowRangeClasses
            ? "Follow the recovery plan and prioritize the subject needing the most consecutive attendance."
            : "Keep attending scheduled classes to maintain your safe range."
        },
        {
          tone: "positive",
          title: faceProfile.status === "enrolled"
            ? "Face profile is ready for classroom attendance"
            : "Complete your face enrollment soon",
          message:
            faceProfile.status === "enrolled"
              ? "Your face profile is stored once and can now be used by all classes you join."
              : "Upload clear images in the face profile section so attendance capture works smoothly."
        }
      ]
    : [
        {
          tone: "warning",
          title: "You have not joined any classes yet",
          message:
            "Enter a valid join code from your teacher to start building your attendance dashboard."
        }
      ];

  return {
    profile: {
      firstName: student.firstName,
      lastName: student.lastName,
      userId: student.userId,
      rollNumber: student.rollNumber,
      batch: student.batch,
      yearOfPassing: student.yearOfPassing,
      department: student.department,
      email: student.email,
      joinedClassesCount: joinedClasses.length
    },
    overview: {
      overallAttendance: comparison.overallAttendance,
      safeThreshold: SAFE_ATTENDANCE_PERCENTAGE,
      joinedClasses: classPerformance.length,
      recordedClasses: recordedClasses.length,
      safeClasses,
      belowRangeClasses,
      noRecordClasses,
      attendedSessions,
      totalRecordedSessions,
      missedSessions,
      pendingLeaveRequests,
      upcomingExams: upcomingExams.length,
      atRiskExams: upcomingExams.filter(
        (exam) => exam.eligibility?.tone !== "positive"
      ).length,
      nextExamDate: upcomingExams[0]?.examDateLabel ?? "Not set",
      missedClassesThisMonth,
      classesToday: upcomingClasses.length,
      nextClassTime: upcomingClasses[0]?.time ?? "TBD",
      strongestClassCode: strongestClass?.code ?? "TBD",
      priorityClassCode: priorityClass?.code ?? "TBD"
    },
    joinedClasses,
    faceProfile,
    classPerformance,
    attendanceTrend: buildAttendanceTrend(studentAttendanceRecords, normalizedUserId),
    peerComparison: comparison.items,
    recoveryPlan,
    aiCoach,
    upcomingExams,
    upcomingClasses,
    weeklySchedule,
    alerts: baseAlerts,
    achievements: classPerformance.length
      ? [
          `${classPerformance.length} classes joined`,
          `${safeClasses} classes in safe range`,
          `${attendedSessions}/${totalRecordedSessions} recorded sessions attended`
        ]
      : ["Create your face profile", "Join your first class", "Start your attendance record"],
    goals: [
          ...(priorityClass
            ? [
                {
                  title: `Focus on ${priorityClass.code}`,
                  target: priorityClass.action
                }
              ]
            : []),
          {
            title:
              faceProfile.status === "enrolled"
                ? "Keep your face profile ready"
                : "Complete face enrollment",
            target:
              faceProfile.status === "enrolled"
                ? "Refresh enrollment only if your appearance changes significantly."
                : "Upload or capture clear images before classroom attendance starts."
          },
          {
            title: "Use the timetable daily",
            target: upcomingClasses.length
              ? `${upcomingClasses[0].code} is next at ${upcomingClasses[0].time}.`
              : "Check the weekly timetable for your next scheduled class."
          }
        ]
  };
}
