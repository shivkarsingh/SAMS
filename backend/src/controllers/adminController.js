import {
  deleteAdminClassroom,
  deleteAdminUser,
  getAdminDashboard,
  updateAdminClassroomStatus,
  updateAdminUserEmailVerification
} from "../services/adminService.js";

export async function getDashboard(request, response) {
  try {
    const dashboard = await getAdminDashboard(request.params.adminId);

    response.json(dashboard);
  } catch (error) {
    response.status(403).json({
      message:
        error instanceof Error ? error.message : "Unable to load admin dashboard."
    });
  }
}

export async function deleteClassroom(request, response) {
  try {
    const result = await deleteAdminClassroom({
      adminUserId: request.params.adminId,
      classId: request.params.classId
    });

    response.json({
      message: "Class and related data deleted.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to delete class."
    });
  }
}

export async function updateClassroomStatus(request, response) {
  try {
    const result = await updateAdminClassroomStatus({
      adminUserId: request.params.adminId,
      classId: request.params.classId,
      status: request.body?.status
    });

    response.json({
      message: "Class status updated.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to update class status."
    });
  }
}

export async function deleteUser(request, response) {
  try {
    const result = await deleteAdminUser({
      adminUserId: request.params.adminId,
      role: request.params.role,
      userId: request.params.userId
    });

    response.json({
      message: "User and related data deleted.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to delete user."
    });
  }
}

export async function updateUserEmailVerification(request, response) {
  try {
    const result = await updateAdminUserEmailVerification({
      adminUserId: request.params.adminId,
      role: request.params.role,
      userId: request.params.userId,
      emailVerified: request.body?.emailVerified
    });

    response.json({
      message: "User email verification updated.",
      ...result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Unable to update user verification."
    });
  }
}
