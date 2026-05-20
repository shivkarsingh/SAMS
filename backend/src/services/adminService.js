import mongoose from "mongoose";
import { AttendanceDraft } from "../models/AttendanceDraft.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { ClassAssignment } from "../models/ClassAssignment.js";
import { ClassAssignmentSubmission } from "../models/ClassAssignmentSubmission.js";
import { ClassDiscussionMessage } from "../models/ClassDiscussionMessage.js";
import { ClassExam } from "../models/ClassExam.js";
import { ClassMembership } from "../models/ClassMembership.js";
import { Classroom } from "../models/Classroom.js";
import { EmailOtp } from "../models/EmailOtp.js";
import { FaceProfile } from "../models/FaceProfile.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { QrAttendanceSession } from "../models/QrAttendanceSession.js";
import { User } from "../models/User.js";
import {
  sanitizeScheduleSlots,
  summarizeScheduleSlots
} from "../utils/schedule.js";

const rollNumberCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base"
});

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
}

function normalizeRole(role) {
  return String(role ?? "").trim().toLowerCase();
}

function assertObjectId(value, label = "ID") {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`${label} is invalid.`);
  }

  return new mongoose.Types.ObjectId(value);
}

function formatName(user) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

function sanitizeUser(user, extra = {}) {
  return {
    id: String(user._id),
    role: user.role,
    userId: user.userId,
    name: formatName(user),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    rollNumber: user.rollNumber ?? "",
    department: user.department ?? "",
    designation: user.designation ?? "",
    createdAt: user.createdAt,
    ...extra
  };
}

function getStudentDisplayRollNumber(student) {
  const explicitRollNumber = String(student.rollNumber ?? "").trim();

  if (explicitRollNumber) {
    return explicitRollNumber;
  }

  const numericParts = String(student.userId ?? "").match(/\d+/g);

  return numericParts?.at(-1) ?? "";
}

function sanitizeClassroom(classroom, extra = {}) {
  const scheduleSlots = sanitizeScheduleSlots(classroom.scheduleSlots);

  return {
    id: String(classroom._id),
    teacherUserId: classroom.teacherUserId,
    teacherName: classroom.teacherName,
    subjectName: classroom.subjectName,
    subjectCode: classroom.subjectCode,
    section: classroom.section,
    room: classroom.room,
    semesterLabel: classroom.semesterLabel,
    academicYear: classroom.academicYear,
    batch: classroom.batch,
    scheduleSummary: summarizeScheduleSlots(
      scheduleSlots,
      classroom.scheduleSummary
    ),
    scheduleSlots,
    joinCode: classroom.joinCode,
    status: classroom.status,
    endedAt: classroom.endedAt ?? null,
    archiveSummary: classroom.archiveSummary ?? null,
    createdAt: classroom.createdAt,
    ...extra
  };
}

function compareStudentsByRollNumber(left, right) {
  const leftRoll = left.rollNumber || left.userId;
  const rightRoll = right.rollNumber || right.userId;
  const rollComparison = rollNumberCollator.compare(leftRoll, rightRoll);

  if (rollComparison !== 0) {
    return rollComparison;
  }

  return rollNumberCollator.compare(left.name || left.userId, right.name || right.userId);
}

async function requireAdmin(adminUserId) {
  const normalizedAdminUserId = normalizeUserId(adminUserId);

  if (!normalizedAdminUserId) {
    throw new Error("Admin ID is required.");
  }

  const admin = await User.findOne({
    userId: normalizedAdminUserId,
    role: "admin"
  }).lean();

  if (!admin) {
    throw new Error("Admin account not found or not authorized.");
  }

  return admin;
}

function getDeletedCount(result) {
  return result?.deletedCount ?? 0;
}

async function deleteClassroomData(classroom) {
  const classObjectId = classroom._id;
  const classIdString = String(classroom._id);

  const [
    memberships,
    attendanceRecords,
    attendanceDrafts,
    exams,
    leaveRequests,
    assignments,
    assignmentSubmissions,
    discussions,
    qrSessions
  ] = await Promise.all([
    ClassMembership.deleteMany({ classId: classObjectId }),
    AttendanceRecord.deleteMany({ classId: classIdString }),
    AttendanceDraft.deleteMany({ classId: classObjectId }),
    ClassExam.deleteMany({ classId: classObjectId }),
    LeaveRequest.deleteMany({ classId: classObjectId }),
    ClassAssignment.deleteMany({ classId: classObjectId }),
    ClassAssignmentSubmission.deleteMany({ classId: classObjectId }),
    ClassDiscussionMessage.deleteMany({ classId: classObjectId }),
    QrAttendanceSession.deleteMany({ classId: classIdString })
  ]);

  const classroomDelete = await Classroom.deleteOne({ _id: classObjectId });

  return {
    classrooms: getDeletedCount(classroomDelete),
    memberships: getDeletedCount(memberships),
    attendanceRecords: getDeletedCount(attendanceRecords),
    attendanceDrafts: getDeletedCount(attendanceDrafts),
    exams: getDeletedCount(exams),
    leaveRequests: getDeletedCount(leaveRequests),
    assignments: getDeletedCount(assignments),
    assignmentSubmissions: getDeletedCount(assignmentSubmissions),
    discussions: getDeletedCount(discussions),
    qrSessions: getDeletedCount(qrSessions)
  };
}

