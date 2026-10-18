import fs from "fs";
import path from "path";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function extractYtId(input = "") {
  const match = input.match(/(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([\w-]{6,})/);
  return match ? `https://www.youtube.com/watch?v=${match[2]}` : input;
}
async function pollYtFile(apiUrl) {
  const base = "https://youtubedl.siputzx.my.id";
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 2e3));
    try {
      const r = await fetch(apiUrl);
      const data = await r.json();
      const fp = data.fileUrl || data.file_url;
      if (!fp?.trim()) continue;
      const full = fp.startsWith("http") ? fp : `${base}${fp}`;
      const check = await fetch(full, {
        method: "HEAD"
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
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
export default {
  name: "ytmp4",
  aliases: ["ytm4", "ytvideo"],
  description: "Download video dari YouTube (MP4)",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    if (!ctx.args.length) {
      return ctx.reply(`–  *Y T M P 4*

Silakan masukkan tautan video YouTube yang valid.

┌  ◦  *Format* : ${prefix}ytmp4 <link>
└  ◦  *Example* : ${prefix}ytmp4 https://youtu.be/xxx`);
    }
    const ytUrl = extractYtId(ctx.args[0]);
    if (!ytUrl.includes("youtube.com/")) {
      return ctx.reply("❌ Tautan YouTube tidak valid. Pastikan link diawali dengan youtube.com atau youtu.be");
    }
    let statusMsg = null;
    let mp4Path = null;
    const upd = async text => {
      if (!statusMsg) {
        statusMsg = await ctx.reply(text);
      } else {
        await sock.sendMessage(ctx.id, {
          text: text,
          edit: statusMsg.key
        });
      }
    };
    try {
      await upd("⏳ Sedang memproses video YouTube, mohon tunggu...");
      const result = await pollYtFile(`https://youtubedl.siputzx.my.id/download?type=merge&url=${encodeURIComponent(ytUrl)}`);
      await upd("⬇️ Mengunduh dan menyiapkan berkas video...");
      const mp4Buf = await dlBuffer(result.fileUrl);
      const tmpDir = "./tmp/video";
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, {
        recursive: true
      });
      const time = Date.now();
      mp4Path = path.join(tmpDir, `video_${time}.mp4`);
      fs.writeFileSync(mp4Path, mp4Buf);
      const caption = `–  *Y O U T U B E*

┌  ◦  *Title* : ${result.title || "YouTube Video"}
└  ◦  *Link* : ${ytUrl}`;
      await sock.sendMessage(ctx.id, {
        video: mp4Buf,
        mimetype: "video/mp4",
        caption: caption
      }, {
        quoted: simpleQuoted(ctx)
      });
      await upd("✅ Video berhasil dikirimkan!");
    } catch (e) {
      await upd(`❌ Gagal: ${e.message}`);
    } finally {
      if (mp4Path && fs.existsSync(mp4Path)) {
        try {
          fs.unlinkSync(mp4Path);
        } catch (_) {}
      }
    }
  }
};