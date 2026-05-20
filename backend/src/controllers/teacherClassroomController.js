import {
  addTeacherClassroomStudent,
  archiveTeacherClassroom,
  cancelTeacherClassToday,
  createTeacherQrAttendanceSession,
  deleteTeacherClassroomStudent,
  finalizeTeacherClassAttendance,
  finalizeTeacherTodayAttendanceDraft,
  getTeacherClassroomDetails,
  markStudentQrAttendance,
  processTeacherClassAttendance,
  submitTeacherManualAttendance,
  updateTeacherTodayAttendanceDraft,
  updateTeacherClassroomStudent
} from "../services/teacherClassroomService.js";
import { setTeacherClassExam } from "../services/examScheduleService.js";
import { reviewTeacherLeaveRequest } from "../services/leaveRequestService.js";

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

export async function addTeacherStudent(request, response) {
  const { teacherId, classId } = request.params;

  if (!teacherId || !classId) {
    response.status(400).json({
      message: "teacherId and classId are required."
    });
    return;
  }

  try {
    const result = await addTeacherClassroomStudent({
      teacherUserId: teacherId,
      classId,
      student: request.body ?? {}
    });

    response.status(201).json({
      message: result.createdStudent
        ? "Student account created and added to class."
        : "Student added to class.",
      ...result.classroom
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to add student."
    });
  }
}

export async function updateTeacherStudent(request, response) {
  const { teacherId, classId, studentId } = request.params;

  if (!teacherId || !classId || !studentId) {
    response.status(400).json({
      message: "teacherId, classId, and studentId are required."
    });
    return;
  }

  try {
    const classroom = await updateTeacherClassroomStudent({
      teacherUserId: teacherId,
      classId,
      studentId,
      updates: request.body ?? {}
    });

    response.json({
      message: "Student updated successfully.",
      ...classroom
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to update student."
    });
  }
}

export async function deleteTeacherStudent(request, response) {
  const { teacherId, classId, studentId } = request.params;

  if (!teacherId || !classId || !studentId) {
    response.status(400).json({
      message: "teacherId, classId, and studentId are required."
    });
    return;
  }

  try {
    const classroom = await deleteTeacherClassroomStudent({
      teacherUserId: teacherId,
      classId,
      studentId
    });

    response.json({
      message: "Student removed from class.",
      ...classroom
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to remove student."
    });
  }
}

export async function archiveTeacherClass(request, response) {
  const { teacherId, classId } = request.params;

  if (!teacherId || !classId) {
    response.status(400).json({
      message: "teacherId and classId are required."
    });
    return;
  }

  try {
    const result = await archiveTeacherClassroom({
      teacherUserId: teacherId,
      classId
    });

    response.json({
      message: "Class ended and saved as inactive.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to end this class."
    });
  }
}

export async function submitManualAttendance(request, response) {
  const { teacherId, classId } = request.params;
  const { statuses, notes } = request.body ?? {};

  if (!teacherId || !classId) {
    response.status(400).json({
      message: "teacherId and classId are required."
    });
    return;
  }

  try {
    const result = await submitTeacherManualAttendance({
      teacherUserId: teacherId,
      classId,
      statuses,
      notes
    });

    response.json({
      message: "Manual attendance submitted successfully.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to submit manual attendance."
    });
  }
}

export async function cancelTodayClass(request, response) {
  const { teacherId, classId } = request.params;
  const { reason } = request.body ?? {};

  if (!teacherId || !classId) {
    response.status(400).json({
      message: "teacherId and classId are required."
    });
    return;
  }

  try {
    const result = await cancelTeacherClassToday({
      teacherUserId: teacherId,
      classId,
      reason
    });

    response.json({
      message: "Today's class has been cancelled.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to cancel today's class."
    });
  }
}

export async function createQrAttendanceSession(request, response) {
  const { teacherId, classId } = request.params;

  if (!teacherId || !classId) {
    response.status(400).json({
      message: "teacherId and classId are required."
    });
    return;
  }

  try {
    const qrSession = await createTeacherQrAttendanceSession({
      teacherUserId: teacherId,
      classId
    });

    response.status(201).json({
      message: "QR attendance code generated.",
      qrSession
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to generate QR attendance code."
    });
  }
}

export async function markQrAttendance(request, response) {
  const { studentId, token } = request.body ?? {};

  if (!studentId || !token) {
    response.status(400).json({
      message: "studentId and token are required."
    });
    return;
  }

  try {
    const result = await markStudentQrAttendance({
      studentUserId: studentId,
      token
    });

    response.json(result);
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to mark QR attendance."
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
    const isAiServiceFailure =
      error instanceof Error && error.message.includes("AI service");

    response.status(isAiServiceFailure ? 502 : 400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to process attendance for this class."
    });
  }
}

export async function updateTodayAttendanceDraft(request, response) {
  const { teacherId, classId, draftId } = request.params;
  const { statuses, notes } = request.body ?? {};

  if (!teacherId || !classId || !draftId) {
    response.status(400).json({
      message: "teacherId, classId, and draftId are required."
    });
    return;
  }

  try {
    const result = await updateTeacherTodayAttendanceDraft({
      teacherUserId: teacherId,
      classId,
      draftId,
      statuses,
      notes
    });

    response.json({
      message: "Today attendance draft updated.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to update today attendance draft."
    });
  }
}

export async function finalizeTodayAttendanceDraft(request, response) {
  const { teacherId, classId, draftId } = request.params;
  const { statuses, notes } = request.body ?? {};

  if (!teacherId || !classId || !draftId) {
    response.status(400).json({
      message: "teacherId, classId, and draftId are required."
    });
    return;
  }

  try {
    const result = await finalizeTeacherTodayAttendanceDraft({
      teacherUserId: teacherId,
      classId,
      draftId,
      statuses,
      notes
    });

    response.json({
      message: "Today attendance finalized successfully.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to finalize today attendance."
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

export async function reviewLeaveRequest(request, response) {
  const { teacherId, classId, requestId } = request.params;
  const { status, teacherNote } = request.body ?? {};

  if (!teacherId || !classId || !requestId) {
    response.status(400).json({
      message: "teacherId, classId, and requestId are required."
    });
    return;
  }

  try {
    const leaveRequest = await reviewTeacherLeaveRequest({
      teacherUserId: teacherId,
      classId,
      requestId,
      status,
      teacherNote
    });

    response.json({
      message:
        leaveRequest.status === "approved"
          ? "Leave request approved."
          : "Leave request rejected.",
      leaveRequest
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to review leave request."
    });
  }
}

export async function setClassExam(request, response) {
  const { teacherId, classId } = request.params;
  const { title, examDate, requiredAttendancePercentage, note } = request.body ?? {};

  if (!teacherId || !classId) {
    response.status(400).json({
      message: "teacherId and classId are required."
    });
    return;
  }

  try {
    const exam = await setTeacherClassExam({
      teacherUserId: teacherId,
      classId,
      title,
      examDate,
      requiredAttendancePercentage,
      note
    });

    response.json({
      message: "Exam schedule updated.",
      exam
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to update exam schedule."
    });
  }
}
