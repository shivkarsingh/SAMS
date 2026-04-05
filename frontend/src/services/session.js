const SESSION_STORAGE_KEY = "sams.session";
const PENDING_JOIN_CODE_KEY = "sams.pendingJoinCode";

export function saveSession(user) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      user,
      savedAt: new Date().toISOString()
    })
  );
}

export function getSession() {
  const rawValue = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
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
