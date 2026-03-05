# Media Module

## Overview

The Media Module is responsible for handling video uploads, processing, and preparation for streaming within the StreamSphere platform.

This module performs video transcoding using FFmpeg, generates streaming-compatible formats, and stores processed media files for playback.

The goal of this module is to ensure:

* High quality video streaming
* Multiple resolution support
* Scalable video delivery
* Secure video access

---

# Responsibilities

The Media Module handles the following tasks:

* Upload video files
* Process video using FFmpeg
* Generate multiple video resolutions
* Convert videos into streaming format
* Store processed media files
* Provide metadata required for playback

---

# Media Processing Flow

The media processing pipeline follows this workflow:

1. Admin uploads a video file
2. Backend receives the video
3. The video is stored temporarily
4. FFmpeg worker processes the video
5. Multiple resolutions are generated (e.g., 360p, 720p, 1080p)
6. Video is converted into streaming-friendly segments
7. Processed files are stored in the media storage
8. Media metadata is stored in the database
9. Video becomes available for streaming

---

# Architecture

The media processing architecture consists of the following components:

**Media Model**
Holds the Structure of the media module

**Media Controller**
Handles incoming API requests for media upload.

**Media Service**
Contains business logic for processing and managing media files.

**Media Worker**
Executes background video transcoding using FFmpeg.

**Media Storage**
Stores processed video segments and manifests.

---

# Video Transcoding

Video transcoding is performed using FFmpeg.

The uploaded video is converted into multiple resolutions to support adaptive streaming.

Example resolutions generated:

* 360p
* 480p
* 720p
* 1080p

This allows clients with different internet speeds to stream appropriate quality.

---

# Streaming Format

Videos are converted into a streaming-friendly format using segmented files.

Typical output structure:

media/
title-id/
360p/
playlist.m3u8
segment1.ts
segment2.ts

720p/
playlist.m3u8
segment1.ts
segment2.ts

The playlist file controls adaptive streaming.

---

# API Endpoints

## Upload Media

Generate the presigned Url by the minio s3

POST /media/presign

Request: 
* filename: Name of the File
* TitleId: Catalog ID From which Video Belong
* UserId:  Uploader ID from Middleware

Response:
* mediaId: Generate By DB
* presignedUrl: Url on which video is uploaded
* objectKey: Unique Object Key for MINIO
* expiesInSec: presignedUrl expiry time

Starting the video uploading with Transcoding in HLS Folder Structure

POST /:id/complete

Params:
* id: Contains the mediaId 

Response:
* message: "upload acknowledge; processing queued"

Queue Process
* Enqueue the Job in the BullMQ Queue for uploading Process
* Process the Queue and take Video Processing Jobs
* Take Job from the Queue and convert the Video to HLS
* Generate thumbnail and sprite and Vtt

---

## Get Media Info

Returns information about processed media.

GET /media/:id/url

Response:
* Media Url

Get Detaila about the Media

GET /media/:id

Response: 
* _id: 69a99fce30406dd01a303f1a
* titleId: 69a84d9252cc12156fc984c7
* filename: video
* objectKey: mmdm7aw8-1a924ddc
* uploaderId: 69a07381763b894575e31384
* status: ready
* attempts: 0,
* progress: 100,
* thumbnails: [],
* spriteKey: "thumbnails/69a99fce30406dd01a303f1a/sprite.jpg",
* vttKey: "thumbnails/69a99fce30406dd01a303f1a/sprite.vtt",
* processingLogs: [],
* createdAt: "2026-03-05T15:22:54.097Z",
* updatedAt: "2026-03-05T16:07:30.377Z",
* __v: 0,
* outputUrlKey: "hls/69a99fce30406dd01a303f1a/hls_2400k/master.m3u8"

Get Thumbnail And VTT Data

GET /media/:id/thumbnails


---

# FFmpeg Usage

FFmpeg is used to perform video transcoding.

Example command used by the worker:

ffmpeg -i input.mp4 
-map 0:v -map 0:a 
-b:v:0 800k -s:v:0 640x360 
-b:v:1 2800k -s:v:1 1280x720 
-f hls 
-hls_time 10 
-hls_playlist_type vod 
output.m3u8

This command generates HLS segments for streaming.

---

# Background Processing

Video transcoding is performed in a worker process.

Reasons:

* Video processing is CPU intensive
* It should not block API requests
* It allows asynchronous processing

Workers process video jobs in the background.

---

# Security Considerations

To prevent unauthorized access:

* Streaming URLs can be signed
* Media files can be protected behind CDN
* Direct storage access is restricted

---

# Future Improvements

Planned enhancements for the media module include:

* Integration with CDN for faster delivery
* Signed streaming URLs
* Video watermarking
* Thumbnail generation
* Distributed transcoding workers
* Support for DASH streaming format

---

# Summary

The Media Module is responsible for processing and preparing video files for streaming in the StreamSphere platform.

It ensures efficient video delivery by:

* transcoding videos
* generating multiple resolutions
* preparing adaptive streaming formats
* storing media metadata

This module forms the backbone of the video streaming system.
