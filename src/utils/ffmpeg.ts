
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export interface ProbeResult {
    duration?: number;
    width?: number;
    height?: number;
    videoCodec?: string;
    audiocodec?: string;
    format?: string;
    bitrate?: number;
}

export async function probeUrl(inputUrl: string): Promise<ProbeResult> {
    // use the ffprobe command to get media info
    const args = [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        inputUrl
    ]

    const {stdout} = await execFileAsync(FFPROBE, args,{maxBuffer:10*1024*1024});

    const json = JSON.parse(stdout);
    const format = json.format || {}
    const streams = Array.isArray(json.streams) ? json.streams : []

    const video = streams.find((s: any) => s.codec_type === 'video') || {}
    const audio = streams.find((s: any) => s.codec_type === 'audio') || {}

    return {
        duration: format.duration ? parseFloat(format.duration) : undefined,
        width: video.width,
        height: video.height,
        videoCodec: video.codec_name,
        audiocodec: audio.codec_name,
        format: format.format_name,
        bitrate: format.bit_rate ? parseInt(format.bit_rate) : undefined,
    }
}