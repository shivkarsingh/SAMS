import { ClassMembership } from "../models/ClassMembership.js";
import { User } from "../models/User.js";
import {
  getAttendanceSummariesByClass,
  summarizeAttendanceRecords
} from "./attendanceAnalyticsService.js";
import { getTeacherManagedClasses } from "./classroomService.js";

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeUserId(userId) {
  return String(userId).trim().toUpperCase();
}

function createNumericSeed(value) {
  return String(value)
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
}

function buildTeacherAttendanceTrend(basePercentage) {
  const offsets = [-6, -2, 1, 4, 3, 6];

  return offsets.map((offset, index) => ({
    label: `W${index + 1}`,
    value: clampPercentage(basePercentage + offset)
  }));
}

async function buildClassesManaged(managedClasses) {
  const classIds = managedClasses.map((classroom) => String(classroom.id));
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

  return managedClasses.map((classroom) => {
    const classId = String(classroom.id);
    const seed = createNumericSeed(classroom.subjectCode + classroom.section);
    const attendanceSummary =
      summariesByClass.get(classId) ??
      summarizeAttendanceRecords([], rosterIdsByClass.get(classId) ?? []);

    return {
      id: classroom.id,
      code: classroom.subjectCode,
      title: classroom.subjectName,
      section: classroom.section,
      studentsCount: rosterIdsByClass.get(classId)?.length ?? classroom.studentsCount,
      averageAttendance: attendanceSummary.averageAttendance,
      attendanceSubmitted: attendanceSummary.totalSessions > 0,
      flaggedStudents: attendanceSummary.flaggedStudents,
      nextClass: classroom.scheduleSummary || "Schedule to be announced",
      room: classroom.room || "Room update pending",
      joinCode: classroom.joinCode,
      joinLink: classroom.joinLink,
      semesterLabel: classroom.semesterLabel,
      batch: classroom.batch,
      totalSessions: attendanceSummary.totalSessions,
      lastAttendanceAt: attendanceSummary.latestSession?.recordedAt ?? null,
      momentumScore:
        attendanceSummary.totalSessions > 0
          ? attendanceSummary.averageAttendance
          : 62 + (seed % 10)
    };
  });
}

function buildStudentWatchlist(classesManaged, memberships, summariesByClass) {
  const classById = new Map(classesManaged.map((course) => [String(course.id), course]));
  const watchlist = memberships
    .map((membership) => {
      const classId = String(membership.classId);
      const attendanceSummary =
        summariesByClass.get(classId) ??
        summarizeAttendanceRecords([], [membership.studentUserId]);
      const studentStats =
        attendanceSummary.studentStatsById.get(
          String(membership.studentUserId).trim().toUpperCase()
        ) ?? {
          attendancePercentage: 0,
          totalCount: 0
        };
      const course = classById.get(classId);

      return {
        name: membership.studentName,
        section: course?.section ?? "Section TBD",
        code: course?.code ?? "Class",
        attendance: studentStats.attendancePercentage,
        totalCount: studentStats.totalCount,
        note:
          studentStats.totalCount > 0
            ? `Needs support in ${course?.code ?? "this class"} if attendance remains below 75%.`
            : `Joined ${course?.code ?? "the class"} but has no recorded attendance sessions yet.`
      };
    })
    .filter((student) => student.totalCount > 0 && student.attendance < 75)
    .sort((left, right) => left.attendance - right.attendance)
    .slice(0, 3);

  return watchlist;
}

function buildFlaggedStudentSet(memberships, summariesByClass) {
  return memberships.reduce((flaggedStudentIds, membership) => {
    const classId = String(membership.classId);
    const normalizedStudentId = normalizeUserId(membership.studentUserId);
    const attendanceSummary =
      summariesByClass.get(classId) ??
      summarizeAttendanceRecords([], [normalizedStudentId]);
    const studentStats = attendanceSummary.studentStatsById.get(normalizedStudentId);

    if (
      studentStats &&
      studentStats.totalCount > 0 &&
      studentStats.attendancePercentage < 75
    ) {
      flaggedStudentIds.add(normalizedStudentId);
    }

    return flaggedStudentIds;
  }, new Set());
}

function buildTeacherSchedule(classesManaged) {
  return classesManaged.slice(0, 3).map((course) => ({
    title: course.title,
    section: course.section,
    time: course.nextClass,
    room: course.room,
    attendanceStatus: course.attendanceSubmitted
      ? "History Active"
      : "First Session Due",
    focus: course.attendanceSubmitted
      ? `Open the class workspace and verify the next attendance session for ${course.code}.`
      : `Share join code ${course.joinCode} and start the first attendance session once the roster is ready.`
  }));
}

