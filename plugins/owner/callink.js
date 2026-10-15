import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "calllink",
  aliases: ["buattelpon", "callroom", "videocalllink", "voicelink"],
  description: "Buat link tautan panggilan suara / video call resmi WhatsApp",
  category: "Tools",
  example: ".calllink video atau .calllink audio",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      if (typeof sock.createCallLink !== "function") {
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Tidak didukung\n` + `└ ◦ *Info* : Instance socket bot belum mendukung fitur createCallLink.\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      const rawType = (ctx.args?.[0] || "").toLowerCase();
      const mediaType = ["video", "vid", "vc"].includes(rawType) ? "video" : "audio";
      const isVideo = mediaType === "video";
      const token = await sock.createCallLink(mediaType);
      if (!token) {
        throw new Error("Gagal memperoleh token panggilan dari server WhatsApp.");
      }
      const callPath = isVideo ? "video" : "voice";
      const callUrl = `https://call.whatsapp.com/${callPath}/${token}`;
      const bodyText = `– *C A L L  L I N K*\n\n` + `┌ ◦ *Type* : ${isVideo ? "Video Call" : "Voice Call"}\n` + `│ ◦ *Token* : ${token}\n` + `│ ◦ *Capacity* : Hingga 32 Peserta\n` + `└ ◦ *Link* : ${callUrl}\n\n` + `${footer}`;
      const buttons = [{
        name: "cta_url",
        display_text: isVideo ? "Gabung Video Call" : "Gabung Panggilan Suara",
        url: callUrl
      }, {
        name: "cta_copy",
        display_text: "Salin Link Room",
        copy_code: callUrl
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Call Room`,
            button_title: "Opsi Panggilan"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Telephony`, buttons, options);
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[CALLLINK ERROR]", e);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${e.message}\n` + `└ ◦ *Command* : ${ctx.command || "calllink"}\n\n` + `${footer}`);
    }
  }
};