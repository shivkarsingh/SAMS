import {
  enrollStudentFaceProfile,
  getFaceProfile
} from "../services/faceProfileService.js";

export async function getStudentFaceProfile(request, response) {
  const { studentId } = request.params;

  if (!studentId) {
    response.status(400).json({
      message: "studentId is required."
    });
    return;
  }

  try {
    const faceProfile = await getFaceProfile(studentId);

    response.json({
      faceProfile
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to load face enrollment profile."
    });
  }
}

export async function enrollFaceProfile(request, response) {
  const { studentId } = request.params;
  const { images } = request.body ?? {};

  if (!studentId) {
    response.status(400).json({
      message: "studentId is required."
    });
    return;
  }

  try {
    const faceProfile = await enrollStudentFaceProfile({
      studentUserId: studentId,
      images
    });

    response.status(201).json({
      message: "Face profile enrolled successfully.",
      faceProfile
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to enroll face profile."
    });
  }
}
