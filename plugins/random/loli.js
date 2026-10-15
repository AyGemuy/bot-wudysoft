import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "loli",
  aliases: ["randomloli"],
  description: "Mengirim gambar loli random",
  category: "Random",
  execute: async (sock, ctx, msg) => {
    try {
      const res = await axios.get("https://api.nekolabs.web.id/random/loli", {
        responseType: "arraybuffer"
      });
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(res.data),
        caption: "┏━━━〔 RANDOM LOLI 〕━━━┓\n┃            🎀            ┃\n┗━━━━━━━━━━━━━━━━━━━━┛"
      }, {
        quoted: simpleQuoted(ctx)
      });
    } catch (error) {
      ctx.reply(`❌ Gagal mengambil gambar loli: ${error.message}`);
    }
  }
};