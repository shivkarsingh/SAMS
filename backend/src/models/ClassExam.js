import mongoose from "mongoose";

const classExamSchema = new mongoose.Schema(
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
    examDate: {
      type: Date,
      required: true,
      index: true
    },
    requiredAttendancePercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 75
    },
    note: {
      type: String,
      trim: true,
      default: ""
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true
    }
  },
  {
    timestamps: true
  }
);

classExamSchema.index(
  {
    classId: 1,
    status: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "active"
    }
  }
);

export const ClassExam = mongoose.model("ClassExam", classExamSchema);
