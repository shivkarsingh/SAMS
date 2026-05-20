import mongoose from "mongoose";

const submissionAttachmentSchema = new mongoose.Schema(
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

const classAssignmentSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassAssignment",
      required: true,
      index: true
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
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
    comment: {
      type: String,
      trim: true,
      default: ""
    },
    attachments: {
      type: [submissionAttachmentSchema],
      default: []
    },
    status: {
      type: String,
      enum: ["submitted", "late"],
      default: "submitted"
    },
    submittedAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

classAssignmentSubmissionSchema.index(
  {
    assignmentId: 1,
    studentUserId: 1
  },
  {
    unique: true
  }
);

export const ClassAssignmentSubmission = mongoose.model(
  "ClassAssignmentSubmission",
  classAssignmentSubmissionSchema
);
