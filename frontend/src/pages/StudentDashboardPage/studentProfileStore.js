import { saveSession } from "../../services/session";

function getStudentProfileStorageKey(userId) {
  return `sams.studentProfile.${userId}`;
}

export function readStoredStudentProfile(userId) {
  const rawValue = localStorage.getItem(getStudentProfileStorageKey(userId));

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function saveStudentProfile(user, nextProfile) {
  localStorage.setItem(
    getStudentProfileStorageKey(user.userId),
    JSON.stringify(nextProfile)
  );

  saveSession({
    ...user,
    firstName: nextProfile.firstName,
    lastName: nextProfile.lastName,
    rollNumber: nextProfile.rollNumber,
    age: nextProfile.age,
    gender: nextProfile.gender,
    batch: nextProfile.batch,
    yearOfPassing: nextProfile.yearOfPassing,
    department: nextProfile.department,
    email: nextProfile.email,
    phoneNumber: nextProfile.phoneNumber,
    avatarDataUrl: nextProfile.avatarDataUrl ?? user.avatarDataUrl
  });
}