function combineDeletionSummaries(summaries) {
  return summaries.reduce((combined, summary) => {
    Object.entries(summary).forEach(([key, value]) => {
      combined[key] = (combined[key] ?? 0) + Number(value ?? 0);
    });

    return combined;
  }, {});
}

async function getClassroomRow(classroom) {
  const classObjectId = classroom._id;
  const classIdString = String(classroom._id);
  const [studentsCount, attendanceRecordsCount, pendingDraftsCount] =
    await Promise.all([
      ClassMembership.countDocuments({ classId: classObjectId }),
      AttendanceRecord.countDocuments({ classId: classIdString }),
      AttendanceDraft.countDocuments({ classId: classObjectId, status: "draft" })
    ]);

  return sanitizeClassroom(classroom, {
    studentsCount,
    attendanceRecordsCount,
    pendingDraftsCount
  });
}

async function getStudentRow(student) {
  const [classesCount, attendanceRecordsCount] =
    await Promise.all([
      ClassMembership.countDocuments({ studentUserId: student.userId }),
      AttendanceRecord.countDocuments({ studentId: student.userId })
    ]);

  return sanitizeUser(student, {
    rollNumber: getStudentDisplayRollNumber(student),
    classesCount,
    attendanceRecordsCount
  });
}

async function getTeacherRow(teacher) {
  const [classesCount, attendanceRecordsCount] =
    await Promise.all([
      Classroom.countDocuments({ teacherUserId: teacher.userId }),
      AttendanceRecord.countDocuments({ teacherUserId: teacher.userId })
    ]);

  return sanitizeUser(teacher, {
    classesCount,
    attendanceRecordsCount
  });
}

export async function getAdminDashboard(adminUserId) {
  const admin = await requireAdmin(adminUserId);

  const [
    studentCount,
    teacherCount,
    activeClassCount,
    archivedClassCount,
    attendanceRecordCount,
    students,
    teachers,
    classrooms
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "teacher" }),
    Classroom.countDocuments({ status: "active" }),
    Classroom.countDocuments({ status: "archived" }),
    AttendanceRecord.countDocuments(),
    User.find({ role: "student" }).sort({ createdAt: -1 }).limit(200).lean(),
    User.find({ role: "teacher" }).sort({ createdAt: -1 }).limit(200).lean(),
    Classroom.find().sort({ createdAt: -1 }).limit(200).lean()
  ]);

  const [studentRows, teacherRows, classRows] = await Promise.all([
    Promise.all(students.map(getStudentRow)),
    Promise.all(teachers.map(getTeacherRow)),
    Promise.all(classrooms.map(getClassroomRow))
  ]);

  return {
    admin: sanitizeUser(admin),
    metrics: {
      students: studentCount,
      teachers: teacherCount,
      activeClasses: activeClassCount,
      archivedClasses: archivedClassCount,
      attendanceRecords: attendanceRecordCount
    },
    students: studentRows.sort(compareStudentsByRollNumber),
    teachers: teacherRows,
    classes: classRows
  };
}

export async function deleteAdminClassroom({ adminUserId, classId }) {
  await requireAdmin(adminUserId);
  const normalizedClassId = assertObjectId(classId, "Classroom ID");
  const classroom = await Classroom.findById(normalizedClassId);

  if (!classroom) {
    throw new Error("Classroom not found.");
  }

  const deleted = await deleteClassroomData(classroom);

  return {
    deleted,
    classroom: sanitizeClassroom(classroom)
  };
}

export async function updateAdminClassroomStatus({
  adminUserId,
  classId,
  status
}) {
  await requireAdmin(adminUserId);
  const normalizedStatus = String(status ?? "").trim().toLowerCase();

  if (!["active", "archived"].includes(normalizedStatus)) {
    throw new Error("Class status must be active or archived.");
  }

  const classroom = await Classroom.findByIdAndUpdate(
    assertObjectId(classId, "Classroom ID"),
    { status: normalizedStatus },
    { new: true }
  );

  if (!classroom) {
    throw new Error("Classroom not found.");
  }

  return {
    classroom: await getClassroomRow(classroom)
  };
}

