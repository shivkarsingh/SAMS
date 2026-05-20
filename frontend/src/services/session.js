const SESSION_STORAGE_KEY = "sams.session";
const PENDING_JOIN_CODE_KEY = "sams.pendingJoinCode";
const STUDENT_SESSION_DURATION_MS = 10 * 60 * 1000;

export function saveSession(user) {
  const savedAt = new Date();
  const expiresAt =
    user.role === "student"
      ? new Date(savedAt.getTime() + STUDENT_SESSION_DURATION_MS).toISOString()
      : null;

  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      user,
      savedAt: savedAt.toISOString(),
      expiresAt
    })
  );
}

export function getSession() {
  const rawValue = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const session = JSON.parse(rawValue);

    if (session?.user?.role === "student") {
      const expiresAt = session.expiresAt
        ? new Date(session.expiresAt).getTime()
        : new Date(session.savedAt).getTime() + STUDENT_SESSION_DURATION_MS;

      if (Number.isFinite(expiresAt) && Date.now() >= expiresAt) {
        clearSession();
        return null;
      }
    }

    return session;
  } catch {
    return null;
  }
}

export function hasSavedSession() {
  return Boolean(localStorage.getItem(SESSION_STORAGE_KEY));
}

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function savePendingJoinCode(joinCode) {
  localStorage.setItem(PENDING_JOIN_CODE_KEY, joinCode);
}

export function getPendingJoinCode() {
  return localStorage.getItem(PENDING_JOIN_CODE_KEY);
}

export function clearPendingJoinCode() {
  localStorage.removeItem(PENDING_JOIN_CODE_KEY);
}
