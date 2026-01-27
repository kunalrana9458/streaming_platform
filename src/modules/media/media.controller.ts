import { Request, Response } from "express";
import { MediaService } from "./media.service";
import Media from "./media.model";
import { presignGet } from "../../lib/minio.client";

// POST - /media/presign
export async function presignUpload(req: any, res: Response) {
  try {
    // do basic validation
    const { filename, titleId } = req.body;

    if (!filename || !titleId) {
      req.log.warn(
        "Invalid upload presign request: missing filename or titleId",
      );
      return res
        .status(400)
        .json({ message: "filename and titleId are required" });
    }

    const uploaderId = (req as any).user?.id;

    if (!uploaderId) {
      req.log.warn("Unauthenticated upload presign request");
      return res.status(401).json({ message: "authentication required" });
    }

    const { media, presignedUrl, objectKey } =
      await MediaService.createPresignedUpload(
        { filename, titleId, uploaderId },
        req.log,
      );

    if (presignedUrl) {
      req.log.info(
        { userId: uploaderId, mediaId: media._id },
        `Generated presigned upload URL for media ID: ${media._id}`,
      );
    }

    req.log.info(
      { userId: uploaderId, mediaId: media._id },
      `Presigned upload flow created successfully`,
    );

    return res.json({
      mediaId: media._id,
      presignedUrl,
      objectKey,
      expiresInSec: 6000,
    });
  } catch (err: any) {
    req.log.error({ err }, "Error in presignUpload");
    return res.status(500).json({
      message: err.message || "failed",
    });
  }
}

// POST /media/:id/complete {Client calls after successful PUT}
export async function uploadComplete(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      req.log.warn("uploadComplete called without media ID");
      return res.status(400).json({ message: "media ID is required" });
    }
    req.log.info(
      { mediaId: id },
      `Acknowledging upload complete for media ID: ${id}`,
    );
    await MediaService.markUploadedAndEnqueue(id, req.log);
    req.log.info(
      { mediaId: id },
      `Media ID: ${id} marked as uploaded and enqueued for processing`,
    );
    return res.json({ message: "upload acknowledge; processing queued" });
  } catch (err: any) {
    req.log.error({ err }, "Error in uploadComplete");
    return res.status(500).json({ message: err.message });
  }
}

// GET /media/:id/url
export async function getStreamingUrl(req: any, res: Response) {
  try {
    const { id } = req.params;

    const mode = (req.query.mode as string) || "stream";
    const variantQuery = (req.query.variant as string) || undefined;
    const region = (req.header("x-region") || req.query.region) as
      | string
      | undefined;
    const clientIp = (req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress) as string | undefined;
    const cookie = (req.query.cookie as any) || "false";
    const userId = req?.user?.id as string;

    req.log.info(
      { mediaId: id, userId, mode, region },
      "Get streaming URL started",
    );

    const { url } = await MediaService.getStreamingUrl(
      id,
      mode,
      variantQuery,
      region,
      clientIp,
      cookie,
      userId,
      req.log,
    );

    req.log.info(
      { mediaId: id, userId },
      "Streaming URL generated successfully",
    );
    return res.json({ url });
  } catch (err: any) {
    req.log.error(
      { error: err.message, mediaId: req.params.id },
      "Failed to generate streaming URL",
    );
    return res.status(400).json({ message: err.message });
  }
}

// GET /media/:id   (metadata)
export async function getMediaById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    req.log.info({ mediaId: id }, "Fetching media metadata");

    const doc = await Media.findById(id).lean();
    if (!doc) {
      req.log.warn({ mediaId: id }, "Media not found");

      return res.status(404).json({ message: "Media not found" });
    }
    req.log.info({ mediaId: id }, "Media metadata fetched");

    return res.json({ media: doc });
  } catch (e: any) {
    req.log.error(
      { error: e.message, mediaId: req.params.id },
      "Error fetching media metadata",
    );
    return res.status(500).json({ message: e.message });
  }
}

// GET /:id/thumbnails
export async function getThumbnailAndWebVttData(req: Request, res: Response) {
  try {
    const { id } = req.params;

    req.log.info({ mediaId: id }, "Fetching thumbnails and VTT");

    const media = await Media.findById(req.params.id);
    if (!media) {
      req.log.warn({ mediaId: id }, "Media not found for thumbnails");

      return res.status(404).json({ message: "not found" });
    }

    const expires = 60 * 60; // 1 hour

    const thumbs = (media.thumbnails || []).map((key: string) =>
      presignGet(key, expires),
    );
    const sprite = media.spriteKey
      ? presignGet(media.spriteKey, expires)
      : null;
    const vtt = media.vttKey ? presignGet(media.vttKey, expires) : null;

    req.log.info({ mediaId: id }, "Thumbnail URLs generated");

    // presignGet may return Promise or string depending on your client; adapt accordingly
    res.json({
      thumbnails: await Promise.all(thumbs),
      sprite: await sprite,
      vtt: await vtt,
    });
  } catch (error: any) {
    req.log.error(
      { error: error.message, mediaId: req.params.id },
      "Error fetching thumbnails",
    );
    return res.status(500).json({ message: error.message });
  }
}
