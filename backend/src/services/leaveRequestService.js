import mongoose from "mongoose";
import { ClassMembership } from "../models/ClassMembership.js";
import { Classroom } from "../models/Classroom.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { notifyLeaveReview } from "./emailNotificationService.js";

const MAX_LEAVE_ATTACHMENTS = 4;
const MAX_LEAVE_ATTACHMENT_BYTES = 2.5 * 1024 * 1024;
const ALLOWED_LEAVE_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
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
  const fileType = String(attachment?.fileType ?? "application/octet-stream").trim();
  const fileSize = Number(attachment?.fileSize ?? 0);

  if (!fileName || !dataUrl) {
    throw new Error("Every proof document needs a file name and file data.");
  }

  if (fileName.length > 140) {
    throw new Error("Proof document file names must be 140 characters or fewer.");
  }

  if (!dataUrl.startsWith("data:")) {
    throw new Error("Proof documents must be sent as browser data URLs.");
  }

  if (!ALLOWED_LEAVE_ATTACHMENT_TYPES.has(fileType)) {
    throw new Error("Upload PDF or image files only for leave proof.");
  }

  if (
    !Number.isFinite(fileSize) ||
    fileSize <= 0 ||
    fileSize > MAX_LEAVE_ATTACHMENT_BYTES ||
    estimateDataUrlBytes(dataUrl) > MAX_LEAVE_ATTACHMENT_BYTES
  ) {
    throw new Error("Each leave proof document must be 2.5 MB or smaller.");
  }

  return {
    fileName,
    fileType,
    fileSize,
    dataUrl
  };
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  if (attachments.length > MAX_LEAVE_ATTACHMENTS) {
    throw new Error(`Use ${MAX_LEAVE_ATTACHMENTS} or fewer proof documents.`);
  }

  return attachments.map(normalizeAttachment);
}

function normalizeRequestType(requestType) {
  const normalizedType = String(requestType ?? "").trim().toLowerCase();

  return ["medical", "leave", "other"].includes(normalizedType)
    ? normalizedType
    : "other";
}

function normalizeAbsenceDate(value) {
  const absenceDate = new Date(value);

  if (!Number.isFinite(absenceDate.getTime())) {
    throw new Error("A valid absence date is required.");
  }

  absenceDate.setHours(0, 0, 0, 0);
  return absenceDate;
}

function sanitizeLeaveRequest(request) {
  return {
    id: String(request._id),
    classId: String(request.classId),
    teacherUserId: request.teacherUserId,
    studentUserId: request.studentUserId,
    studentName: request.studentName,
    rollNumber: request.rollNumber,
    requestType: request.requestType,
    absenceDate: request.absenceDate,
    reason: request.reason,
    attachments: request.attachments ?? [],
    status: request.status,
    teacherNote: request.teacherNote ?? "",
    reviewedBy: request.reviewedBy ?? "",
    reviewedAt: request.reviewedAt,
    submittedAt: request.submittedAt,
    updatedAt: request.updatedAt
  };
}

export function sanitizeLeaveRequests(requests = []) {
  return requests.map(sanitizeLeaveRequest);
}

async function getStudentMembership(studentUserId, classId) {
  const normalizedClassId = assertObjectId(classId, "Classroom ID");
  const normalizedStudentUserId = normalizeUserId(studentUserId);
  const membership = await ClassMembership.findOne({
    classId: normalizedClassId,
    studentUserId: normalizedStudentUserId
  }).lean();

  if (!membership) {
    throw new Error("You can only submit leave proof for classes you have joined.");
  }

  const classroom = await Classroom.findOne({
    _id: normalizedClassId,
    status: "active"
  }).lean();

  if (!classroom) {
    throw new Error("Classroom not found.");
  }

  return {
    classroom,
    membership,
    normalizedStudentUserId
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
    throw new Error("You can only review leave requests for classes you teach.");
  }

  return {
    classroom,
    normalizedTeacherUserId
  };
}

export async function submitStudentLeaveRequest({
  studentUserId,
  classId,
  requestType,
  absenceDate,
  reason,
  attachments
}) {
  const { classroom, membership, normalizedStudentUserId } =
    await getStudentMembership(studentUserId, classId);
  const trimmedReason = String(reason ?? "").trim();
  const normalizedAttachments = normalizeAttachments(attachments);

  if (trimmedReason.length < 8) {
    throw new Error("Add a short reason for the leave or absence request.");
  }

  if (!normalizedAttachments.length) {
    throw new Error("Upload at least one PDF or image proof document.");
  }

  const request = await LeaveRequest.create({
    classId: classroom._id,
    teacherUserId: classroom.teacherUserId,
    studentUserId: normalizedStudentUserId,
    studentName: membership.studentName,
    rollNumber: membership.rollNumber,
    requestType: normalizeRequestType(requestType),
    absenceDate: normalizeAbsenceDate(absenceDate),
    reason: trimmedReason,
    attachments: normalizedAttachments,
    status: "pending",
    submittedAt: new Date()
  });

  return sanitizeLeaveRequest(request.toObject());
}

export async function reviewTeacherLeaveRequest({
  teacherUserId,
  classId,
  requestId,
  status,
  teacherNote
}) {
  const { classroom, normalizedTeacherUserId } = await getTeacherClassroom(
    teacherUserId,
    classId
  );
  const normalizedRequestId = assertObjectId(requestId, "Leave request ID");
  const normalizedStatus = String(status ?? "").trim().toLowerCase();

  if (!["approved", "rejected"].includes(normalizedStatus)) {
    throw new Error("Leave request review must be approved or rejected.");
  }

  const request = await LeaveRequest.findOne({
    _id: normalizedRequestId,
    classId: classroom._id,
    teacherUserId: normalizedTeacherUserId
  });

  if (!request) {
    throw new Error("Leave request not found for this class.");
  }

  request.status = normalizedStatus;
  request.teacherNote = String(teacherNote ?? "").trim();
  request.reviewedBy = normalizedTeacherUserId;
  request.reviewedAt = new Date();
  await request.save();

  const sanitizedRequest = sanitizeLeaveRequest(request.toObject());
  const emailStatus = await notifyLeaveReview({
    leaveRequest: sanitizedRequest,
    classroom
  });

  return {
    ...sanitizedRequest,
    emailStatus
  };
}
