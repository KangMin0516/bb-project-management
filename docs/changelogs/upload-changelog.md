# Upload Changelog

> File storage layer. Two surfaces: **attachments** on issues/comments (S3 direct URL) and **avatars** for user profiles (S3 + API-proxied URL for cache control). All uploads enforce size + MIME + extension blocklists.

## Owns

- **Modules**: `packages/api/src/upload/`
- **Frontend**: `packages/web/src/api/issues.ts` `uploadApi` section, attachment widgets in `packages/web/src/components/issue/` and `packages/web/src/components/comment/`
- **Tables**: `attachments`
- **External storage**: AWS S3 bucket — configured via `AWS_S3_BUCKET`, `AWS_S3_REGION` (default `ap-northeast-2`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

## Surface

- `POST /api/upload` — JWT, multipart, query params `?issueId=` and/or `?commentId=`. Returns the persisted `attachments` row with the public S3 URL.
- `DELETE /api/upload/:id` — JWT, only the uploader can delete.
- `POST /api/auth/upload-avatar` — JWT, single avatar per user; old avatar best-effort deleted from S3 first.
- `GET /api/upload/avatar/:userId` — **public** proxy. Returns the avatar binary with long-lived cache headers.

## Constants

- `ATTACHMENT_MAX_SIZE = 50 MB` — issue/comment attachments.
- `AVATAR_MAX_SIZE = 5 MB`.
- **Avatar allowlist**: `.jpg`, `.jpeg`, `.png`, `.webp`.
- **Attachment blocklist** (executable / web-active types): `.exe .bat .cmd .com .msi .scr .pif .sh .bash .ps1 .vbs .js .wsh .wsf .html .htm .svg .hta .xhtml` and MIMEs `application/x-msdownload`, `application/x-executable`, `text/html`, `image/svg+xml`, `application/hta`, `application/javascript`, `text/javascript`, `application/x-sh`, `application/x-msdos-program`.

## Timeline

### 2026-05-20 — Fix 413 on attachment uploads + client-side image compression
**Fixed + Added.** Two coupled changes for the attachment upload pipeline:

1. **Nginx body limit.** `packages/web/nginx.conf` was missing `client_max_body_size`, so the reverse proxy was rejecting any upload above its 1 MB default with a 413 before NestJS even saw it — even though the API allowed up to 50 MB. Set the directive to `50m` to match `ATTACHMENT_MAX_SIZE`, and turned off `proxy_request_buffering` plus raised `proxy_read_timeout` to 120s so large multipart bodies stream through instead of being fully buffered on disk first.
2. **Client-side prepare step.** New `packages/web/src/shared/lib/prepareUpload.ts` runs before every upload call site (issue attachment, TipTap inline image, avatar). For compressible image MIMEs (`jpeg/png/webp/heic/heif`) it re-encodes via `browser-image-compression` at max 1920×1920 / ~1.5 MB target (avatar variant: 512×512 / ~0.5 MB) using a web worker. For everything else (videos, PDFs, ...) it only validates the size against the 50 MB / 5 MB cap and surfaces a `FileTooLargeError` with a localised message so the user gets a real toast instead of a generic Axios failure. Videos are *not* transcoded in-browser — ffmpeg.wasm was rejected as too heavy a bundle add for the current upload volume.

GIF and SVG are intentionally left uncompressed (animation / vector loss). If compression itself fails the original file is still attempted so we don't make uploads strictly worse on edge inputs.
- Source: `packages/web/nginx.conf`, `packages/web/src/shared/lib/prepareUpload.ts`, `packages/web/src/features/issue/hooks/useIssueMutations.ts`, `packages/web/src/shared/ui/editor/TipTapEditor.tsx`, `packages/web/src/features/auth/api.ts`, `packages/web/package.json` (added `browser-image-compression`).

### 2026-04-17 — Avatar cache TTL extended to 30 days (400e106)
**Changed.** `/api/upload/avatar/:userId` proxy now sets `Cache-Control: public, max-age=2592000, immutable`. Avatars stop flickering on every dashboard re-render. Trade-off: a profile picture change takes up to 30 days to propagate to other users' browsers; mitigation is a hash-busting query string when we know an avatar just changed.
- Source: `packages/api/src/upload/upload.controller.ts`.

### 2026-04-07 — Attachments + S3 wiring (Schema: `20260407060000_add_attachment`)
**Added + Schema.** `attachments` table with FK to either `issue_id` or `comment_id`, plus `uploader_id`. The service uploads via `@aws-sdk/client-s3` `PutObjectCommand` with the file's `mimetype` as `ContentType`. URL is the public S3 form `https://${bucket}.s3.${region}.amazonaws.com/${key}` — direct fetch from the browser.
- Migration: `20260407060000_add_attachment`.
- Source: `packages/api/src/upload/upload.service.ts:188` (`upload`).

### 2026-04-06 — Avatar upload + proxy
**Added.** Two routes: write (`POST /api/auth/upload-avatar`) and read (`GET /api/upload/avatar/:userId`). The DB stores `users.avatar = "/api/upload/avatar/<userId>"` — a proxy URL rather than the raw S3 URL, so the bucket can rotate/cache change without DB writes. The read endpoint streams the S3 `GetObjectCommand` response back to the browser.
- Source: `packages/api/src/upload/upload.service.ts:80` (`uploadAvatar`), `:138` (`getAvatar`).

## Open questions / known issues

- **R7 — Avatar `getAvatar` brute-forces 4 extensions on cache miss.** `users.avatar` stores `/api/upload/avatar/<userId>` without the extension. On a cold read the resolver tries `.jpeg`, `.jpg`, `.png`, `.webp` in sequence — up to 4 S3 GETs. Future fix: store the actual S3 key in `users.avatar`. See [`docs/ARCHITECTURE.md` §13](../ARCHITECTURE.md#13-risk-register).
- **No presigned upload URL.** All upload traffic goes through the API container, then forwards to S3. For large files this is wasteful bandwidth. A future change should issue presigned `PutObject` URLs and let the browser upload directly.
- **No content scanning.** The blocklist only checks declared MIME / extension. There's no AV scan and no inspection of bytes.
- **No CDN.** Public S3 URLs are hit directly. Adding CloudFront / a CDN would significantly improve attachment download latency for global users.
