import Media, { IMedia } from "./media.model";
import DeliveryPolicy, { IDeliveryPolicy } from "../delivery/delivery.model";
import { presignGet, presignPut } from "../../lib/minio.client";
import { mediaQueue } from "../../lib/queue";
import { randomBytes } from "crypto";
import { file } from "zod";

function makeObjectKey(filename: string) {
  // keep original extension, add random prefix for uniqueness
  const ext = filename.includes(".")
    ? filename.slice(filename.lastIndexOf("."))
    : "";
  const prefix = Date.now().toString(36) + "-" + randomBytes(4).toString("hex");
  return `${prefix}${ext}`;
}

// function to check the media Delivery is allowed to that region or not
function regionAllowed(policy: any | null, region?: string): boolean {
  if (!policy) return true;
  if (policy.allowRegions && policy.allowRegions.length > 0) {
    if (!region) return false;
    return policy.allowRegions
      .map((r: string) => r.toUpperCase())
      .includes(region.toUpperCase());
  }
  return true;
}

// function to check particular IP is allowed to access the content or not
function ipAllowed(policy: any | null, ip?: string): boolean {
  if (!policy) return true;
  if (policy.allowIPs && policy.allowIPs.length > 0) {
    if (!ip) return false;
    // naive exact match; replace with cidr-check if needed
    return policy.allowIPs.includes(ip);
  }
  return true;
}

