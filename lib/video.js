import fs from "fs";
import path from "path";
import {
  exec
} from "child_process";
import {
  promisify
} from "util";
const execAsync = promisify(exec);
const TMP_DIR = path.resolve("./tmp/video");
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
export const HD_VIDEO_OPTIONS = ["-map", "0:v:0", "-map", "0:a?", "-vf", "hqdn3d=1.5:1.5:4:4,unsharp=5:5:0.8:5:5:0.0,eq=brightness=0.03:contrast=1.12:saturation=1.2,scale='min(1920,trunc(iw*1.2/2)*2)':-2:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"];
export async function enhanceHDVideo(buffer, customOptions = HD_VIDEO_OPTIONS) {
  let inputPath = null;
  let outputPath = null;
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer video tidak valid atau kosong");
    }
    await ensureTmpDir();
    const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    inputPath = path.join(TMP_DIR, `${time}_in.mp4`);
    outputPath = path.join(TMP_DIR, `${time}_hd_out.mp4`);
    await fs.promises.writeFile(inputPath, buffer);
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" ${customOptions.join(" ")} "${outputPath}"`;
    await execAsync(ffmpegCmd, {
      maxBuffer: 1024 * 1024 * 100
    });
    if (fs.existsSync(outputPath)) {
      const outputBuffer = await fs.promises.readFile(outputPath);
      if (outputBuffer.length > 0) return outputBuffer;
    }
    throw new Error("FFmpeg tidak menghasilkan file video HD");
  } catch (error) {
    console.error("[enhanceHDVideo Error]:", error?.message || error);
    throw error;
  } finally {
    await Promise.allSettled([inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : Promise.resolve(), outputPath ? fs.promises.unlink(outputPath).catch(() => {}) : Promise.resolve()]);
  }
}
export async function compressVideo(buffer, targetCrf = 28) {
  let inputPath = null;
  let outputPath = null;
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer video tidak valid atau kosong");
    }
    await ensureTmpDir();
    const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    inputPath = path.join(TMP_DIR, `${time}_in.mp4`);
    outputPath = path.join(TMP_DIR, `${time}_comp_out.mp4`);
    await fs.promises.writeFile(inputPath, buffer);
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -map 0:v:0 -map 0:a? -c:v libx264 -crf ${targetCrf} -preset faster -pix_fmt yuv420p -vf "scale='min(720,trunc(iw/2)*2)':-2:flags=bicubic,format=yuv420p" -c:a aac -b:a 96k -movflags +faststart "${outputPath}"`;
    await execAsync(ffmpegCmd, {
      maxBuffer: 1024 * 1024 * 100
    });
    if (fs.existsSync(outputPath)) {
      const outputBuffer = await fs.promises.readFile(outputPath);
      if (outputBuffer.length > 0) return outputBuffer;
    }
    throw new Error("FFmpeg tidak menghasilkan file kompresi video");
  } catch (error) {
    console.error("[compressVideo Error]:", error?.message || error);
    throw error;
  } finally {
    await Promise.allSettled([inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : Promise.resolve(), outputPath ? fs.promises.unlink(outputPath).catch(() => {}) : Promise.resolve()]);
  }
}