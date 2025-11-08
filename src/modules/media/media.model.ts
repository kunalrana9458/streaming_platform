import mongoose, {Document,Schema} from 'mongoose'

export interface IMedia extends Document {
    titleId: mongoose.Types.ObjectId;   
    originalName: string;
    storageKey: string;
    url: string;
    type: string;
    size: number;
    status: 'processing' | 'uploaded' | 'failed' | 'ready';
    createdAt: Date;
    updatedAt: Date;
}



const MediaSchema = new Schema<IMedia>(
  {
    titleId: { type: Schema.Types.ObjectId, ref: "Title", required: true },
    originalName: { type: String, required: true },
    storageKey: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, required: true },
    status: {
      type: String,
      enum: ["uploaded", "processing", "ready", "failed"],
      default: "uploaded",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IMedia>("Media", MediaSchema);