export const MediaService = {
  async createPresignedUpload(
    {
      filename,
      titleId,
      uploaderId,
    }: { filename: string; titleId: string; uploaderId?: string },
    log: any,
  ) {
    log.info(
      { userId: uploaderId, filename, titleId },
      `Creating presigned upload Key`,
    );
    const objectKey = makeObjectKey(filename);
    log.info(
      { userId: uploaderId },
      `Create entry in Media collection for objectKey: ${objectKey}`,
    );
    const media = await Media.create({
      titleId,
      filename,
      objectKey,
      uploaderId,
      status: "upload_pending",
    });
    // create a DeliveryPolicy and point it to the MediaId
    log.info(
      { userId: uploaderId },
      `Creating DeliveryPolicy for media ID: ${media._id}`,
    );
    await DeliveryPolicy.create({ assetId: media._id });

    log.info(
      { userId: uploaderId },
      `Generating presigned PUT URL for objectKey: ${objectKey}`,
    );
    const url = await presignPut(objectKey, 600); // 10 minutes
    return { media, presignedUrl: url, objectKey };
  },

  async markUploadedAndEnqueue(mediaId: string, log: any) {
    const media = await Media.findById(mediaId);
    if (!media) {
      log.warn({ mediaId }, `markUploadedAndEnqueue: Media not found`);
      throw new Error("Media Not Found");
    }
    media.status = "uploaded";
    await media.save();
    log.info({ mediaId }, `Media marked as uploaded in DB`);

    // add job to processing queue
    log.info({ mediaId }, `Enqueuing media processing job`);
    await mediaQueue.add(
      "process-media",
      { mediaId },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
    return media;
  },

  async getStreamingUrl(
    mediaId: string,
    mode: any,
    variantQuery: any,
    region: any,
    clientIP: any,
    cookie: any,
    userId: string,
    log: any,
  ) {
    log.info({ mediaId, userId }, "Streaming service started");

    const media = await Media.findById(mediaId);
    if (!media) {
      log.warn({ mediaId }, "Media not found");

      throw new Error("Media Not Found");
    }
    if (media.status !== "ready") {
      log.warn({ mediaId, status: media.status }, "Media not ready");
      throw new Error("Media not ready for streaming");
    }

    const policy = await DeliveryPolicy.findOne({ assetId: media._id }).lean();

    // Embargo
    if (policy?.embargoUntil && new Date() < new Date(policy.embargoUntil)) {
      log.warn(
        { mediaId, embargoUntil: policy.embargoUntil },
        "Media embargoed",
      );

      return { error: "asset_embargoed", data: policy.embargoUntil };
    }

    // Region/IP checks
    if (!regionAllowed(policy, region)) {
      log.warn({ mediaId, region }, "Region not allowed");

      return { error: "region_not_allowed" };
    }
    if (!ipAllowed(policy, clientIP)) {
      log.warn({ mediaId, clientIP }, "IP not allowed");

      return { error: "ip_not_allowed" };
    }

    const key = media.outputUrlKey || media.objectKey;

    if (cookie === "true") {
      const expires = Math.floor(Date.now() / 1000) + 60 * 5;
      const payload = `${userId || "anon"}:${media._id}:${expires}`;
      const token = Buffer.from(payload).toString("base64");
      log.info({ mediaId, userId }, "Streaming cookie generated");

      return { cookie: { name: "cdn_token", value: token, expires } };
    }

    const url = await presignGet(key, 600);
    log.info({ mediaId, userId }, "Presigned streaming URL generated");

    return { media, url };
  },

  async updateStatus(mediaId: string, status: IMedia["status"]) {
    const m = await Media.findByIdAndUpdate(mediaId, { status }, { new: true });
    return m;
  },
};

/*** ***************** Get Stream URL function with the watermark, Varient according to video quality */
// utils/delivery.service.ts (or wherever you keep service code)
// import { Types } from 'mongoose';
// import Media from '../modules/media/media.model';
// import DeliveryPolicy from '../modules/delivery/delivery.model';
// import { presignGet } from '../lib/minio.client'; // your helper that returns presigned GET URL
// import crypto from 'crypto';

// function regionAllowed(policy: any | null, region?: string) {
//   if (!policy) return true;
//   if (policy.allowRegions && policy.allowRegions.length > 0) {
//     if (!region) return false;
//     return policy.allowRegions.map((r: string) => r.toUpperCase()).includes(region.toUpperCase());
//   }
//   return true;
// }
// function ipAllowed(policy: any | null, ip?: string) {
//   if (!policy) return true;
//   if (policy.allowIPs && policy.allowIPs.length > 0) {
//     if (!ip) return false;
//     return policy.allowIPs.includes(ip);
//   }
//   return true;
// }

// /**
//  * getStreamingUrl
//  * @param mediaId string - id of Media document
//  * @param opts - options object with mode, variantQuery, region, clientIP, cookie (boolean), userId
//  * @returns { error?: string, data?: any }
//  */
// export async function getStreamingUrl(
//   mediaId: string,
//   opts: {
//     mode?: 'stream' | 'download',
//     variantQuery?: string | undefined,
//     region?: string | undefined,
//     clientIP?: string | undefined,
//     cookie?: boolean,
//     userId?: string | undefined
//   } = {}
// ) {
//   const { mode = 'stream', variantQuery, region, clientIP, cookie = false, userId } = opts;

//   // validate id
//   if (!Types.ObjectId.isValid(mediaId)) return { error: 'invalid_media_id' };

//   // load media
//   const media = await Media.findById(mediaId).lean();
//   if (!media) return { error: 'media_not_found' };
//   if (media.status !== 'ready') return { error: 'media_not_ready' };

//   // load policy
//   const policy = await DeliveryPolicy.findOne({ assetId: media._id }).lean();

//   // embargo check
//   if (policy?.embargoUntil && new Date() < new Date(policy.embargoUntil)) {
//     return { error: 'asset_embargoed', data: { embargoUntil: policy.embargoUntil } };
//   }

//   // region/ip checks
//   if (!regionAllowed(policy, region)) return { error: 'region_not_allowed' };
//   if (!ipAllowed(policy, clientIP)) return { error: 'ip_not_allowed' };

//   // choose candidate variants list
//   const variants = Array.isArray(media.outputVariants) ? media.outputVariants : [];

//   // If watermark required, prefer watermarked variants
//   let chosenVariant: any | null = null;
//   if (policy?.requireWatermark) {
//     chosenVariant = variants.find((v: any) => v.watermarkApplied === true) || null;
//   }

//   // If client asked for a specific variant (e.g., '1080p' or 'hls_2400k'), try to find it
//   if (!chosenVariant && variantQuery) {
//     chosenVariant = variants.find((v: any) => v.name === variantQuery) || null;
//   }

//   // Default fallback: best available variant
//   if (!chosenVariant && variants.length > 0) {
//     // choose the first variant or implement a ranking by bitrate/resolution
//     chosenVariant = variants[0];
//   }

//   // If no variants available, fall back to original uploaded object (download mode)
//   if (!chosenVariant) {
//     if (mode === 'stream') {
//       // streaming requires HLS variants; we cannot stream a raw mp4 reliably here
//       return { error: 'no_variants_available' };
//     }
//     // for download, allow serving original objectKey
//   }

//   // cookie flow: return a token (dev). Use HMAC in production.
//   if (cookie) {
//     const expires = Math.floor(Date.now() / 1000) + 60 * 5; // 5 minutes
//     const payload = `${userId || 'anon'}:${media._id}:${expires}`;

//     // DEV: base64 (insecure)
//     // const token = Buffer.from(payload).toString('base64');

//     // PROD: HMAC (recommended)
//     const secret = process.env.CDN_SIGNING_KEY || 'dev-secret-change-me';
//     const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64');
//     const token = Buffer.from(JSON.stringify({ payload, hmac })).toString('base64');

//     return { data: { cookie: { name: 'cdn_token', value: token, expires } } };
//   }

//   // Build object path (what to presign)
//   let objectKey: string;
//   if (mode === 'download') {
//     objectKey = media.objectKey; // original
//   } else {
//     // stream -> chosenVariant.hlsMasterPath or media.outputUrlKey
//     objectKey = chosenVariant?.hlsMasterPath || media.outputUrlKey || media.objectKey;
//   }

//   // presign GET for client (short TTL). TTL depends on mode/UX
//   const ttl = 60 * 5; // 5 minutes
//   try {
//     const url = await presignGet(objectKey, ttl);
//     return { data: { media: { id: media._id, title: media.filename }, url, variant: chosenVariant?.name } };
//   } catch (err) {
//     console.error('presign error', err);
//     return { error: 'presign_failed' };
//   }
// }
