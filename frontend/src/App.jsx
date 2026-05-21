import { useEffect, useState } from "react";
import { AuthPage } from "./pages/AuthPage/AuthPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage/AdminDashboardPage";
import { ClassAssignmentsPage } from "./pages/ClassAssignmentsPage/ClassAssignmentsPage";
import { ClassDiscussionPage } from "./pages/ClassDiscussionPage/ClassDiscussionPage";
import { ClassNotesPage } from "./pages/ClassNotesPage/ClassNotesPage";
import { HomePage } from "./pages/HomePage/HomePage";
import { JoinClassPage } from "./pages/JoinClassPage/JoinClassPage";
import { QrAttendancePage } from "./pages/QrAttendancePage/QrAttendancePage";
import { TeacherClassExamPage } from "./pages/TeacherClassExamPage/TeacherClassExamPage";
import { TeacherClassQrPage } from "./pages/TeacherClassQrPage/TeacherClassQrPage";
import { TeacherClassroomPage } from "./pages/TeacherClassroomPage/TeacherClassroomPage";
import { TeacherClassroomSessionsPage } from "./pages/TeacherClassroomSessionsPage/TeacherClassroomSessionsPage";
import { TeacherClassroomStudentsPage } from "./pages/TeacherClassroomStudentsPage/TeacherClassroomStudentsPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage/StudentDashboardPage";
import { StudentDashboardToolsPage } from "./pages/StudentDashboardPage/StudentDashboardToolsPage";
import { StudentClassDetailPage } from "./pages/StudentClassDetailPage/StudentClassDetailPage";
import { StudentFaceEnrollmentPage } from "./pages/StudentFaceEnrollmentPage/StudentFaceEnrollmentPage";
import { StudentProfilePage } from "./pages/StudentProfilePage/StudentProfilePage";
import { TeacherDashboardPage } from "./pages/TeacherDashboardPage/TeacherDashboardPage";
import { TeacherDashboardToolsPage } from "./pages/TeacherDashboardPage/TeacherDashboardToolsPage";
import { TeacherProfilePage } from "./pages/TeacherProfilePage/TeacherProfilePage";
import {
  clearSession,
  getSession,
  hasSavedSession,
  refreshSessionActivity
} from "./services/session";
import { getRouteFromHash } from "./utils/router";

export default function App() {
  const [route, setRoute] = useState(getRouteFromHash());

  function redirectExpiredSession() {
    if (window.location.hash !== "#/login") {
      clearSession();
      window.location.hash = "/login";
    }
  }

  useEffect(() => {
    function handleHashChange() {
      if (window.location.hash.startsWith("#/")) {
        setRoute(getRouteFromHash());
      }
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      const hadSession = hasSavedSession();
      const session = getSession();

      if (hadSession && !session) {
        redirectExpiredSession();
      }
    }, 30000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    let lastActivityRefreshAt = 0;

    function handleUserActivity() {
      const now = Date.now();

      if (now - lastActivityRefreshAt < 30000) {
        return;
      }

      lastActivityRefreshAt = now;

      if (hasSavedSession() && !refreshSessionActivity()) {
        redirectExpiredSession();
      }
    }

    const activityEvents = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
      "visibilitychange"
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, {
        passive: true
      });
    });

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
    };
  }, []);

  if (route === "/login") {
    return <AuthPage mode="login" />;
  }

  if (route === "/signup") {
    return <AuthPage mode="signup" />;
  }

  if (route === "/reset-password") {
    return <AuthPage mode="reset-password" />;
  }

  if (route === "/student-dashboard") {
    return <StudentDashboardPage />;
  }

  if (route === "/admin-dashboard") {
    return <AdminDashboardPage />;
  }

  if (route === "/student-classes") {
    return <StudentDashboardToolsPage view="classes" />;
  }

  if (route === "/student-performance") {
    return <StudentDashboardToolsPage view="performance" />;
  }

  if (route === "/student-schedule") {
    return <StudentDashboardPage />;
  }

  if (route === "/student-calculator") {
    return <StudentDashboardToolsPage view="calculator" />;
  }

  if (route === "/student-calendar") {
    return <StudentDashboardToolsPage view="calendar" />;
  }

  if (route === "/student-exams") {
    return <StudentDashboardToolsPage view="exams" />;
  }

  if (route === "/student-insights") {
    return <StudentDashboardToolsPage view="performance" />;
  }

  if (route === "/student-notifications") {
    return <StudentDashboardToolsPage view="notifications" />;
  }

  if (route === "/student-todos") {
    return <StudentDashboardToolsPage view="todos" />;
  }

  if (route === "/student-classroom") {
    return <StudentClassDetailPage />;
  }

  if (route === "/student-face-enrollment") {
    return <StudentFaceEnrollmentPage />;
  }

  if (route === "/student-profile") {
    return <StudentProfilePage />;
  }

  if (route === "/join-class") {
    return <JoinClassPage />;
  }

  if (route === "/qr-attendance") {
    return <QrAttendancePage />;
  }

  if (route === "/teacher-dashboard") {
    return <TeacherDashboardPage />;
  }

  if (route === "/teacher-classes") {
    return <TeacherDashboardToolsPage view="classes" />;
  }

  if (route === "/teacher-create-class") {
    return <TeacherDashboardToolsPage view="create-class" />;
  }

  if (route === "/teacher-class-exam") {
    return <TeacherClassExamPage />;
  }

  if (route === "/teacher-class-qr") {
    return <TeacherClassQrPage />;
  }

  if (route === "/teacher-todos") {
    return <TeacherDashboardToolsPage view="todos" />;
  }

  if (route === "/teacher-profile") {
    return <TeacherProfilePage />;
  }

  if (route === "/teacher-classroom") {
    return <TeacherClassroomPage />;
  }

  if (route === "/teacher-classroom-attendance") {
    return <TeacherClassroomPage attendanceOnly />;
  }

  if (route === "/teacher-classroom-sessions") {
    return <TeacherClassroomSessionsPage />;
  }

  if (route === "/teacher-classroom-students") {
    return <TeacherClassroomStudentsPage />;
  }

  if (route === "/class-notes") {
    return <ClassNotesPage />;
  }

  if (route === "/class-assignments") {
    return <ClassAssignmentsPage />;
  }

  if (route === "/class-discussion") {
    return <ClassDiscussionPage />;
  }

  return <HomePage />;
}
