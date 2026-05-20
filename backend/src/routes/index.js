import { Router } from "express";
import {
  deleteClassroom as deleteAdminClassroom,
  deleteUser as deleteAdminUser,
  getDashboard as getAdminDashboard,
  updateClassroomStatus as updateAdminClassroomStatus,
  updateUserEmailVerification as updateAdminUserEmailVerification
} from "../controllers/adminController.js";
import {
  getSummary,
  verifyAttendance
} from "../controllers/attendanceController.js";
import {
  login,
  requestPasswordResetEmail,
  requestSignupEmailOtp,
  resendVerificationEmail,
  resetPassword,
  signup,
  verifyEmail,
  verifyPasswordResetCode,
  verifySignupEmailOtp
} from "../controllers/authController.js";
import {
  listClassDiscussion,
  postClassDiscussionMessage,
  postClassDiscussionReaction,
  postClassDiscussionReply
} from "../controllers/classDiscussionController.js";
import {
  getClassAssignments,
  postStudentAssignmentSubmission,
  postTeacherClassAssignment
} from "../controllers/classAssignmentController.js";
import {
  createTeacherClass,
  joinStudentClass
} from "../controllers/classroomController.js";
import {
  enrollFaceProfile,
  getStudentFaceProfile
} from "../controllers/faceProfileController.js";
import {
  getEmailStatus,
  sendEmailTest,
  verifyEmailStatus
} from "../controllers/emailController.js";
import { getHealth } from "../controllers/healthController.js";
import {
  getDashboard,
  submitLeaveRequest
} from "../controllers/studentController.js";
import {
  addTeacherStudent,
  archiveTeacherClass,
  cancelTodayClass,
  createQrAttendanceSession,
  deleteTeacherStudent,
  finalizeTodayAttendanceDraft,
  finalizeTeacherAttendance,
  getTeacherClassroom,
  markQrAttendance,
  processTeacherAttendance,
  reviewLeaveRequest,
  setClassExam,
  submitManualAttendance,
  updateTodayAttendanceDraft,
  updateTeacherStudent
} from "../controllers/teacherClassroomController.js";
import { getDashboard as getTeacherDashboard } from "../controllers/teacherController.js";
import {
  patchUserProfile,
  sendProfileEmailOtp
} from "../controllers/userProfileController.js";

export const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.get("/email/status", getEmailStatus);
apiRouter.post("/email/verify", verifyEmailStatus);
apiRouter.post("/email/test", sendEmailTest);
apiRouter.get("/attendance/summary", getSummary);
apiRouter.post("/attendance/verify", verifyAttendance);
apiRouter.post("/auth/signup", signup);
apiRouter.post("/auth/signup-email/request", requestSignupEmailOtp);
apiRouter.post("/auth/signup-email/verify", verifySignupEmailOtp);
apiRouter.post("/auth/login", login);
apiRouter.post("/auth/verify-email", verifyEmail);
apiRouter.post("/auth/resend-verification", resendVerificationEmail);
apiRouter.post("/auth/password-reset/request", requestPasswordResetEmail);
apiRouter.post("/auth/password-reset/verify", verifyPasswordResetCode);
apiRouter.post("/auth/password-reset/confirm", resetPassword);
apiRouter.post("/auth/reset-password", resetPassword);
apiRouter.get("/admins/:adminId/dashboard", getAdminDashboard);
apiRouter.patch(
  "/admins/:adminId/classes/:classId/status",
  updateAdminClassroomStatus
);
apiRouter.delete("/admins/:adminId/classes/:classId", deleteAdminClassroom);
apiRouter.patch(
  "/admins/:adminId/users/:role/:userId/email-verification",
  updateAdminUserEmailVerification
);
apiRouter.delete("/admins/:adminId/users/:role/:userId", deleteAdminUser);
apiRouter.post("/users/:role/:userId/email-otp", sendProfileEmailOtp);
apiRouter.patch("/users/:role/:userId/profile", patchUserProfile);
apiRouter.get("/classes/:classId/assignments", getClassAssignments);
apiRouter.get("/classes/:classId/discussion", listClassDiscussion);
apiRouter.post("/classes/:classId/discussion", postClassDiscussionMessage);
apiRouter.post(
  "/classes/:classId/discussion/:messageId/replies",
  postClassDiscussionReply
);
apiRouter.post(
  "/classes/:classId/discussion/:messageId/reactions",
  postClassDiscussionReaction
);
apiRouter.get("/students/:userId/dashboard", getDashboard);
apiRouter.post("/students/:studentId/classes/join", joinStudentClass);
apiRouter.post(
  "/students/:studentId/classes/:classId/assignments/:assignmentId/submissions",
  postStudentAssignmentSubmission
);
apiRouter.post(
  "/students/:studentId/classes/:classId/leave-requests",
  submitLeaveRequest
);
apiRouter.get("/students/:studentId/face-profile", getStudentFaceProfile);
apiRouter.post("/students/:studentId/face-profile/enroll", enrollFaceProfile);
apiRouter.get("/teachers/:userId/dashboard", getTeacherDashboard);
apiRouter.post("/teachers/:teacherId/classes", createTeacherClass);
apiRouter.post(
  "/teachers/:teacherId/classes/:classId/assignments",
  postTeacherClassAssignment
);
apiRouter.patch(
  "/teachers/:teacherId/classes/:classId/exam",
  setClassExam
);
apiRouter.get("/teachers/:teacherId/classes/:classId", getTeacherClassroom);
apiRouter.patch(
  "/teachers/:teacherId/classes/:classId/archive",
  archiveTeacherClass
);
apiRouter.post("/teachers/:teacherId/classes/:classId/students", addTeacherStudent);
apiRouter.patch(
  "/teachers/:teacherId/classes/:classId/students/:studentId",
  updateTeacherStudent
);
apiRouter.delete(
  "/teachers/:teacherId/classes/:classId/students/:studentId",
  deleteTeacherStudent
);
apiRouter.post(
  "/teachers/:teacherId/classes/:classId/attendance/manual",
  submitManualAttendance
);
apiRouter.post(
  "/teachers/:teacherId/classes/:classId/cancel-today",
  cancelTodayClass
);
apiRouter.post(
  "/teachers/:teacherId/classes/:classId/attendance/qr-session",
  createQrAttendanceSession
);
apiRouter.post("/students/attendance/qr-scan", markQrAttendance);
apiRouter.post(
  "/teachers/:teacherId/classes/:classId/attendance/session",
  processTeacherAttendance
);
apiRouter.patch(
  "/teachers/:teacherId/classes/:classId/attendance/today-draft/:draftId",
  updateTodayAttendanceDraft
);
apiRouter.post(
  "/teachers/:teacherId/classes/:classId/attendance/today-draft/:draftId/finalize",
  finalizeTodayAttendanceDraft
);
apiRouter.post(
  "/teachers/:teacherId/classes/:classId/attendance/finalize",
  finalizeTeacherAttendance
);
apiRouter.patch(
  "/teachers/:teacherId/classes/:classId/leave-requests/:requestId",
  reviewLeaveRequest
);
