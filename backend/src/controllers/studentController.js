import { submitStudentLeaveRequest } from "../services/leaveRequestService.js";
import { getStudentDashboard } from "../services/studentDashboardService.js";

export async function getDashboard(request, response) {
  const { userId } = request.params;

  if (!userId) {
    response.status(400).json({
      message: "userId is required."
    });
    return;
  }

  try {
    const dashboard = await getStudentDashboard(userId);

    response.json(dashboard);
  } catch (error) {
    response.status(404).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to load student dashboard."
    });
  }
}

export async function submitLeaveRequest(request, response) {
  const { studentId, classId } = request.params;
  const { requestType, absenceDate, reason, attachments } = request.body ?? {};

  if (!studentId || !classId) {
    response.status(400).json({
      message: "studentId and classId are required."
    });
    return;
  }

  try {
    const leaveRequest = await submitStudentLeaveRequest({
      studentUserId: studentId,
      classId,
      requestType,
      absenceDate,
      reason,
      attachments
    });

    response.status(201).json({
      message: "Leave request submitted for teacher review.",
      leaveRequest
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to submit leave request."
    });
  }
}
