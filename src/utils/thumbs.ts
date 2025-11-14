import { spawn } from "child_process";
import path, { resolve } from "path";
import fs from "fs";
import os from "os";
import { ensureDir } from "./tmp";
import { stdout } from "process";

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";

/**
 * Generate N thumbnails from the input video at a particular interval of time
 * return array of local file paths
 */

export async function generateThumbnails(
  inputDir: string,
  outDir: string,
  {
    count = 10,
    width = 320,
    height = -2, // -2 preservs aspect ratio for width
  }: { count?: number; width?: number; height?: number }
): Promise<string[]> {
  ensureDir(outDir);

  // build the ffmpeg args to produce multiple images
  const duration = await probeDuration(inputDir).catch(() => 0.0);
  const rate = duration > 0 ? Math.max(0.1, duration / count) : 1.0;

  const outputPattern = path.join(outDir, "thumb-%03d.png");

  const args = [
    "-y",
    "-i",
    inputDir,
    "-vf",
    `fps=${rate},scale=${width}:${height}:flags=bicubic`,
    "-frames:v",
    String(count),
    outputPattern,
  ];

  await runFfmpeg(args);

  // collect produced files
  const files = fs
    .readdirSync(outDir)
    .filter((f) => f.startsWith("thumb-") && f.endsWith(".png"))
    .sort()
    .map((f) => path.join(outDir, f));

  return files;
}

/** ---- helpers */
function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(FFMPEG_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (d) => process.stdout.write(`[ffmpeg ${d}]`));
    p.stderr.on("data", (d) => process.stdout.write(`[ffmpeg] ${d}`));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))
    );
  });
}

/** run the probe command to get video duration(seconds) */
function probeDuration(input: string): Promise<number> {
  return new Promise((resolve) => {
    try {
      const { execSync } = require("child_process");
      const out = execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 ${input}`
      )
        .toString()
        .trim();
      const n = parseFloat(out);
      resolve(isNaN(n) ? 0 : n);
    } catch (error) {
      resolve(0);
    }
  });
}

export async function generateSpriteAndVtt(
  thumbnails: string[],
  spritePath: string,
  vttPath: string,
  {
    columns = 5,
    thumbWidth = 320,
    thumbHeight = -1,
    duration = 0,
  }: {
    columns?: number;
    thumbWidth?: number;
    thumbHeight?: number;
    duration?: number;
  } = {}
): Promise<{
  spritePath: string;
  vttPath: string;
  cellW: number;
  cellH: number;
}> {
  if (!thumbnails || thumbnails.length === 0)
    throw new Error("No thumbnails provided");

  const outDir = path.dirname(spritePath);
  ensureDir(outDir);

  // determine rows
  const total = thumbnails.length;
  const cols = columns;
  const rows = Math.ceil(total / cols);

  const tmpDir = path.join(os.tmpdir(), `sprite-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  thumbnails.forEach((src, idx) => {
    const dst = path.join(
      tmpDir,
      `thumb-${String(idx + 1).padStart(3, "0")}.png`
    );
    fs.copyFileSync(src, dst);
  });

  // use ffmpeg tile filter:
  // -pattern_type glob doesn't gurantee order, so we use a numeric pattern
  const inputPattern = path.join(tmpDir, "thumb-%03d.png");

  // build filter: tile=columnsxrows
  const tileFilter = `tile=${cols}x${rows}`;

  // Use scale to unify cell size if needed via -vf "scale=thumbWidth:-1,tile=WxH"
  // But tile filter expects all inputs same size — we rely on generated thumbs having same size.
  const args = [
    "-y",
    "-i",
    inputPattern,
    "-filter_complex",
    tileFilter,
    "-frames:v",
    "1",
    spritePath,
  ];

  await runFfmpeg(args);
  
  // Build VTT file mapping. We'll assume thumbnails are evenly spaced across `duration` seconds.
  // cue duration per thumbnail:
  const per = duration && duration > 0 ? duration / total : 1;
  // Build cues referencing sprite coordinates
  // Each thumbnail index i => row = floor(i/cols), col = i % cols
  const cellW = thumbWidth; // assume same as requested width
  // For height get actual image height (read via fs? we'll assume aspect kept and thumbHeight unknown)
  // For robust clients, sprite VTT references background-position in pixels; we need sprite cell height. Probe image height of first thumb.
  const first = thumbnails[0];
  const size = await probeImageSize(first);
  const cellH = size ? size.h : 180;

  // Create VTT text
  let vtt = 'WEBVTT\n\n';
  for (let i = 0; i < total; i++) {
    const start = secondsToTimestamp(i * per);
    const end = secondsToTimestamp((i + 1) * per);
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = col * cellW;
    const y = row * cellH;
    // cue: start --> end
    // sprite syntax: <sprite.jpg>#xywh=x,y,w,h
    vtt += `${start} --> ${end}\n`;
    vtt += `${path.basename(spritePath)}#xywh=${x},${y},${cellW},${cellH}\n\n`;
  }
  fs.writeFileSync(vttPath, vtt, 'utf8');

  // cleanup tmpDir
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  return { spritePath, vttPath, cellW, cellH };
}


/** Probe image size using sharp if available, else fallback to reading with native image-size library if installed.
 * We'll use a minimal implementation: attempt to require('image-size') or return null.
 */
function probeImageSize(imgPath: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    try {
      const sizeOf = require('image-size');
      const s = sizeOf(imgPath);
      resolve({ w: s.width, h: s.height });
    } catch {
      resolve(null);
    }
  });
}

function secondsToTimestamp(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}