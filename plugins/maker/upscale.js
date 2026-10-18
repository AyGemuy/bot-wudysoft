import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const UPSCALE_VERSIONS = [{
  version: "v38",
  url: `${global.bot?.api?.wudysoft}/api/tools/upscale/v38`,
  paramKey: "image",
  extractUrl: data => data?.result?.file_url || (typeof data?.result === "string" ? data.result : null)
}, {
  version: "v37",
  url: `${global.bot?.api?.wudysoft}/api/tools/upscale/v37`,
  paramKey: "image",
  extractUrl: data => data?.result || data?.images?.[0]?.url
}, {
  version: "v35",
  url: `${global.bot?.api?.wudysoft}/api/tools/upscale/v35`,
  paramKey: "imageUrl",
  extractUrl: data => data?.result || data?.info?.raw_response?.res?.image?.url
}, {
  version: "v33",
  url: `${global.bot?.api?.wudysoft}/api/tools/upscale/v33`,
  paramKey: "imageUrl",
  extractUrl: data => typeof data?.result === "string" ? data.result : null
}];
async function processUpscale(imageUrl, targetVersion = null) {
  let versionsToTry = [...UPSCALE_VERSIONS];
  if (targetVersion) {
    const cleanVer = targetVersion.toString().toLowerCase().replace(/^v/, "");
    const selected = UPSCALE_VERSIONS.find(v => v.version === `v${cleanVer}`);
    if (selected) {
      versionsToTry = [selected, ...UPSCALE_VERSIONS.filter(v => v.version !== `v${cleanVer}`)];
    }
  }
  let lastError = null;
  for (const cfg of versionsToTry) {
    try {
      const res = await axios.get(cfg.url, {
        params: {
          [cfg.paramKey]: imageUrl
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 45e3
      });
      const extracted = cfg.extractUrl(res.data);
      if (extracted && typeof extracted === "string" && /^https?:\/\//i.test(extracted)) {
        return {
          url: extracted,
          version: cfg.version
        };
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(lastError?.response?.data?.message || lastError?.message || "Semua server upscale gagal memproses gambar.");
}
export default {
  name: "upscale",
  aliases: ["hd", "enhance", "remini", "jernih"],
  description: "Tingkatkan kualitas & resolusi foto menjadi Ultra HD via AI (Khusus Gambar & Dokumen Foto).",
  category: "Tools",
  limit: true,
  example: "reply gambar dengan .upscale atau .upscale --v 38",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const fullText = (ctx.query || ctx.args?.join(" ") || "").trim();
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const mediaType = ctx.mediaType || ctx.quoted?.mediaType || "";
      const mimetype = (ctx.mimetype || ctx.quoted?.mimetype || "").toLowerCase();
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const isImage = mediaType === "image" || mediaType === "sticker" || mimetype.startsWith("image/");
      if (isMedia && !isImage) {
        return ctx.reply("❌ Fitur ini hanya menerima file *Gambar/Foto* atau *Dokumen Gambar* (JPG, PNG, WEBP).");
      }
      if (!fullText && !isImage && !ctx.mentionedJid?.length) {
        return ctx.reply(`–  *U P S C A L E  H D*

Silakan kirim atau balas gambar yang ingin ditingkatkan resolusinya.

┌  ◦  *Pilihan Engine* : \`--v 38\`, \`--v 37\`, \`--v 35\`, \`--v 33\`
│  ◦  *Cara Pakai* : Reply/kirim foto dengan \`${prefix}upscale\`
└  ◦  *Pilih Versi* : Reply foto dengan \`${prefix}upscale --v 38\``);
      }
      let targetVersion = null;
      const versionMatch = fullText.match(/--(?:v|version)\s+(\d+)/i);
      if (versionMatch && versionMatch[1]) {
        targetVersion = versionMatch[1];
      }
      ctx.react?.("⏳");
      let primaryImage = null;
      if (isImage) {
        const buffer = await ctx.download?.().catch(() => null);
        if (!buffer || !Buffer.isBuffer(buffer)) {
          ctx.react?.("❌");
          return ctx.reply("❌ Gagal mengunduh file gambar dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          ctx.react?.("❌");
          return ctx.reply(`❌ Gagal upload media: ${uploadRes?.message || "Upload error"}`);
        }
        primaryImage = uploadRes.url;
      } else {
        const target = ctx.mentionedJid?.[0] || ctx.quoted?.sender || ctx.sender;
        try {
          if (typeof sock.profilePictureUrl === "function") {
            primaryImage = await sock.profilePictureUrl(target, "image");
          }
        } catch {
          primaryImage = global.bot?.media?.avatar || null;
        }
      }
      if (!primaryImage) {
        ctx.react?.("❌");
        return ctx.reply("❌ Gambar tidak ditemukan. Silakan kirim atau balas file gambar/dokumen foto!");
      }
      const result = await processUpscale(primaryImage, targetVersion);
      const captionText = `–  *U P S C A L E  H D*

┌  ◦  *Engine* : \`${result.version.toUpperCase()}\`
└  ◦  *Kualitas* : Enhanced / Ultra HD`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: result.url
        },
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      ctx.react?.("✅");
    } catch (error) {
      console.error("[Upscale Error]:", error);
      ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Upscale Error: ${errMsg}`);
    }
  }
};