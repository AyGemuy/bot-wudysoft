import fs from "fs";
import path from "path";
import {
  exec
} from "child_process";
import {
  promisify
} from "util";
import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const execAsync = promisify(exec);

function extractYtId(input) {
  const match = String(input || "").match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : input;
}
async function pollYtFile(apiUrl) {
  const base = "https://youtubedl.siputzx.my.id";
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 2e3));
    try {
      const {
        data
      } = await axios.get(apiUrl, {
        timeout: 15e3,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });
      const fp = data.fileUrl || data.file_url;
      if (!fp?.trim()) continue;
      const full = fp.startsWith("http") ? fp : `${base}${fp}`;
      const check = await axios.head(full, {
        timeout: 1e4,
        validateStatus: s => s === 200
      });
      if (check.status === 200) {
        return {
          ...data,
          fileUrl: full
        };
      }
    } catch {}
  }
  throw new Error("Waktu proses unduhan habis (Timeout)");
}
async function dlBuffer(url) {
  const {
    data
  } = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 6e4,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });
  return Buffer.from(data);
}
export default {
  name: "ytmp3",
  aliases: ["ytm3", "ytaudio"],
  description: "Download audio dari YouTube (MP3 / Voice Note)",
  category: "Downloader",
  limit: true,
  example: "ytmp3 <url> atau ytmp3 voice <url>",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    if (!ctx.args || !ctx.args.length) {
      return ctx.reply(`–  *Y T M P 3*

Silakan masukkan tautan audio YouTube yang valid.

┌  ◦  *Format* : ${prefix}ytmp3 <link> [voice]
│  ◦  *Audio MP3* : ${prefix}ytmp3 https://youtu.be/xxx
└  ◦  *Voice Note* : ${prefix}ytmp3 voice https://youtu.be/xxx`);
    }
    const isVoice = ctx.args[0]?.toLowerCase() === "voice";
    const rawUrl = ctx.args[isVoice ? 1 : 0] || "";
    const ytUrl = extractYtId(rawUrl);
    if (!ytUrl || !ytUrl.startsWith("http")) {
      return ctx.reply("❌ Tautan YouTube tidak valid. Pastikan link diawali dengan youtube.com atau youtu.be");
    }
    let statusMsg = null;
    const upd = async text => {
      try {
        if (!statusMsg) {
          statusMsg = await ctx.reply(text);
        } else {
          await sock.sendMessage(ctx.id, {
            text: text,
            edit: statusMsg.key
          });
        }
      } catch {
        statusMsg = await ctx.reply(text);
      }
    };
    const quotedObj = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      await upd("⏳ Sedang memproses audio YouTube, mohon tunggu...");
      const apiUrl = `https://youtubedl.siputzx.my.id/download?type=audio&url=${encodeURIComponent(ytUrl)}`;
      const result = await pollYtFile(apiUrl);
      await upd("⬇️ Mengunduh dan menyiapkan berkas audio...");
      const mp3Buf = await dlBuffer(result.fileUrl);
      const time = Date.now();
      const tmpDir = path.resolve("./tmp/audio");
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, {
          recursive: true
        });
      }
      const mp3Path = path.join(tmpDir, `${time}.mp3`);
      fs.writeFileSync(mp3Path, mp3Buf);
      if (isVoice) {
        await upd("🔄 Mengonversi audio ke format Voice Note...");
        const oggPath = path.join(tmpDir, `${time}.ogg`);
        await execAsync(`ffmpeg -i "${mp3Path}" -avoid_negative_ts make_zero -ac 1 -c:a libopus "${oggPath}"`);
        await sock.sendMessage(ctx.id, {
          audio: fs.readFileSync(oggPath),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        }, {
          quoted: quotedObj
        });
        if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
      } else {
        const caption = `–  *Y O U T U B E*

┌  ◦  *Title* : ${result.title || "YouTube Audio"}
└  ◦  *Link* : ${ytUrl}`;
        await sock.sendMessage(ctx.id, {
          document: mp3Buf,
          mimetype: "audio/mpeg",
          fileName: `${(result.title || "YouTube_Audio").replace(/[\\/:*?"<>|]/g, "")}.mp3`,
          caption: caption
        }, {
          quoted: quotedObj
        });
      }
      await upd("✅ Audio berhasil dikirimkan!");
      if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
    } catch (e) {
      await upd(`❌ Gagal: ${e.message}`);
    }
  }
};