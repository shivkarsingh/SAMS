import { AttendanceDraft } from "../models/AttendanceDraft.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { ClassAssignment } from "../models/ClassAssignment.js";
import { ClassAssignmentSubmission } from "../models/ClassAssignmentSubmission.js";
import { ClassDiscussionMessage } from "../models/ClassDiscussionMessage.js";
import { ClassExam } from "../models/ClassExam.js";
import { ClassMembership } from "../models/ClassMembership.js";
import { Classroom } from "../models/Classroom.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { QrAttendanceSession } from "../models/QrAttendanceSession.js";

function getDeletedCount(result) {
  return result?.deletedCount ?? 0;
}

export async function deleteClassroomData(classroom) {
  const classObjectId = classroom._id;
  const classIdString = String(classroom._id);

  const [
    memberships,
    attendanceRecords,
    attendanceDrafts,
    exams,
    leaveRequests,
    assignments,
    assignmentSubmissions,
    discussions,
    qrSessions
  ] = await Promise.all([
    ClassMembership.deleteMany({ classId: classObjectId }),
    AttendanceRecord.deleteMany({ classId: classIdString }),
    AttendanceDraft.deleteMany({ classId: classObjectId }),
    ClassExam.deleteMany({ classId: classObjectId }),
    LeaveRequest.deleteMany({ classId: classObjectId }),
    ClassAssignment.deleteMany({ classId: classObjectId }),
    ClassAssignmentSubmission.deleteMany({ classId: classObjectId }),
    ClassDiscussionMessage.deleteMany({ classId: classObjectId }),
    QrAttendanceSession.deleteMany({ classId: classIdString })
  ]);

  const classroomDelete = await Classroom.deleteOne({ _id: classObjectId });

  return {
    classrooms: getDeletedCount(classroomDelete),
    memberships: getDeletedCount(memberships),
    attendanceRecords: getDeletedCount(attendanceRecords),
    attendanceDrafts: getDeletedCount(attendanceDrafts),
    exams: getDeletedCount(exams),
    leaveRequests: getDeletedCount(leaveRequests),
    assignments: getDeletedCount(assignments),
    assignmentSubmissions: getDeletedCount(assignmentSubmissions),
    discussions: getDeletedCount(discussions),
    qrSessions: getDeletedCount(qrSessions)
  };
}
