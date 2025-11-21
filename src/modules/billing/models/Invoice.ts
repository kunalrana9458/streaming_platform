import mongoose, { Document, Schema } from "mongoose";

export interface IBillingInvoice extends Document {
  stripeInvoiceId: string;
  customerId?: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  amountDue?: number;
  amountPaid?: number;
  status?: string;
  hostedInvoiceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IBillingInvoice>({
  stripeInvoiceId: { type: String, unique: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'BillingCustomer' },
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'BillingSubscription' },
  amountDue: Number,
  amountPaid: Number,
  status: String,
  hostedInvoiceUrl: String
}, { timestamps: true });

export default mongoose.model<IBillingInvoice>('BillingInvoice', InvoiceSchema);
