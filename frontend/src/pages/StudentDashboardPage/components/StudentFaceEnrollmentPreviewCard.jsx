import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

export function StudentFaceEnrollmentPreviewCard({
  faceProfile,
  onOpenFaceEnrollment
}) {
  return (
    <article className="glass-card dashboard-panel student-face-preview-panel">
      <DashboardPanelHeader
        label="Face Enrollment"
        title="Manage face setup from a dedicated page."
        description="Open the full enrollment workspace to capture live camera photos, upload image batches, and refresh your face profile when needed."
      />

      <div className="face-profile-card">
        <div className="face-profile-header">
          <div>
            <h3>Profile Status</h3>
            <p className="face-profile-copy">
              Keep your enrollment images current so classroom attendance checks stay accurate.
            </p>
          </div>
          <span
            className={`face-profile-status ${
              faceProfile.status === "enrolled" ? "ready" : "pending"
            }`}
          >
            {faceProfile.status === "enrolled" ? "Ready for Attendance" : "Setup Pending"}
          </span>
        </div>

        <div className="face-profile-stats">
          <div>
            <span>Images Used</span>
            <strong>{faceProfile.uploadedImageCount}</strong>
          </div>
          <div>
            <span>Embeddings</span>
            <strong>{faceProfile.embeddingCount}</strong>
          </div>
          <div>
            <span>Quality Score</span>
            <strong>{Math.round(faceProfile.averageQualityScore * 100)}%</strong>
          </div>
        </div>
      </div>

      <div className="face-enrollment-actions">
        <button className="primary-button" type="button" onClick={onOpenFaceEnrollment}>
          Open Face Enrollment Page
        </button>
        <span className="panel-meta">
          Use the dedicated page for uploads, live camera capture, and enrollment updates.
        </span>
      </div>
    </article>
  );
}
