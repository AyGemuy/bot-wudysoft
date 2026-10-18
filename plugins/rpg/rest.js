import db from "../../data/db.js";
export default {
  name: "rest",
  aliases: ["tidur", "istirahat", "camp"],
  description: "Mendirikan tenda perkemahan dan memulihkan seluruh HP & Mana",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Rest & Camp`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      const now = Date.now();
      const COOLDOWN = 10 * 60 * 1e3;
      if (user.cooldown?.rest && now - user.cooldown.rest < COOLDOWN) {
        const sisa = COOLDOWN - (now - user.cooldown.rest);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `Hi ${userName}!
Kamu baru saja beristirahat di perkemahan.

–  *C O O L D O W N*

┌  ◦  *Remaining* : ${m}m ${s}s
└  ◦  *Status* : Rested

Tubuhmu masih terasa bugar untuk melanjutkan petualangan.`;
        return ctx.reply(cdText);
      }
      if (user.hp >= user.hpMax && user.mana >= user.manaMax) {
        const fullEnergyText = `–  *F U L L  E N E R G Y*

Kondisi HP dan Mana karakter sudah penuh.

┌  ◦  *Health* : ${user.hp} / ${user.hpMax} HP
└  ◦  *Mana* : ${user.mana} / ${user.manaMax} MP

Karakter Anda siap bertarung di *${prefix}adv*.`;
        return ctx.reply(fullEnergyText);
      }
      const oldHp = user.hp;
      user.hp = user.hpMax;
      user.mana = user.manaMax;
      user.cooldown = user.cooldown || {};
      user.cooldown.rest = now;
      let foundFruit = false;
      if (Math.random() < .4) {
        user.inventory = user.inventory || {};
        user.inventory.fruit = user.inventory.fruit || {};
        user.inventory.fruit.apple = (user.inventory.fruit.apple || 0) + 2;
        foundFruit = true;
      }
      db.write(global.db);
      await ctx.react("⛺");
      let restText = `Hi ${userName}!
Kamu beristirahat dengan tenang di dekat api unggun perkemahan.

–  *R E C O V E R Y*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Health* : ${oldHp} ➔ ${user.hpMax} / ${user.hpMax} HP (100%)
│  ◦  *Mana* : ${user.manaMax} / ${user.manaMax} MP (Penuh)
└  ◦  *Status* : Fully Restored\n\n`;
      if (foundFruit) {
        restText += `–  *F O U N D*

└  ◦  Memetik 2x Apel Segar saat berkemah.\n\n`;
      }
      restText += `Stamina dan tenaga telah pulih penuh. Ayo bertualang kembali!`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Masuk Dungeon",
          id: `${prefix}adv`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⛏️ Pergi Menambang",
          id: `${prefix}mine`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        })
      }];
      const options = {
        image: bannerImage,
        title: `✦ Rest & Camp • Full Recovered ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Rest & Recovery`,
            button_title: "Aksi Selanjutnya"
          }
        },
        mentions: [ctx.sender],
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: msg
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(restText, botFooter, buttons, options);
      }
      return await sock.sendMessage(ctx.id, {
        image: {
          url: bannerImage
        },
        caption: restText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[REST ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};