import {
  createClassroom,
  joinClassroom
} from "../services/classroomService.js";

function hasRequiredClassFields(payload) {
  return [
    "subjectName",
    "subjectCode",
    "section",
    "room",
    "semesterLabel",
    "academicYear",
    "scheduleSummary"
  ].every((field) => payload?.[field] !== undefined && payload?.[field] !== "");
}

export async function createTeacherClass(request, response) {
  const { teacherId } = request.params;
  const payload = request.body ?? {};

  if (!teacherId) {
    response.status(400).json({
      message: "teacherId is required."
    });
    return;
  }

  if (!hasRequiredClassFields(payload)) {
    response.status(400).json({
      message: "Please fill all required class details."
    });
    return;
  }

  try {
    const classroom = await createClassroom({
      teacherUserId: teacherId,
      ...payload
    });

    response.status(201).json({
      message: "Class created successfully.",
      classroom
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to create class."
    });
  }
}

export async function joinStudentClass(request, response) {
  const { studentId } = request.params;
  const { joinInput } = request.body ?? {};

  if (!studentId) {
    response.status(400).json({
      message: "studentId is required."
    });
    return;
  }

  if (!joinInput) {
    response.status(400).json({
      message: "Join link or join code is required."
    });
    return;
  }

  try {
    const result = await joinClassroom({
      studentUserId: studentId,
      joinInput
    });

    response.json({
      message: result.alreadyJoined
        ? "You have already joined this class."
        : "Class joined successfully.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Unable to join class."
    });
  }
}
