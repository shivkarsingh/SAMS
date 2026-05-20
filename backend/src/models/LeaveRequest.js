import mongoose from "mongoose";

const leaveRequestAttachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    fileType: {
      type: String,
      trim: true,
      default: "application/octet-stream"
    },
    fileSize: {
      type: Number,
      min: 0,
      default: 0
    },
    dataUrl: {
      type: String,
      required: true
    }
  },
  {
    _id: false
  }
);

const leaveRequestSchema = new mongoose.Schema(
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
    studentUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    studentName: {
      type: String,
      required: true,
      trim: true
    },
    rollNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: ""
    },
    requestType: {
      type: String,
      enum: ["medical", "leave", "other"],
      default: "other"
    },
    absenceDate: {
      type: Date,
      required: true,
      index: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    attachments: {
      type: [leaveRequestAttachmentSchema],
      default: []
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
    },
    teacherNote: {
      type: String,
      trim: true,
      default: ""
    },
    reviewedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: ""
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

leaveRequestSchema.index({
  classId: 1,
  studentUserId: 1,
  absenceDate: -1
});

export const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);
