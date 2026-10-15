export default {
  name: "delete",
  aliases: ["del", "d", "hapus"],
  description: "Menghapus pesan bot atau pesan orang lain (jika bot admin)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.quoted) {
        return ctx.reply("❌ Reply/balas pesan yang ingin kamu hapus!");
      }
      await ctx.react("⏳");
      const quoted = ctx.quoted;
      const deleteKey = {
        remoteJid: quoted.key?.remoteJid || ctx.id || ctx.from,
        fromMe: quoted.key?.fromMe ?? (quoted.isMe ?? quoted.fromMe ?? false),
        id: quoted.key?.id || quoted.id,
        participant: quoted.key?.participant || quoted.sender || quoted.participant
      };
      await sock.sendMessage(ctx.id, {
        delete: deleteKey
      });
      if (msg?.key) {
        await sock.sendMessage(ctx.id, {
          delete: msg.key
        }).catch(() => {});
      }
      await ctx.react("🗑️");
    } catch (error) {
      await ctx.react("❌");
      console.error("Delete Message Error:", error);
      await ctx.reply(`❌ *Gagal menghapus pesan:*\n\`\`\`\n${error?.message || error}\n\`\`\``);
    }
  }
};