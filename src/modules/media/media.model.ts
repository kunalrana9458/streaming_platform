import mongoose, {Types,Document,Schema} from 'mongoose'

export type MediaStatus = 'upload_pending' | 'uploaded' | 'processing' | 'ready' | 'failed';

export interface IMedia extends Document {
  titleId: string;
  filename: string;
  objectKey: string; // how it is stored in MinIO
  uploaderId?: Types.ObjectId | string;
  status: MediaStatus;
  size?: number;
  attempts?: number;

  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    videoCodec?: string;
    audioCodec?: string;
    format?: string;
    bitrate?: number;
  };

  progress?: number;
  outputUrl?: string;
  outputUrlKey?: string;
  processingLogs?: string[];

  thumbnails?: string[]; // array of MinIO object keys''
  spriteKey?: string | null;
  vttKey?: string | null;

  createdAt: Date;
  updatedAt: Date;
}



const MediaSchema = new Schema<IMedia>({
  titleId: { type: String }, // keep if you still use it
    filename: { type: String, required: true },
    objectKey: { type: String, required: true, index: true },
    uploaderId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['upload_pending', 'uploaded', 'processing', 'ready', 'failed'],
      default: 'upload_pending',
      index: true,
    },
    size: { type: Number },
    attempts: { type: Number, default: 0 },

    metadata: {
      duration: Number,
      width: Number,
      height: Number,
      videoCodec: String,
      audioCodec: String,
      format: String,
      bitrate: Number,
    },
    progress: { type: Number, default: 0 },
    outputUrl: { type: String },
    outputUrlKey: { type: String },
    
    thumbnails: { type: [String], default: [] },
    spriteKey: { type: String, default: null },
    vttKey: { type: String, default: null },

    processingLogs: { type: [String], default: [] },

  },
  { timestamps: true });


MediaSchema.index({status:1,createdAt:-1})


export default mongoose.model<IMedia>("Media", MediaSchema);


