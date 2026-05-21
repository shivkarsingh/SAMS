import { useEffect, useRef, useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

const editableFields = [
  { name: "firstName", label: "First name" },
  { name: "lastName", label: "Last name" },
  { name: "email", label: "Email" },
  { name: "phoneNumber", label: "Phone number" },
  { name: "department", label: "Department" },
  { name: "batch", label: "Batch" },
  { name: "yearOfPassing", label: "Year of passing" },
  { name: "semesterLabel", label: "Semester" },
  { name: "age", label: "Age" },
  { name: "gender", label: "Gender" }
];

function getInitials(profile) {
  return `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

const defaultCropSettings = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0
};

function loadCropImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load the selected photo."));
    image.src = dataUrl;
  });
}

async function createCroppedAvatar(dataUrl, cropSettings) {
  const image = await loadCropImage(dataUrl);
  const outputSize = 640;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context || !image.naturalWidth || !image.naturalHeight) {
    throw new Error("Unable to crop this photo.");
  }

  canvas.width = outputSize;
  canvas.height = outputSize;

  const scale =
    Math.max(outputSize / image.naturalWidth, outputSize / image.naturalHeight) *
    cropSettings.zoom;
  const scaledWidth = image.naturalWidth * scale;
  const scaledHeight = image.naturalHeight * scale;
  const maxOffsetX = Math.max(0, (scaledWidth - outputSize) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - outputSize) / 2);
  const drawX =
    (outputSize - scaledWidth) / 2 + (cropSettings.offsetX / 100) * maxOffsetX;
  const drawY =
    (outputSize - scaledHeight) / 2 + (cropSettings.offsetY / 100) * maxOffsetY;

  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);

  return canvas.toDataURL("image/jpeg", 0.9);
}

export function StudentProfileSection({
  profile,
  onSaveProfile,
  onRequestEmailOtp,
  onVerifyEmailOtp
}) {
  const [form, setForm] = useState(profile);
  const [status, setStatus] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerification, setEmailVerification] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [photoToolsOpen, setPhotoToolsOpen] = useState(false);
  const [cropSource, setCropSource] = useState("");
  const [cropSettings, setCropSettings] = useState(defaultCropSettings);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setForm(profile);
    setEmailOtp("");
    setEmailVerification(null);
    setCropSource("");
    setCropSettings(defaultCropSettings);
    setPhotoToolsOpen(false);
  }, [profile]);

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) {
      return;
    }

    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
  }, [cameraOpen]);

  useEffect(() => () => stopCamera(false), []);

  function updateField(field, value) {
    if (field === "email") {
      setEmailOtp("");
      setEmailVerification(null);
    }

    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function togglePhotoTools() {
    if (photoToolsOpen) {
      stopCamera();
      cancelCrop();
      setPhotoToolsOpen(false);
      return;
    }

    setPhotoToolsOpen(true);
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      openCropEditor(String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function openCropEditor(dataUrl) {
    if (!dataUrl) {
      return;
    }

    setCropSource(dataUrl);
    setCropSettings(defaultCropSettings);
    setPhotoToolsOpen(true);
    setStatus("Crop the photo, then apply it before saving.");
  }

  function updateCropSetting(field, value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    setCropSettings((currentSettings) => ({
      ...currentSettings,
      [field]: numericValue
    }));
  }

  async function applyCrop() {
    if (!cropSource) {
      return;
    }

    setStatus("Cropping photo...");

    try {
      const nextAvatarDataUrl = await createCroppedAvatar(cropSource, cropSettings);
      updateField("avatarDataUrl", nextAvatarDataUrl);
      setCropSource("");
      setStatus("Photo cropped. Save profile to keep it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to crop this photo.");
    }
  }

  function cancelCrop() {
    setCropSource("");
    setCropSettings(defaultCropSettings);
  }

  function stopCamera(updateState = true) {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (updateState) {
      setCameraOpen(false);
    }
  }

  async function toggleCamera() {
    if (cameraOpen) {
      stopCamera();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera access is unavailable in this browser.");
      return;
    }

    setCameraPending(true);
    setPhotoToolsOpen(true);
    setStatus("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 960 }
        },
        audio: false
      });

      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      setStatus(
        error instanceof Error ? `Unable to open camera. ${error.message}` : "Unable to open camera."
      );
    } finally {
      setCameraPending(false);
    }
  }

  function capturePhoto() {
    if (!videoRef.current?.videoWidth || !videoRef.current?.videoHeight) {
      setStatus("Wait for the camera preview to load before capturing.");
      return;
    }

    const size = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
    const sourceX = (videoRef.current.videoWidth - size) / 2;
    const sourceY = (videoRef.current.videoHeight - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const context = canvas.getContext("2d");

    if (!context) {
      setStatus("Unable to capture a photo from the camera.");
      return;
    }

    context.drawImage(videoRef.current, sourceX, sourceY, size, size, 0, 0, 640, 640);
    openCropEditor(canvas.toDataURL("image/jpeg", 0.9));
    setStatus("Camera photo captured. Crop it before saving.");
    stopCamera();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (emailChanged && !emailVerified) {
      setStatus("Verify the new email before saving this profile.");
      return;
    }

    setStatus("Saving profile...");

    try {
      const response = await onSaveProfile(
        form,
        emailChanged ? emailVerification?.otp ?? "" : ""
      );
      setStatus(response?.message ?? "Profile updated.");
      setEmailOtp("");
      setEmailVerification(null);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to update profile."
      );
    }
  }

  async function handleRequestOtp() {
    const nextEmail = normalizeEmail(form.email);

    if (!nextEmail) {
      setStatus("Enter the new email before requesting OTP.");
      return;
    }

    setStatus("Sending email OTP...");

    try {
      const response = await onRequestEmailOtp(nextEmail);
      setEmailOtp("");
      setEmailVerification({
        email: nextEmail,
        otp: "",
        verified: false
      });
      setStatus(
        `${response?.message ?? "OTP sent."}${response?.verification?.devOtp ? ` Dev OTP: ${response.verification.devOtp}` : ""}`
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to send email OTP."
      );
    }
  }

  async function handleVerifyOtp() {
    const nextEmail = normalizeEmail(form.email);
    const nextOtp = emailOtp.trim();

    if (!emailVerification || emailVerification.email !== nextEmail) {
      setStatus("Send an OTP to this email before verifying.");
      return;
    }

    if (!nextOtp) {
      setStatus("Enter the email OTP.");
      return;
    }

    setStatus("Verifying email...");

    try {
      const response = await onVerifyEmailOtp(nextEmail, nextOtp);
      setEmailVerification({
        email: nextEmail,
        otp: nextOtp,
        verified: true,
        verifiedAt: response?.verifiedAt
      });
      setEmailOtp("");
      setStatus(response?.message ?? "Email verified. Save profile to apply it.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to verify email OTP."
      );
    }
  }

  const currentEmail = normalizeEmail(form.email);
  const emailChanged = currentEmail !== normalizeEmail(profile.email);
  const emailOtpSent = emailVerification?.email === currentEmail;
  const emailVerified = Boolean(emailOtpSent && emailVerification?.verified);
  const canVerifyEmailOtp = Boolean(emailOtpSent && emailOtp.trim());
  const displayAvatarUrl = form.avatarDataUrl || form.faceProfilePhotoUrl || "";

  return (
    <section className="glass-card dashboard-panel teacher-profile-panel" id="profile">
      <DashboardPanelHeader
        label="Profile"
        title="Edit your student details and profile photo."
      />

      <div className="teacher-profile-layout">
        <div className="teacher-profile-identity">
          <div className="teacher-profile-avatar">
            {displayAvatarUrl ? (
              <img src={displayAvatarUrl} alt={`${form.firstName} ${form.lastName}`} />
            ) : (
              <span>{getInitials(form)}</span>
            )}
          </div>

          <div className="teacher-profile-copy">
            <strong>
              {form.firstName} {form.lastName}
            </strong>
            <span>{form.rollNumber || form.userId}</span>
            <button
              className="secondary-button"
              type="button"
              onClick={togglePhotoTools}
            >
              {photoToolsOpen ? "Close Photo Tools" : "Edit Photo"}
            </button>
            {photoToolsOpen ? (
              <div className="profile-photo-tools">
                <label className="secondary-button teacher-profile-upload">
                  Upload
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                </label>
                {form.avatarDataUrl ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => openCropEditor(form.avatarDataUrl)}
                  >
                    Crop
                  </button>
                ) : null}
                <button
                  className="secondary-button"
                  type="button"
                  onClick={toggleCamera}
                  disabled={cameraPending}
                >
                  {cameraPending ? "Opening..." : cameraOpen ? "Close Camera" : "Camera"}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {cameraOpen ? (
          <div className="profile-camera-panel">
            <div className="profile-camera-frame">
              <video
                ref={videoRef}
                className="profile-camera-preview"
                autoPlay
                muted
                playsInline
              />
            </div>
            <div className="teacher-profile-actions">
              <button className="primary-button" type="button" onClick={capturePhoto}>
                Capture Photo
              </button>
              <button className="secondary-button" type="button" onClick={() => stopCamera()}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {cropSource ? (
          <div className="profile-crop-panel">
            <div className="profile-crop-frame">
              <img
                src={cropSource}
                alt="Profile crop preview"
                style={{
                  transform: `translate(${cropSettings.offsetX / 8}%, ${
                    cropSettings.offsetY / 8
                  }%) scale(${cropSettings.zoom})`
                }}
              />
            </div>
            <div className="profile-crop-controls">
              <label className="field">
                <span>Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={cropSettings.zoom}
                  onChange={(event) => updateCropSetting("zoom", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Horizontal</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={cropSettings.offsetX}
                  onChange={(event) => updateCropSetting("offsetX", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Vertical</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={cropSettings.offsetY}
                  onChange={(event) => updateCropSetting("offsetY", event.target.value)}
                />
              </label>
            </div>
            <div className="teacher-profile-actions">
              <button className="primary-button" type="button" onClick={applyCrop}>
                Apply Crop
              </button>
              <button className="secondary-button" type="button" onClick={cancelCrop}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <form className="teacher-profile-form" onSubmit={handleSubmit}>
          <div className="teacher-profile-grid">
            {editableFields.map((field) => (
              <label key={field.name} className="field">
                <span>{field.label}</span>
                <input
                  type={field.name === "email" ? "email" : "text"}
                  value={form[field.name] ?? ""}
                  onChange={(event) => updateField(field.name, event.target.value)}
                  autoComplete={field.name === "email" ? "email" : undefined}
                  required={field.name === "email"}
                />
              </label>
            ))}
          </div>

          {emailChanged ? (
            <div className={`profile-email-otp-panel ${emailVerified ? "verified" : ""}`}>
              {emailVerified ? (
                <div className="profile-email-verified">
                  <span aria-hidden="true">✓</span>
                  <strong>Email verified</strong>
                </div>
              ) : (
                <>
                  <p>
                    {emailOtpSent
                      ? "Enter the OTP sent to the new email."
                      : "Send an OTP to verify the new email before saving this profile."}
                  </p>
                  <label className="field">
                    <span>Email OTP</span>
                    <input
                      value={emailOtp}
                      onChange={(event) => setEmailOtp(event.target.value)}
                      placeholder="6 digit OTP"
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </label>
                  <div className="profile-email-otp-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={handleRequestOtp}
                    >
                      {emailOtpSent ? "Resend OTP" : "Send OTP"}
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={!canVerifyEmailOtp}
                      onClick={handleVerifyOtp}
                    >
                      Verify Email
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="teacher-profile-actions">
            <button className="primary-button" type="submit">
              Save Profile
            </button>
            {status ? <span className="panel-meta">{status}</span> : null}
          </div>
        </form>
      </div>
    </section>
  );
}
