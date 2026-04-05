import mongoose from "mongoose";

const classroomSchema = new mongoose.Schema(
  {
    teacherUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    teacherName: {
      type: String,
      required: true,
      trim: true
    },
    subjectName: {
      type: String,
      required: true,
      trim: true
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    section: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    room: {
      type: String,
      trim: true,
      default: ""
    },
    semesterLabel: {
      type: String,
      trim: true,
      default: ""
    },
    academicYear: {
      type: String,
      trim: true,
      default: ""
    },
    batch: {
      type: String,
      trim: true,
      default: ""
    },
    scheduleSummary: {
      type: String,
      trim: true,
      default: ""
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    joinLink: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

export const Classroom = mongoose.model("Classroom", classroomSchema);
