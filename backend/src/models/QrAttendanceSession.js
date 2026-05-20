import mongoose from "mongoose";

const qrAttendanceSessionSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    classId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    teacherUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

export const QrAttendanceSession = mongoose.model(
  "QrAttendanceSession",
  qrAttendanceSessionSchema
);
