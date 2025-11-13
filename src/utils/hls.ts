import { spawn } from "child_process";
import path, { resolve } from "path";
import fs from "fs";
import { ensureDir } from "./tmp";

import dotenv from "dotenv";

dotenv.config();

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";

export interface HlsOptions {
  variantName?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  hlsTime?: number;
  hlsListSize?: number; // e.g. ['360p','480p','720p']
}

export async function transcodeToHlsSingle(
  inputPath: string,
  outDir: string,
  opts: HlsOptions = {}
): Promise<{ masterPath: string }> {
  const {
    variantName = "hls",
    videoBitrate = "25000k",
    audioBitrate = "128k",
    hlsTime = 4,
    hlsListSize = 0,
  } = opts;

  const variantDir = path.join(outDir, variantName);
  ensureDir(variantDir);

  const master = path.join(variantDir, "master.m3u8");
  const segmentPattern = path.join(variantDir, "segment_%03d.ts");

  // assume videoBitrate is like "2500k" and hlsTime is number (e.g. 4)
const num = parseInt(String(videoBitrate).replace(/k$/i, ""), 10) || 2500;
const maxrate = `${Math.round(num * 1.5)}k`;
const bufsize = `${Math.round(num * 3)}k`;

// choose target GOP based on ~30fps (use a reasonable default)
const fpsEstimate = 30;
const keyint = Math.max(1, Math.round(fpsEstimate * hlsTime));      // e.g. 30 * 4 = 120
const minKeyint = Math.max(1, Math.round(keyint / 2));             // e.g. 60

const args = [
  "-y",
  "-i", inputPath,

  // video codec + preset
  "-c:v", "libx264",
  "-preset", "medium",        // change to "fast" if you need speed over quality
  "-profile:v", "main",
  "-pix_fmt", "yuv420p",

  // scale to 720p (remove or change height if you want same as source)
  "-vf", "scale=-2:720:flags=bicubic",

  // bitrate control (ABR) - remove '-crf' when using bitrate mode
  "-b:v", videoBitrate,      // e.g. "2500k"
  "-maxrate", maxrate,       // ~1.5 * target
  "-bufsize", bufsize,       // ~3 * target

  // GOP / keyframe settings (portable)
  "-g", String(keyint),
  "-keyint_min", String(minKeyint),
  "-sc_threshold", "0",

  // audio
  "-c:a", "aac",
  "-b:a", audioBitrate,
  "-ac", "2",
  "-ar", "48000",

  // HLS output
  "-f", "hls",
  "-hls_time", String(hlsTime),
  "-hls_list_size", String(hlsListSize),
  "-hls_segment_filename", segmentPattern,
  "-hls_flags", "independent_segments+append_list",
  master
];




  await runFfmpeg(args);
  if(!fs.existsSync(master)) {
    throw new Error('HLS master playlist not generated')
  }
  return {masterPath:master}
}

function runFfmpeg(args:string[]) {
    return new Promise<void>((resolve,reject) => {
        const p = spawn(FFMPEG_PATH,args,{stdio:['ignore','pipe','pipe']})

        p.stdout.on('data',(d) => process.stdout.write(`[ffmpeg] ${d}`))
        p.stderr.on('data',(d) => process.stdout.write(`[ffmpeg] ${d}`))

        p.on('error',reject)
        p.on('close',(code) => {
            if(code === 0) resolve()
            else reject(new Error(`ffmpeg exited with code ${code}`))
        })
    })
}
