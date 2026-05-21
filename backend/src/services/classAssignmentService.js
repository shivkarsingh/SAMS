import mongoose from "mongoose";
import { ClassAssignment } from "../models/ClassAssignment.js";
import { ClassAssignmentSubmission } from "../models/ClassAssignmentSubmission.js";
import { ClassMembership } from "../models/ClassMembership.js";
import { Classroom } from "../models/Classroom.js";
import { FaceProfile } from "../models/FaceProfile.js";
import { User } from "../models/User.js";
import {
  sanitizeScheduleSlots,
  summarizeScheduleSlots
} from "../utils/schedule.js";
import { resolveStudentDisplayPhotoUrl } from "../utils/studentDisplayPhoto.js";

const MAX_ASSIGNMENT_ATTACHMENTS = 6;
const MAX_ASSIGNMENT_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
}

function formatFullName(person) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function getStudentPhotoPayload(user, faceProfile) {
  return {
    avatarDataUrl: user?.avatarDataUrl ?? "",
    faceProfilePhotoUrl: faceProfile?.profilePhotoUrl ?? "",
    profilePhotoUrl: resolveStudentDisplayPhotoUrl(user, faceProfile)
  };
}

async function getStudentPhotosById(studentIds = []) {
  const normalizedStudentIds = Array.from(
    new Set(studentIds.map((studentId) => normalizeUserId(studentId)).filter(Boolean))
  );

  if (!normalizedStudentIds.length) {
    return new Map();
  }

  const [users, faceProfiles] = await Promise.all([
    User.find({
      userId: { $in: normalizedStudentIds },
      role: "student"
    }).lean(),
    FaceProfile.find({
      studentUserId: { $in: normalizedStudentIds }
    }).lean()
  ]);
  const usersById = new Map(users.map((user) => [normalizeUserId(user.userId), user]));
  const faceProfilesById = new Map(
    faceProfiles.map((profile) => [normalizeUserId(profile.studentUserId), profile])
  );

  return new Map(
    normalizedStudentIds.map((studentId) => [
      studentId,
      getStudentPhotoPayload(usersById.get(studentId), faceProfilesById.get(studentId))
    ])
  );
}

function assertObjectId(value, label) {
  const normalizedValue = String(value ?? "").trim();

  if (!mongoose.Types.ObjectId.isValid(normalizedValue)) {
    throw new Error(`${label} is invalid.`);
  }

  return normalizedValue;
}

function estimateDataUrlBytes(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  const base64Payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;

  return Math.ceil((base64Payload.length * 3) / 4);
}

function normalizeAttachment(attachment) {
  const fileName = String(attachment?.fileName ?? "").trim();
  const dataUrl = String(attachment?.dataUrl ?? "").trim();
  const fileSize = Number(attachment?.fileSize ?? 0);

  if (!fileName || !dataUrl) {
    throw new Error("Every attachment needs a file name and file data.");
  }

  if (fileName.length > 140) {
    throw new Error("Attachment file names must be 140 characters or fewer.");
  }

  if (!dataUrl.startsWith("data:")) {
    throw new Error("Attachments must be sent as browser data URLs.");
  }

  if (
    !Number.isFinite(fileSize) ||
    fileSize < 0 ||
    fileSize > MAX_ASSIGNMENT_ATTACHMENT_BYTES ||
    estimateDataUrlBytes(dataUrl) > MAX_ASSIGNMENT_ATTACHMENT_BYTES
  ) {
    throw new Error("Each assignment attachment must be 5 MB or smaller.");
  }

  return {
    fileName,
    fileType: String(attachment?.fileType ?? "application/octet-stream").trim(),
    fileSize,
    dataUrl
  };
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  if (attachments.length > MAX_ASSIGNMENT_ATTACHMENTS) {
    throw new Error(
      `Use ${MAX_ASSIGNMENT_ATTACHMENTS} or fewer files for one assignment action.`
    );
  }

  return attachments.map(normalizeAttachment);
}

function sanitizeClassroom(classroom) {
  const scheduleSlots = sanitizeScheduleSlots(classroom.scheduleSlots);

  return {
    id: String(classroom._id),
    teacherUserId: classroom.teacherUserId,
    teacherName: classroom.teacherName,
    subjectName: classroom.subjectName,
    subjectCode: classroom.subjectCode,
    section: classroom.section,
    scheduleSummary: summarizeScheduleSlots(scheduleSlots, classroom.scheduleSummary),
    scheduleSlots
  };
}

