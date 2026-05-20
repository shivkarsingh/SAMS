import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchClassDiscussion,
  fetchStudentDashboard,
  fetchTeacherClassroom,
  postClassDiscussionMessage,
  postClassDiscussionReaction,
  postClassDiscussionReply
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import {
  readClassDiscussionMessages,
  saveClassDiscussionMessages
} from "./classDiscussionStore";
import "../TeacherDashboardPage/TeacherDashboardPage.css";
import "../TeacherClassroomPage/TeacherClassroomPage.css";
import "./ClassDiscussionPage.css";

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "just now";
  }

  const secondsAgo = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
  ];
  const matchingUnit = units.find(([, seconds]) => secondsAgo >= seconds);

  if (!matchingUnit) {
    return "just now";
  }

  const [label, seconds] = matchingUnit;
  const count = Math.floor(secondsAgo / seconds);

  return `${count} ${label}${count === 1 ? "" : "s"} ago`;
}

function getInitials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatUserName(user) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.userId;
}

function normalizeDiscussionMessage(message) {
  return {
    ...message,
    replies: Array.isArray(message.replies) ? message.replies : [],
    likes: Array.isArray(message.likes) ? message.likes : [],
    dislikes: Array.isArray(message.dislikes) ? message.dislikes : []
  };
}

