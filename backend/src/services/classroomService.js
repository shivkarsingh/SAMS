import crypto from "crypto";
import { Classroom } from "../models/Classroom.js";
import { ClassMembership } from "../models/ClassMembership.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

function normalizeUserId(userId) {
  return String(userId).trim().toUpperCase();
}

function formatFullName(person) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function buildJoinLink(joinCode) {
  return `${env.frontendAppUrl.replace(/\/$/, "")}/#/join-class?code=${encodeURIComponent(
    joinCode
  )}`;
}

function sanitizeClassroom(classroom, membersCount = 0) {
  return {
    id: String(classroom._id),
    teacherUserId: classroom.teacherUserId,
    teacherName: classroom.teacherName,
    subjectName: classroom.subjectName,
    subjectCode: classroom.subjectCode,
    section: classroom.section,
    description: classroom.description,
    room: classroom.room,
    semesterLabel: classroom.semesterLabel,
    academicYear: classroom.academicYear,
    batch: classroom.batch,
    scheduleSummary: classroom.scheduleSummary,
    joinCode: classroom.joinCode,
    joinLink: classroom.joinLink,
    status: classroom.status,
    studentsCount: membersCount,
    createdAt: classroom.createdAt
  };
}

async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const joinCode = `SAMS-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const existingClassroom = await Classroom.findOne({ joinCode }).lean();

    if (!existingClassroom) {
      return joinCode;
    }
  }

  throw new Error("Unable to generate a unique join code. Please try again.");
}

function normalizeJoinCode(joinInput) {
  const rawValue = String(joinInput ?? "").trim();

  if (!rawValue) {
    throw new Error("Join link or join code is required.");
  }

  try {
    const parsedUrl = new URL(rawValue);
    const codeFromQuery = parsedUrl.searchParams.get("code");
    const hashValue = parsedUrl.hash.startsWith("#")
      ? parsedUrl.hash.slice(1)
      : parsedUrl.hash;
    const hashQuery = hashValue.includes("?")
      ? new URLSearchParams(hashValue.split("?")[1])
      : null;
    const codeFromHash = hashQuery?.get("code");

    if (codeFromQuery) {
      return codeFromQuery.trim().toUpperCase();
    }

    if (codeFromHash) {
      return codeFromHash.trim().toUpperCase();
    }

    const pathnamePart = parsedUrl.pathname.split("/").filter(Boolean).at(-1);
    const hashPathPart = hashValue.split("?")[0].split("/").filter(Boolean).at(-1);

    if (pathnamePart) {
      return pathnamePart.trim().toUpperCase();
    }

    if (hashPathPart && hashPathPart !== "join-class") {
      return hashPathPart.trim().toUpperCase();
    }
  } catch {
    return rawValue.replace(/\s+/g, "").toUpperCase();
  }

  return rawValue.replace(/\s+/g, "").toUpperCase();
}

export async function createClassroom(payload) {
  const normalizedTeacherUserId = normalizeUserId(payload.teacherUserId);
  const teacher = await User.findOne({
    userId: normalizedTeacherUserId,
    role: "teacher"
  });

  if (!teacher) {
    throw new Error("Teacher account not found.");
  }

  const joinCode = await generateUniqueJoinCode();
  const joinLink = buildJoinLink(joinCode);

  const classroom = await Classroom.create({
    teacherUserId: normalizedTeacherUserId,
    teacherName: formatFullName(teacher),
    subjectName: payload.subjectName,
    subjectCode: String(payload.subjectCode).trim().toUpperCase(),
    section: payload.section,
    description: payload.description,
    room: payload.room,
    semesterLabel: payload.semesterLabel,
    academicYear: payload.academicYear,
    batch: payload.batch,
    scheduleSummary: payload.scheduleSummary,
    joinCode,
    joinLink
  });

  return sanitizeClassroom(classroom, 0);
}

export async function joinClassroom(payload) {
  const normalizedStudentUserId = normalizeUserId(payload.studentUserId);
  const student = await User.findOne({
    userId: normalizedStudentUserId,
    role: "student"
  });

  if (!student) {
    throw new Error("Student account not found.");
  }

  const joinCode = normalizeJoinCode(payload.joinInput);
  const classroom = await Classroom.findOne({
    joinCode,
    status: "active"
  });

  if (!classroom) {
    throw new Error("No active class was found for this join code.");
  }

  const existingMembership = await ClassMembership.findOne({
    classId: classroom._id,
    studentUserId: normalizedStudentUserId
  });

  if (existingMembership) {
    return {
      classroom: sanitizeClassroom(classroom, await getClassroomMemberCount(classroom._id)),
      alreadyJoined: true
    };
  }

  await ClassMembership.create({
    classId: classroom._id,
    studentUserId: normalizedStudentUserId,
    studentName: formatFullName(student)
  });

  return {
    classroom: sanitizeClassroom(classroom, await getClassroomMemberCount(classroom._id)),
    alreadyJoined: false
  };
}

async function getClassroomMemberCount(classId) {
  return ClassMembership.countDocuments({ classId });
}

export async function getTeacherManagedClasses(teacherUserId) {
  const normalizedTeacherUserId = normalizeUserId(teacherUserId);
  const classrooms = await Classroom.find({
    teacherUserId: normalizedTeacherUserId
  })
    .sort({ createdAt: -1 })
    .lean();

  const counts = await Promise.all(
    classrooms.map((classroom) => getClassroomMemberCount(classroom._id))
  );

  return classrooms.map((classroom, index) =>
    sanitizeClassroom(classroom, counts[index])
  );
}

export async function getStudentJoinedClasses(studentUserId) {
  const normalizedStudentUserId = normalizeUserId(studentUserId);
  const memberships = await ClassMembership.find({
    studentUserId: normalizedStudentUserId
  })
    .sort({ createdAt: -1 })
    .lean();

  const classIds = memberships.map((membership) => membership.classId);
  const classrooms = await Classroom.find({
    _id: { $in: classIds }
  }).lean();

  const counts = await Promise.all(
    classrooms.map((classroom) => getClassroomMemberCount(classroom._id))
  );
  const classroomById = new Map(
    classrooms.map((classroom, index) => [
      String(classroom._id),
      {
        classroom,
        membersCount: counts[index]
      }
    ])
  );

  return memberships
    .map((membership) => {
      const classroomRecord = classroomById.get(String(membership.classId));

      if (!classroomRecord) {
        return null;
      }

      return {
        ...sanitizeClassroom(
          classroomRecord.classroom,
          classroomRecord.membersCount
        ),
        joinedAt: membership.createdAt
      };
    })
    .filter(Boolean);
}
