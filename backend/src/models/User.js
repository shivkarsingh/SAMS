import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      required: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    rollNumber: {
      type: String,
      required() {
        return this.role === "student";
      },
      trim: true,
      uppercase: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      min: 16
    },
    gender: {
      type: String,
      enum: ["male", "female", "non-binary", "prefer-not-to-say"],
      default: "prefer-not-to-say"
    },
    batch: {
      type: String,
      trim: true
    },
    yearOfPassing: {
      type: Number
    },
    department: {
      type: String,
      trim: true
    },
    semesterLabel: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    emailVerified: {
      type: Boolean,
      default: false,
      index: true
    },
    emailVerifiedAt: {
      type: Date,
      default: null
    },
    emailVerificationRequired: {
      type: Boolean,
      default: false
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    avatarDataUrl: {
      type: String,
      default: ""
    },
    designation: {
      type: String,
      trim: true
    },
    specialization: {
      type: String,
      trim: true
    },
    experienceYears: {
      type: Number,
      min: 0
    },
    joiningYear: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model("User", userSchema);
