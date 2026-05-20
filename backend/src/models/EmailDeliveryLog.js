import mongoose from "mongoose";

const emailDeliveryLogSchema = new mongoose.Schema(
  {
    to: {
      type: [String],
      default: []
    },
    subject: {
      type: String,
      trim: true,
      default: ""
    },
    template: {
      type: String,
      trim: true,
      default: ""
    },
    status: {
      type: String,
      enum: ["sent", "skipped", "failed"],
      default: "skipped",
      index: true
    },
    providerMessageId: {
      type: String,
      trim: true,
      default: ""
    },
    notificationKey: {
      type: String,
      trim: true,
      sparse: true,
      unique: true
    },
    errorMessage: {
      type: String,
      trim: true,
      default: ""
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

export const EmailDeliveryLog = mongoose.model(
  "EmailDeliveryLog",
  emailDeliveryLogSchema
);