function buildTeacherWeeklySchedule(classesManaged) {
  const dayBuckets = [
    { day: "Mon", items: [] },
    { day: "Tue", items: [] },
    { day: "Wed", items: [] },
    { day: "Thu", items: [] },
    { day: "Fri", items: [] }
  ];

  classesManaged.forEach((course, index) => {
    dayBuckets[index % dayBuckets.length].items.push(
      `${course.code} ${course.section} ${course.nextClass}`
    );
  });

  return dayBuckets.map((bucket) => ({
    ...bucket,
    items: bucket.items.length ? bucket.items : ["No classes scheduled"]
  }));
}

export async function getTeacherDashboard(userId) {
  const normalizedUserId = String(userId).trim().toUpperCase();
  const teacher = await User.findOne({
    userId: normalizedUserId,
    role: "teacher"
  }).lean();

  if (!teacher) {
    throw new Error("Teacher account not found for dashboard.");
  }

  const managedClasses = await getTeacherManagedClasses(normalizedUserId);
  const classesManaged = await buildClassesManaged(managedClasses);
  const classIds = managedClasses.map((classroom) => String(classroom.id));
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
  const uniqueStudentIds = new Set(
    memberships.map((membership) => normalizeUserId(membership.studentUserId))
  );
  const flaggedStudentIds = buildFlaggedStudentSet(memberships, summariesByClass);
  const averageAttendance = clampPercentage(
    classesManaged.length
      ? classesManaged.reduce(
          (total, currentClass) => total + currentClass.averageAttendance,
          0
        ) / classesManaged.length
      : 0
  );

  return {
    profile: {
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      userId: teacher.userId,
      department: teacher.department,
      designation: teacher.designation,
      specialization: teacher.specialization,
      experienceYears: teacher.experienceYears,
      joiningYear: teacher.joiningYear,
      email: teacher.email
    },
    overview: {
      classesToday: classesManaged.length,
      pendingAttendance: classesManaged.filter(
        (classroom) => !classroom.attendanceSubmitted
      ).length,
      totalStudents: uniqueStudentIds.size,
      averageAttendance,
      sectionsHandled: classesManaged.length,
      flaggedStudents: flaggedStudentIds.size
    },
    classesManaged,
    attendanceTrend: buildTeacherAttendanceTrend(classesManaged.length ? averageAttendance : 20),
    sectionComparison: [
      {
        label: "Your Sections",
        value: averageAttendance
      },
      {
        label: "Department Avg",
        value: 79
      },
      {
        label: "Best Section",
        value: classesManaged.length
          ? Math.max(...classesManaged.map((item) => item.averageAttendance))
          : 0
      },
      {
        label: "At-Risk Section",
        value: classesManaged.length
          ? Math.min(...classesManaged.map((item) => item.averageAttendance))
          : 0
      }
    ],
    todaysSchedule: buildTeacherSchedule(classesManaged),
    weeklySchedule: buildTeacherWeeklySchedule(classesManaged),
    studentWatchlist: classesManaged.length
      ? buildStudentWatchlist(classesManaged, memberships, summariesByClass)
      : [],
    quickInsights: classesManaged.length
      ? [
          {
            tone: "warning",
            title: "Share join links as soon as classes are created",
            message:
              "Students can only be matched during attendance after they join the class roster."
          },
          {
            tone: "positive",
            title: "Your class setup is ready for face-based attendance",
            message:
              "Each new class already has a join code and link, so you can bring students into the roster quickly."
          }
        ]
      : [
          {
            tone: "warning",
            title: "Create your first class to begin attendance",
            message:
              "Add subject details, generate a join link, and start building the roster before live attendance sessions."
          }
        ],
    recentActivity: classesManaged.length
      ? classesManaged.slice(0, 3).map(
          (course) =>
            course.lastAttendanceAt
              ? `Latest attendance finalized for ${course.code} ${course.section} with ${course.averageAttendance}% average attendance.`
              : `Prepared ${course.code} ${course.section} with join code ${course.joinCode}`
        )
      : ["No classes created yet"],
    priorities: classesManaged.length
      ? [
          {
            title: "Share invite details with enrolled students",
            target: "Send the join link or code for every active class."
          },
          {
            title: "Keep class rosters clean before attendance",
            target: "Ask students to join the class and complete face enrollment ahead of the session."
          }
        ]
      : [
          {
            title: "Create your first class",
            target: "Add subject details and generate a join link from the dashboard."
          },
          {
            title: "Prepare students for enrollment",
            target: "Ask students to upload clear face images once after joining."
          }
        ]
  };
}
