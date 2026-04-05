export const attendanceVerificationRequestExample = {
  studentId: "STU-1001",
  classId: "CSE-AI-301",
  imageUrl: "https://example.com/captures/student-verified.jpg"
};

export const attendanceVerificationResponseExample = {
  request: {
    ...attendanceVerificationRequestExample,
    capturedAt: "2026-04-04T10:30:00.000Z",
    verificationMode: "face-recognition"
  },
  verification: {
    accepted: true,
    confidence: 0.93,
    model: "facenet512-placeholder",
    notes: "Placeholder response until the production model is selected."
  }
};
