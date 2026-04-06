const CLASS_NOTES_STORAGE_PREFIX = "sams.classNotes.";

function getClassNotesStorageKey(classId) {
  return `${CLASS_NOTES_STORAGE_PREFIX}${classId}`;
}

export function readClassNotes(classId) {
  const rawValue = localStorage.getItem(getClassNotesStorageKey(classId));

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

export function saveClassNotes(classId, notes) {
  localStorage.setItem(getClassNotesStorageKey(classId), JSON.stringify(notes));
}
