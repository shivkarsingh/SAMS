import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      trim: true,
      index: true,
      default: ""
    },
    teacherUserId: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: ""
    },
    studentId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    studentName: {
      type: String,
      trim: true,
      default: ""
    },
    rollNumber: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: ""
    },
    classId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    className: {
      type: String,
      trim: true,
      default: ""
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "cancelled"],
      default: "present"
    },
    verificationMethod: {
      type: String,
      enum: [
        "manual",
        "qr",
        "face-recognition",
        "teacher-confirmed",
        "manual-add",
        "system-derived"
      ],
      default: "manual"
    },
    source: {
      type: String,
      enum: [
        "ai-auto",
        "teacher-confirmed",
        "manual-add",
        "manual",
        "class-cancelled",
        "system-derived"
      ],
      default: "teacher-confirmed"
    },
    confidence: {
      type: Number,
      default: null
    },
    attendanceUnit: {
      type: Number,
      min: 1,
      default: 1
    },
    sessionType: {
      type: String,
      enum: ["regular", "extra"],
      default: "regular",
      index: true
    },
    recordedAt: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

attendanceRecordSchema.index({
  classId: 1,
  studentId: 1,
  recordedAt: -1
});

export const AttendanceRecord = mongoose.model(
  "AttendanceRecord",
  attendanceRecordSchema
);
