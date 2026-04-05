import { useEffect, useState } from "react";
import { AuthPage } from "./pages/AuthPage/AuthPage";
import { HomePage } from "./pages/HomePage/HomePage";
import { JoinClassPage } from "./pages/JoinClassPage/JoinClassPage";
import { TeacherClassroomPage } from "./pages/TeacherClassroomPage/TeacherClassroomPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage/StudentDashboardPage";
import { StudentFaceEnrollmentPage } from "./pages/StudentFaceEnrollmentPage/StudentFaceEnrollmentPage";
import { TeacherDashboardPage } from "./pages/TeacherDashboardPage/TeacherDashboardPage";
import { getRouteFromHash } from "./utils/router";

export default function App() {
  const [route, setRoute] = useState(getRouteFromHash());

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

  if (route === "/login") {
    return <AuthPage mode="login" />;
  }

  if (route === "/signup") {
    return <AuthPage mode="signup" />;
  }

  if (route === "/student-dashboard") {
    return <StudentDashboardPage />;
  }

  if (route === "/student-face-enrollment") {
    return <StudentFaceEnrollmentPage />;
  }

  if (route === "/join-class") {
    return <JoinClassPage />;
  }

  if (route === "/teacher-dashboard") {
    return <TeacherDashboardPage />;
  }

  if (route === "/teacher-classroom") {
    return <TeacherClassroomPage />;
  }

  return <HomePage />;
}
