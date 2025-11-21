import mongoose, {Document,Schema} from "mongoose";

export interface IBillingCustomer extends Document {
    userId?: mongoose.Types.ObjectId,
    email: string,
    stripeCustomerId: string,
    defaultPaymentMethod: string;
    status:  'inactive' | 'active' | 'past_due' | 'canceled' ,
    createdAt: Date,
    updatedAt: Date
}


const BillingCustomerSchema = new Schema<IBillingCustomer>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    email: { type: String, required: true, index: true },
    stripeCustomerId: { type: String, required: true, unique: true },
    defaultPaymentMethod: String,
    status: { type: String, enum: ['inactive','active','past_due','canceled'], default: 'inactive' }
}, { timestamps: true })

export default mongoose.model<IBillingCustomer>('BillingCustomer',BillingCustomerSchema)