import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchStudentDashboard,
  fetchTeacherClassroom
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import { readClassNotes, saveClassNotes } from "./classNotesStore";
import "./ClassNotesPage.css";

async function convertFilesToNoteEntries(files, title, description) {
  const entries = await Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              id: crypto.randomUUID(),
              title: title.trim() || file.name,
              description: description.trim(),
              fileName: file.name,
              fileType: file.type || "application/octet-stream",
              fileSize: file.size,
              dataUrl: String(reader.result ?? ""),
              uploadedAt: new Date().toISOString()
            });
          };
          reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
          reader.readAsDataURL(file);
        })
    )
  );

  return entries;
}

function formatFileSize(size) {
  if (!size) {
    return "0 B";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function ClassNotesPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [pageStatus, setPageStatus] = useState({
    loading: true,
    message: ""
  });
  const [classroom, setClassroom] = useState(null);
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    files: []
  });
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    async function loadContext() {
      if (!user) {
        goToRoute("/login");
        return;
      }

      if (!classId) {
        setPageStatus({
          loading: false,
          message: "A classroom ID is required to open notes."
        });
        return;
      }

      try {
        if (user.role === "teacher") {
          const response = await fetchTeacherClassroom(user.userId, classId);
          setClassroom(response.classroom);
        } else {
          const response = await fetchStudentDashboard(user.userId);
          const joinedClass = response.joinedClasses.find(
            (currentClass) => currentClass.id === classId
          );

          if (!joinedClass) {
            throw new Error("You can only access notes for classes you have joined.");
          }

          setClassroom(joinedClass);
        }

        setNotes(readClassNotes(classId));
        setPageStatus({
          loading: false,
          message: ""
        });
      } catch (error) {
        setPageStatus({
          loading: false,
          message:
            error instanceof Error ? error.message : "Unable to load class notes."
        });
      }
    }

    void loadContext();
  }, [classId, user]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!form.files.length) {
      setUploadStatus("Choose at least one file to upload.");
      return;
    }

    try {
      const nextEntries = await convertFilesToNoteEntries(
        form.files,
        form.title,
        form.description
      );
      const nextNotes = [ ...nextEntries, ...notes ];
      setNotes(nextNotes);
      saveClassNotes(classId, nextNotes);
      setForm({
        title: "",
        description: "",
        files: []
      });
      setUploadStatus("Notes uploaded successfully.");
    } catch (error) {
      setUploadStatus(
        error instanceof Error ? error.message : "Unable to upload notes."
      );
    }
  }

  function handleRemove(noteId) {
    const nextNotes = notes.filter((note) => note.id !== noteId);
    setNotes(nextNotes);
    saveClassNotes(classId, nextNotes);
  }

  if (!user) {
    return null;
  }

  if (pageStatus.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard label="Loading" title="Preparing class notes..." />
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
            label="Notes Error"
            title={pageStatus.message || "Unable to load class notes."}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Class Notes" />

        <nav className="dashboard-nav">
          <button className="dashboard-nav-button active-teacher-nav" type="button">
            Notes
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

      <main className="dashboard-shell class-notes-shell">
        <section className="class-notes-heading">
          <h1>Class Notes</h1>
          <p className="course-meta">
            {classroom.subjectName} • {classroom.subjectCode} • {classroom.section}
          </p>
        </section>

        {user.role === "teacher" ? (
          <section className="glass-card dashboard-panel class-notes-upload-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="pill">Upload Notes</span>
                <h2>Share notes and files for this classroom.</h2>
              </div>
            </div>

            <form className="class-notes-form" onSubmit={handleUpload}>
              <div className="class-notes-form-grid">
                <label className="field">
                  <span>Title</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        title: event.target.value
                      }))
                    }
                    placeholder="Unit 1 Notes"
                  />
                </label>

                <label className="field">
                  <span>Files</span>
                  <input
                    type="file"
                    multiple
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        files: Array.from(event.target.files ?? [])
                      }))
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>Description</span>
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      description: event.target.value
                    }))
                  }
                  placeholder="Short context for students about these notes."
                />
              </label>

              <div className="teacher-class-actions">
                <button className="primary-button" type="submit">
                  Upload Notes
                </button>
                {uploadStatus ? <span className="panel-meta">{uploadStatus}</span> : null}
              </div>
            </form>
          </section>
        ) : null}

        <section className="glass-card dashboard-panel class-notes-list-panel">
          <div className="dashboard-panel-header">
            <div>
              <span className="pill">Shared Notes</span>
              <h2>Files available for this class.</h2>
            </div>
          </div>

          {notes.length ? (
            <div className="class-notes-list">
              {notes.map((note) => (
                <article key={note.id} className="class-note-card">
                  <div className="class-note-copy">
                    <strong>{note.title}</strong>
                    {note.description ? <p>{note.description}</p> : null}
                    <span>
                      {note.fileName} • {formatFileSize(note.fileSize)} • {formatDateTime(note.uploadedAt)}
                    </span>
                  </div>

                  <div className="class-note-actions">
                    <a
                      className="secondary-button"
                      href={note.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                    <a
                      className="ghost-button"
                      href={note.dataUrl}
                      download={note.fileName}
                    >
                      Download
                    </a>
                    {user.role === "teacher" ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleRemove(note.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="panel-fallback">
              No notes shared for this class yet.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
