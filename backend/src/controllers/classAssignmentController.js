import {
  createClassAssignment,
  listClassAssignments,
  submitClassAssignment
} from "../services/classAssignmentService.js";

export async function getClassAssignments(request, response) {
  const { classId } = request.params;
  const { userId, role } = request.query ?? {};

  if (!classId || !userId || !role) {
    response.status(400).json({
      message: "classId, userId, and role are required."
    });
    return;
  }

  try {
    response.json(
      await listClassAssignments({
        classId,
        userId,
        role
      })
    );
  } catch (error) {
    response.status(403).json({
      message:
        error instanceof Error ? error.message : "Unable to load assignments."
    });
  }
}

export async function postTeacherClassAssignment(request, response) {
  const { teacherId, classId } = request.params;
  const { title, instructions, deadlineAt, attachments } = request.body ?? {};

  if (!teacherId || !classId) {
    response.status(400).json({
      message: "teacherId and classId are required."
    });
    return;
  }

  try {
    const assignment = await createClassAssignment({
      teacherUserId: teacherId,
      classId,
      title,
      instructions,
      deadlineAt,
      attachments
    });

    response.status(201).json({
      message: "Assignment posted.",
      assignment
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to post assignment."
    });
  }
}

export async function postStudentAssignmentSubmission(request, response) {
  const { studentId, classId, assignmentId } = request.params;
  const { comment, attachments } = request.body ?? {};

  if (!studentId || !classId || !assignmentId) {
    response.status(400).json({
      message: "studentId, classId, and assignmentId are required."
    });
    return;
  }

  try {
    const submission = await submitClassAssignment({
      studentUserId: studentId,
      classId,
      assignmentId,
      comment,
      attachments
    });

    response.status(201).json({
      message: "Assignment submitted.",
      submission
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to submit assignment."
    });
  }
}
