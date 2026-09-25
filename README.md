# ImgPress — Media Compression Service

ImgPress is a self-hosted Node.js service and web interface for compressing and converting images, audio, video, and PDF files. Processing happens on your server; uploaded files are not retained after processing.

## Features

- Batch web interface with drag-and-drop uploads and ZIP downloads
- Image compression with WebP, AVIF, JPEG, PNG, and GIF output
- HEIC/HEIF conversion, plus TIFF and BMP input support
- Audio transcoding to AAC in an M4A container
- Video transcoding to H.264/AAC MP4
- PDF optimization or first-page export to PNG, WebP, AVIF, or JPEG
- Smart quality limits, color-space conversion, and Lanczos3 resizing
- Optional domain allowlist for WordPress/API clients
- Admin UI for managing allowed domains
- Docker image and Docker Compose deployment
- CORS support for cross-origin integrations

## Requirements

For local Node.js development:

- Node.js 18 or newer
- `ffmpeg` for HEIC, audio, and video processing
- Ghostscript (`gs`) for PDF processing
- MariaDB/MySQL is optional; it is only needed for domain authorization and the admin panel

Docker includes Node.js, FFmpeg, Ghostscript, and the native image-processing dependencies.

## Quick Start

### Node.js

```bash
git clone git@github.com:binjuhor/imgpress.org.git
cd imgpress.org/server
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). The web interface is served by the same Node.js process.

To use a custom configuration, copy `server/.env.example` to `server/.env` and edit the values before starting the server.

### Docker

```bash
docker build -t imgpress .
docker run --rm -p 3000:3000 imgpress
```

### Docker Compose

Compose starts ImgPress with MariaDB for domain authorization and the admin panel:

```bash
export DB_PASSWORD='replace-with-a-strong-password'
export DB_ROOT_PASSWORD='replace-with-another-strong-password'
export ADMIN_KEY='replace-with-an-admin-key'
docker network create caddy 2>/dev/null || true
docker compose up -d --build
```

The Compose file expects the external `caddy` network because it is designed to sit behind a Caddy reverse proxy. Remove that network from `compose.yml` if a reverse proxy is not being used.

## Web Interface

Visit `/` to use the browser client. It accepts up to 20 files per batch and supports:

- Images: JPEG, PNG, WebP, AVIF, GIF, HEIC/HEIF, TIFF, and BMP
- Audio: MP3, WAV, FLAC, AAC, OGG, M4A, Opus, and related formats → AAC/M4A
- Video: MOV, AVI, MKV, WMV, FLV, WebM, MPEG, and related formats → H.264/MP4
- PDF: optimization, or first-page export to PNG, WebP, AVIF, or JPEG

The format, quality, and maximum image width controls apply to image processing. Quality also controls audio bitrate, video CRF, and the PDF optimization preset. Converted files can be downloaded individually or as a ZIP archive.

## HTTP API

### Compress one file

`POST /compress/one`

Send a `multipart/form-data` request with a required `file` field. The response contains the converted file as base64, so this endpoint is convenient for direct integrations.

Query parameters:

| Parameter | Default | Description |
| --- | ---: | --- |
| `format` | `webp` | Image output: `auto`, `webp`, `avif`, `jpeg`, `png`, or `gif`. Selecting an image format for a PDF exports its first page; otherwise PDFs, audio, and video use their native output. |
| `quality` | `80` | Quality from 1–100. The service applies format-specific limits. |
| `width` | `1600` | Maximum image width. Images are never enlarged. |

Example:

```bash
curl -X POST \
  -F 'file=@photo.jpg' \
  'http://localhost:3000/compress/one?format=avif&quality=75&width=1200'
```

Successful image response:

```json
{
  "name": "photo.jpg",
  "mime": "image/avif",
  "originalSize": 2048576,
  "compressedSize": 614400,
  "savedBytes": 1434176,
  "ratio": 70,
  "data": "...base64...",
  "error": false
}
```

### Batch compression with download URLs

`POST /api/compress`

Send up to `MAX_FILES` files in a `files` multipart field. The response contains one result per file and a temporary `downloadUrl` instead of inline base64 data. Download URLs expire after `JOB_TTL_MS` (one hour by default) and are deleted after download.

When database configuration is enabled, this endpoint requires an `X-Site-Domain` header whose value is present in the allowed-domain table. If the database is disabled, domain checks are skipped.

```bash
curl -X POST \
  -H 'X-Site-Domain: example.com' \
  -F 'files=@photo.jpg' \
  -F 'files=@document.pdf' \
  'http://localhost:3000/api/compress?format=webp&quality=80'
