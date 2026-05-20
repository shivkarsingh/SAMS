import mongoose from "mongoose";

const attendanceDraftRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
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
      default: ""
    },
    status: {
      type: String,
      enum: ["present", "absent", "late"],
      default: "absent"
    },
    source: {
      type: String,
      enum: ["ai-suggested", "teacher-edited", "manual"],
      default: "ai-suggested"
    },
    confidence: {
      type: Number,
      default: null
    },
    aiStatus: {
      type: String,
      trim: true,
      default: ""
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    _id: false
  }
);

const attendanceDraftSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
      index: true
    },
    teacherUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    sourceSessionId: {
      type: String,
      trim: true,
      default: ""
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    records: {
      type: [attendanceDraftRecordSchema],
      default: []
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    },
    status: {
      type: String,
      enum: ["draft", "finalized"],
      default: "draft",
      index: true
    },
    absenteeEmailSentAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    finalizedAt: {
      type: Date,
      default: null
    },
    finalizedMode: {
      type: String,
      enum: ["teacher", "auto", ""],
      default: ""
    }
  },
  {
    timestamps: true
  }
);

attendanceDraftSchema.index({
  classId: 1,
  dateKey: 1,
  status: 1
});

export const AttendanceDraft = mongoose.model(
  "AttendanceDraft",
  attendanceDraftSchema
);
