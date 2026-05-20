import mongoose from "mongoose";

const classDiscussionReplySchema = new mongoose.Schema(
  {
    authorUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    authorName: {
      type: String,
      required: true,
      trim: true
    },
    authorRole: {
      type: String,
      enum: ["student", "teacher"],
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 600
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);

const classDiscussionMessageSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classroom",
      required: true,
      index: true
    },
    authorUserId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    authorName: {
      type: String,
      required: true,
      trim: true
    },
    authorRole: {
      type: String,
      enum: ["student", "teacher"],
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    replies: {
      type: [classDiscussionReplySchema],
      default: []
    },
    likes: {
      type: [String],
      default: []
    },
    dislikes: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

classDiscussionMessageSchema.index({
  classId: 1,
  createdAt: -1
});

export const ClassDiscussionMessage = mongoose.model(
  "ClassDiscussionMessage",
  classDiscussionMessageSchema
);
