import mongoose,{Document,Schema} from "mongoose";

export interface ITitle extends Document {
    type: 'movie' | 'series';
    name: string;
    description: string;
    language: string;
    isLive: boolean
    genres: string[];
    releaseYear: number;
    thumbnailUrl: string;
    createdAt: Date;
    updatedAt: Date;
}

const TitleSchema = new Schema<ITitle>({
    type: {type: String, enum: ['movie','series'], required: true},
    name: {type: String, required: true},
    description: {type: String, required: true},
    language: {type: String, required: true},
    isLive: {type: Boolean, default: false},
    genres: {type: [String], required: true},
    releaseYear: {type: Number, required: true},
    thumbnailUrl: {type: String}
}, {timestamps: true});

export default mongoose.model<ITitle>('Title', TitleSchema);