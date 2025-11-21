import mongoose, { Document, Schema } from "mongoose";

export interface IWebhookEvent extends Document {
  stripeEventId: string;
  type: string;
  payload: object;
  processed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>({
  stripeEventId: { type: String, unique: true },
  type: String,
  payload: Schema.Types.Mixed,
  processed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
