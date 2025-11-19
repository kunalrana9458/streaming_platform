
import mongoose, {Schema,Document,model} from 'mongoose'

export interface IDeliveryPolicy extends Document {
    assetId: mongoose.Types.ObjectId,
    allowRegions?: string[],
    allowIPs?: string[],
    embargoUntil?: Date | null;
    requireWaterMark?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const DeliveryPolicySchema = new Schema<IDeliveryPolicy>(
    {
        assetId: {type: Schema.Types.ObjectId, required:true, index: true, ref: 'Media' },
        allowRegions: { type: [String], default: [] },
        allowIPs: { type:[String], default:null },
        embargoUntil: { type: Date, default: null },
        requireWaterMark: { type:Boolean, default: false }
    },
    { timestamps: true }
)

export default model<IDeliveryPolicy>('DeliveryPolicy',DeliveryPolicySchema)