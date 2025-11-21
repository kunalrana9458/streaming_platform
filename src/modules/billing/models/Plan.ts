import mongoose, { Document, Schema } from "mongoose";

export interface IPlan extends Document {
  priceId: string; // Stripe price_xxx
  name?: string;
  amount?: string;
  currency?: string;
  interval?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>({
  priceId: { type: String, required: true, unique: true },
  name: String,
  amount: String,
  currency: String,
  interval: String
}, { timestamps: true });

export default mongoose.model<IPlan>('Plan', PlanSchema);
