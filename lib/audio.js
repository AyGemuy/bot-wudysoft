import fs from "fs";
import path from "path";
import {
  exec
} from "child_process";
import {
  promisify
} from "util";
import axios from "axios";
const execAsync = promisify(exec);
const TMP_DIR = path.resolve("./tmp/audio");
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
export const EIGHT_D_OPTIONS = ["-af", "apulsator=hz=0.125:mode=sine:width=1,extrastereo=m=1.2", "-vn", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "192k"];
export async function fetchAudioBuffer(url) {
  try {
    const {
      data
    } = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 6e4,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    if (!data || data.byteLength === 0) {
      throw new Error("Buffer audio kosong dari URL");
    }
    return Buffer.from(data);
  } catch (err) {
    console.error("[fetchAudioBuffer Error]:", err?.message || err);
    throw new Error(`Gagal mengunduh audio dari URL: ${err?.message || err}`);
  }
}
export async function toPTT(buffer) {
  let inputPath = null;
  let outputPath = null;
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer audio tidak valid atau kosong");
    }
    await ensureTmpDir();
    const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    inputPath = path.join(TMP_DIR, `${time}_ptt_in.raw`);
    outputPath = path.join(TMP_DIR, `${time}_ptt_out.ogg`);
    await fs.promises.writeFile(inputPath, buffer);
    await execAsync(`ffmpeg -y -i "${inputPath}" -vn -c:a libopus -b:a 48k -vbr on -compression_level 10 -ar 48000 -ac 1 -avoid_negative_ts make_zero -f ogg "${outputPath}"`, {
      maxBuffer: 1024 * 1024 * 50
    });
    if (fs.existsSync(outputPath)) {
      const result = await fs.promises.readFile(outputPath);
      if (result.length > 0) return result;
    }
    throw new Error("FFmpeg tidak menghasilkan file PTT OGG");
  } catch (err) {
    console.error("[toPTT Error]:", err?.message || err);
    throw err;
  } finally {
    await Promise.allSettled([inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : Promise.resolve(), outputPath ? fs.promises.unlink(outputPath).catch(() => {}) : Promise.resolve()]);
  }
}
export async function toMP3(buffer) {
  let inputPath = null;
  let outputPath = null;
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer audio tidak valid atau kosong");
    }
    await ensureTmpDir();
    const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    inputPath = path.join(TMP_DIR, `${time}_mp3_in.raw`);
    outputPath = path.join(TMP_DIR, `${time}_mp3_out.mp3`);
    await fs.promises.writeFile(inputPath, buffer);
    await execAsync(`ffmpeg -y -i "${inputPath}" -vn -map 0:a:0? -c:a libmp3lame -q:a 2 -ar 44100 -ac 2 "${outputPath}"`, {
      maxBuffer: 1024 * 1024 * 50
    });
    if (fs.existsSync(outputPath)) {
      const result = await fs.promises.readFile(outputPath);
      if (result.length > 0) return result;
    }
    throw new Error("FFmpeg tidak menghasilkan output MP3");
  } catch (err) {
    console.error("[toMP3 Error]:", err?.message || err);
    throw err;
  } finally {
    await Promise.allSettled([inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : Promise.resolve(), outputPath ? fs.promises.unlink(outputPath).catch(() => {}) : Promise.resolve()]);
  }
}
export async function to8DAudio(buffer, customOptions = EIGHT_D_OPTIONS) {
  let inputPath = null;
  let outputPath = null;
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer audio tidak valid atau kosong");
    }
    await ensureTmpDir();
    const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    inputPath = path.join(TMP_DIR, `${time}_8d_in.raw`);
    outputPath = path.join(TMP_DIR, `${time}_8d_out.mp3`);
    await fs.promises.writeFile(inputPath, buffer);
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" ${customOptions.join(" ")} "${outputPath}"`;
    await execAsync(ffmpegCmd, {
      maxBuffer: 1024 * 1024 * 50
    });
    if (fs.existsSync(outputPath)) {
      const result = await fs.promises.readFile(outputPath);
      if (result.length > 0) return result;
    }
    throw new Error("FFmpeg tidak menghasilkan output 8D Audio");
  } catch (err) {
    console.error("[to8DAudio Error]:", err?.message || err);
    throw err;
  } finally {
    await Promise.allSettled([inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : Promise.resolve(), outputPath ? fs.promises.unlink(outputPath).catch(() => {}) : Promise.resolve()]);
  }
}
export async function applyAudioFilter(buffer, filterType = "bassboost") {
  let inputPath = null;
  let outputPath = null;
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer audio tidak valid atau kosong");
    }
    await ensureTmpDir();
    const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    inputPath = path.join(TMP_DIR, `${time}_af_in.raw`);
    outputPath = path.join(TMP_DIR, `${time}_af_out.mp3`);
    let filter = "equalizer=f=60:width_type=h:width=50:g=10";
    if (filterType === "nightcore") {
      filter = "asetrate=44100*1.25,aresample=44100,atempo=1.05";
    } else if (filterType === "slowed") {
      filter = "asetrate=44100*0.85,aresample=44100,aecho=0.8:0.88:60:0.4";
    } else if (filterType === "reverse") {
      filter = "areverse";
    } else if (filterType === "robot") {
      filter = "flanger=delay=10:depth=10:regen=50:width=100:speed=0.5";
    }
    await fs.promises.writeFile(inputPath, buffer);
    await execAsync(`ffmpeg -y -i "${inputPath}" -vn -map 0:a:0? -af "${filter}" -c:a libmp3lame -b:a 192k "${outputPath}"`, {
      maxBuffer: 1024 * 1024 * 50
    });
    if (fs.existsSync(outputPath)) {
      const result = await fs.promises.readFile(outputPath);
      if (result.length > 0) return result;
    }
    throw new Error(`FFmpeg gagal menerapkan filter audio: ${filterType}`);
  } catch (err) {
    console.error("[applyAudioFilter Error]:", err?.message || err);
    throw err;
  } finally {
    await Promise.allSettled([inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : Promise.resolve(), outputPath ? fs.promises.unlink(outputPath).catch(() => {}) : Promise.resolve()]);
  }
}
export async function sendPTT(sock, targetJid, audioBufferOrUrl, quotedMsg = null) {
  try {
    let rawBuffer;
    if (Buffer.isBuffer(audioBufferOrUrl)) {
      rawBuffer = audioBufferOrUrl;
    } else if (typeof audioBufferOrUrl === "string") {
      rawBuffer = await fetchAudioBuffer(audioBufferOrUrl);
    } else {
      throw new Error("Parameter audioBufferOrUrl harus berupa Buffer atau String URL valid");
    }
    try {
      const pttBuffer = await toPTT(rawBuffer);
      return await sock.sendMessage(targetJid, {
        audio: pttBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      }, {
        quoted: quotedMsg
      });
    } catch (conversionErr) {
      console.warn("[sendPTT Gagal toPTT, fallback ke rawBuffer]:", conversionErr?.message || conversionErr);
      return await sock.sendMessage(targetJid, {
        audio: rawBuffer,
        mimetype: "audio/mp4",
        ptt: true
      }, {
        quoted: quotedMsg
      });
    }
  } catch (err) {
    console.error("[sendPTT Fatal Error]:", err?.message || err);
    throw err;
  }
}