const CLASS_DISCUSSION_STORAGE_PREFIX = "sams.classDiscussion.";

function getClassDiscussionStorageKey(classId) {
  return `${CLASS_DISCUSSION_STORAGE_PREFIX}${classId}`;
}

export function readClassDiscussionMessages(classId) {
  const rawValue = localStorage.getItem(getClassDiscussionStorageKey(classId));

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

export function saveClassDiscussionMessages(classId, messages) {
  localStorage.setItem(
    getClassDiscussionStorageKey(classId),
    JSON.stringify(messages)
  );
}
