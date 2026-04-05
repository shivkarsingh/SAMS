import { FaceProfile } from "../models/FaceProfile.js";
import { User } from "../models/User.js";
import { enrollFaceProfileWithAi } from "./aiService.js";
import { getStudentJoinedClasses } from "./classroomService.js";

function normalizeUserId(userId) {
  return String(userId).trim().toUpperCase();
}

function formatFullName(person) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function sanitizeFaceProfile(faceProfile) {
  if (!faceProfile) {
    return {
      status: "not-started",
      uploadedImageCount: 0,
      embeddingCount: 0,
      averageQualityScore: 0,
      faceModel: "ArcFace",
      executionMode: "simulated",
      referenceImageNames: [],
      notes: [
        "Upload 6 to 10 clear face images so your face profile can be enrolled once and reused across classes."
      ],
      lastEnrolledAt: null
    };
  }

  return {
    status: faceProfile.status,
    uploadedImageCount: faceProfile.uploadedImageCount,
    embeddingCount: faceProfile.embeddingCount,
    averageQualityScore: faceProfile.averageQualityScore,
    faceModel: faceProfile.faceModel,
    executionMode: faceProfile.executionMode,
    referenceImageNames: faceProfile.referenceImageNames,
    notes: faceProfile.notes,
    lastEnrolledAt: faceProfile.lastEnrolledAt
  };
}

export async function getFaceProfile(studentUserId) {
  const normalizedStudentUserId = normalizeUserId(studentUserId);
  const faceProfile = await FaceProfile.findOne({
    studentUserId: normalizedStudentUserId
  }).lean();

  return sanitizeFaceProfile(faceProfile);
}

export async function enrollStudentFaceProfile({ studentUserId, images }) {
  const normalizedStudentUserId = normalizeUserId(studentUserId);
  const student = await User.findOne({
    userId: normalizedStudentUserId,
    role: "student"
  });

  if (!student) {
    throw new Error("Student account not found.");
  }

  if (!Array.isArray(images) || images.length < 6) {
    throw new Error("Please upload at least 6 clear images for face enrollment.");
  }

  const validImages = images.filter(
    (image) =>
      image &&
      typeof image.fileName === "string" &&
      image.fileName.trim() &&
      typeof image.dataUrl === "string" &&
      image.dataUrl.startsWith("data:image/")
  );

  if (validImages.length < 6) {
    throw new Error("Please provide valid image files for enrollment.");
  }

  const joinedClasses = await getStudentJoinedClasses(normalizedStudentUserId);
  const aiResult = await enrollFaceProfileWithAi({
    personId: normalizedStudentUserId,
    fullName: formatFullName(student),
    role: "student",
    classIds: joinedClasses.map((joinedClass) => joinedClass.id),
    metadata: {
      department: student.department,
      batch: student.batch,
      yearOfPassing: student.yearOfPassing
    },
    referenceImages: validImages.map((image) => image.dataUrl)
  });

  const updatedFaceProfile = await FaceProfile.findOneAndUpdate(
    {
      studentUserId: normalizedStudentUserId
    },
    {
      studentUserId: normalizedStudentUserId,
      studentName: formatFullName(student),
      status: "enrolled",
      uploadedImageCount: validImages.length,
      embeddingCount: aiResult.embeddingCount,
      averageQualityScore: aiResult.averageQualityScore,
      faceModel: aiResult.faceModel,
      executionMode: aiResult.executionMode,
      referenceImageNames: validImages.map((image) => image.fileName),
      notes: aiResult.notes,
      lastEnrolledAt: aiResult.storedAt
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return sanitizeFaceProfile(updatedFaceProfile);
}
