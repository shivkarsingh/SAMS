const TODO_STORAGE_PREFIX = "sams.todos";

function getTodoStorageKey(role, userId) {
  return `${TODO_STORAGE_PREFIX}.${role}.${userId}`;
}

function normalizeTodo(item) {
  return {
    id: String(item.id ?? ""),
    title: String(item.title ?? "").trim(),
    dueDate: String(item.dueDate ?? ""),
    priority: ["high", "normal", "low"].includes(item.priority)
      ? item.priority
      : "normal",
    completed: Boolean(item.completed),
    createdAt: String(item.createdAt ?? new Date().toISOString())
  };
}

export function readTodos(role, userId) {
  if (!role || !userId) {
    return [];
  }

  const rawValue = localStorage.getItem(getTodoStorageKey(role, userId));

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map(normalizeTodo)
      .filter((item) => item.id && item.title);
  } catch {
    return [];
  }
}

export function saveTodos(role, userId, todos) {
  if (!role || !userId) {
    return;
  }

  localStorage.setItem(
    getTodoStorageKey(role, userId),
    JSON.stringify(todos.map(normalizeTodo).filter((item) => item.id && item.title))
  );
}
