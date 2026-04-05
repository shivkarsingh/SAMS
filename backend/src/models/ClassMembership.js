import mongoose from "mongoose";

const classMembershipSchema = new mongoose.Schema(
  {
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
    }
  },
  {
    timestamps: true
  }
);

classMembershipSchema.index(
  {
    classId: 1,
    studentUserId: 1
  },
  {
    unique: true
  }
);

export const ClassMembership = mongoose.model(
  "ClassMembership",
  classMembershipSchema
);
