import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: "user" | "admin";
  isEmailVerified: boolean;
  tokenVersion: number; // refresh token invalidation
  otp?: {
    codeHash: string;      // hashed OTP
    expiresAt: Date;
    attempts: number;
    resendCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isEmailVerified: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    otp: {
      codeHash: { type: String },
      expiresAt: { type: Date },
      attempts: { type: Number, default: 0 },
      resendCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
