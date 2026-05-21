import { useEffect, useMemo, useState } from "react";
import { readTodos, saveTodos } from "../../services/todoStore";
import { DashboardPanelHeader } from "./DashboardPanelHeader";
import "./TodoPanel.css";

const initialDraft = {
  title: "",
  dueDate: "",
  priority: "normal"
};

function createTodoId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDueLabel(dueDate) {
  if (!dueDate) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  }).format(new Date(`${dueDate}T00:00:00`));
}

function sortTodos(left, right) {
  if (left.completed !== right.completed) {
    return left.completed ? 1 : -1;
  }

  if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
    return left.dueDate.localeCompare(right.dueDate);
  }

  if (left.dueDate !== right.dueDate) {
    return left.dueDate ? -1 : 1;
  }

  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

export function TodoPanel({ role, userId }) {
  const scope = `${role}:${userId}`;
  const [todoState, setTodoState] = useState(() => ({
    scope,
    items: readTodos(role, userId)
  }));
  const [draft, setDraft] = useState(initialDraft);
  const [status, setStatus] = useState("");
  const todos = todoState.items;

  useEffect(() => {
    setTodoState({
      scope,
      items: readTodos(role, userId)
    });
    setDraft(initialDraft);
    setStatus("");
  }, [role, scope, userId]);

  useEffect(() => {
    if (todoState.scope === scope) {
      saveTodos(role, userId, todoState.items);
    }
  }, [role, scope, todoState, userId]);

  const sortedTodos = useMemo(() => [...todos].sort(sortTodos), [todos]);
  const openCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - openCount;

  function updateDraft(field, value) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const title = draft.title.trim();

    if (!title) {
      setStatus("Add a task title.");
      return;
    }

    setTodoState((currentState) => ({
      ...currentState,
      items: [
        {
          id: createTodoId(),
          title,
          dueDate: draft.dueDate,
          priority: draft.priority,
          completed: false,
          createdAt: new Date().toISOString()
        },
        ...currentState.items
      ]
    }));
    setDraft(initialDraft);
    setStatus("");
  }

  function toggleTodo(todoId) {
    setTodoState((currentState) => ({
      ...currentState,
      items: currentState.items.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              completed: !todo.completed
            }
          : todo
      )
    }));
  }

  function removeTodo(todoId) {
    setTodoState((currentState) => ({
      ...currentState,
      items: currentState.items.filter((todo) => todo.id !== todoId)
    }));
  }

  function clearCompleted() {
    setTodoState((currentState) => ({
      ...currentState,
      items: currentState.items.filter((todo) => !todo.completed)
    }));
  }

  return (
    <article className="glass-card dashboard-panel todo-panel">
      <DashboardPanelHeader
        label="To Do"
        title={openCount ? `${openCount} task${openCount === 1 ? "" : "s"} open` : "All tasks clear"}
        description={`${completedCount} completed`}
      />

      <form className="todo-form" onSubmit={handleSubmit}>
        <label className="field todo-title-field">
          <span>Task</span>
          <input
            type="text"
            value={draft.title}
            maxLength={120}
            onChange={(event) => updateDraft("title", event.target.value)}
            placeholder="Prepare notes"
          />
        </label>

        <label className="field">
          <span>Due</span>
          <input
            type="date"
            value={draft.dueDate}
            onChange={(event) => updateDraft("dueDate", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Priority</span>
          <select
            value={draft.priority}
            onChange={(event) => updateDraft("priority", event.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </label>

        <button className="primary-button" type="submit">
          Add
        </button>
      </form>

      {status ? <p className="todo-status">{status}</p> : null}

      <div className="todo-list">
        {sortedTodos.length ? (
          sortedTodos.map((todo) => (
            <article
              key={todo.id}
              className={`todo-item ${todo.completed ? "completed" : ""}`}
            >
              <label className="todo-check">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span>{todo.title}</span>
              </label>

              <div className="todo-meta">
                <span className={`todo-priority ${todo.priority}`}>
                  {todo.priority}
                </span>
                <span>{getDueLabel(todo.dueDate)}</span>
                <button
                  className="ghost-button todo-remove-button"
                  type="button"
                  onClick={() => removeTodo(todo.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="panel-fallback">No tasks yet.</p>
        )}
      </div>

      {completedCount ? (
        <div className="todo-footer">
          <button className="secondary-button" type="button" onClick={clearCompleted}>
            Clear Completed
          </button>
        </div>
      ) : null}
    </article>
  );
}
