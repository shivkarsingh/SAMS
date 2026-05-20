import mongoose from "mongoose";
import { ClassDiscussionMessage } from "../models/ClassDiscussionMessage.js";
import { ClassMembership } from "../models/ClassMembership.js";
import { Classroom } from "../models/Classroom.js";
import { User } from "../models/User.js";
import {
  sanitizeScheduleSlots,
  summarizeScheduleSlots
} from "../utils/schedule.js";

const MAX_DISCUSSION_MESSAGE_LENGTH = 1000;
const MAX_DISCUSSION_REPLY_LENGTH = 600;
const MAX_DISCUSSION_MESSAGES = 80;

function normalizeUserId(userId) {
  return String(userId).trim().toUpperCase();
}

function formatFullName(person) {
  return `${person.firstName} ${person.lastName}`.trim();
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
    room: classroom.room,
    scheduleSummary: summarizeScheduleSlots(scheduleSlots, classroom.scheduleSummary),
    scheduleSlots
  };
}

function sanitizeMessage(message) {
  return {
    id: String(message._id),
    classId: String(message.classId),
    authorUserId: message.authorUserId,
    authorName: message.authorName,
    authorRole: message.authorRole,
    message: message.message,
    replies: (message.replies ?? []).map((reply) => ({
      id: String(reply._id),
      authorUserId: reply.authorUserId,
      authorName: reply.authorName,
      authorRole: reply.authorRole,
      message: reply.message,
      createdAt: reply.createdAt
    })),
    likes: message.likes ?? [],
    dislikes: message.dislikes ?? [],
    createdAt: message.createdAt
  };
}

function assertMessageObjectId(messageId) {
  const normalizedMessageId = String(messageId ?? "").trim();

  if (!mongoose.Types.ObjectId.isValid(normalizedMessageId)) {
    throw new Error("A valid discussion message ID is required.");
  }

  return normalizedMessageId;
}

async function getClassroomForParticipant({ classId, userId, role }) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedClassId = String(classId ?? "").trim();

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("A valid student or teacher role is required.");
  }

  if (!mongoose.Types.ObjectId.isValid(normalizedClassId)) {
    throw new Error("A valid classroom ID is required for discussion.");
  }

  const user = await User.findOne({
    userId: normalizedUserId,
    role: normalizedRole
  }).lean();

  if (!user) {
    throw new Error("User account not found for discussion access.");
  }

  if (normalizedRole === "teacher") {
    const classroom = await Classroom.findOne({
      _id: normalizedClassId,
      teacherUserId: normalizedUserId
    }).lean();

    if (!classroom) {
      throw new Error("You can only access discussion for classes you manage.");
    }

    return { classroom, user, role: normalizedRole };
  }

  const membership = await ClassMembership.findOne({
    classId: normalizedClassId,
    studentUserId: normalizedUserId
  }).lean();

  if (!membership) {
    throw new Error("You can only access discussion for classes you have joined.");
  }

  const classroom = await Classroom.findOne({
    _id: normalizedClassId,
    status: "active"
  }).lean();

  if (!classroom) {
    throw new Error("Classroom not found for discussion.");
  }

  return { classroom, user, role: normalizedRole };
}

export async function getClassDiscussion({ classId, userId, role }) {
  const { classroom } = await getClassroomForParticipant({
    classId,
    userId,
    role
  });
  const messages = await ClassDiscussionMessage.find({
    classId: classroom._id
  })
    .sort({ createdAt: -1 })
    .limit(MAX_DISCUSSION_MESSAGES)
    .lean();

  return {
    classroom: sanitizeClassroom(classroom),
    messages: messages.reverse().map(sanitizeMessage)
  };
}

export async function createClassDiscussionMessage({
  classId,
  userId,
  role,
  message
}) {
  const trimmedMessage = String(message ?? "").trim();

  if (!trimmedMessage) {
    throw new Error("Discussion message cannot be empty.");
  }

  if (trimmedMessage.length > MAX_DISCUSSION_MESSAGE_LENGTH) {
    throw new Error(
      `Discussion message must be ${MAX_DISCUSSION_MESSAGE_LENGTH} characters or fewer.`
    );
  }

  const { classroom, user, role: normalizedRole } = await getClassroomForParticipant({
    classId,
    userId,
    role
  });
  const createdMessage = await ClassDiscussionMessage.create({
    classId: classroom._id,
    authorUserId: normalizeUserId(user.userId),
    authorName: formatFullName(user),
    authorRole: normalizedRole,
    message: trimmedMessage
  });

  return sanitizeMessage(createdMessage);
}

export async function createClassDiscussionReply({
  classId,
  messageId,
  userId,
  role,
  message
}) {
  const normalizedMessageId = assertMessageObjectId(messageId);
  const trimmedMessage = String(message ?? "").trim();

  if (!trimmedMessage) {
    throw new Error("Reply cannot be empty.");
  }

  if (trimmedMessage.length > MAX_DISCUSSION_REPLY_LENGTH) {
    throw new Error(
      `Reply must be ${MAX_DISCUSSION_REPLY_LENGTH} characters or fewer.`
    );
  }

  const { classroom, user, role: normalizedRole } = await getClassroomForParticipant({
    classId,
    userId,
    role
  });
  const discussionMessage = await ClassDiscussionMessage.findOne({
    _id: normalizedMessageId,
    classId: classroom._id
  });

  if (!discussionMessage) {
    throw new Error("Discussion message not found for this class.");
  }

  discussionMessage.replies.push({
    authorUserId: normalizeUserId(user.userId),
    authorName: formatFullName(user),
    authorRole: normalizedRole,
    message: trimmedMessage
  });

  await discussionMessage.save();

  return sanitizeMessage(discussionMessage.toObject());
}

export async function toggleClassDiscussionReaction({
  classId,
  messageId,
  userId,
  role,
  reaction
}) {
  const normalizedMessageId = assertMessageObjectId(messageId);
  const normalizedReaction = String(reaction ?? "").trim().toLowerCase();

  if (!["like", "dislike"].includes(normalizedReaction)) {
    throw new Error("Reaction must be like or dislike.");
  }

  const { classroom } = await getClassroomForParticipant({
    classId,
    userId,
    role
  });
  const discussionMessage = await ClassDiscussionMessage.findOne({
    _id: normalizedMessageId,
    classId: classroom._id
  });

  if (!discussionMessage) {
    throw new Error("Discussion message not found for this class.");
  }

  const normalizedUserId = normalizeUserId(userId);
  const targetField = normalizedReaction === "like" ? "likes" : "dislikes";
  const oppositeField = normalizedReaction === "like" ? "dislikes" : "likes";
  const targetSet = new Set(discussionMessage[targetField] ?? []);
  const oppositeSet = new Set(discussionMessage[oppositeField] ?? []);

  if (targetSet.has(normalizedUserId)) {
    targetSet.delete(normalizedUserId);
  } else {
    targetSet.add(normalizedUserId);
    oppositeSet.delete(normalizedUserId);
  }

  discussionMessage[targetField] = [...targetSet];
  discussionMessage[oppositeField] = [...oppositeSet];

  await discussionMessage.save();

  return sanitizeMessage(discussionMessage.toObject());
}