function sanitizeSubmission(submission, studentPhotosById = new Map()) {
  if (!submission) {
    return null;
  }

  const studentPhoto =
    studentPhotosById.get(normalizeUserId(submission.studentUserId)) ?? {};

  return {
    id: String(submission._id),
    assignmentId: String(submission.assignmentId),
    classId: String(submission.classId),
    studentUserId: submission.studentUserId,
    studentName: submission.studentName,
    rollNumber: submission.rollNumber,
    avatarDataUrl: studentPhoto.avatarDataUrl ?? "",
    faceProfilePhotoUrl: studentPhoto.faceProfilePhotoUrl ?? "",
    profilePhotoUrl: studentPhoto.profilePhotoUrl ?? "",
    comment: submission.comment,
    attachments: submission.attachments,
    status: submission.status,
    submittedAt: submission.submittedAt,
    updatedAt: submission.updatedAt
  };
}

function sanitizeMissingStudent(membership, studentPhotosById = new Map()) {
  const studentPhoto =
    studentPhotosById.get(normalizeUserId(membership.studentUserId)) ?? {};

  return {
    studentUserId: membership.studentUserId,
    studentName: membership.studentName,
    rollNumber: membership.rollNumber,
    avatarDataUrl: studentPhoto.avatarDataUrl ?? "",
    faceProfilePhotoUrl: studentPhoto.faceProfilePhotoUrl ?? "",
    profilePhotoUrl: studentPhoto.profilePhotoUrl ?? ""
  };
}

function sanitizeAssignment(
  assignment,
  submissions = [],
  mySubmission = null,
  summary = {},
  studentPhotosById = new Map()
) {
  const assignedStudentCount = Number(summary.assignedStudentCount ?? 0);
  const lateSubmissionCount =
    summary.lateSubmissionCount ??
    submissions.filter((submission) => submission.status === "late").length;
  const missingSubmissions = summary.missingSubmissions ?? [];

  return {
    id: String(assignment._id),
    classId: String(assignment.classId),
    teacherUserId: assignment.teacherUserId,
    title: assignment.title,
    instructions: assignment.instructions,
    deadlineAt: assignment.deadlineAt,
    attachments: assignment.attachments,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    assignedStudentCount,
    submissionCount: submissions.length,
    lateSubmissionCount,
    missingSubmissionCount: Math.max(
      Number(summary.missingSubmissionCount ?? missingSubmissions.length),
      0
    ),
    missingSubmissions: missingSubmissions.map((membership) =>
      sanitizeMissingStudent(membership, studentPhotosById)
    ),
    submissions: submissions.map((submission) =>
      sanitizeSubmission(submission, studentPhotosById)
    ),
    mySubmission: sanitizeSubmission(mySubmission, studentPhotosById)
  };
}

async function getTeacherClassroom(teacherUserId, classId) {
  const normalizedClassId = assertObjectId(classId, "Classroom ID");
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classroom = await Classroom.findOne({
    _id: normalizedClassId,
    teacherUserId: normalizedTeacherUserId
  }).lean();

  if (!classroom) {
    throw new Error("You can only manage assignments for classes you teach.");
  }

  return classroom;
}

async function getStudentClassroom(studentUserId, classId) {
  const normalizedClassId = assertObjectId(classId, "Classroom ID");
  const normalizedStudentUserId = normalizeUserId(studentUserId);
  const membership = await ClassMembership.findOne({
    classId: normalizedClassId,
    studentUserId: normalizedStudentUserId
  }).lean();

  if (!membership) {
    throw new Error("You can only open assignments for classes you have joined.");
  }

  const classroom = await Classroom.findOne({
    _id: normalizedClassId,
    status: "active"
  }).lean();

  if (!classroom) {
    throw new Error("Classroom not found.");
  }

  return { classroom, membership };
}

async function getClassroomForParticipant({ classId, userId, role }) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();

  if (normalizedRole === "teacher") {
    return {
      classroom: await getTeacherClassroom(userId, classId),
      membership: null,
      role: normalizedRole
    };
  }

  if (normalizedRole === "student") {
    return {
      ...(await getStudentClassroom(userId, classId)),
      role: normalizedRole
    };
  }

  throw new Error("A valid student or teacher role is required.");
}

