import { ClassMembership } from "../models/ClassMembership.js";
import { User } from "../models/User.js";
import {
  getAttendanceSummariesByClass,
  summarizeAttendanceRecords
} from "./attendanceAnalyticsService.js";
import { getStudentJoinedClasses } from "./classroomService.js";
import { getFaceProfile } from "./faceProfileService.js";

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createNumericSeed(value) {
  return String(value)
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
}

function buildTrendSeries(basePercentage) {
  const offsets = [-8, -4, -2, 3, 1, 6];

  return offsets.map((offset, index) => ({
    label: `W${index + 1}`,
    value: clampPercentage(basePercentage + offset)
  }));
}

function buildClassPerformance(joinedClasses, summariesByClass, studentUserId) {
  const normalizedStudentUserId = String(studentUserId).trim().toUpperCase();

  return joinedClasses.map((joinedClass) => {
    const seed = createNumericSeed(joinedClass.subjectCode + joinedClass.section);
    const attendanceSummary =
      summariesByClass.get(String(joinedClass.id)) ??
      summarizeAttendanceRecords([], [normalizedStudentUserId]);
    const studentStats =
      attendanceSummary.studentStatsById.get(normalizedStudentUserId) ?? {
        presentCount: 0,
        totalCount: 0,
        attendancePercentage: 0
      };
    const friendAverage = clampPercentage(
      attendanceSummary.averageAttendance + ((seed % 5) - 2)
    );

    return {
      id: joinedClass.id,
      code: joinedClass.subjectCode,
      title: joinedClass.subjectName,
      faculty: joinedClass.teacherName,
      attended: studentStats.presentCount,
      total: studentStats.totalCount,
      studentPercentage: studentStats.attendancePercentage,
      classAverage: attendanceSummary.averageAttendance,
      friendAverage,
      room: joinedClass.room || "Room update pending",
      nextClass: joinedClass.scheduleSummary || "Schedule to be announced",
      joinCode: joinedClass.joinCode
    };
  });
}

function buildWeeklySchedule(joinedClasses) {
  const dayBuckets = [
    { day: "Mon", items: [] },
    { day: "Tue", items: [] },
    { day: "Wed", items: [] },
    { day: "Thu", items: [] },
    { day: "Fri", items: [] }
  ];

  joinedClasses.forEach((joinedClass, index) => {
    dayBuckets[index % dayBuckets.length].items.push(
      `${joinedClass.subjectCode} ${joinedClass.scheduleSummary || "Time TBD"}`
    );
  });

  return dayBuckets.map((bucket) => ({
    ...bucket,
    items: bucket.items.length ? bucket.items : ["No regular class scheduled"]
  }));
}

function buildUpcomingClasses(joinedClasses) {
  return joinedClasses.slice(0, 3).map((joinedClass) => ({
    title: joinedClass.subjectName,
    time: joinedClass.scheduleSummary || "Time to be announced",
    faculty: joinedClass.teacherName,
    room: joinedClass.room || "Room update pending",
    status: `Join code: ${joinedClass.joinCode}`
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
  const classPerformance = buildClassPerformance(
    joinedClasses,
    summariesByClass,
    normalizedUserId
  );
  const overallAttendance = clampPercentage(
    classPerformance.filter((course) => course.total > 0).length
      ? classPerformance.reduce(
          (total, course) => total + course.studentPercentage,
          0
        ) /
          classPerformance.filter((course) => course.total > 0).length
      : 0
  );

  return {
    profile: {
      firstName: student.firstName,
      lastName: student.lastName,
      userId: student.userId,
      batch: student.batch,
      yearOfPassing: student.yearOfPassing,
      department: student.department,
      email: student.email,
      joinedClassesCount: joinedClasses.length
    },
    overview: {
      overallAttendance,
      classRank: classPerformance.length ? 7 : null,
      totalStudentsInCohort: 62,
      consistencyScore: classPerformance.length ? 91 : 0,
      attendanceStreak: classPerformance.length ? 16 : 0,
      missedClassesThisMonth: classPerformance.length
        ? Math.max(0, 4 - Math.floor(classPerformance.length / 2))
        : 0
    },
    joinedClasses,
    faceProfile,
    classPerformance,
    attendanceTrend: buildTrendSeries(classPerformance.length ? overallAttendance : 12),
    peerComparison: [
      { label: "You", value: overallAttendance },
      { label: "Close Friends", value: clampPercentage(overallAttendance + 3) },
      { label: "Class Average", value: clampPercentage(overallAttendance + 1) },
      { label: "Top Performer", value: classPerformance.length ? 96 : 0 }
    ],
    upcomingClasses: buildUpcomingClasses(joinedClasses),
    weeklySchedule: buildWeeklySchedule(joinedClasses),
    alerts: classPerformance.length
      ? [
          {
            tone: "warning",
            title: "Keep your lowest-attendance class on track",
            message:
              "Open your class-wise breakdown and focus on the subject that is closest to the minimum safe range."
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
              "Paste a valid join link or join code from your teacher to start building your attendance dashboard."
          }
        ],
    achievements: classPerformance.length
      ? [
          `${classPerformance.length} classes joined`,
          `${faceProfile.embeddingCount} face embeddings stored`,
          `${classPerformance.filter((item) => item.studentPercentage >= 85).length} classes above 85% attendance`
        ]
      : ["Create your face profile", "Join your first class", "Start your attendance record"],
    goals: faceProfile.status === "enrolled"
      ? [
          {
            title: "Keep your face profile updated",
            target: "Re-enroll with fresh images if your appearance changes significantly."
          },
          {
            title: "Stay active in every joined class",
            target: "Use the class breakdown to keep all subjects in the safe attendance zone."
          }
        ]
      : [
          {
            title: "Enroll your face profile",
            target: "Upload 6 to 10 clear face images from the dedicated face enrollment page."
          },
          {
            title: "Join classes before attendance starts",
            target: "Paste the invite link or code shared by your teachers."
          }
        ]
  };
}
