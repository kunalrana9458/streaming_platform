import { spawn } from "child_process";
import path, { resolve } from "path";
import fs from "fs";
import { ensureDir } from "./tmp";

import dotenv from "dotenv";
import { rejects } from "assert";

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
    videoBitrate = "2500k",
    audioBitrate = "128k",
    hlsTime = 4,
    hlsListSize = 0,
  } = opts;

  const variantDir = path.join(outDir, variantName);
  ensureDir(variantDir);

  const master = path.join(variantDir, "master.m3u8");
  const segmentPattern = path.join(variantDir, "segment_%03d.ts");

  const args = [
    "-y", // overwrite existing files
    "-i",
    inputPath, // input file path
    "-c:v",
    "libx264", // video codec
    "-preset",
    "veryfast", // encoding speed (quality tradeoff)
    "-b:v",
    videoBitrate, // target video bitrate
    "-c:a",
    "aac", // audio codec
    "-b:a",
    audioBitrate, // target audio bitrate
    "-ac",
    "2", // audio channels (stereo)
    "-f",
    "hls", // output format
    "-hls_time",
    String(hlsTime), // segment length (seconds)
    "-hls_list_size",
    String(hlsListSize), // 0 = all segments
    "-hls_segment_filename",
    segmentPattern, // naming pattern
    "-hls_flags",
    "independent_segments", // independent keyframes per segment
    master, // output playlist file
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
