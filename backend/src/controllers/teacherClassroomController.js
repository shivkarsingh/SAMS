import {
  finalizeTeacherClassAttendance,
  getTeacherClassroomDetails,
  processTeacherClassAttendance
} from "../services/teacherClassroomService.js";

export async function getTeacherClassroom(request, response) {
  const { teacherId, classId } = request.params;

  if (!teacherId || !classId) {
    response.status(400).json({
      message: "teacherId and classId are required."
    });
    return;
  }

  try {
    const classroom = await getTeacherClassroomDetails({
      teacherUserId: teacherId,
      classId
    });

    response.json(classroom);
  } catch (error) {
    response.status(404).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to load teacher classroom."
    });
  }
}

export async function processTeacherAttendance(request, response) {
  const { teacherId, classId } = request.params;
  const { images } = request.body ?? {};

  if (!teacherId || !classId) {
    response.status(400).json({
      message: "teacherId and classId are required."
    });
    return;
  }

  try {
    const result = await processTeacherClassAttendance({
      teacherUserId: teacherId,
      classId,
      images
    });

    response.json({
      message: "Attendance verification completed.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to process attendance for this class."
    });
  }
}

export async function finalizeTeacherAttendance(request, response) {
  const { teacherId, classId } = request.params;
  const {
    sessionId,
    confirmedPresentIds,
    manuallyAddedPresentIds,
    rejectedTrackIds,
    notes
  } = request.body ?? {};

  if (!teacherId || !classId || !sessionId) {
    response.status(400).json({
      message: "teacherId, classId, and sessionId are required."
    });
    return;
  }

  try {
    const result = await finalizeTeacherClassAttendance({
      teacherUserId: teacherId,
      classId,
      sessionId,
      confirmedPresentIds,
      manuallyAddedPresentIds,
      rejectedTrackIds,
      notes
    });

    response.json({
      message: "Attendance submitted successfully.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to finalize attendance."
    });
  }
}
