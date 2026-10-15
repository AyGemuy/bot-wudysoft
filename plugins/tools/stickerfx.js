import {
  writeExif
} from "../../lib/exif.js";
import {
  downloadMediaNode
} from "../../core/serialize.js";
global.stickerFxSessions = global.stickerFxSessions || new Map();
const STICKER_EFFECTS = {
  circle: {
    title: "Circle Crop",
    desc: "Potong foto/video menjadi stiker lingkaran rapi",
    opts: {
      circle: true
    }
  },
  nobg: {
    title: "Remove Background",
    desc: "Hapus latar belakang foto secara otomatis",
    opts: {
      nobg: true
    }
  },
  pixel: {
    title: "8-Bit Pixelate",
    desc: "Ubah stiker menjadi gaya pixel art game retro",
    opts: {
      pixel: 10
    }
  },
  blur: {
    title: "Soft Blur Effect",
    desc: "Berikan efek buram artistik pada stiker",
    opts: {
      blur: 8
    }
  },
  sepia: {
    title: "Vintage Sepia",
    desc: "Nuansa foto jadul hangat kecokelatan klasik",
    opts: {
      sepia: true
    }
  },
  invert: {
    title: "Invert Colors",
    desc: "Membalik warna stiker seperti klise negatif film",
    opts: {
      invert: true
    }
  },
  fast: {
    title: "Fast Motion 2x",
    desc: "Percepat animasi stiker video 2 kali lipat",
    opts: {
      speed: 2
    }
  },
  reverse: {
    title: "Reverse Motion",
    desc: "Putar balik animasi stiker dari akhir ke awal",
    opts: {
      reverse: true
    }
  }
};

function resolveEffectKey(input = "") {
  if (!input || typeof input !== "string") return null;
  const clean = input.toLowerCase().trim();
  if (!clean || clean.length === 0) return null;
  if (STICKER_EFFECTS[clean]) return clean;
  for (const [key, val] of Object.entries(STICKER_EFFECTS)) {
    if (val.title.toLowerCase().includes(clean) || clean.includes(key)) {
      return key;
    }
  }
  if (clean.includes("pixel") || clean.includes("8-bit") || clean.includes("retro")) return "pixel";
  if (clean.includes("circle") || clean.includes("bulat")) return "circle";
  if (clean.includes("nobg") || clean.includes("remove") || clean.includes("hapus")) return "nobg";
  if (clean.includes("blur") || clean.includes("buram")) return "blur";
  if (clean.includes("sepia") || clean.includes("vintage") || clean.includes("klasik")) return "sepia";
  if (clean.includes("invert") || clean.includes("negative") || clean.includes("klise")) return "invert";
  if (clean.includes("fast") || clean.includes("cepat") || clean.includes("2x")) return "fast";
  if (clean.includes("reverse") || clean.includes("balik") || clean.includes("putar")) return "reverse";
  return null;
}
export default {
  name: "stickerfx",
  aliases: ["stikerefek", "editstiker"],
  description: "Pembuat Stiker dengan Filter Eksklusif via lib/exif Engine",
  category: "Tools",
  execute: async (sock, ctx, msg, {
    args,
    prefix,
    query
  }) => {
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const sessionKey = `${ctx.chat}_${ctx.senderNumber || ctx.sender}`;
    const rawEffectInput = (args[0] || query || "").trim();
    let effectKey = resolveEffectKey(rawEffectInput);
    let mediaTarget = null;
    let mime = "";
    const candidateNodes = [ctx.quoted?.msg || ctx.quoted, ctx.quoted?.quoted?.msg || ctx.quoted?.quoted, ctx.msg || ctx].filter(Boolean);
    for (const node of candidateNodes) {
      const candidateMime = node.mimetype || node.msg && node.msg.mimetype || "";
      if (/image|video|webp/.test(candidateMime)) {
        mediaTarget = node;
        mime = candidateMime;
        break;
      }
    }
    const cachedSession = global.stickerFxSessions.get(sessionKey);
    const hasValidSession = cachedSession && Date.now() - cachedSession.time < 5 * 60 * 1e3;
    if (!mediaTarget && !hasValidSession) {
      const helpText = `– *S T I C K E R  F X*\n\n` + `┌ ◦ *Usage* : ${prefix}stickerfx <filter>\n` + `│ ◦ *Quoted* : Balas foto/video/stiker dengan ${prefix}stickerfx\n` + `└ ◦ *Function* : Memberikan efek visual khusus pada stiker WhatsApp\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Menu* : Balas media dengan ${prefix}stickerfx\n` + `└ ◦ *Direct* : ${prefix}stickerfx pixel (sambil balas media)\n\n` + `${footer}`;
      return await ctx.reply(helpText);
    }
    if (!effectKey || !STICKER_EFFECTS[effectKey]) {
      await ctx.react("📥");
      const downloadedBuffer = await downloadMediaNode(mediaTarget);
      if (!downloadedBuffer) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh media\n` + `└ ◦ *Info* : File media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
      }
      global.stickerFxSessions.set(sessionKey, {
        buffer: downloadedBuffer,
        mime: mime,
        time: Date.now()
      });
      await ctx.react("✨");
      const rows = Object.entries(STICKER_EFFECTS).map(([key, val]) => ({
        title: val.title,
        description: val.desc,
        id: `${prefix}stickerfx ${key}`
      }));
      const bodyText = `– *S T I C K E R  F X  -  S T U D I O*\n\n` + `┌ ◦ *Status* : Media Berhasil Diunduh\n` + `│ ◦ *Format* : ${mime}\n` + `└ ◦ *Action* : Pilih efek visual stiker pada tombol di bawah\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH FILTER STIKER",
          sections: [{
            title: "PRESET EFEK VISUAL",
            rows: rows
          }],
          has_multiple_buttons: true
        })
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${botName} • EXIF Studio`, buttons, {
          quoted: msg
        });
      }
      return await ctx.reply(bodyText);
    }
    await ctx.react("⏳");
    const selected = STICKER_EFFECTS[effectKey];
    const finalBuffer = hasValidSession ? cachedSession.buffer : await downloadMediaNode(mediaTarget);
    const finalMime = hasValidSession ? cachedSession.mime : mime;
    if (!finalBuffer) {
      await ctx.react("❌");
      return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Buffer media kedaluwarsa\n` + `└ ◦ *Action* : Silakan balas ulang media dengan perintah.\n\n` + `${footer}`);
    }
    try {
      const metadata = {
        packname: global.bot?.packname || "Paimon Bot",
        author: global.bot?.author || botName
      };
      const stickerBuffer = await writeExif({
        data: finalBuffer,
        mimetype: finalMime
      }, metadata, selected.opts);
      await ctx.react("✅");
      await sock.sendMessage(ctx.id, {
        sticker: stickerBuffer
      }, {
        quoted: msg
      });
      global.stickerFxSessions.delete(sessionKey);
    } catch (err) {
      console.error("[STICKER FX ERROR]:", err);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Gagal memproses efek stiker pada media ini.\n` + `└ ◦ *Command* : ${ctx.command || "stickerfx"}\n\n` + `${footer}`);
    }
  }
};