
import mongoose from "mongoose";

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27018/streamsphere'


export async function connectDB() {
    if(mongoose.connection.readyState === 1) return; // already db is connected

    await mongoose.connect(MONGO_URL,{
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000
    } as any)
    console.log('[DB] Connected:',MONGO_URL)
}

export async function disconnectDB() {
    if(mongoose.connection.readyState !== 0){
        await mongoose.disconnect()
        console.log('[DB] Disconnected')
    }
}