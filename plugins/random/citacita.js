import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/sound/windah`,
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "citacita",
  aliases: ["soundcitacita", "citacitasound", "suaracitacita", "citamp3"],
  description: "Memutar sound meme random cita-cita secara langsung via Wudysoft API.",
  category: "Sound",
  limit: true,
  example: "citacita",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const res = await axios.get(CONFIG.API_URL, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      let audioSource = Buffer.from(res.data);
      const contentType = res.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        try {
          const json = JSON.parse(audioSource.toString("utf-8"));
          const audioUrl = json.result || json.url || json.audio || json.link;
          if (audioUrl) {
            audioSource = audioUrl;
          }
        } catch {}
      }
      await sendPTT(sock, targetJid, audioSource, quotedMsg);
      await ctx.react("✅");
    } catch (error) {
      console.error("[Cita-Cita Sound Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memuat sound cita-cita: ${error?.message || error}`);
    }
  }
};