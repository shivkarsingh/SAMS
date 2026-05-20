import mongoose from "mongoose";

const assignmentAttachmentSchema = new mongoose.Schema(
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

const classAssignmentSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true
    },
    instructions: {
      type: String,
      trim: true,
      default: ""
    },
    deadlineAt: {
      type: Date,
      required: true,
      index: true
    },
    attachments: {
      type: [assignmentAttachmentSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

classAssignmentSchema.index({
  classId: 1,
  createdAt: -1
});

export const ClassAssignment = mongoose.model(
  "ClassAssignment",
  classAssignmentSchema
);
