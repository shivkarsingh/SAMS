import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["student", "teacher"],
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
    passwordHash: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      required: true,
      min: 16
    },
    gender: {
      type: String,
      enum: ["male", "female", "non-binary", "prefer-not-to-say"],
      required: true
    },
    batch: {
      type: String,
      required() {
        return this.role === "student";
      },
      trim: true
    },
    yearOfPassing: {
      type: Number,
      required() {
        return this.role === "student";
      }
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    designation: {
      type: String,
      required() {
        return this.role === "teacher";
      },
      trim: true
    },
    specialization: {
      type: String,
      required() {
        return this.role === "teacher";
      },
      trim: true
    },
    experienceYears: {
      type: Number,
      required() {
        return this.role === "teacher";
      },
      min: 0
    },
    joiningYear: {
      type: Number,
      required() {
        return this.role === "teacher";
      }
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model("User", userSchema);
