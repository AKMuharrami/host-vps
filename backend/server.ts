import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import http from "http";
import https from "https";
import fs from "fs";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Initialize backend app
const app = express();
const EXPRESS_PORT = process.env.PORT || "3005";

console.log(`[Init] Starting Hostinger VPS backend on port: ${EXPRESS_PORT}`);
console.log(`[System] CPU Cores: ${os.cpus().length}`);
console.log(`[System] Total Memory: ${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB`);

// Debug logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({limit: "50mb"}));
app.use(express.urlencoded({limit: "50mb", extended: true}));
app.use(express.text({ limit: '200mb' }));

// Static file serving for temp files and fonts
app.use("/temp", express.static(os.tmpdir()));
app.use("/fonts", express.static(path.join(os.tmpdir(), "fonts")));

// Set the native ffmpeg binary path
let validFfmpegPath = process.env.SYSTEM_FFMPEG_PATH || ffmpegStatic || 'ffmpeg'; 
ffmpeg.setFfmpegPath(validFfmpegPath);
console.log(`[FFmpeg] Using binary at: ${validFfmpegPath}`);

// Configure Multer
const uploadDir = path.join(os.tmpdir(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ 
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 * 1024 } 
});

// Font Manager
const FONT_URLS: Record<string, string> = {
  'Janna LT': 'https://hjrm8lbtnby37npy.public.blob.vercel-storage.com/Janna%20LT%20Regular.ttf',
  'Cairo': 'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/Cairo%5Bslnt%2Cwght%5D.ttf',
  'Tajawal': 'https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Bold.ttf',
  'Amiri': 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Bold.ttf',
  'IBM Plex Sans Arabic': 'https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsansarabic/IBMPlexSansArabic-Bold.ttf',
  'DejaVu Sans': 'https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf',
  'Roboto': 'https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf',
  'Noto Sans Arabic': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf',
  'Noto Sans JP': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf',
  'Noto Sans SC': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf'
};

async function downloadFont(fontName: string, url: string, fontsDir: string) {
  const fontPath = path.join(fontsDir, `${fontName}_v2.ttf`);
  if (fs.existsSync(fontPath)) return;
  try {
    console.log(`[Font Installer] Downloading font: ${fontName}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Font download failed`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(fontPath, Buffer.from(buffer));
  } catch (err) {
    console.error(`[Font Installer] Failed to download font ${fontName}`);
  }
}

async function ensureFont(fontName: string): Promise<string | null> {
  const fontsDir = path.join(os.tmpdir(), 'fonts');
  if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
  const normalizedKey = Object.keys(FONT_URLS).find(k => k.toLowerCase() === fontName.toLowerCase());
  const actualFontName = normalizedKey ? normalizedKey : 'DejaVu Sans';
  await downloadFont(actualFontName, FONT_URLS[actualFontName], fontsDir);
  return fontsDir;
}

const exportJobs = new Map<string, { status: string; progress?: number; downloadUrl?: string; error?: string }>();
const jobQueue: (() => Promise<void>)[] = [];
const MAX_CONCURRENT_JOBS = process.env.MAX_CONCURRENT_JOBS ? parseInt(process.env.MAX_CONCURRENT_JOBS) : 1;
let activeJobs = 0;

// Periodic cleanup
setInterval(() => {
  const tempDir = os.tmpdir();
  fs.readdir(tempDir, (err, files) => {
    if (err) return;
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > 10 * 60 * 1000) {
          if (stats.isDirectory() && file.startsWith('remotion-')) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else if (file.startsWith('out_') || file.startsWith('subs_') || file.startsWith('dl_') || file.startsWith('concat_')) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (e) {}
    });
  });
}, 15 * 60 * 1000);

let globalCachedBundleLocation: string | null = null;
let globalBundlePromise: Promise<string> | null = null;

