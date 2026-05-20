import mongoose from "mongoose";

const emailOtpSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["student", "teacher"],
      required: true
    },
    userId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    purpose: {
      type: String,
      enum: [
        "email-verification",
        "password-reset",
        "profile-email-verification"
      ],
      required: true,
      index: true
    },
    otpHash: {
      type: String,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    resetVerifiedAt: {
      type: Date,
      default: null
    },
    resetTokenHash: {
      type: String,
      default: null
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null
    },
    passwordResetAt: {
      type: Date,
      default: null
    },
    consumedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: {
        expires: 0
      }
    }
  },
  {
    timestamps: true
  }
);

emailOtpSchema.index({
  userId: 1,
  role: 1,
  purpose: 1,
  email: 1,
  createdAt: -1
});

emailOtpSchema.index({
  userId: 1,
  role: 1,
  purpose: 1,
  resetTokenExpiresAt: 1
});

export const EmailOtp = mongoose.model("EmailOtp", emailOtpSchema);
