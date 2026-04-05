import bcrypt from "bcryptjs";
import { User } from "../models/User.js";

function normalizeUserId(userId) {
  return String(userId).trim().toUpperCase();
}

export async function registerUser(payload) {
  const normalizedUserId = normalizeUserId(payload.userId);
  const existingUser = await User.findOne({ userId: normalizedUserId });

  if (existingUser) {
    throw new Error("A user with this ID already exists.");
  }

  const passwordHash = await bcrypt.hash(payload.password, 10);

  const user = await User.create({
    role: payload.role,
    firstName: payload.firstName,
    lastName: payload.lastName,
    userId: normalizedUserId,
    passwordHash,
    age: payload.age,
    gender: payload.gender,
    batch: payload.batch,
    yearOfPassing: payload.yearOfPassing,
    department: payload.department,
    email: payload.email,
    phoneNumber: payload.phoneNumber,
    designation: payload.designation,
    specialization: payload.specialization,
    experienceYears: payload.experienceYears,
    joiningYear: payload.joiningYear
  });

  return sanitizeUser(user);
}

export async function loginUser({ role, userId, password }) {
  const normalizedUserId = normalizeUserId(userId);
  const user = await User.findOne({ userId: normalizedUserId, role });

  if (!user) {
    throw new Error("Invalid role, ID, or password.");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new Error("Invalid role, ID, or password.");
  }

  return sanitizeUser(user);
}

function sanitizeUser(userDocument) {
  return {
    id: userDocument._id,
    role: userDocument.role,
    firstName: userDocument.firstName,
    lastName: userDocument.lastName,
    userId: userDocument.userId,
    age: userDocument.age,
    gender: userDocument.gender,
    batch: userDocument.batch,
    yearOfPassing: userDocument.yearOfPassing,
    department: userDocument.department,
    email: userDocument.email,
    phoneNumber: userDocument.phoneNumber,
    designation: userDocument.designation,
    specialization: userDocument.specialization,
    experienceYears: userDocument.experienceYears,
    joiningYear: userDocument.joiningYear
  };
}
