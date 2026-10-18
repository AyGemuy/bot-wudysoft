import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_URL = `${global.bot?.api?.wudysoft}/api/ai/img2img/ghibli/v17`;
const VALID_TEMPLATES = ["photo-to-ghibli-anime", "photo-to-cubism", "photo-to-rick-and-morty", "photo-to-gta", "photo-to-sims", "photo-to-south-park-character", "photo-to-claymation"];
const DEFAULT_TEMPLATE = "photo-to-ghibli-anime";
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function formatTemplateTitle(str = "") {
  return str.replace(/^photo-to-/, "").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["image", "img", "imageurl"].includes(lowerKey)) key = "imageUrl";
    if (["temp", "template_id", "style", "t"].includes(lowerKey)) key = "template";
    if (["ratio", "ar", "aspectratio"].includes(lowerKey)) key = "aspectRatio";
    if (["list", "l", "styles", "menu"].includes(lowerKey)) key = "list";
    if (["help", "h"].includes(lowerKey)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}

function matchTemplate(query = "") {
  if (!query) return DEFAULT_TEMPLATE;
  const q = query.toLowerCase().trim();
  if (VALID_TEMPLATES.includes(q)) return q;
  const found = VALID_TEMPLATES.find(t => {
    const clean = t.replace("photo-to-", "").replace(/-/g, "");
    const search = q.replace(/[-_\s]/g, "");
    return t.includes(search) || clean.includes(search);
  });
  return found || DEFAULT_TEMPLATE;
}
export default {
  name: "photosstyle",
  aliases: ["photostyle", "ghibliv17", "photosstylelist"],
  description: "AI Image-to-Image Styles (PhotosStyle v17) via Interactive CTA UI.",
  category: "AI",
  limit: true,
  example: "• Pilih Style: photosstyle --template gta\n• Apply Foto: Reply gambar dengan caption photosstyle --template rick-and-morty",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["photosstyle", "photostyle", "ghibliv17", "photosstylelist"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • PhotosStyle AI`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const isListReq = flags.list || ["list", "templates", "template", "styles"].includes(cleanPrompt.toLowerCase()) || ctx.command?.toLowerCase() === "photosstylelist";
      if (isListReq) {
        await ctx.react("⏳");
        const sections = [{
          title: `${botName} • PhotosStyle Templates`,
          rows: VALID_TEMPLATES.map(t => ({
            title: `🎨 ${formatTemplateTitle(t)}`,
            description: `ID: ${t} • Ketuk untuk memilih`,
            id: `${prefix}photosstyle --template ${t}`
          }))
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🎨 PILIH STYLE (${VALID_TEMPLATES.length})`,
            sections: sections
          })
        }, {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📌 Salin Default Style ID",
            id: "copy_default_style",
            copy_code: DEFAULT_TEMPLATE
          })
        }];
        const bodyText = `–  *P H O T O S  S T Y L E*

Pilihan filter artistik kecerdasan buatan untuk mengubah gaya foto Anda.

┌  ◦  *Total Style* : ${VALID_TEMPLATES.length} Template
└  ◦  *Default Ratio* : \`2:3\`

Silakan tentukan style melalui menu pilihan tombol di bawah ini:`;
        const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • PhotosStyle`,
              button_title: "🎨 Buka Daftar Style"
            },
            limited_time_offer: {
              text: `✦ ${botName} - PhotosStyle AI ✦`,
              url: "",
              copy_code: "",
              expiration_time: Date.now() + 3600 * 1e3
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          let fallbackMsg = `🎨 *DAFTAR TEMPLATE PHOTOSSTYLE*\n\n`;
          fallbackMsg += VALID_TEMPLATES.map(t => `• *${formatTemplateTitle(t)}*\n  ID: \`${t}\``).join("\n\n");
          await ctx.reply(fallbackMsg);
        }
        await ctx.react("✅");
        return;
      }
      if (!rawText && !isMedia) {
        const guideText = `–  *P H O T O S  S T Y L E*

Layanan transformasi gaya visual foto menggunakan PhotosStyle v17 Engine.

┌  ◦  *Ubah Gaya Foto* :
│  └ Reply / kirim gambar: \`${prefix}photosstyle --template gta\`
│
├  ◦  *Kustomisasi Rasio* :
│  └ \`${prefix}photosstyle --template cubism --ratio 1:1\`
│
├  ◦  *Buka Menu Style (CTA UI)* :
│  └ \`${prefix}photosstyle --list\`
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--template <nama|id>\`
   ├ \`--ratio <2:3 | 1:1 | 16:9>\` (Default: \`2:3\`)
   ├ \`--imageUrl <url>\`
   └ \`--body <json_string>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      const selectedTemplate = matchTemplate(flags.template || cleanPrompt);
      const selectedTitle = formatTemplateTitle(selectedTemplate);
      if (!isMedia && !flags.imageUrl) {
        const infoBody = `–  *P H O T O S  S T Y L E*

Style berhasil dipilih dan siap diterapkan.

┌  ◦  *Nama Style* : ${selectedTitle}
│  ◦  *Style ID* : \`${selectedTemplate}\`
└  ◦  *Aspect Ratio* : \`${flags.aspectRatio || "2:3"}\`

Silakan kirim atau balas (reply) foto Anda dengan perintah:
\`${prefix}photosstyle --template ${selectedTemplate}\``;
        const infoButtons = [{
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: `📋 Salin Style ID (${selectedTitle.slice(0, 15)})`,
            id: "copy_selected_style_id",
            copy_code: selectedTemplate
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎨 Pilih Style Lain",
            id: `${prefix}photosstyle --list`
          })
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(infoBody, botFooter, infoButtons, {
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(infoBody);
        }
      }
      await ctx.react("⏳");
      let uploadedImageUrl = flags.imageUrl || null;
      if (isMedia && !uploadedImageUrl) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      if (!uploadedImageUrl) {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar tidak valid. Kirim/reply gambar atau sertakan URL gambar via flag `--imageUrl <url>`.");
      }
      let bodyOverride = {};
      if (flags.body) {
        try {
          bodyOverride = typeof flags.body === "string" ? JSON.parse(flags.body) : flags.body;
          delete flags.body;
        } catch (e) {
          console.error("[PHOTOSSTYLE] Invalid JSON in --body flag:", e.message);
        }
      }
      const payload = {
        template: selectedTemplate,
        imageUrl: uploadedImageUrl,
        aspectRatio: flags.aspectRatio || "2:3",
        category: flags.category || selectedTemplate,
        credit: String(flags.credit || "1"),
        ...flags,
        ...bodyOverride
      };
      const response = await axios.post(BASE_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resData = response.data;
      const resultUrl = resData?.imgUrl || resData?.result || resData?.data?.url;
      if (!resultUrl) {
        throw new Error(resData?.message || "Gagal mendapatkan URL hasil gambar dari PhotosStyle server.");
      }
      const imgRes = await axios.get(resultUrl, {
        responseType: "arraybuffer",
        timeout: 6e4
      });
      const imageBuffer = Buffer.from(imgRes.data);
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar hasil generasi kosong atau gagal diunduh.");
      }
      const resultCaption = `–  *P H O T O S  S T Y L E*

Transformasi visual foto berhasil diselesaikan.

┌  ◦  *Style* : ${selectedTitle}
│  ◦  *Style ID* : \`${selectedTemplate}\`
│  ◦  *Aspect Ratio* : \`${payload.aspectRatio}\`
└  ◦  *Task ID* : \`${resData?.id || "-"}\``;
      const resultButtons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: `📋 Salin Style ID (${selectedTitle.slice(0, 15)})`,
          id: "copy_style_id",
          copy_code: selectedTemplate
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎨 Ganti Style Lain",
          id: `${prefix}photosstyle --list`
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(resultCaption, botFooter, resultButtons, {
          image: imageBuffer,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: imageBuffer,
          caption: resultCaption.trim()
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[PhotosStyle Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ PhotosStyle Error: ${errorMessage}`);
    }
  }
};