import axios from "axios";
import db from "../../data/db.js";
import { upload } from "../../lib/upload.js";
import { simpleQuoted } from "../../lib/quoted.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/ai/stable-ai`;
const SESSION_TIMEOUT = 20 * 60 * 1e3; // 20 Menit
const CONFIG = {
  TIMEOUT: 18e4, // 180 detik sesuai durasi polling antrean gambar
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 8
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.stableAi) global.db.stableAi = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;

    if (["ratio", "ar"].includes(key)) key = "aspect_ratio";
    if (["img", "image"].includes(key)) key = "media";
    if (["aid", "android"].includes(key)) key = "android_id";

    if (rawVal !== undefined) {
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
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
    flags,
    cleanPrompt
  };
}

async function requestStableAi(params = {}) {
  const { data } = await axios.get(API_URL, {
    params,
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  if (!data?.status || data?.status === "error") {
    throw new Error(data?.error || data?.message || "Gagal memproses permintaan ke Stable Diffusion.");
  }
  return data;
}

function recordSession(chatId, messageId, androidId, lastImage, style, model) {
  if (!chatId) return;
  initDB();
  if (!global.db.stableAi[chatId]) {
    global.db.stableAi[chatId] = {
      android_id: androidId || null,
      last_image: lastImage || null,
      style: style || "Ghibli Anime",
      model: model || "internal_actionfigure",
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.stableAi[chatId];
  if (androidId) s.android_id = androidId;
  if (lastImage) s.last_image = lastImage;
  if (style) s.style = style;
  if (model) s.model = model;
  if (messageId) {
    if (!Array.isArray(s.msgIds)) s.msgIds = [];
    if (!s.msgIds.includes(messageId)) s.msgIds.push(messageId);
    s.lastMsgId = messageId;
  }
  s.updatedAt = Date.now();
  s.expireTime = Date.now() + SESSION_TIMEOUT;
  saveDB();
}

export default {
  name: "stablediffusion",
  aliases: ["sdai", "stablediffusionai", "sdiffusion", "dalle4"],
  description: "Stable Diffusion AI Image Generator & Restyle (Full DB Session & Reply Listener).",
  category: "AI",
  limit: true,
  example: "sdai anime cute cat in cyberpunk city --style Ghibli Anime\nBalas/reply gambar hasil bot untuk merestyled/transform ulang.",

  before: async (msg, { sock, ctx }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.stableAi[chatId]) return;

      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;

      const sessionData = global.db.stableAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.stableAi[chatId];
        saveDB();
        return;
      }

      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingAi = quotedStanzaId && (
        quotedStanzaId === sessionData.lastMsgId ||
        (Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId))
      );

      if (!isQuotingAi) return;

      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;

      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;

      if (typeof ctx?.react === "function") await ctx.react("🎨");

      let uploadedMediaUrl = null;
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedMediaUrl = uploadRes.url;
          }
        }
      }

      // Jika mereply hasil gambar bot terdahulu tanpa kirim foto baru, gunakan gambar sebelumnya sebagai input restyle
      const inputImage = uploadedMediaUrl || sessionData.last_image;
      const isI2I = Boolean(inputImage);

      const queryParams = {
        action: "generate",
        prompt: userText || "Enhance and restyle into aesthetic artwork",
        android_id: sessionData.android_id || undefined,
        wait: "true",
        ...(isI2I ? {
          image: inputImage,
          model: sessionData.model || "internal_actionfigure"
        } : {
          style: sessionData.style || "Ghibli Anime"
        })
      };

      const data = await requestStableAi(queryParams);
      const outputUrl = data.output;
      if (!outputUrl) throw new Error("Gagal menerima hasil gambar.");

      const bodyText = `–  *S T A B L E  D I F F U S I O N*\n\n` +
        `┌  ◦  *Prompt* : ${queryParams.prompt}\n` +
        `├  ◦  *Mode* : ${isI2I ? "Image to Image (Reply)" : "Text to Image"}\n` +
        `├  ◦  *Preset* : ${isI2I ? queryParams.model : queryParams.style}\n` +
        `└  ◦  *Job ID* : \`${data.job_id || "-"}\``;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Prompt",
        copy_code: queryParams.prompt
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: outputUrl,
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: { url: outputUrl },
          caption: bodyText
        }, { quoted: msg });
      }

      const newMsgId = sentMsg?.key?.id;
      recordSession(chatId, newMsgId, data.android_id || sessionData.android_id, outputUrl, sessionData.style, sessionData.model);

      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[STABLE DIFFUSION BEFORE ERROR]:", e.message);
    }
  },

  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);

      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["stablediffusion", "sdai", "stablediffusionai", "sdiffusion", "dalle4"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;

      // 1. Reset Sesi
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.stableAi[chatId]) {
          delete global.db.stableAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi Stable Diffusion berhasil direset!* Preferensi telah dikembalikan ke awal.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif di percakapan ini.");
      }

      const { flags, cleanPrompt } = parseFlags(rawText);
      const existingSession = global.db.stableAi[chatId];
      const activeAndroidId = flags.android_id || existingSession?.android_id || undefined;

      // 2. Profile / Saldo Koin
      if (flags.profile || cleanPrompt.toLowerCase() === "profile") {
        await ctx.react("⏳");
        const res = await requestStableAi({ action: "profile", android_id: activeAndroidId });
        recordSession(chatId, null, res.android_id);

        await ctx.react("✨");
        return ctx.reply(
          `–  *S T A B L E  D I F F U S I O N  P R O F I L E*\n\n` +
          `┌  ◦  *Android ID* : \`${res.android_id}\`\n` +
          `├  ◦  *Coin Balance* : ${res.coin_balance} 🪙\n` +
          `├  ◦  *Sisa Limit* : ${res.remaining_balance} / ${res.total_request_limit}\n` +
          `└  ◦  *Status Premium* : ${res.is_premium ? "Aktif ✨" : "Tidak"}`
        );
      }

      // 3. Claim Koin Gratis
      if (flags.claim || cleanPrompt.toLowerCase() === "claim") {
        await ctx.react("⏳");
        const res = await requestStableAi({
          action: "claim",
          android_id: activeAndroidId,
          coins: flags.coins || 10
        });
        recordSession(chatId, null, res.android_id);

        await ctx.react("✨");
        return ctx.reply(`🎉 *Sukses klaim koin!* Saldo Anda saat ini: *${res.coin_balance}* 🪙`);
      }

      // 4. Set Style / Model Manual
      if (flags.setstyle || flags.setmodel) {
        const isModel = Boolean(flags.setmodel);
        const targetVal = String(flags.setstyle || flags.setmodel).trim();
        const targetName = flags.name || targetVal;

        recordSession(
          chatId,
          null,
          activeAndroidId,
          null,
          isModel ? existingSession?.style : targetVal,
          isModel ? targetVal : existingSession?.model
        );

        await ctx.react("✅");
        return ctx.reply(
          `–  *S T A B L E  D I F F U S I O N*\n\n` +
          `┌  ◦  *Preset Disimpan* : ${isModel ? "Image-to-Image Model" : "Text-to-Image Style"}\n` +
          `├  ◦  *Nama* : ${targetName}\n` +
          `└  ◦  *Value ID* : \`${targetVal}\`\n\n` +
          `_Ketik \`${prefix}sdai <prompt>\` untuk mulai membuat gambar._`
        );
      }

      // 5. CTA Pagination List (Styles / Models)
      if (flags.list || flags.models || flags.search || rawText.startsWith("--list") || flags.page) {
        await ctx.react("⏳");
        const isModel = flags.type === "model" || flags.iti === true || String(flags.iti) === "true";
        const data = await requestStableAi({ action: "models" });

        const rawList = isModel ? (data.image_to_image_models || []) : (data.text_to_image_styles || []);
        if (!rawList.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada data model/style dari server.");
        }

        const searchQuery = flags.search || flags.query || (!flags.page && cleanPrompt) || "";
        let matchedItems = rawList;
        if (searchQuery && searchQuery !== "true") {
          const kw = searchQuery.toLowerCase();
          matchedItems = rawList.filter(item => {
            const name = (item.display_name || item.name || item.actual_model_name || "").toLowerCase();
            return name.includes(kw);
          });
        }

        if (!matchedItems.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Data tidak ditemukan dengan query "${searchQuery}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedItems.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedItems.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((item, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          const valId = isModel ? item.actual_model_name : item.name;
          const displayName = item.display_name || valId;
          const isPrem = Boolean(isModel ? item.is_model_premium : item.is_style_premium);
          const cmdFlag = isModel ? `--setmodel "${valId}"` : `--setstyle "${valId}"`;

          return {
            title: `${globalIdx}. ${displayName}`.slice(0, 24),
            id: `${prefix}sdai ${cmdFlag} --name "${displayName}"`,
            description: `${isPrem ? "[👑 Premium] " : ""}ID: ${valId}`.slice(0, 60)
          };
        });

        let baseCmd = `${prefix}sdai`;
        if (isModel) baseCmd += ` --type model`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH ${isModel ? "MODEL" : "STYLE"} (${pageItems.length})`,
            sections: [{
              title: `DAFTAR ${isModel ? "ITI MODEL" : "TTI STYLE"} (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${baseCmd} --page ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} --page ${page + 1}`
            })
          });
        }

        const bodyText = `–  *S T A B L E  D I F F U S I O N  -  L I S T*\n\n` +
          `┌  ◦  *Tipe* : ${isModel ? "Image-to-Image Models" : "Text-to-Image Styles"}\n` +
          `├  ◦  *Total Item* : ${matchedItems.length}\n` +
          `└  ◦  *Halaman* : ${page} / ${totalPages}\n\n` +
          `_Pilih preset melalui tombol interaktif di bawah ini:_`;

        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `SD Presets`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };

        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, "", buttons, options);
        } else {
          let fallback = `${bodyText}\n\n` + rows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          await ctx.reply(fallback);
        }

        await ctx.react("✅");
        return;
      }

      // 6. Generate Mode
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const activeStyle = existingSession?.style || "Ghibli Anime";
        const activeModel = existingSession?.model || "internal_actionfigure";

        const guideText = `–  *S T A B L E  D I F F U S I O N  A I*