function sortMessagesByCreatedAt(nextMessages) {
  return nextMessages
    .map(normalizeDiscussionMessage)
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

function mergeDiscussionMessages(apiMessages, localMessages) {
  const messagesById = new Map();

  [...localMessages, ...apiMessages].forEach((message) => {
    messagesById.set(message.id, message);
  });

  return sortMessagesByCreatedAt([...messagesById.values()]);
}

function messageMatchesName(message, normalizedNameFilter) {
  if (!normalizedNameFilter) {
    return true;
  }

  const authorName = String(message.authorName ?? "").toLowerCase();
  const replyAuthorMatch = message.replies.some((reply) =>
    String(reply.authorName ?? "").toLowerCase().includes(normalizedNameFilter)
  );

  return authorName.includes(normalizedNameFilter) || replyAuthorMatch;
}

export function ClassDiscussionPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroom, setClassroom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [activeReplyId, setActiveReplyId] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});
  const [roleFilter, setRoleFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [pageStatus, setPageStatus] = useState({
    loading: true,
    message: ""
  });
  const [postStatus, setPostStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });

  async function loadDiscussion() {
    if (!user || !classId) {
      return;
    }

    const localMessages = readClassDiscussionMessages(classId);

    try {
      const response = await fetchClassDiscussion(user.userId, user.role, classId);
      setClassroom(response.classroom);
      setMessages(mergeDiscussionMessages(response.messages, localMessages));
      return;
    } catch {
      if (user.role === "teacher") {
        const response = await fetchTeacherClassroom(user.userId, classId);
        setClassroom(response.classroom);
        setMessages(sortMessagesByCreatedAt(localMessages));
        return;
      }

      const response = await fetchStudentDashboard(user.userId);
      const joinedClass = response.joinedClasses.find(
        (currentClass) => currentClass.id === classId
      );

      if (!joinedClass) {
        throw new Error("You can only access discussion for classes you have joined.");
      }

      setClassroom(joinedClass);
      setMessages(sortMessagesByCreatedAt(localMessages));
    }
  }

  useEffect(() => {
    if (!user) {
      goToRoute("/login");
      return;
    }

    if (!classId) {
      setPageStatus({
        loading: false,
        message: "A classroom ID is required to open discussion."
      });
      return;
    }

    async function loadInitialDiscussion() {
      try {
        await loadDiscussion();
        setPageStatus({
          loading: false,
          message: ""
        });
      } catch (error) {
        setPageStatus({
          loading: false,
          message:
            error instanceof Error
              ? error.message
              : "Unable to load class discussion."
        });
      }
    }

    void loadInitialDiscussion();
  }, [classId, user]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  async function handlePostMessage(event) {
    event.preventDefault();

    if (!draftMessage.trim()) {
      setPostStatus({
        pending: false,
        tone: "warning",
        message: "Write a message before posting."
      });
      return;
    }

    setPostStatus({
      pending: true,
      tone: "",
      message: ""
    });

    try {
      const response = await postClassDiscussionMessage(classId, {
        userId: user.userId,
        role: user.role,
        message: draftMessage.trim()
      });
      const nextMessages = sortMessagesByCreatedAt([
        normalizeDiscussionMessage(response.discussionMessage),
        ...messages
      ]);

      setMessages(nextMessages);
      saveClassDiscussionMessages(classId, nextMessages);
      setDraftMessage("");
      setPostStatus({
        pending: false,
        tone: "success",
        message: response.message
      });
    } catch (error) {
      const localMessage = {
        id: crypto.randomUUID(),
        classId,
        authorUserId: user.userId,
        authorName: formatUserName(user),
        authorRole: user.role,
        message: draftMessage.trim(),
        replies: [],
        likes: [],
        dislikes: [],
        createdAt: new Date().toISOString()
      };
      const nextMessages = sortMessagesByCreatedAt([...messages, localMessage]);

      setMessages(nextMessages);
      saveClassDiscussionMessages(classId, nextMessages);
      setDraftMessage("");
      setPostStatus({
        pending: false,
        tone: "success",
        message: "Message posted in this browser."
      });
    }
  }

  function updateMessages(nextMessages) {
    const sortedMessages = sortMessagesByCreatedAt(nextMessages);

    setMessages(sortedMessages);
    saveClassDiscussionMessages(classId, sortedMessages);
  }

  function replaceDiscussionMessage(updatedMessage) {
    updateMessages(
      messages.map((message) =>
        message.id === updatedMessage.id
          ? normalizeDiscussionMessage(updatedMessage)
          : message
      )
    );
  }

  function updateLocalReaction(messageId, reactionType) {
    updateMessages(
      messages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }

        const likes = new Set(message.likes);
        const dislikes = new Set(message.dislikes);
        const currentSet = reactionType === "like" ? likes : dislikes;
        const oppositeSet = reactionType === "like" ? dislikes : likes;

        if (currentSet.has(user.userId)) {
          currentSet.delete(user.userId);
        } else {
          currentSet.add(user.userId);
          oppositeSet.delete(user.userId);
        }

        return {
          ...message,
          likes: [...likes],
          dislikes: [...dislikes]
        };
      })
    );
  }

  async function handleReaction(messageId, reactionType) {
    try {
      const response = await postClassDiscussionReaction(classId, messageId, {
        userId: user.userId,
        role: user.role,
        reaction: reactionType
      });

      replaceDiscussionMessage(response.discussionMessage);
    } catch {
      updateLocalReaction(messageId, reactionType);
    }
  }

  async function handleReplySubmit(event, messageId) {
    event.preventDefault();

    const replyText = String(replyDrafts[messageId] ?? "").trim();

    if (!replyText) {
      return;
    }

    try {
      const response = await postClassDiscussionReply(classId, messageId, {
        userId: user.userId,
        role: user.role,
        message: replyText
      });

      replaceDiscussionMessage(response.discussionMessage);
    } catch {
      const reply = {
        id: crypto.randomUUID(),
        authorUserId: user.userId,
        authorName: formatUserName(user),
        authorRole: user.role,
        message: replyText,
        createdAt: new Date().toISOString()
      };

      updateMessages(
        messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                replies: [...message.replies, reply]
              }
            : message
        )
      );
    }

    setReplyDrafts((currentDrafts) => ({
      ...currentDrafts,
      [messageId]: ""
    }));
    setActiveReplyId("");
  }

  const normalizedNameFilter = nameFilter.trim().toLowerCase();
  const filteredMessages = messages.filter(
    (message) =>
      (roleFilter === "all" || message.authorRole === roleFilter) &&
      messageMatchesName(message, normalizedNameFilter)
  );
  const hasActiveFilters = roleFilter !== "all" || Boolean(normalizedNameFilter);

  if (!user) {
    return null;
  }

  if (pageStatus.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard label="Loading" title="Opening class discussion..." />
        </main>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Discussion Error"
            title={pageStatus.message || "Unable to load class discussion."}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Class Discussion" />

        <nav className="dashboard-nav">
          <button className="dashboard-nav-button active-teacher-nav" type="button">
            Discussion
          </button>
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              goToRoute(
                user.role === "teacher"
                  ? `/teacher-classroom?classId=${encodeURIComponent(classId)}`
                  : "/student-dashboard"
              )
            }
          >
            Back
          </button>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-shell class-discussion-shell">
        <section className="class-discussion-heading">
          <h1>Class Discussion</h1>
          <p className="course-meta">
            {classroom.subjectName} • {classroom.subjectCode}
          </p>
        </section>

        <section className="glass-card dashboard-panel class-discussion-comments-panel">
          <div className="class-discussion-comments-header">
            <div>
              <span className="pill">Comments</span>
              <h2>
                {filteredMessages.length} of {messages.length} comment
                {messages.length === 1 ? "" : "s"}
              </h2>
            </div>

            <button
              className="secondary-button"
              type="button"
              disabled={postStatus.pending}
              onClick={() => {
                setPostStatus({ pending: true, tone: "", message: "" });
                loadDiscussion()
                  .then(() =>
                    setPostStatus({
                      pending: false,
                      tone: "success",
                      message: "Discussion refreshed."
                    })
                  )
                  .catch((error) =>
                    setPostStatus({
                      pending: false,
                      tone: "warning",
                      message:
                        error instanceof Error
                          ? error.message
                          : "Unable to refresh discussion."
                    })
                  );
              }}
            >
              Refresh
            </button>
          </div>

          <div className="class-discussion-tools">
            <div className="discussion-role-filter" aria-label="Filter comments by role">
              {["all", "teacher", "student"].map((role) => (
                <button
                  key={role}
                  className={roleFilter === role ? "active" : ""}
                  type="button"
                  onClick={() => setRoleFilter(role)}
                >
                  {role === "all" ? "All" : role}
                </button>
              ))}
            </div>

            <label className="discussion-name-filter">
              <input
                type="search"
                value={nameFilter}
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Search comments by name"
              />
            </label>

            {hasActiveFilters ? (
              <button
                className="comment-filter-clear"
                type="button"
                onClick={() => {
                  setRoleFilter("all");
                  setNameFilter("");
                }}
              >
                Clear
              </button>
            ) : null}
          </div>

          <form className="class-discussion-form" onSubmit={handlePostMessage}>
            <div className="comment-avatar own-avatar">
              {getInitials(formatUserName(user))}
            </div>
            <label className="field">
              <textarea
                rows="2"
                maxLength="1000"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Add a comment..."
              />
            </label>

            <div className="comment-compose-actions">
              <span className="panel-meta">{draftMessage.length}/1000</span>
              <button
                className="ghost-button"
                type="button"
                disabled={postStatus.pending || !draftMessage}
                onClick={() => setDraftMessage("")}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={postStatus.pending || !draftMessage.trim()}
              >
                {postStatus.pending ? "Posting..." : "Comment"}
              </button>
            </div>

            {postStatus.message ? (
              <p className={`teacher-status-copy comment-post-status ${postStatus.tone}`}>
                {postStatus.message}
              </p>
            ) : null}
          </form>

          {filteredMessages.length ? (
            <div className="class-discussion-list">
              {filteredMessages.map((message) => (
                <article
                  key={message.id}
                  className={`class-discussion-message ${
                    message.authorUserId === user.userId ? "own-message" : ""
                  }`}
                >
                  <div className="comment-avatar">
                    {getInitials(message.authorName)}
                  </div>
                  <div className="class-discussion-message-head">
                    <div>
                      <strong>{message.authorName}</strong>
                      <span>
                        <span className="comment-role">{message.authorRole}</span>
                        {formatRelativeTime(message.createdAt)}
                      </span>
                    </div>
                    {message.authorUserId === user.userId ? (
                      <span className="own-comment-label">You</span>
                    ) : null}
                  </div>
                  <p>{message.message}</p>
                  <div className="comment-actions">
                    <button
                      className={
                        message.likes.includes(user.userId)
                          ? "comment-action active"
                          : "comment-action"
                      }
                      type="button"
                      onClick={() => handleReaction(message.id, "like")}
                    >
                      Like {message.likes.length ? message.likes.length : ""}
                    </button>
                    <button
                      className={
                        message.dislikes.includes(user.userId)
                          ? "comment-action active"
                          : "comment-action"
                      }
                      type="button"
                      onClick={() => handleReaction(message.id, "dislike")}
                    >
                      Dislike {message.dislikes.length ? message.dislikes.length : ""}
                    </button>
                    <button
                      className="comment-action"
                      type="button"
                      onClick={() =>
                        setActiveReplyId((currentId) =>
                          currentId === message.id ? "" : message.id
                        )
                      }
                    >
                      Reply
                    </button>
                  </div>

                  {activeReplyId === message.id ? (
                    <form
                      className="comment-reply-form"
                      onSubmit={(event) => handleReplySubmit(event, message.id)}
                    >
                      <div className="comment-avatar comment-reply-avatar">
                        {getInitials(formatUserName(user))}
                      </div>
                      <label className="field">
                        <textarea
                          rows="1"
                          maxLength="600"
                          value={replyDrafts[message.id] ?? ""}
                          onChange={(event) =>
                            setReplyDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [message.id]: event.target.value
                            }))
                          }
                          placeholder={`Reply to ${message.authorName}...`}
                        />
                      </label>
                      <div className="comment-reply-actions">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setReplyDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [message.id]: ""
                            }));
                            setActiveReplyId("");
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="primary-button"
                          type="submit"
                          disabled={!String(replyDrafts[message.id] ?? "").trim()}
                        >
                          Reply
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {message.replies.length ? (
                    <div className="comment-replies">
                      <span className="comment-replies-count">
                        {message.replies.length} repl
                        {message.replies.length === 1 ? "y" : "ies"}
                      </span>
                      {message.replies.map((reply) => (
                        <article key={reply.id} className="comment-reply">
                          <div className="comment-avatar comment-reply-avatar">
                            {getInitials(reply.authorName)}
                          </div>
                          <div className="comment-reply-body">
                            <div className="class-discussion-message-head">
                              <div>
                                <strong>{reply.authorName}</strong>
                                <span>
                                  <span className="comment-role">{reply.authorRole}</span>
                                  {formatRelativeTime(reply.createdAt)}
                                </span>
                              </div>
                              {reply.authorUserId === user.userId ? (
                                <span className="own-comment-label">You</span>
                              ) : null}
                            </div>
                            <p>{reply.message}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="panel-fallback">
              {messages.length
                ? "No comments match the current filters."
                : "No discussion messages yet. Start the class thread with the first update."}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