export async function listClassAssignments({ classId, userId, role }) {
  const { classroom, role: normalizedRole } = await getClassroomForParticipant({
    classId,
    userId,
    role
  });
  const assignments = await ClassAssignment.find({
    classId: classroom._id
  })
    .sort({ createdAt: -1 })
    .lean();
  const assignmentIds = assignments.map((assignment) => assignment._id);
  const submissionQuery =
    normalizedRole === "teacher"
      ? { assignmentId: { $in: assignmentIds } }
      : {
          assignmentId: { $in: assignmentIds },
          studentUserId: normalizeUserId(userId)
        };
  const submissions = assignmentIds.length
    ? await ClassAssignmentSubmission.find(submissionQuery)
        .sort({ submittedAt: -1 })
        .lean()
    : [];
  const submissionsByAssignment = new Map();
  const roster =
    normalizedRole === "teacher"
      ? await ClassMembership.find({
          classId: classroom._id
        })
          .sort({ rollNumber: 1, studentName: 1 })
          .lean()
      : [];
  const studentPhotosById = await getStudentPhotosById([
    ...roster.map((membership) => membership.studentUserId),
    ...submissions.map((submission) => submission.studentUserId),
    ...(normalizedRole === "student" ? [userId] : [])
  ]);

  submissions.forEach((submission) => {
    const assignmentKey = String(submission.assignmentId);
    const currentSubmissions = submissionsByAssignment.get(assignmentKey) ?? [];
    currentSubmissions.push(submission);
    submissionsByAssignment.set(assignmentKey, currentSubmissions);
  });

  return {
    classroom: sanitizeClassroom(classroom),
    assignments: assignments.map((assignment) => {
      const currentSubmissions =
        submissionsByAssignment.get(String(assignment._id)) ?? [];
      const submittedStudentIds = new Set(
        currentSubmissions.map((submission) => submission.studentUserId)
      );
      const missingSubmissions =
        normalizedRole === "teacher"
          ? roster.filter(
              (membership) => !submittedStudentIds.has(membership.studentUserId)
            )
          : [];

      return sanitizeAssignment(
        assignment,
        normalizedRole === "teacher" ? currentSubmissions : [],
        normalizedRole === "student" ? currentSubmissions[0] : null,
        normalizedRole === "teacher"
          ? {
              assignedStudentCount: roster.length,
              lateSubmissionCount: currentSubmissions.filter(
                (submission) => submission.status === "late"
              ).length,
              missingSubmissionCount: missingSubmissions.length,
              missingSubmissions
            }
          : {},
        studentPhotosById
      );
    })
  };
}

export async function createClassAssignment({
  teacherUserId,
  classId,
  title,
  instructions,
  deadlineAt,
  attachments
}) {
  const classroom = await getTeacherClassroom(teacherUserId, classId);
  const trimmedTitle = String(title ?? "").trim();
  const normalizedDeadline = new Date(deadlineAt);

  if (!trimmedTitle) {
    throw new Error("Assignment title is required.");
  }

  if (!Number.isFinite(normalizedDeadline.getTime())) {
    throw new Error("A valid assignment deadline is required.");
  }

  if (normalizedDeadline <= new Date()) {
    throw new Error("Assignment deadline must be in the future.");
  }

  const assignment = await ClassAssignment.create({
    classId: classroom._id,
    teacherUserId: normalizeUserId(teacherUserId),
    title: trimmedTitle,
    instructions: String(instructions ?? "").trim(),
    deadlineAt: normalizedDeadline,
    attachments: normalizeAttachments(attachments)
  });

  return sanitizeAssignment(assignment.toObject());
}

export async function submitClassAssignment({
  studentUserId,
  classId,
  assignmentId,
  comment,
  attachments
}) {
  const normalizedAssignmentId = assertObjectId(assignmentId, "Assignment ID");
  const { classroom, membership } = await getStudentClassroom(studentUserId, classId);
  const assignment = await ClassAssignment.findOne({
    _id: normalizedAssignmentId,
    classId: classroom._id
  }).lean();

  if (!assignment) {
    throw new Error("Assignment not found for this class.");
  }

  const [student, faceProfile] = await Promise.all([
    User.findOne({
      userId: normalizeUserId(studentUserId),
      role: "student"
    }).lean(),
    FaceProfile.findOne({
      studentUserId: normalizeUserId(studentUserId)
    }).lean()
  ]);
  const normalizedAttachments = normalizeAttachments(attachments);
  const trimmedComment = String(comment ?? "").trim();

  if (!normalizedAttachments.length && !trimmedComment) {
    throw new Error("Add a file or private comment before submitting.");
  }

  const submittedAt = new Date();
  const status = submittedAt > new Date(assignment.deadlineAt) ? "late" : "submitted";
  const submission = await ClassAssignmentSubmission.findOneAndUpdate(
    {
      assignmentId: assignment._id,
      studentUserId: normalizeUserId(studentUserId)
    },
    {
      assignmentId: assignment._id,
      classId: classroom._id,
      studentUserId: normalizeUserId(studentUserId),
      studentName: student ? formatFullName(student) : membership.studentName,
      rollNumber: String(student?.rollNumber ?? membership.rollNumber ?? "").trim(),
      comment: trimmedComment,
      attachments: normalizedAttachments,
      status,
      submittedAt
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return sanitizeSubmission(
    submission,
    new Map([
      [normalizeUserId(studentUserId), getStudentPhotoPayload(student, faceProfile)]
    ])
  );
}