Generator visual artistik berkualitas tinggi berbasis Stable Diffusion.

┌  ◦  *Text to Image* :
│  └ \`${prefix}sdai A majestic dragon flying over cyberpunk tokyo\`
│
├  ◦  *Image to Image (Kirim/Balas Foto)* :
│  └ Kirim foto: \`${prefix}sdai Turn into 3d action figure\`
│
├  ◦  *Menu Preset Styles & Models (CTA)* :
│  ├ \`${prefix}sdai --list\` (Daftar Styles TTI)
│  └ \`${prefix}sdai --list --type model\` (Daftar Models ITI)
│
├  ◦  *Sesi Berkelanjutan (Multi-Turn)* :
│  └ Cukup *reply pesan/foto hasil bot* dengan instruksi baru untuk mentransformasi ulang!
│
└  ◦  *Flags Tambahan* :
   ├ \`--style <nama>\` (Ubah style visual)
   ├ \`--model <nama>\` (Ubah engine model)
   ├ \`--ar <square|portrait|landscape>\` (Aspect ratio)
   ├ \`--profile\` (Cek kuota koin)
   ├ \`--claim\` (Klaim koin bonus)
   └ \`--reset\` (Hapus sesi obrolan)`;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      await ctx.react("🎨");

      let uploadedMediaUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedMediaUrl = uploadRes.url;
          }
        }
      }

      const inputImage = uploadedMediaUrl || flags.media || null;
      const isI2I = Boolean(inputImage);
      const promptText = cleanPrompt || flags.prompt || (isI2I ? "Turn into artistic figure masterpiece" : "Masterpiece high quality artwork");

      const queryParams = {
        action: "generate",
        prompt: promptText,
        android_id: activeAndroidId,
        wait: "true",
        ...flags
      };

      if (isI2I) {
        queryParams.image = inputImage;
        queryParams.model = flags.model || existingSession?.model || "internal_actionfigure";
      } else {
        queryParams.style = flags.style || existingSession?.style || "Ghibli Anime";
      }

      const data = await requestStableAi(queryParams);
      const outputUrl = data.output;
      if (!outputUrl) throw new Error("Server tidak mengembalikan URL output gambar.");

      const bodyText = `–  *S T A B L E  D I F F U S I O N*\n\n` +
        `┌  ◦  *Prompt* : ${promptText}\n` +
        `├  ◦  *Mode* : ${isI2I ? "Image to Image" : "Text to Image"}\n` +
        `├  ◦  *Preset* : ${isI2I ? queryParams.model : queryParams.style}\n` +
        `└  ◦  *Job ID* : \`${data.job_id || "-"}\``;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Prompt",
        copy_code: promptText
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: outputUrl,
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: { url: outputUrl },
          caption: bodyText
        }, { quoted: quotedMsg });
      }

      const sentMsgId = sentMsg?.key?.id;
      recordSession(
        chatId,
        sentMsgId,
        data.android_id || activeAndroidId,
        outputUrl,
        queryParams.style || existingSession?.style,
        queryParams.model || existingSession?.model
      );

      await ctx.react("✨");
    } catch (error) {
      console.error("[Stable Diffusion AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Gagal memproses gambar.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};