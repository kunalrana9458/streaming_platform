import mongoose, {Schema, Document} from "mongoose";

export interface ISession extends Document {
    userId: mongoose.Types.ObjectId;
    refreshTokenHash: string;
    deviceInfo: string;
    ipAddress: string;
    userAgent: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
}


const sessionSchema = new Schema<ISession>({
    userId: {type: Schema.Types.ObjectId, ref: 'User', required: true, index: true},
    refreshTokenHash: {type: String, required: true},
    deviceInfo: {type: String, required: true},
    ipAddress: {type: String, required: true},
    userAgent: {type: String, required: true},
    isActive: {type: Boolean, default: true},
    createdAt: {type: Date, default: Date.now},
    updatedAt: {type: Date, default: Date.now},
    expiresAt: {type: Date, required: true}
})

export const SessionModel = mongoose.model<ISession>('Session',sessionSchema);  