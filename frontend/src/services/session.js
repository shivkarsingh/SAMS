const SESSION_STORAGE_KEY = "sams.session";
const PENDING_JOIN_CODE_KEY = "sams.pendingJoinCode";
const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const SESSION_ABSOLUTE_TIMEOUT_MS = 60 * 60 * 1000;

function readStoredSession() {
  const rawValue = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    clearSession();
    return null;
  }
}

function getTimeValue(value) {
  const timeValue = new Date(value).getTime();

  return Number.isFinite(timeValue) ? timeValue : null;
}

function isSessionExpired(session, now = Date.now()) {
  const savedAt = getTimeValue(session?.savedAt);

  if (savedAt === null) {
    return true;
  }

  const lastActivityAt = getTimeValue(session?.lastActivityAt) ?? savedAt;
  const absoluteExpiresAt = savedAt + SESSION_ABSOLUTE_TIMEOUT_MS;
  const idleExpiresAt = lastActivityAt + SESSION_IDLE_TIMEOUT_MS;

  return now >= absoluteExpiresAt || now >= idleExpiresAt;
}

export function saveSession(user) {
  const savedAt = new Date();

  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      user,
      savedAt: savedAt.toISOString(),
      lastActivityAt: savedAt.toISOString(),
      expiresAt: new Date(
        savedAt.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS
      ).toISOString()
    })
  );
}

export function getSession() {
  const session = readStoredSession();

  if (!session) {
    return null;
  }

  if (isSessionExpired(session)) {
    clearSession();
    return null;
  }

  return session;
}

export function refreshSessionActivity() {
  const session = readStoredSession();

  if (!session) {
    return null;
  }

  if (isSessionExpired(session)) {
    clearSession();
    return null;
  }

  const nextSession = {
    ...session,
    lastActivityAt: new Date().toISOString()
  };

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));

  return nextSession;
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
