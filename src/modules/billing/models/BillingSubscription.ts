import mongoose, { Document, Schema } from "mongoose";

export interface IBillingSubscription extends Document {
  customerId?: mongoose.Types.ObjectId;
  stripeSubscriptionId: string;
  planId?: mongoose.Types.ObjectId;
  status?: string;
  cancelAtPeriodEnd?: Boolean,
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  quantity?: number;
  metadata?: object;
  createdAt: Date;
  updatedAt: Date;
}

const BillingSubscriptionSchema = new Schema<IBillingSubscription>({
  customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer' },
  stripeSubscriptionId: { type: String, required: true, unique: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan' },
  status: String,
  cancelAtPeriodEnd: Boolean,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  quantity: { type: Number, default: 1 },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model<IBillingSubscription>('BillingSubscription', BillingSubscriptionSchema);
