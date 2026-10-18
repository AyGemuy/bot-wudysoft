import fs from "fs";
import path from "path";
import axios from "axios";
import {
  exec
} from "child_process";
import {
  promisify
} from "util";
import {
  upload
} from "./upload.js";
import {
  convert
} from "./exif.js";
const execAsync = promisify(exec);
const TMP_DIR = path.resolve("./tmp/media");
async function ensureTmpDir() {
  try {
    if (!fs.existsSync(TMP_DIR)) {
      await fs.promises.mkdir(TMP_DIR, {
        recursive: true
      });
    }
  } catch (err) {
    console.error("[ensureTmpDir Error]:", err?.message || err);
    throw new Error(`Gagal membuat direktori temporary: ${err?.message || err}`);
  }
}
export function isAnimatedWebp(buffer) {
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length < 30) return false;
    return buffer.includes(Buffer.from("ANIM")) || buffer.includes(Buffer.from("ANMF"));
  } catch (err) {
    console.error("[isAnimatedWebp Error]:", err?.message || err);
    return false;
  }
}

function cleanWebpBuffer(buffer) {
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length < 16) return buffer;
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
      return buffer;
    }
    let offset = 12;
    const validChunks = [];
    while (offset < buffer.length - 8) {
      const chunkTag = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const totalChunkLength = 8 + chunkSize + chunkSize % 2;
      if (offset + totalChunkLength > buffer.length) break;
      if (chunkTag === "VP8X") {
        const vp8xChunk = Buffer.from(buffer.subarray(offset, offset + totalChunkLength));
        if (vp8xChunk.length > 20) {
          vp8xChunk[20] &= ~12;
        }
        validChunks.push(vp8xChunk);
      } else if (chunkTag !== "EXIF" && chunkTag !== "XMP ") {
        validChunks.push(buffer.subarray(offset, offset + totalChunkLength));
      }
      offset += totalChunkLength;
    }
    const chunksBody = Buffer.concat(validChunks);
    const riffHeader = Buffer.from("RIFF");
    const riffSize = Buffer.alloc(4);
    riffSize.writeUInt32LE(chunksBody.length + 4, 0);
    const webpHeader = Buffer.from("WEBP");
    return Buffer.concat([riffHeader, riffSize, webpHeader, chunksBody]);
  } catch (e) {
    return buffer;
  }
}
export async function webpToPNG(buffer) {
  let inputPath = null;
  let outputPath = null;
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer WebP tidak valid atau kosong");
    }
    await ensureTmpDir();
    const cleanBuffer = cleanWebpBuffer(buffer);
    const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    inputPath = path.join(TMP_DIR, `${time}_in.webp`);
    outputPath = path.join(TMP_DIR, `${time}_out.png`);
    await fs.promises.writeFile(inputPath, cleanBuffer);
    try {
      await execAsync(`ffmpeg -y -i "${inputPath}" -vframes 1 -c:v png "${outputPath}"`);
      if (fs.existsSync(outputPath)) {
        const resultBuf = await fs.promises.readFile(outputPath);
        if (resultBuf.length > 0) return resultBuf;
      }
      throw new Error("FFmpeg tidak menghasilkan output PNG");
    } catch (ffmpegErr) {
      console.warn("[FFmpeg webpToPNG Gagal, beralih ke Fallback API]:", ffmpegErr?.message || ffmpegErr);
      try {
        const uploadRes = await upload(buffer);
        const uploadedUrl = uploadRes?.url || uploadRes?.result || uploadRes?.data?.url || (typeof uploadRes === "string" ? uploadRes : null);
        if (uploadedUrl) {
          const convertRes = await convert({
            url: uploadedUrl,
            from: "webp",
            to: "png"
          });
          const resultUrl = convertRes?.result || convertRes?.url;
          if (resultUrl) {
            const dlRes = await axios.get(resultUrl, {
              responseType: "arraybuffer",
              timeout: 3e4
            });
            if (dlRes?.data && dlRes.data.length > 0) {
              return Buffer.from(dlRes.data);
            }
          }
        }
        throw new Error("Fallback API gagal menghasilkan file PNG");
      } catch (fallbackErr) {
        throw new Error(`Gagal konversi PNG (FFmpeg & API gagal): ${fallbackErr?.message || fallbackErr}`);
      }
    }
  } catch (err) {
    console.error("[webpToPNG Fatal Error]:", err?.message || err);
    throw err;
  } finally {
    await Promise.all([inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : Promise.resolve(), outputPath ? fs.promises.unlink(outputPath).catch(() => {}) : Promise.resolve()]);
  }
}
export async function webpToMP4(buffer) {
  let inputPath = null;
  let outputPath = null;
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer WebP tidak valid atau kosong");
    }
    await ensureTmpDir();
    const cleanBuffer = cleanWebpBuffer(buffer);
    const isAnim = isAnimatedWebp(cleanBuffer);
    const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    inputPath = path.join(TMP_DIR, `${time}_anim.webp`);
    outputPath = path.join(TMP_DIR, `${time}_anim.mp4`);
    await fs.promises.writeFile(inputPath, cleanBuffer);
    try {
      if (isAnim) {
        try {
          await execAsync(`ffmpeg -y -c:v libwebp_anim -i "${inputPath}" -vf "fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p" -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an -movflags +faststart "${outputPath}"`, {
            maxBuffer: 1024 * 1024 * 50
          });
        } catch {
          await execAsync(`ffmpeg -y -i "${inputPath}" -vf "fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p" -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an -movflags +faststart "${outputPath}"`, {
            maxBuffer: 1024 * 1024 * 50
          });
        }
      } else {
        await execAsync(`ffmpeg -y -loop 1 -i "${inputPath}" -t 3 -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p" -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -an -movflags +faststart "${outputPath}"`, {
          maxBuffer: 1024 * 1024 * 50
        });
      }
      if (fs.existsSync(outputPath)) {
        const resultBuf = await fs.promises.readFile(outputPath);
        if (resultBuf.length > 0) return resultBuf;
      }
      throw new Error("FFmpeg menghasilkan output MP4 kosong");
    } catch (ffmpegErr) {
      console.warn("[FFmpeg webpToMP4 Gagal, beralih ke Fallback API]:", ffmpegErr?.message || ffmpegErr);
      try {
        const uploadRes = await upload(buffer);
        const uploadedUrl = uploadRes?.url || uploadRes?.result || uploadRes?.data?.url || (typeof uploadRes === "string" ? uploadRes : null);
        if (uploadedUrl) {
          const convertRes = await convert({
            url: uploadedUrl,
            from: "webp",
            to: "mp4"
          });
          const videoUrl = convertRes?.result || convertRes?.url;
          if (videoUrl) {
            const dlRes = await axios.get(videoUrl, {
              responseType: "arraybuffer",
              timeout: 45e3
            });
            if (dlRes?.data && dlRes.data.length > 0) {
              return Buffer.from(dlRes.data);
            }
          }
        }
        throw new Error("Fallback API gagal menghasilkan file MP4");
      } catch (fallbackErr) {
        throw new Error(`Gagal konversi MP4 (FFmpeg & API gagal): ${fallbackErr?.message || fallbackErr}`);
      }
    }
  } catch (err) {
    console.error("[webpToMP4 Fatal Error]:", err?.message || err);
    throw err;
  } finally {
    await Promise.all([inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : Promise.resolve(), outputPath ? fs.promises.unlink(outputPath).catch(() => {}) : Promise.resolve()]);
  }
}
export async function webpToGIF(buffer) {
  let inputPath = null;
  let outputPath = null;
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer WebP tidak valid atau kosong");
    }
    await ensureTmpDir();
    const cleanBuffer = cleanWebpBuffer(buffer);
    const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    inputPath = path.join(TMP_DIR, `${time}_anim.webp`);
    outputPath = path.join(TMP_DIR, `${time}_anim.gif`);
    await fs.promises.writeFile(inputPath, cleanBuffer);
    try {
      try {
        await execAsync(`ffmpeg -y -c:v libwebp_anim -i "${inputPath}" -vf "fps=15,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse=alpha_threshold=128" -loop 0 "${outputPath}"`, {
          maxBuffer: 1024 * 1024 * 50
        });
      } catch {
        await execAsync(`ffmpeg -y -i "${inputPath}" -vf "fps=15,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse=alpha_threshold=128" -loop 0 "${outputPath}"`, {
          maxBuffer: 1024 * 1024 * 50
        });
      }
      if (fs.existsSync(outputPath)) {
        const resultBuf = await fs.promises.readFile(outputPath);
        if (resultBuf.length > 0) return resultBuf;
      }
      throw new Error("FFmpeg tidak menghasilkan file GIF");
    } catch (ffmpegErr) {
      console.warn("[FFmpeg webpToGIF Gagal, beralih ke Fallback API]:", ffmpegErr?.message || ffmpegErr);
      try {
        const uploadRes = await upload(buffer);
        const uploadedUrl = uploadRes?.url || uploadRes?.result || uploadRes?.data?.url || (typeof uploadRes === "string" ? uploadRes : null);
        if (uploadedUrl) {
          const convertRes = await convert({
            url: uploadedUrl,
            from: "webp",
            to: "gif"
          });
          const gifUrl = convertRes?.result || convertRes?.url;
          if (gifUrl) {
            const dlRes = await axios.get(gifUrl, {
              responseType: "arraybuffer",
              timeout: 45e3
            });
            if (dlRes?.data && dlRes.data.length > 0) {
              return Buffer.from(dlRes.data);
            }
          }
        }
        throw new Error("Fallback API gagal menghasilkan file GIF");
      } catch (fallbackErr) {
        throw new Error(`Gagal konversi GIF (FFmpeg & API gagal): ${fallbackErr?.message || fallbackErr}`);
      }
    }
  } catch (err) {
    console.error("[webpToGIF Fatal Error]:", err?.message || err);
    throw err;
  } finally {
    await Promise.all([inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : Promise.resolve(), outputPath ? fs.promises.unlink(outputPath).catch(() => {}) : Promise.resolve()]);
  }
}