import { getTeacherDashboard } from "../services/teacherDashboardService.js";

export async function getDashboard(request, response) {
  const { userId } = request.params;

  if (!userId) {
    response.status(400).json({
      message: "userId is required."
    });
    return;
  }

  try {
    const dashboard = await getTeacherDashboard(userId);

    response.json(dashboard);
  } catch (error) {
    response.status(404).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to load teacher dashboard."
    });
  }
}

