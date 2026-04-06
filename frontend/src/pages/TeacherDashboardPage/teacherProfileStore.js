import { saveSession } from "../../services/session";

function getTeacherProfileStorageKey(userId) {
  return `sams.teacherProfile.${userId}`;
}

export function readStoredTeacherProfile(userId) {
  const rawValue = localStorage.getItem(getTeacherProfileStorageKey(userId));

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function saveTeacherProfile(user, nextProfile) {
  localStorage.setItem(
    getTeacherProfileStorageKey(user.userId),
    JSON.stringify(nextProfile)
  );

  saveSession({
    ...user,
    firstName: nextProfile.firstName,
    lastName: nextProfile.lastName,
    email: nextProfile.email,
    department: nextProfile.department,
    designation: nextProfile.designation,
    specialization: nextProfile.specialization,
    experienceYears: nextProfile.experienceYears,
    joiningYear: nextProfile.joiningYear,
    avatarDataUrl: nextProfile.avatarDataUrl ?? user.avatarDataUrl
  });
}