```

Download a result with `GET /api/download/:id`.

## Admin and Domain Allowlist

Open `/admin` to manage allowed domains. Requests to these endpoints require the `X-Admin-Key` header:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/domains` | List allowed domains |
| `POST` | `/api/admin/domains` | Add a domain; JSON body: `{ "domain": "example.com", "note": "..." }` |
| `DELETE` | `/api/admin/domains/:id` | Remove a domain |

Set `ADMIN_KEY` and the MariaDB variables before using the admin panel. Domain authorization is applied to `/api/compress`, not `/compress/one`.

## Configuration

All settings are environment variables. See [`server/.env.example`](server/.env.example) for the full template.

| Variable | Default | Purpose |
| --- | ---: | --- |
| `PORT` | `3000` | HTTP port |
| `MAX_FILE_SIZE_MB` | `50` | Maximum non-video file size |
| `MAX_VIDEO_FILE_SIZE_MB` | `500` | Maximum video file size |
| `MAX_FILES` | `20` | Maximum files in a batch |
| `MAX_IMAGE_SIDE_PX` | `20000` | Maximum image width or height |
| `MAX_IMAGE_MEGAPIXELS` | `200` | Maximum image pixel count |
| `DEFAULT_QUALITY` | `80` | Default quality |
| `DEFAULT_WIDTH` | `1600` | Default maximum image width |
| `COMPRESS_TIMEOUT_MS` | `300000` | Processing timeout |
| `JOB_TTL_MS` | `3600000` | Temporary download URL lifetime |
| `DB_HOST` | empty | Enables MariaDB domain checks when set |
| `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | — | Database connection settings |
| `ADMIN_KEY` | empty | Enables authenticated admin endpoints when set |

Additional image tuning variables include `MAX_QUALITY_NO_ALPHA`, `MAX_QUALITY_WITH_ALPHA`, `DITHER_MAX`, `DITHER_MIN`, and `SHARP_CONCURRENCY`. Server timeout variables are also available in `server/.env.example`.

## Processing Notes

- Images are converted to sRGB and resized with the Lanczos3 kernel when needed.
- JPEG uses MozJPEG and progressive encoding; PNG uses maximum compression; AVIF uses 4:2:0 chroma subsampling; GIF uses adaptive dithering.
- Image quality is capped at 85 for opaque images and 90 for images with transparency.
- HEIC/HEIF input is decoded through FFmpeg before image processing.
- PDF image export renders only the first page.
- SVG input is passed through unchanged.
- CORS allows all origins by default. Restrict `Access-Control-Allow-Origin` in `server/middleware/cors.js` for a locked-down deployment.

## Development

```bash
cd server
npm install
npm test
npm start
```

Project layout:

```text
server/
├── config/                 # Environment configuration
├── database/               # Optional MariaDB connection and schema setup
├── middleware/             # Upload, timeout, CORS, and authorization middleware
├── routes/                 # Compression and admin API routes
├── services/               # Image, audio, video, and PDF processing
├── stores/                 # Temporary in-memory download jobs
└── test/                   # Node.js tests
client/                    # Web and admin interfaces
Dockerfile                 # Production container
compose.yml                # App + MariaDB deployment
```

## Credits & Acknowledgments

ImgPress was built on the image-processing foundation of the open-source project [hoanghiep2625/imgpress](https://github.com/hoanghiep2625/imgpress). The current project has been independently refactored and extended with a full web client, FFmpeg-based audio/video processing, PDF processing, HEIC support, domain authorization, administration tools, Docker deployment, and API integration features.

Special thanks to the original author for the image-compression baseline.

## License

MIT

## Support

For bugs, feature requests, or questions, open an issue in this repository.
