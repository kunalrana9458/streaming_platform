import mongoose, {Document,Schema} from 'mongoose'

export type MediaStatus = 'upload_pending' | 'uploaded' | 'processing' | 'ready' | 'failed';

export interface IMedia extends Document {
  titleId: string;
  filename: string;
  objectKey: string; // how it is stored in MinIO
  uploaderId?: string;
  status: MediaStatus;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
  attempts?: number;
}


const MediaSchema = new Schema<IMedia>({
  titleId: { type: String, required: true },
  filename: { type: String, required: true },
  objectKey: { type: String, required: true, index: true },
  uploaderId: { type: String },
  status: { type: String, enum: ['upload_pending','uploaded','processing','ready','failed'], default: 'upload_pending' },
  size: { type: Number },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });


export default mongoose.model<IMedia>("Media", MediaSchema);


