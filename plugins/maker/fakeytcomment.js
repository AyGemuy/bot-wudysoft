import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "fakeytcomment",
  aliases: ["fakeyt", "ytcomment", "ytc"],
  description: "Membuat gambar fake komentar YouTube",
  category: "Maker",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      let comment = (ctx.args?.join(" ") || ctx.query || ctx.quoted?.text || "").trim();
      if (!comment) {
        return ctx.reply(`💬 *FAKE YOUTUBE COMMENT MAKER*\n\n` + `👉 Format: *${ctx.prefix || "."}fakeytcomment <teks komentar>*\n` + `👉 Contoh: *${ctx.prefix || "."}fakeytcomment Kontennya bagus banget bang!*`);
      }
      await ctx.react("⏳");
      const senderJid = ctx.sender || msg.key?.participant || msg.key?.remoteJid;
      let avatarUrl = "https://i.ibb.co/m5xGqMD/avatar-default.png";
      try {
        if (senderJid) {
          avatarUrl = await sock.profilePictureUrl(senderJid, "image");
        }
      } catch {
        avatarUrl = "https://i.ibb.co/m5xGqMD/avatar-default.png";
      }
      const username = ctx.pushname || ctx.name || "User";
      const response = await axios.get("https://some-random-api.com/canvas/misc/youtube-comment", {
        params: {
          avatar: avatarUrl,
          username: username,
          comment: comment
        },
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!response.data) {
        throw new Error("Gagal menerima hasil gambar komentar YouTube.");
      }
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(response.data),
        caption: `💬 *Fake YouTube Comment Selesai*\n👤 *User:* ${username}\n📝 *Komentar:* "${comment}"`
      }, {
        quoted: simpleQuoted(ctx)
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Fake YT Comment Error: ${errMsg}`);
    }
  }
};