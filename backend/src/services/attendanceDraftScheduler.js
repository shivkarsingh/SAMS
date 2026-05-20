import { finalizeExpiredTeacherAttendanceDrafts } from "./teacherClassroomService.js";

const ATTENDANCE_DRAFT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let attendanceDraftSweepTimer = null;
let sweepInProgress = false;

async function runAttendanceDraftSweep() {
  if (sweepInProgress) {
    return;
  }

  sweepInProgress = true;

  try {
    const result = await finalizeExpiredTeacherAttendanceDrafts();

    if (result.finalizedCount || result.errors.length) {
      console.info("[attendance-drafts:sweep]", result);
    }
  } catch (error) {
    console.error(
      "[attendance-drafts:sweep-failed]",
      error instanceof Error ? error.message : "Unable to sweep attendance drafts."
    );
  } finally {
    sweepInProgress = false;
  }
}

export function startAttendanceDraftScheduler() {
  if (attendanceDraftSweepTimer) {
    return;
  }

  void runAttendanceDraftSweep();
  attendanceDraftSweepTimer = setInterval(
    runAttendanceDraftSweep,
    ATTENDANCE_DRAFT_SWEEP_INTERVAL_MS
  );
  attendanceDraftSweepTimer.unref?.();
}