async function deleteStudentAccount(student) {
  const studentUserId = student.userId;

  const [
    memberships,
    attendanceRecords,
    leaveRequests,
    faceProfile,
    assignmentSubmissions,
    ownMessages,
    replyUpdates,
    reactionUpdates,
    otps
  ] = await Promise.all([
    ClassMembership.deleteMany({ studentUserId }),
    AttendanceRecord.deleteMany({ studentId: studentUserId }),
    LeaveRequest.deleteMany({ studentUserId }),
    FaceProfile.deleteOne({ studentUserId }),
    ClassAssignmentSubmission.deleteMany({ studentUserId }),
    ClassDiscussionMessage.deleteMany({ authorUserId: studentUserId }),
    ClassDiscussionMessage.updateMany(
      { "replies.authorUserId": studentUserId },
      { $pull: { replies: { authorUserId: studentUserId } } }
    ),
    ClassDiscussionMessage.updateMany(
      { $or: [{ likes: studentUserId }, { dislikes: studentUserId }] },
      { $pull: { likes: studentUserId, dislikes: studentUserId } }
    ),
    EmailOtp.deleteMany({ role: "student", userId: studentUserId })
  ]);

  const draftUpdates = await AttendanceDraft.updateMany(
    { "records.studentId": studentUserId },
    { $pull: { records: { studentId: studentUserId } } }
  );
  const userDelete = await User.deleteOne({ _id: student._id });

  return {
    users: getDeletedCount(userDelete),
    memberships: getDeletedCount(memberships),
    attendanceRecords: getDeletedCount(attendanceRecords),
    leaveRequests: getDeletedCount(leaveRequests),
    faceProfiles: getDeletedCount(faceProfile),
    assignmentSubmissions: getDeletedCount(assignmentSubmissions),
    discussions: getDeletedCount(ownMessages),
    discussionReplyDocumentsUpdated: replyUpdates.modifiedCount ?? 0,
    discussionReactionDocumentsUpdated: reactionUpdates.modifiedCount ?? 0,
    attendanceDraftDocumentsUpdated: draftUpdates.modifiedCount ?? 0,
    emailOtps: getDeletedCount(otps)
  };
}

async function deleteTeacherAccount(teacher) {
  const teacherUserId = teacher.userId;
  const teacherClasses = await Classroom.find({ teacherUserId });
  const classDeletionSummaries = [];

  for (const classroom of teacherClasses) {
    classDeletionSummaries.push(await deleteClassroomData(classroom));
  }

  const [
    attendanceRecords,
    leaveRequests,
    exams,
    qrSessions,
    ownMessages,
    replyUpdates,
    reactionUpdates,
    otps
  ] = await Promise.all([
    AttendanceRecord.deleteMany({ teacherUserId }),
    LeaveRequest.deleteMany({ teacherUserId }),
    ClassExam.deleteMany({ teacherUserId }),
    QrAttendanceSession.deleteMany({ teacherUserId }),
    ClassDiscussionMessage.deleteMany({ authorUserId: teacherUserId }),
    ClassDiscussionMessage.updateMany(
      { "replies.authorUserId": teacherUserId },
      { $pull: { replies: { authorUserId: teacherUserId } } }
    ),
    ClassDiscussionMessage.updateMany(
      { $or: [{ likes: teacherUserId }, { dislikes: teacherUserId }] },
      { $pull: { likes: teacherUserId, dislikes: teacherUserId } }
    ),
    EmailOtp.deleteMany({ role: "teacher", userId: teacherUserId })
  ]);

  const userDelete = await User.deleteOne({ _id: teacher._id });
  const classDeleted = combineDeletionSummaries(classDeletionSummaries);

  return {
    ...classDeleted,
    users: getDeletedCount(userDelete),
    attendanceRecords:
      (classDeleted.attendanceRecords ?? 0) + getDeletedCount(attendanceRecords),
    leaveRequests:
      (classDeleted.leaveRequests ?? 0) + getDeletedCount(leaveRequests),
    exams: (classDeleted.exams ?? 0) + getDeletedCount(exams),
    qrSessions:
      (classDeleted.qrSessions ?? 0) + getDeletedCount(qrSessions),
    discussions:
      (classDeleted.discussions ?? 0) + getDeletedCount(ownMessages),
    discussionReplyDocumentsUpdated: replyUpdates.modifiedCount ?? 0,
    discussionReactionDocumentsUpdated: reactionUpdates.modifiedCount ?? 0,
    emailOtps: getDeletedCount(otps)
  };
}

export async function deleteAdminUser({ adminUserId, role, userId }) {
  await requireAdmin(adminUserId);
  const normalizedRole = normalizeRole(role);
  const normalizedUserId = normalizeUserId(userId);

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("Admin can delete student or teacher accounts only.");
  }

  const user = await User.findOne({
    role: normalizedRole,
    userId: normalizedUserId
  });

  if (!user) {
    throw new Error("User account not found.");
  }

  const deleted =
    normalizedRole === "student"
      ? await deleteStudentAccount(user)
      : await deleteTeacherAccount(user);

  return {
    deleted,
    user: sanitizeUser(user)
  };
}

export async function updateAdminUserEmailVerification({
  adminUserId,
  role,
  userId,
  emailVerified
}) {
  await requireAdmin(adminUserId);
  const normalizedRole = normalizeRole(role);

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("Admin can update student or teacher accounts only.");
  }

  const user = await User.findOne({
    role: normalizedRole,
    userId: normalizeUserId(userId)
  });

  if (!user) {
    throw new Error("User account not found.");
  }

  user.emailVerified = Boolean(emailVerified);
  user.emailVerifiedAt = user.emailVerified ? new Date() : null;
  user.emailVerificationRequired = Boolean(user.email && !user.emailVerified);
  await user.save();

  return {
    user: sanitizeUser(user)
  };
}