async function processQueue() {
  while (jobQueue.length > 0 && activeJobs < MAX_CONCURRENT_JOBS) {
    const job = jobQueue.shift();
    if (job) {
      activeJobs++;
      job()
        .catch(err => console.error("[Queue] Job failed", err))
        .finally(() => {
          activeJobs--;
          processQueue();
        });
    }
  }
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", mode: "Hostinger Standalone" }));

app.get("/api/download-export/:fileId", (req, res) => {
  const { fileId } = req.params;
  const { name } = req.query;
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, `out_${fileId}.mp4`);
  if (!fs.existsSync(filePath)) return res.status(404).send("File expired");
  const downloadName = name ? String(name) : 'video.mp4';
  res.download(filePath, downloadName);
});

app.post("/api/export-video", upload.single('videoFile'), async (req: any, res: any) => {
  const videoUrl = req.body.videoUrl || '';
  const uploadedFilePath = req.file?.path;
  const { srtContent, assStyle, originalName, videoWidth, videoHeight, captionsJson } = req.body;
  
  if (!videoUrl && !uploadedFilePath) return res.status(400).json({ error: "No video" });

  const sessionId = `${uuidv4().substring(0, 8)}_${Date.now()}`;
  let videoSource = uploadedFilePath || videoUrl;
  
  exportJobs.set(sessionId, { status: 'pending' });
  res.json({ jobId: sessionId });

  jobQueue.push(async () => {
    exportJobs.set(sessionId, { status: 'processing' });
    let srtFileName: string | undefined;
    let outputPath: string | undefined;
    let downloadedVideoPath: string | undefined;
    
    try {
        if (videoSource.startsWith('http')) {
           const dlRes = await fetch(videoSource);
           const arr = await dlRes.arrayBuffer();
           downloadedVideoPath = path.join(os.tmpdir(), `dl_${sessionId}.mp4`);
           fs.writeFileSync(downloadedVideoPath, Buffer.from(arr));
           videoSource = downloadedVideoPath;
        }

        const tempDir = os.tmpdir();
        outputPath = path.join(tempDir, `out_${sessionId}.mp4`);
        
        const vW = parseInt(videoWidth || '720') || 720;
        const vH = parseInt(videoHeight || '1280') || 1280;

        let captionsParams = null;
        let styleOptionsParsed = null;
        try {
            captionsParams = typeof captionsJson === 'string' ? JSON.parse(captionsJson) : captionsJson;
            styleOptionsParsed = typeof req.body.styleOptions === 'string' ? JSON.parse(req.body.styleOptions) : req.body.styleOptions;
            if (req.body.captionPosition) {
              const pos = typeof req.body.captionPosition === 'string' ? JSON.parse(req.body.captionPosition) : req.body.captionPosition;
              styleOptionsParsed = styleOptionsParsed || {};
              styleOptionsParsed.captionPosition = pos;
            }
        } catch (e) {}

        if (captionsParams && styleOptionsParsed) {
            const { bundle } = await import('@remotion/bundler');
            const { renderMedia, selectComposition } = await import('@remotion/renderer');
            
            if (!globalCachedBundleLocation) {
                if (!globalBundlePromise) {
                    globalBundlePromise = (async () => {
                        console.log("[Export] Bundling Remotion project...");
                        const location = await bundle({
                            entryPoint: path.join(__dirname, 'remotion', 'index.tsx'),
                            publicPath: ""
                        });
                        globalCachedBundleLocation = location.replace(/\/index\.html$/, '');
                        return globalCachedBundleLocation;
                    })();
                }
                await globalBundlePromise;
            }
            
            const bundleLocation = globalCachedBundleLocation!;
            const relativePath = path.relative(os.tmpdir(), videoSource);
            const localVideoUrl = `http://127.0.0.1:${EXPRESS_PORT}/temp/${relativePath.replace(/\\/g, '/')}`;

            const rawDuration = parseFloat(req.body.duration);
            const durationInFrames = Math.max(1, Math.ceil((isNaN(rawDuration) ? 5 : rawDuration) * 30));

            const FONT_MAP: Record<string, string> = {
                'font-sans': 'Janna LT',
                'font-cairo': 'Cairo',
                'font-tajawal': 'Tajawal',
                'font-serif': 'Amiri',
                'font-roboto': 'Roboto',
                'font-amiri': 'Amiri',
                'font-ibm': 'IBM Plex Sans Arabic',
            };
            const fontKey = styleOptionsParsed?.fontFamily || 'font-sans';
            await ensureFont(FONT_MAP[fontKey] || fontKey);

            const inputProps = {
                videoUrl: localVideoUrl,
                captions: captionsParams,
                styleOptions: styleOptionsParsed,
                videoWidth: vW,
                videoHeight: vH,
                durationInFrames: durationInFrames,
                expressPort: Number(EXPRESS_PORT)
            };

            const chromiumArgs = [
                "--no-sandbox", 
                "--disable-setuid-sandbox", 
                "--disable-dev-shm-usage",
                "--disable-web-security",
                "--hide-scrollbars",
                "--mute-audio"
            ];

            const chromiumOptions: any = { args: chromiumArgs };

            const composition = await selectComposition({
                serveUrl: bundleLocation,
                id: 'Captions',
                inputProps,
                chromiumOptions,
                timeoutInMilliseconds: 60000
            });

            const cpuCount = os.cpus().length;
            // On a VPS we prefer stability. No chunking by default if < 4 cores.
            const useChunking = cpuCount >= 4 && durationInFrames > 600;
            const numChunks = useChunking ? 2 : 1; 
            const optimalConcurrency = Math.max(1, Math.floor(cpuCount / numChunks));

            console.log(`[Export] Rendering. Chunks: ${numChunks}, Concurrency: ${optimalConcurrency}`);
            
            if (numChunks === 1) {
                await renderMedia({
                    composition,
                    serveUrl: bundleLocation,
                    codec: 'h264',
                    outputLocation: outputPath,
                    inputProps,
                    concurrency: optimalConcurrency,
                    chromiumOptions
                });
            } else {
                // Chunked multi-core render
                const chunkPaths: string[] = [];
                const renderPromises: Promise<any>[] = [];
                for (let i = 0; i < numChunks; i++) {
                    const startFrame = Math.floor((durationInFrames / numChunks) * i);
                    const endFrame = i === numChunks - 1 ? durationInFrames - 1 : Math.floor((durationInFrames / numChunks) * (i + 1)) - 1;
                    const chunkPath = outputPath.replace('.mp4', `_chunk_${i}.mp4`);
                    chunkPaths.push(chunkPath);
                    renderPromises.push(renderMedia({
                        composition,
                        serveUrl: bundleLocation,
                        codec: 'h264',
                        outputLocation: chunkPath,
                        inputProps,
                        frameRange: [startFrame, endFrame],
                        concurrency: optimalConcurrency,
                        chromiumOptions
                    }));
                }
                await Promise.all(renderPromises);
                
                // Concat
                const concatListPath = path.join(os.tmpdir(), `concat_${sessionId}.txt`);
                fs.writeFileSync(concatListPath, chunkPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
                await new Promise((resolve) => {
                    spawn(validFfmpegPath, ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', outputPath])
                    .on('close', resolve);
                });
                chunkPaths.forEach(p => fs.unlinkSync(p));
                fs.unlinkSync(concatListPath);
            }

            // Mux Audio
            const finalPath = outputPath.replace('.mp4', '_final.mp4');
            await new Promise((resolve) => {
                spawn(validFfmpegPath, ['-y', '-i', outputPath, '-i', videoSource, '-c:v', 'copy', '-map', '0:v:0', '-map', '1:a:0?', '-c:a', 'aac', '-shortest', finalPath])
                .on('close', resolve);
            });
            fs.renameSync(finalPath, outputPath);

        }

      const downloadUrl = `/api/download-export/${sessionId}`;
      exportJobs.set(sessionId, { status: 'completed', downloadUrl });

    } catch (err: any) {
      console.error(`[Export Error]`, err);
      exportJobs.set(sessionId, { status: 'failed', error: err.message });
    } finally {
      [uploadedFilePath, downloadedVideoPath].forEach(p => {
        try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch(e){}
      });
    }
  });

  processQueue();
});

app.get("/api/export-status/:jobId", (req: any, res: any) => {
   const job = exportJobs.get(req.params.jobId);
   if (job) return res.json(job);
   res.status(404).json({ error: "Not found" });
});

app.listen(Number(EXPRESS_PORT), "0.0.0.0", () => {
  console.log(`Server is running on port ${EXPRESS_PORT}`);
});
