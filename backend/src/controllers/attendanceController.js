import {
  buildVerificationContext,
  getAttendanceSummary
} from "../services/attendanceService.js";
import { verifyAttendanceWithAi } from "../services/aiService.js";

export function getSummary(_request, response) {
  response.json(getAttendanceSummary());
}

export async function verifyAttendance(request, response) {
  const { studentId, classId, imageUrl } = request.body ?? {};

  if (!studentId || !classId || !imageUrl) {
    response.status(400).json({
      message: "studentId, classId, and imageUrl are required."
    });
    return;
  }

  try {
    const payload = { studentId, classId, imageUrl };
    const verification = await verifyAttendanceWithAi(payload);

    response.json({
      request: buildVerificationContext(payload),
      verification
    });
  } catch (error) {
    response.status(502).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to verify attendance with the AI service."
    });
  }
}

