export function normalizeRollNumber(rollNumber) {
  return String(rollNumber ?? "").trim().toUpperCase();
}

export function normalizeStudentScopeValue(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function getStudentRollScope(student = {}) {
  return {
    rollNumber: normalizeRollNumber(student.rollNumber),
    department: normalizeStudentScopeValue(student.department),
    semesterLabel: normalizeStudentScopeValue(student.semesterLabel)
  };
}

export function isSameRollScope(left = {}, right = {}) {
  const leftScope = getStudentRollScope(left);
  const rightScope = getStudentRollScope(right);

  return (
    leftScope.rollNumber === rightScope.rollNumber &&
    leftScope.department === rightScope.department &&
    leftScope.semesterLabel === rightScope.semesterLabel
  );
}

export function findStudentRollConflict(
  students = [],
  candidate = {},
  excludeUserId = ""
) {
  const normalizedExcludeUserId = String(excludeUserId ?? "").trim().toUpperCase();

  return students.find((student) => {
    const studentUserId = String(student.userId ?? "").trim().toUpperCase();

    return (
      (!normalizedExcludeUserId || studentUserId !== normalizedExcludeUserId) &&
      isSameRollScope(student, candidate)
    );
  }) ?? null;
}

