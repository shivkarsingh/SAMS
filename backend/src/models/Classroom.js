import mongoose from "mongoose";

const classroomScheduleSlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      required: true
    },
    startTime: {
      type: String,
      required: true,
      trim: true
    },
    endTime: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    _id: false
  }
);

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
      trim: true,
      default: ""
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
    scheduleSlots: {
      type: [classroomScheduleSlotSchema],
      default: []
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active"
    },
    endedAt: {
      type: Date,
      default: null
    },
    endedBy: {
      type: String,
      trim: true,
      uppercase: true,
      default: ""
    },
    archiveSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const Classroom = mongoose.model("Classroom", classroomSchema);
