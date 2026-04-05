import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("bufferCommands", false);

export async function connectToDatabase() {
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log("MongoDB connected.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown MongoDB connection error.";

    throw new Error(`MongoDB connection failed. ${message}`);
  }
}

export function getDatabaseStatus() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}
