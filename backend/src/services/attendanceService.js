export function getAttendanceSummary() {
  const totalStudents = 480;
  const presentToday = 438;

  return {
    totalStudents,
    presentToday,
    absentToday: totalStudents - presentToday,
    activeMode: "face-recognition",
    recognitionEnabled: true,
    anomalyDetectionEnabled: true
  };
}

export function buildVerificationContext(payload) {
  return {
    ...payload,
    capturedAt: new Date().toISOString(),
    verificationMode: "face-recognition"
  };
}

