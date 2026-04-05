import { useEffect, useRef, useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { convertFilesToImagesPayload } from "../../../utils/fileReaders";
import "./StudentClassroomSection.css";

const MINIMUM_IMAGE_COUNT = 6;
const MAXIMUM_IMAGE_COUNT = 10;
const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function StudentFaceEnrollmentSection({
  faceProfile,
  onEnrollFaceProfile
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [capturedImages, setCapturedImages] = useState([]);
  const [camera, setCamera] = useState({
    open: false,
    pending: false
  });
  const [status, setStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!camera.open || !streamRef.current || !videoRef.current) {
      return;
    }

    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
  }, [camera.open]);

  useEffect(() => () => {
    stopCameraStream();
  }, []);

  const totalSelectedImages = selectedFiles.length + capturedImages.length;
  const selectedImageItems = [
    ...selectedFiles.map((file) => ({
      key: `${file.name}-${file.size}`,
      label: file.name,
      source: "Upload"
    })),
    ...capturedImages.map((image, index) => ({
      key: `${image.fileName}-${index}`,
      label: image.fileName,
      source: "Camera"
    }))
  ];

  function stopCameraStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function resetSelection() {
    setSelectedFiles([]);
    setCapturedImages([]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function closeCamera() {
    stopCameraStream();
    setCamera({
      open: false,
      pending: false
    });
  }

  async function handleCameraToggle() {
    if (camera.open) {
      closeCamera();
      return;
    }

    if (!window.isSecureContext) {
      const suggestedUrl = `http://localhost:${window.location.port || "5173"}`;

      setStatus({
        pending: false,
        tone: "warning",
        message: LOCALHOST_HOSTNAMES.has(window.location.hostname)
          ? "Chrome camera access needs a secure page. Reload this page and make sure camera permission is allowed."
          : `Chrome camera access only works here on localhost or HTTPS. Open the app at ${suggestedUrl} and try again.`
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({
        pending: false,
        tone: "warning",
        message:
          "Camera access is unavailable in this browser session. Open the app at http://localhost:5173 and check Chrome camera permissions."
      });
      return;
    }

    setCamera({
      open: false,
      pending: true
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "user"
          }
        },
        audio: false
      });

      streamRef.current = stream;
      setCamera({
        open: true,
        pending: false
      });
    } catch (error) {
      closeCamera();
      let message = "Unable to open the camera.";

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          message =
            "Camera permission was blocked. Allow camera access for this site in Chrome and try again.";
        } else if (error.name === "NotFoundError") {
          message = "No camera was found on this device.";
        } else if (error.name === "NotReadableError") {
          message =
            "Chrome found the camera, but another app may already be using it. Close other camera apps and try again.";
        } else {
          message = `Unable to open the camera. ${error.message}`;
        }
      }

      setStatus({
        pending: false,
        tone: "warning",
        message
      });
    }
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files ?? []);
    const availableSlots = Math.max(MAXIMUM_IMAGE_COUNT - capturedImages.length, 0);
    const nextFiles = files.slice(0, availableSlots);

    setSelectedFiles(nextFiles);

    if (files.length > availableSlots) {
      setStatus({
        pending: false,
        tone: "warning",
        message: `You can enroll up to ${MAXIMUM_IMAGE_COUNT} images in one submission.`
      });
    }
  }

  function handleCapturePhoto() {
    if (totalSelectedImages >= MAXIMUM_IMAGE_COUNT) {
      setStatus({
        pending: false,
        tone: "warning",
        message: `You can enroll up to ${MAXIMUM_IMAGE_COUNT} images in one submission.`
      });
      return;
    }

    if (!videoRef.current?.videoWidth || !videoRef.current?.videoHeight) {
      setStatus({
        pending: false,
        tone: "warning",
        message: "Wait for the camera preview to load before capturing."
      });
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setStatus({
        pending: false,
        tone: "warning",
        message: "Unable to capture an image from the camera preview."
      });
      return;
    }

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    setCapturedImages((current) => [
      ...current,
      {
        fileName: `camera-capture-${current.length + 1}.jpg`,
        dataUrl: canvas.toDataURL("image/jpeg", 0.92)
      }
    ]);
    setStatus({
      pending: false,
      tone: "success",
      message: `Camera capture added. ${totalSelectedImages + 1} of ${MAXIMUM_IMAGE_COUNT} images selected.`
    });
  }

  function handleClearSelection() {
    resetSelection();
    setStatus({
      pending: false,
      tone: "",
      message: ""
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (totalSelectedImages < MINIMUM_IMAGE_COUNT) {
      setStatus({
        pending: false,
        tone: "warning",
        message: `Select at least ${MINIMUM_IMAGE_COUNT} clear face images to continue.`
      });
      return;
    }

    if (totalSelectedImages > MAXIMUM_IMAGE_COUNT) {
      setStatus({
        pending: false,
        tone: "warning",
        message: `Use no more than ${MAXIMUM_IMAGE_COUNT} images in one enrollment batch.`
      });
      return;
    }

    setStatus({
      pending: true,
      tone: "",
      message: ""
    });

    try {
      const uploadedImages = await convertFilesToImagesPayload(selectedFiles);
      const images = [...uploadedImages, ...capturedImages];
      const response = await onEnrollFaceProfile(images);
      resetSelection();
      closeCamera();
      setStatus({
        pending: false,
        tone: "success",
        message: response.message
      });
    } catch (error) {
      setStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to enroll your face profile."
      });
    }
  }

  return (
    <article className="glass-card dashboard-panel student-face-panel">
      <DashboardPanelHeader
        label="Face Enrollment"
        title="Upload your images once and reuse the face profile everywhere."
      />

      <div className="face-profile-card">
        <div className="face-profile-header">
          <div>
            <h3>Enrollment Status</h3>
            <p className="face-profile-copy">
              Your face profile is linked to your student ID and reused across all joined classes.
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

        <div className="simple-list" style={{ marginTop: "18px" }}>
          {faceProfile.notes.map((note) => (
            <div key={note} className="simple-list-item">
              <strong>Enrollment Note</strong>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </div>

      <form className="face-enrollment-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Upload 6 to 10 clear face images</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={status.pending}
            onChange={handleFileChange}
          />
        </label>

        <div className="face-capture-toolbar">
          <button
            className="secondary-button"
            type="button"
            disabled={status.pending || camera.pending}
            onClick={handleCameraToggle}
          >
            {camera.pending
              ? "Opening Camera..."
              : camera.open
                ? "Close Camera"
                : "Use Camera"}
          </button>

          {totalSelectedImages ? (
            <span className="panel-meta">
              {totalSelectedImages} / {MAXIMUM_IMAGE_COUNT} images selected
            </span>
          ) : (
            <span className="panel-meta">
              Mix uploaded files and live camera captures in one enrollment batch.
            </span>
          )}
        </div>

        {camera.open ? (
          <div className="camera-capture-card">
            <div className="camera-preview-frame">
              <video
                ref={videoRef}
                className="camera-preview"
                autoPlay
                muted
                playsInline
              />
            </div>

            <div className="face-enrollment-actions">
              <button
                className="primary-button"
                type="button"
                disabled={status.pending || totalSelectedImages >= MAXIMUM_IMAGE_COUNT}
                onClick={handleCapturePhoto}
              >
                Capture Photo
              </button>
              <span className="panel-meta">
                Use front lighting and slight head-angle variation for better enrollment quality.
              </span>
            </div>
          </div>
        ) : null}

        <div className="face-enrollment-actions">
          <button className="primary-button" type="submit" disabled={status.pending}>
            {status.pending ? "Enrolling..." : "Enroll Face Profile"}
          </button>
          <button
            className="ghost-button"
            type="button"
            disabled={status.pending || totalSelectedImages === 0}
            onClick={handleClearSelection}
          >
            Clear Selection
          </button>
          <span className="panel-meta">
            Use front-facing, well-lit images with slight angle variation and no heavy blur.
          </span>
        </div>

        {status.message ? (
          <p className={`face-status-copy ${status.tone}`}>{status.message}</p>
        ) : null}
      </form>

      {selectedImageItems.length ? (
        <div className="selected-file-list">
          {selectedImageItems.map((image) => (
            <span key={image.key} className="selected-file-pill">
              <span>{image.label}</span>
              <small className="selected-file-source">{image.source}</small>
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
