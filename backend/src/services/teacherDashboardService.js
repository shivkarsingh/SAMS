import { ClassMembership } from "../models/ClassMembership.js";
import { ClassExam } from "../models/ClassExam.js";
import { User } from "../models/User.js";
import {
  getAttendanceSummariesByClass,
  summarizeAttendanceRecords
} from "./attendanceAnalyticsService.js";
import { getTeacherManagedClasses } from "./classroomService.js";
import {
  buildTeacherExamSummary,
  sortUpcomingExams
} from "./examScheduleService.js";
import {
  getCurrentScheduleDayId,
  scheduleDays
} from "../utils/schedule.js";

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
      scheduleSlots: classroom.scheduleSlots ?? [],
      room: classroom.room || "Room update pending",
      joinCode: classroom.joinCode,
      status: classroom.status,
      endedAt: classroom.endedAt ?? null,
      archiveSummary: classroom.archiveSummary ?? null,
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
  const todayId = getCurrentScheduleDayId();

  return classesManaged
    .filter((course) => course.status !== "archived")
    .flatMap((course) =>
      (course.scheduleSlots ?? [])
        .filter((slot) => slot.day === todayId)
        .map((slot) => ({
          id: `${course.id}-${slot.day}-${slot.startTime}`,
          title: course.title,
          code: course.code,
          section: course.section || "Section TBD",
          time: slot.timeLabel,
          startTime: slot.startTime,
          room: course.room,
          attendanceStatus: course.attendanceSubmitted
            ? "History Active"
            : "First Session Due",
          focus: course.attendanceSubmitted
            ? `Open the class workspace and verify the next attendance session for ${course.code}.`
            : `Share join code ${course.joinCode} before this class starts.`
        }))
    )
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function buildTeacherWeeklySchedule(classesManaged) {
  return scheduleDays.map((day) => {
    const items = classesManaged
      .filter((course) => course.status !== "archived")
      .flatMap((course) =>
        (course.scheduleSlots ?? [])
          .filter((slot) => slot.day === day.id)
          .map((slot) => ({
            id: `${course.id}-${slot.day}-${slot.startTime}`,
            title: course.title,
            code: course.code,
            section: course.section || "Section TBD",
            time: slot.timeLabel,
            startTime: slot.startTime,
            room: course.room
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

function buildTeacherUpcomingExams(
  classesManaged,
  examRecords,
  rosterIdsByClass,
  summariesByClass
) {
  const classById = new Map(
    classesManaged.map((course) => [String(course.id), course])
  );

  return examRecords
    .map((exam) => {
      const classId = String(exam.classId);
      const classroom = classById.get(classId);

      if (!classroom) {
        return null;
      }

      return buildTeacherExamSummary({
        exam,
        classroom,
        attendanceSummary:
          summariesByClass.get(classId) ??
          summarizeAttendanceRecords([], rosterIdsByClass.get(classId) ?? []),
        studentIds: rosterIdsByClass.get(classId) ?? []
      });
    })
    .filter(Boolean)
    .sort(sortUpcomingExams);
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
  let classesManaged = await buildClassesManaged(managedClasses);
  const classIds = managedClasses.map((classroom) => String(classroom.id));
  const activeClassIds = managedClasses
    .filter((classroom) => classroom.status !== "archived")
    .map((classroom) => String(classroom.id));
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examRecords = activeClassIds.length
    ? await ClassExam.find({
        classId: { $in: activeClassIds },
        status: "active",
        examDate: { $gte: today }
      })
        .sort({ examDate: 1 })
        .lean()
    : [];
  const upcomingExams = buildTeacherUpcomingExams(
    classesManaged,
    examRecords,
    rosterIdsByClass,
    summariesByClass
  );
  const upcomingExamByClassId = new Map(
    upcomingExams.map((exam) => [String(exam.classId), exam])
  );
  classesManaged = classesManaged.map((course) => ({
    ...course,
    upcomingExam: upcomingExamByClassId.get(String(course.id)) ?? null
  }));
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
  const todaysSchedule = buildTeacherSchedule(classesManaged);
  const weeklySchedule = buildTeacherWeeklySchedule(classesManaged);
  const scheduledSlotCount = classesManaged.reduce(
    (total, currentClass) =>
      currentClass.status === "archived"
        ? total
        : total + (currentClass.scheduleSlots?.length ?? 0),
    0
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
      classesToday: todaysSchedule.length,
      pendingAttendance: classesManaged.filter(
        (classroom) =>
          classroom.status !== "archived" && !classroom.attendanceSubmitted
      ).length,
      totalStudents: uniqueStudentIds.size,
      averageAttendance,
      sectionsHandled: activeClassIds.length,
      flaggedStudents: flaggedStudentIds.size,
      scheduledSlotCount,
      upcomingExams: upcomingExams.length,
      atRiskExamStudents: upcomingExams.reduce(
        (total, exam) => total + (exam.eligibility?.atRiskStudents ?? 0),
        0
      )
    },
    classesManaged,
    upcomingExams,
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
    todaysSchedule,
    weeklySchedule,
    studentWatchlist: classesManaged.length
      ? buildStudentWatchlist(classesManaged, memberships, summariesByClass)
      : [],
    quickInsights: classesManaged.length
      ? [
          {
            tone: upcomingExams.some((exam) => exam.eligibility?.atRiskStudents)
              ? "warning"
              : "positive",
            title: upcomingExams.length
              ? "Upcoming exams have attendance eligibility ready"
              : "Set exam dates for eligibility planning",
            message:
              upcomingExams.length
                ? `${upcomingExams.length} exam${upcomingExams.length === 1 ? "" : "s"} are scheduled. Review at-risk students before exam week.`
                : "Add exam date and required percentage for each class so students can see eligibility early."
          },
          {
            tone: "warning",
            title: todaysSchedule.length
              ? "Use today's schedule to start attendance on time"
              : "No class is scheduled for today",
            message:
              todaysSchedule.length
                ? "Open the class workspace from each scheduled class and finalize attendance while the roster is fresh."
                : "Your weekly timetable is still available below for planning the next teaching day."
          },
          {
            tone: "positive",
            title: "Your class setup is ready for roster-based attendance",
            message:
              "Each class has schedule, join code, and attendance history tied together in one workspace."
          }
        ]
      : [
          {
            tone: "warning",
            title: "Create your first class to begin attendance",
            message:
              "Add subject details, share the join code, and start building the roster before live attendance sessions."
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
            title: "Keep schedules complete",
            target: scheduledSlotCount
              ? `${scheduledSlotCount} weekly teaching slots are mapped for timetable views.`
              : "Add weekly slots while creating your next class."
          },
          {
            title: "Keep class rosters clean before attendance",
            target: "Ask students to join the class and complete face enrollment ahead of the session."
          }
        ]
      : [
          {
            title: "Create your first class",
            target: "Add subject details and share the join code from the dashboard."
          },
          {
            title: "Prepare students for enrollment",
            target: "Ask students to upload clear face images once after joining."
          }
        ]
  };
}
