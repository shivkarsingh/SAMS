import { Router } from "express";
import {
  getSummary,
  verifyAttendance
} from "../controllers/attendanceController.js";
import { login, signup } from "../controllers/authController.js";
import {
  createTeacherClass,
  joinStudentClass
} from "../controllers/classroomController.js";
import {
  enrollFaceProfile,
  getStudentFaceProfile
} from "../controllers/faceProfileController.js";
import { getHealth } from "../controllers/healthController.js";
import { getDashboard } from "../controllers/studentController.js";
import {
  finalizeTeacherAttendance,
  getTeacherClassroom,
  processTeacherAttendance
} from "../controllers/teacherClassroomController.js";
import { getDashboard as getTeacherDashboard } from "../controllers/teacherController.js";

export const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.get("/attendance/summary", getSummary);
apiRouter.post("/attendance/verify", verifyAttendance);
apiRouter.post("/auth/signup", signup);
apiRouter.post("/auth/login", login);
apiRouter.get("/students/:userId/dashboard", getDashboard);
apiRouter.post("/students/:studentId/classes/join", joinStudentClass);
apiRouter.get("/students/:studentId/face-profile", getStudentFaceProfile);
apiRouter.post("/students/:studentId/face-profile/enroll", enrollFaceProfile);
apiRouter.get("/teachers/:userId/dashboard", getTeacherDashboard);
apiRouter.post("/teachers/:teacherId/classes", createTeacherClass);
apiRouter.get("/teachers/:teacherId/classes/:classId", getTeacherClassroom);
apiRouter.post(
  "/teachers/:teacherId/classes/:classId/attendance/session",
  processTeacherAttendance
);
apiRouter.post(
  "/teachers/:teacherId/classes/:classId/attendance/finalize",
  finalizeTeacherAttendance
);
