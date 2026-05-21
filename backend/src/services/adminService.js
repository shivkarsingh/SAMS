import mongoose from "mongoose";
import { AttendanceDraft } from "../models/AttendanceDraft.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
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
import {
  findStudentRollConflict,
  normalizeRollNumber
} from "../utils/studentRollNumberScope.js";
import { resolveStudentDisplayPhotoUrl } from "../utils/studentDisplayPhoto.js";
import { deleteClassroomData } from "./classroomDeletionService.js";

const rollNumberCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base"
});

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
}

function buildStudentUserId(firstName, rollNumber) {
  const namePart = String(firstName ?? "").trim().replace(/\s+/g, "");
  const rollPart = normalizeRollNumber(rollNumber);

  return namePart && rollPart ? normalizeUserId(`${namePart}#${rollPart}`) : "";
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
    avatarDataUrl: user.avatarDataUrl ?? "",
    rollNumber: user.rollNumber ?? "",
    department: user.department ?? "",
    semesterLabel: user.semesterLabel ?? "",
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
  const [classesCount, attendanceRecordsCount, faceProfile] =
    await Promise.all([
      ClassMembership.countDocuments({ studentUserId: student.userId }),
      AttendanceRecord.countDocuments({ studentId: student.userId }),
      FaceProfile.findOne({ studentUserId: student.userId }).lean()
    ]);

  return sanitizeUser(student, {
    rollNumber: getStudentDisplayRollNumber(student),
    faceProfilePhotoUrl: faceProfile?.profilePhotoUrl ?? "",
    profilePhotoUrl: resolveStudentDisplayPhotoUrl(student, faceProfile),
    classesCount,
    attendanceRecordsCount,
    faceProfile: faceProfile
      ? {
          status: faceProfile.status,
          enrolled: faceProfile.status === "enrolled",
          uploadedImageCount: faceProfile.uploadedImageCount ?? 0,
          embeddingCount: faceProfile.embeddingCount ?? 0,
          profilePhotoUrl: faceProfile.profilePhotoUrl ?? "",
          lastEnrolledAt: faceProfile.lastEnrolledAt ?? null
        }
      : {
          status: "not-started",
          enrolled: false,
          uploadedImageCount: 0,
          embeddingCount: 0,
          profilePhotoUrl: "",
          lastEnrolledAt: null
        }
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

async function findExistingStudentRollConflict(candidate, excludeUserId = "") {
  const studentsWithRollNumber = await User.find({
    role: "student",
    rollNumber: candidate.rollNumber
  }).lean();

  return findStudentRollConflict(studentsWithRollNumber, candidate, excludeUserId);
}

async function replaceDiscussionUserId(previousUserId, nextUserId) {
  if (previousUserId === nextUserId) {
    return;
  }

  await Promise.all([
    ClassDiscussionMessage.updateMany(
      { authorUserId: previousUserId },
      { $set: { authorUserId: nextUserId } }
    ),
    ClassDiscussionMessage.updateMany(
      { "replies.authorUserId": previousUserId },
      { $set: { "replies.$[reply].authorUserId": nextUserId } },
      { arrayFilters: [{ "reply.authorUserId": previousUserId }] }
    ),
    ClassDiscussionMessage.updateMany(
      { likes: previousUserId },
      { $set: { "likes.$[likedUserId]": nextUserId } },
      { arrayFilters: [{ likedUserId: previousUserId }] }
    ),
    ClassDiscussionMessage.updateMany(
      { dislikes: previousUserId },
      { $set: { "dislikes.$[dislikedUserId]": nextUserId } },
      { arrayFilters: [{ dislikedUserId: previousUserId }] }
    )
  ]);
}

async function replaceStudentRollNumberReferences({
  previousUserId,
  nextUserId,
  rollNumber
}) {
  const idChanged = previousUserId !== nextUserId;

  await Promise.all([
    ClassMembership.updateMany(
      { studentUserId: previousUserId },
      {
        $set: {
          ...(idChanged ? { studentUserId: nextUserId } : {}),
          rollNumber
        }
      }
    ),
    AttendanceRecord.updateMany(
      { studentId: previousUserId },
      {
        $set: {
          ...(idChanged ? { studentId: nextUserId } : {}),
          rollNumber
        }
      }
    ),
    AttendanceDraft.updateMany(
      { "records.studentId": previousUserId },
      {
        $set: {
          ...(idChanged ? { "records.$[record].studentId": nextUserId } : {}),
          "records.$[record].rollNumber": rollNumber
        }
      },
      { arrayFilters: [{ "record.studentId": previousUserId }] }
    ),
    LeaveRequest.updateMany(
      { studentUserId: previousUserId },
      {
        $set: {
          ...(idChanged ? { studentUserId: nextUserId } : {}),
          rollNumber
        }
      }
    ),
    ClassAssignmentSubmission.updateMany(
      { studentUserId: previousUserId },
      {
        $set: {
          ...(idChanged ? { studentUserId: nextUserId } : {}),
          rollNumber
        }
      }
    ),
    idChanged
      ? FaceProfile.updateMany(
          { studentUserId: previousUserId },
          {
            $set: {
              studentUserId: nextUserId,
              status: "needs-refresh"
            },
            $addToSet: {
              notes:
                "Roll number changed. Re-enroll this face profile before using AI attendance again."
            }
          }
        )
      : Promise.resolve(),
    idChanged
      ? EmailOtp.updateMany(
          { role: "student", userId: previousUserId },
          { $set: { userId: nextUserId } }
        )
      : Promise.resolve()
  ]);

  await replaceDiscussionUserId(previousUserId, nextUserId);
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

export async function updateAdminStudentRollNumber({
  adminUserId,
  userId,
  rollNumber
}) {
  await requireAdmin(adminUserId);
  const normalizedUserId = normalizeUserId(userId);
  const normalizedRollNumber = normalizeRollNumber(rollNumber);

  if (!normalizedRollNumber) {
    throw new Error("Roll number is required.");
  }

  if (!/^\d+$/.test(normalizedRollNumber)) {
    throw new Error("Roll number must contain numbers only.");
  }

  const student = await User.findOne({
    role: "student",
    userId: normalizedUserId
  });

  if (!student) {
    throw new Error("Student account not found.");
  }

  if (normalizedRollNumber === normalizeRollNumber(student.rollNumber)) {
    return {
      user: await getStudentRow(student)
    };
  }

  const existingRollNumber = await findExistingStudentRollConflict(
    {
      rollNumber: normalizedRollNumber,
      department: student.department,
      semesterLabel: student.semesterLabel
    },
    student.userId
  );

  if (existingRollNumber) {
    throw new Error(
      "A student with this roll number already exists in the same branch and semester."
    );
  }

  const nextUserId = buildStudentUserId(student.firstName, normalizedRollNumber);

  if (!nextUserId) {
    throw new Error("Student ID could not be generated from name and roll number.");
  }

  const existingUserId = await User.findOne({
    userId: nextUserId,
    _id: { $ne: student._id }
  }).lean();

  if (existingUserId) {
    throw new Error("A user with the generated student ID already exists.");
  }

  await replaceStudentRollNumberReferences({
    previousUserId: student.userId,
    nextUserId,
    rollNumber: normalizedRollNumber
  });

  student.userId = nextUserId;
  student.rollNumber = normalizedRollNumber;
  await student.save();

  return {
    user: await getStudentRow(student)
  };
}
