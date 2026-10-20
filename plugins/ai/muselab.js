import axios from "axios";
import db from "../../data/db.js";
import { upload } from "../../lib/upload.js";
import { simpleQuoted } from "../../lib/quoted.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/ai/muselab`;
const SESSION_TIMEOUT = 25 * 60 * 1e3; // 25 Menit
const CONFIG = {
  TIMEOUT: 18e4, // 180 detik
  POLL_INTERVAL: 4e3, // 4 detik tiap iterasi cek status
  MAX_POLL_ATTEMPTS: 45, // ~180 detik
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 8
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.muselabAi) global.db.muselabAi = {};
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

    if (["video", "i2v", "tovideo"].includes(key)) key = "is_video";
    if (["tpl", "template"].includes(key)) key = "unique_id";
    if (["ratio", "ar"].includes(key)) key = "aspect_ratio";
    if (["img", "image"].includes(key)) key = "media";
    if (["dur", "time"].includes(key)) key = "duration";
    if (["res"].includes(key)) key = "resolution";

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

// Request API dengan auto recovery & refresh session bila state rusak/expired
async function requestMuseLab(params = {}, chatId = null) {
  let session = chatId && global.db.muselabAi?.[chatId] ? global.db.muselabAi[chatId] : null;
  let currentState = params.state || session?.state || undefined;

  const runRequest = async (stateVal) => {
    const qParams = { ...params };
    if (stateVal) qParams.state = stateVal;
    return await axios.get(API_URL, {
      params: qParams,
      headers: {
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
  };

  try {
    const { data } = await runRequest(currentState);
    if (!data?.status || data?.status === "error") {
      throw new Error(data?.error || data?.message || "Gagal memproses permintaan ke MuseLab AI.");
    }
    if (data?.state && chatId) {
      if (!global.db.muselabAi[chatId]) global.db.muselabAi[chatId] = {};
      global.db.muselabAi[chatId].state = data.state;
      saveDB();
    }
    return data;
  } catch (err) {
    const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || "";
    if (currentState && /sesi|auth|state|token|koin tidak mencukupi|point/i.test(errMsg)) {
      if (global.db.muselabAi[chatId]) global.db.muselabAi[chatId].state = null;
      const { data } = await runRequest(undefined);
      if (data?.status && data?.state && chatId) {
        global.db.muselabAi[chatId].state = data.state;
        saveDB();
      }
      return data;
    }
    throw new Error(errMsg || "Gagal menghubungi API MuseLab.");
  }
}

// Polling Helper untuk menunggu proses pembuatan video/gambar
async function pollTaskStatus(taskId, state, serviceType, chatId) {
  for (let i = 1; i <= CONFIG.MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, CONFIG.POLL_INTERVAL));
    const res = await requestMuseLab({
      action: "status",
      task_id: taskId,
      service_type: serviceType,
      state: state
    }, chatId);

    if (res?.status === "completed") {
      return res;
    }
    if (res?.status === "failed" || res?.status === "error") {
      throw new Error(res?.message || "Task AI gagal diproses oleh server.");
    }
  }
  throw new Error("Batas waktu tunggu (timeout 180 detik) habis saat memproses media.");
}

function recordSession(chatId, messageId, returnedState, lastMedia, templateId, templateTitle) {
  if (!chatId) return;
  initDB();
  if (!global.db.muselabAi[chatId]) {
    global.db.muselabAi[chatId] = {
      state: returnedState || null,
      last_media: lastMedia || null,
      template_id: templateId || null,
      template_title: templateTitle || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.muselabAi[chatId];
  if (returnedState) s.state = returnedState;
  if (lastMedia) s.last_media = lastMedia;
  if (templateId) s.template_id = templateId;
  if (templateTitle) s.template_title = templateTitle;
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
  name: "muselab",
  aliases: ["muselabai", "mlai", "muse"],
  description: "MuseLab AI Multimodal: Image Restyle, Video Animation & AI Templates (Full DB Session & Reply Listener).",
  category: "AI",
  limit: true,
  example: "muselab anime cyberpunk --video (Kirim/balas gambar)\nBalas/reply media hasil bot untuk mentransformasi ulang.",

  before: async (msg, { sock, ctx }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.muselabAi[chatId]) return;

      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;

      const sessionData = global.db.muselabAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.muselabAi[chatId];
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

      const inputImage = uploadedMediaUrl || sessionData.last_media;
      if (!inputImage) return;

      const { flags, cleanPrompt } = parseFlags(userText);
      const isVideoGen = flags.is_video === true || String(flags.is_video) === "true";
      const targetTemplate = flags.unique_id || (!cleanPrompt && !isVideoGen ? sessionData.template_id : null);

      let actionType = "image_to_image";
      const queryParams = {
        image: inputImage,
        prompt: cleanPrompt || "Enhance subject into aesthetic artwork",
        ...flags
      };

      if (isVideoGen) {
        actionType = "image_to_video";
        queryParams.duration = String(flags.duration || "4");
        queryParams.resolution = String(flags.resolution || "540p");
      } else if (targetTemplate) {
        actionType = "template_to_image";
        queryParams.unique_id = targetTemplate;
      }
      queryParams.action = actionType;

      const taskRes = await requestMuseLab(queryParams, chatId);
      const taskId = taskRes.task_id;
      if (!taskId) throw new Error(taskRes.message || "Gagal menginisiasi task.");

      const completedTask = await pollTaskStatus(
        taskId,
        taskRes.state,
        taskRes.service_type || (isVideoGen ? "videogen" : "aiGeneral"),
        chatId
      );

      const resultImages = completedTask.images || [];
      const resultVideos = completedTask.videos || [];
      const outputUrl = resultVideos[0] || resultImages[0];
      if (!outputUrl) throw new Error("Gagal menerima hasil media dari MuseLab.");

      const isVideo = Boolean(resultVideos.length > 0);
      const bodyText = `–  *M U S E L A B  A I*\n\n` +
        `┌  ◦  *Prompt* : ${queryParams.prompt}\n` +
        `├  ◦  *Mode* : ${isVideo ? "Image to Video (Reply)" : "Image to Image (Reply)"}\n` +
        `├  ◦  *Biaya Koin* : ${taskRes.cost_point ?? "-"} Pts\n` +
        `└  ◦  *Sisa Koin* : ${taskRes.remaining_points ?? "-"} 🪙`;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Prompt",
        copy_code: queryParams.prompt
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function" && !isVideo) {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: outputUrl,
          quoted: msg
        });
      } else if (isVideo) {
        sentMsg = await sock.sendMessage(ctx.id, {
          video: { url: outputUrl },
          caption: bodyText
        }, { quoted: msg });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: { url: outputUrl },
          caption: bodyText
        }, { quoted: msg });
      }

      const newMsgId = sentMsg?.key?.id;
      recordSession(chatId, newMsgId, taskRes.state || sessionData.state, outputUrl, sessionData.template_id, sessionData.template_title);

      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[MUSELAB BEFORE ERROR]:", e.message);
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
        if (["muselab", "muselabai", "mlai", "muse"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;

      // 1. Reset Sesi
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.muselabAi[chatId]) {
          delete global.db.muselabAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi MuseLab AI berhasil direset!* Preferensi template dan media dibersihkan.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif di percakapan ini.");
      }

      const { flags, cleanPrompt } = parseFlags(rawText);
      const existingSession = global.db.muselabAi[chatId];

      // 2. Profile / Sisa Saldo Koin
      if (flags.profile || cleanPrompt.toLowerCase() === "profile") {
        await ctx.react("⏳");
        const res = await requestMuseLab({ action: "profile" }, chatId);
        recordSession(chatId, null, res.state);

        await ctx.react("✨");
        return ctx.reply(
          `–  *M U S E L A B  P R O F I L E*\n\n` +
          `┌  ◦  *User ID* : \`${res.user_id}\`\n` +
          `├  ◦  *Points Balance* : ${res.available_points} 🪙\n` +
          `└  ◦  *Code ID* : \`${res.code_id}\``
        );
      }

      // 3. Claim Koin Reward Harian
      if (flags.claim || cleanPrompt.toLowerCase() === "claim") {
        await ctx.react("⏳");
        const res = await requestMuseLab({
          action: "claim",
          code_type: flags.type || "all"
        }, chatId);
        recordSession(chatId, null, res.state);

        await ctx.react("✨");
        return ctx.reply(`🎉 *Sukses klaim koin!* Total didapat: +${res.total_claimed || 0} Pts. Saldo saat ini: *${res.current_points}* 🪙`);
      }

      // 4. Set Template Pilihan
      if (flags.settemplate) {
        const uId = String(flags.settemplate).trim();
        const tTitle = flags.name || uId;

        recordSession(chatId, null, existingSession?.state, null, uId, tTitle);

        await ctx.react("✅");
        return ctx.reply(
          `–  *M U S E L A B  A I*\n\n` +
          `┌  ◦  *Preset Disimpan* : Template Preset\n` +
          `├  ◦  *Title* : ${tTitle}\n` +
          `└  ◦  *Unique ID* : \`${uId}\`\n\n` +
          `_Kirim atau balas foto dengan perintah \`${prefix}muselab\` untuk menerapkan template ini._`
        );
      }

      // 5. CTA Pagination List (Templates)
      if (flags.templates || flags.list || flags.search || rawText.startsWith("--list") || flags.page) {
        await ctx.react("⏳");
        const res = await requestMuseLab({
          action: "templates",
          pageIndex: 1,
          pageSize: 100
        }, chatId);

        const modules = res.data?.records || [];
        let allTemplates = [];
        for (const mod of modules) {
          if (Array.isArray(mod.displayTemplates)) {
            for (const t of mod.displayTemplates) {
              if (t && t.uniqueId && !allTemplates.some(x => x.uniqueId === t.uniqueId)) {
                allTemplates.push(t);
              }
            }
          }
        }

        const searchQuery = flags.search || flags.query || (!flags.page && cleanPrompt) || "";
        let matchedTemplates = allTemplates;
        if (searchQuery && searchQuery !== "true") {
          const kw = searchQuery.toLowerCase();
          matchedTemplates = allTemplates.filter(t => (t.title || "").toLowerCase().includes(kw) || (t.uniqueId || "").toLowerCase().includes(kw));
        }

        if (!matchedTemplates.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Template tidak ditemukan dengan kata kunci "${searchQuery}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedTemplates.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedTemplates.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((item, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          const uId = item.uniqueId;
          const title = item.title || uId;
          const desc = item.description ? item.description.slice(0, 45) : `ID: ${uId}`;

          return {
            title: `${globalIdx}. ${title}`.slice(0, 24),
            id: `${prefix}muselab --settemplate "${uId}" --name "${title}"`,
            description: `${desc} • ID: ${uId}`.slice(0, 60)
          };
        });

        let baseCmd = `${prefix}muselab`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH TEMPLATE (${pageItems.length})`,
            sections: [{
              title: `MUSELAB TEMPLATES (Hal ${page}/${totalPages})`,
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

        const bodyText = `–  *M U S E L A B  -  T E M P L A T E S*\n\n` +
          `┌  ◦  *Total Template* : ${matchedTemplates.length}\n` +
          `├  ◦  *Halaman* : ${page} / ${totalPages}\n` +
          `└  ◦  *Engine* : MuseLab Material v2.0\n\n` +
          `_Pilih template yang ingin digunakan dari menu di bawah:_`;

        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `MuseLab Templates`,
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
      if (!isMedia && !flags.media) {
        const activeTpl = existingSession?.template_title || existingSession?.template_id || "None (Default I2I)";
        const guideText = `–  *M U S E L A B  A I*

Generator visual canggih untuk Restyle Foto, Animasi Video & AI Templates.

┌  ◦  *Active Template* : ${activeTpl}
│
├  ◦  *Image to Image (Restyle)* :
│  └ Kirim/balas foto: \`${prefix}muselab ubah jadi karakter anime aesthetic\`
│
├  ◦  *Image to Video (Animasi Hidup)* :
│  └ Kirim/balas foto: \`${prefix}muselab buat bergerak terbang di awan --video\`
│
├  ◦  *Pilih Template Style (CTA Menu)* :
│  └ \`${prefix}muselab --list\`
│
├  ◦  *Sesi Berkelanjutan (Multi-Turn)* :
│  └ Cukup *reply media hasil bot* untuk mentransformasi ulang secara berkelanjutan!
│
└  ◦  *Flags Tambahan* :
   ├ \`--video\` (Hasilkan animasi video MP4)
   ├ \`--template <unique_id>\` (Pakai template langsung)
   ├ \`--dur <4|6>\` (Durasi video)
   ├ \`--profile\` (Cek sisa saldo poin)
   ├ \`--claim\` (Klaim koin gratis)
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
      if (!inputImage) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memproses atau mengunggah file media gambar.");
      }

      const isVideoGen = flags.is_video === true || String(flags.is_video) === "true";
      const chosenTemplate = flags.unique_id || (!cleanPrompt && !isVideoGen ? existingSession?.template_id : null);

      let actionType = "image_to_image";
      const queryParams = {
        image: inputImage,
        prompt: cleanPrompt || "Enhance subject, high quality aesthetic artwork",
        ...flags
      };

      if (isVideoGen) {
        actionType = "image_to_video";
        queryParams.duration = String(flags.duration || "4");
        queryParams.resolution = String(flags.resolution || "540p");
      } else if (chosenTemplate) {
        actionType = "template_to_image";
        queryParams.unique_id = chosenTemplate;
      }
      queryParams.action = actionType;

      const taskRes = await requestMuseLab(queryParams, chatId);
      const taskId = taskRes.task_id;
      if (!taskId) throw new Error(taskRes.message || "Gagal menginisiasi task pada server.");

      const completedTask = await pollTaskStatus(
        taskId,
        taskRes.state,
        taskRes.service_type || (isVideoGen ? "videogen" : "aiGeneral"),
        chatId
      );

      const resultImages = completedTask.images || [];
      const resultVideos = completedTask.videos || [];
      const outputUrl = resultVideos[0] || resultImages[0];
      if (!outputUrl) throw new Error("Server tidak mengembalikan URL output media.");

      const isVideo = Boolean(resultVideos.length > 0);
      const bodyText = `–  *M U S E L A B  A I*\n\n` +
        `┌  ◦  *Action* : ${actionType}\n` +
        `├  ◦  *Task ID* : \`${taskId}\`\n` +
        `├  ◦  *Biaya Koin* : ${taskRes.cost_point ?? "-"} Pts\n` +
        `└  ◦  *Sisa Saldo* : ${taskRes.remaining_points ?? "-"} 🪙`;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Prompt",
        copy_code: queryParams.prompt
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function" && !isVideo) {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: outputUrl,
          quoted: quotedMsg
        });
      } else if (isVideo) {
        sentMsg = await sock.sendMessage(ctx.id, {
          video: { url: outputUrl },
          caption: bodyText
        }, { quoted: quotedMsg });
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
        taskRes.state || existingSession?.state,
        outputUrl,
        chosenTemplate || existingSession?.template_id,
        existingSession?.template_title
      );

      await ctx.react("✨");
    } catch (error) {
      console.error("[MuseLab AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Gagal memproses MuseLab AI.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};