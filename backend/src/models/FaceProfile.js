import mongoose from "mongoose";

const faceProfileSchema = new mongoose.Schema(
  {
    studentUserId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    studentName: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["not-started", "enrolled", "needs-refresh"],
      default: "enrolled"
    },
    uploadedImageCount: {
      type: Number,
      required: true,
      min: 0
    },
    embeddingCount: {
      type: Number,
      required: true,
      min: 0
    },
    averageQualityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    faceModel: {
      type: String,
      required: true,
      trim: true
    },
    executionMode: {
      type: String,
      required: true,
      trim: true
    },
    referenceImageNames: {
      type: [String],
      default: []
    },
    notes: {
      type: [String],
      default: []
    },
    lastEnrolledAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

export const FaceProfile = mongoose.model("FaceProfile", faceProfileSchema);
