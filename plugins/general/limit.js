import axios from "axios";
import {
  makeJid
} from "../../core/tools.js";
import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";

function getRankTitle(level) {
  if (level >= 100) return "🌟 Mythic Overlord";
  if (level >= 75) return "👑 Grandmaster";
  if (level >= 50) return "⚔️ Master";
  if (level >= 35) return "💎 Diamond Hero";
  if (level >= 20) return "🛡️ Platinum Knight";
  if (level >= 10) return "🥉 Gold Warrior";
  if (level >= 5) return "🥈 Silver Adventurer";
  return "🌱 Novice Traveler";
}
export default [{
  name: "limit",
  aliases: ["ceklimit", "checklimit", "rank", "status"],
  description: "Cek sisa limit, statistik karakter, dan kartu rank RPG kamu",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react?.("⏳");
      const chatId = ctx.id || ctx.from;
      const sender = ctx.sender;
      const senderNum = sender.split("@")[0];
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || "Wudysoft • Multi-Device";
      const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      db.ensureUser(sender, ctx.pushname || senderNum);
      const user = global.db.user[sender] || {};
      const isPremium = user.premium?.status === true;
      const isOwner = user.ownerAcces === true || ctx.isOwner === true;
      const userName = user.name || ctx.pushname || senderNum;
      let expiredText = "";
      if (isPremium && user.premium.expiredAt && user.premium.expiredAt !== Number.MAX_SAFE_INTEGER) {
        const remaining = user.premium.expiredAt - Date.now();
        if (remaining > 0) {
          const d = Math.floor(remaining / 864e5);
          const h = Math.floor(remaining % 864e5 / 36e5);
          expiredText = `${d}d ${h}h`;
        }
      }
      const allUsers = Object.entries(global.db?.user || {}).map(([jid, data]) => ({
        jid: jid,
        level: data.level || 1,
        exp: data.exp || 0
      })).sort((a, b) => b.level - a.level || b.exp - a.exp);
      const userRank = Math.max(1, allUsers.findIndex(u => u.jid === sender) + 1);
      const userLevel = user.level || 1;
      const currentXp = user.exp || 0;
      const requiredXp = userLevel * 500;
      const rankTier = getRankTitle(userLevel);
      const userStatus = isOwner ? "dnd" : isPremium ? "idle" : "online";
      const borderColor = isOwner ? "ff0055" : isPremium ? "ffd700" : "00b4d8";
      let avatarUrl = global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
      try {
        avatarUrl = await sock.profilePictureUrl(sender, "image");
      } catch {}
      let mediaOutput = global.bot?.media?.banner1 || global.bot?.media?.thumb || global.bot?.media?.banner2;
      try {
        const {
          data
        } = await axios.post(`${global.bot?.api?.wudysoft}/api/canvas/canvafy/rank`, {
          username: userName.slice(0, 16),
          avatar: avatarUrl,
          status: userStatus,
          level: userLevel,
          rank: userRank,
          currentXp: currentXp,
          requiredXp: requiredXp,
          borderColor: borderColor
        }, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
          },
          timeout: 15e3
        });
        if (data) mediaOutput = Buffer.from(data);
      } catch (err) {
        console.warn("[Rank Card Canvas Fail]:", err.message);
      }
      const maxLimit = global.bot?.defaultLimit || 20;
      const limitDisplay = isOwner ? "Unlimited (Owner)" : isPremium ? "Unlimited (VIP)" : `${user.limit ?? 0} / ${maxLimit}`;
      const statusDisplay = isOwner ? "Owner" : isPremium ? "Premium" : "Free User";
      const bodyText = `Hi ${userName}!
Berikut adalah data limit dan status karakter Anda.

–  *S T A T U S*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Limit* : ${limitDisplay}
│  ◦  *Balance* : Rp ${(user.money || 0).toLocaleString("id-ID")}
│  ◦  *Status* : ${statusDisplay}
└  ◦  *Expired* : ${expiredText || "-"}

–  *R P G*

┌  ◦  *Level* : Lv. ${userLevel}
│  ◦  *Rank* : ${rankTier}
│  ◦  *Global* : #${userRank} (${allUsers.length} Players)
└  ◦  *Exp* : ${currentXp.toLocaleString("id-ID")} / ${requiredXp.toLocaleString("id-ID")}

Ketik *${prefix}levelup* jika EXP kamu sudah mencapai target.`;
      const footerText = `${botFooter}`;
      const rpgSections = [{
        title: `⚔️ MENU RPG & AKTIVITAS`,
        rows: [{
          title: "🆙 Level Up Karakter",
          description: `Tingkatkan level dengan ${requiredXp} EXP`,
          id: `${prefix}levelup`
        }, {
          title: "🎒 Buka Inventory",
          description: "Cek perlengkapan, ore, dan hasil loot",
          id: `${prefix}inv`
        }, {
          title: "🌲 Mulai Adventure",
          description: "Jelajahi dungeon untuk mencari EXP & Loot",
          id: `${prefix}adventure`
        }, {
          title: "🎁 Klaim Daily",
          description: "Ambil bonus exp, limit harian & money gratis",
          id: `${prefix}daily`
        }, {
          title: "🏆 Leaderboard",
          description: "Cek peringkat pemain tertinggi di server",
          id: `${prefix}lb`
        }]
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIHAN AKSI RPG",
          sections: rpgSections
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🆙 Naik Level",
          id: `${prefix}levelup`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Inventory",
          id: `${prefix}inv`
        })
      }];
      const options = {
        image: mediaOutput,
        title: `✦ ${botName} • Character Status ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • RPG Status`,
            button_title: "Aksi Karakter"
          },
          limited_time_offer: {
            text: `🔥 EVENT EXP BOOST 2X SEDANG BERLANGSUNG! 🔥`,
            url: channelUrl,
            copy_code: `${prefix}daily`,
            expiration_time: Date.now() + 24 * 3600 * 1e3
          }
        },
        contextInfo: {
          mentionedJid: [sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        await sock.sendMessage(chatId, {
          image: Buffer.isBuffer(mediaOutput) ? mediaOutput : {
            url: mediaOutput
          },
          caption: bodyText,
          mentions: [sender]
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react?.("✅");
    } catch (e) {
      await ctx.react?.("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
}, {
  name: "levelup",
  aliases: ["up", "naiklevel", "lvlup"],
  description: "Naikkan level karakter RPG dengan EXP yang kamu kumpulkan",
  category: "RPG",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react?.("⏳");
      const chatId = ctx.id || ctx.from;
      const sender = ctx.sender;
      const senderNum = sender.split("@")[0];
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || "Wudysoft • Multi-Device";
      const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      db.ensureUser(sender, ctx.pushname || senderNum);
      const user = global.db.user[sender];
      const isOwner = user.ownerAcces === true || ctx.isOwner === true;
      const isPremium = user.premium?.status === true;
      const userName = user.name || ctx.pushname || senderNum;
      const currentLevel = Number(user.level) || 1;
      const currentExp = Number(user.exp) || 0;
      const requiredExp = currentLevel * 500;
      if (currentExp < requiredExp) {
        await ctx.react?.("❌");
        const missingExp = requiredExp - currentExp;
        const failText = `Hi ${userName}!
EXP kamu belum mencukupi untuk naik ke level berikutnya.

–  *R E Q U I R E M E N T*

┌  ◦  *Current Level* : Lv. ${currentLevel}
│  ◦  *Current Exp* : ${currentExp.toLocaleString("id-ID")} XP
│  ◦  *Target Exp* : ${requiredExp.toLocaleString("id-ID")} XP
└  ◦  *Missing* : ${missingExp.toLocaleString("id-ID")} XP

Kumpulkan EXP tambahan melalui petualangan atau daily reward.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🌲 Mulai Adventure",
            id: `${prefix}adventure`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎁 Klaim Daily",
            id: `${prefix}daily`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📊 Cek Status",
            id: `${prefix}limit`
          })
        }];
        const options = {
          image: global.bot?.media?.banner1 || "https://picsum.photos/seed/rpg/800/400",
          title: `✦ EXP Belum Cukup ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Level Up`,
              button_title: "Cari EXP Tambahan"
            },
            limited_time_offer: {
              text: `⏳ SISA ${missingExp} EXP LAGI UNTUK NAIK LEVEL!`,
              url: channelUrl,
              copy_code: `${prefix}adventure`,
              expiration_time: Date.now() + 2 * 3600 * 1e3
            }
          },
          contextInfo: {
            mentionedJid: [sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(failText, botFooter, buttons, options);
        } else {
          return await ctx.reply(failText, {
            mentions: [sender],
            quoted: quotedMsg
          });
        }
      }
      const nextLevel = currentLevel + 1;
      const expRemaining = currentExp - requiredExp;
      const bonusMoney = nextLevel * 5e3;
      const bonusLimit = 5;
      user.level = nextLevel;
      user.exp = expRemaining;
      user.money = (user.money || 0) + bonusMoney;
      user.limit = (user.limit || 0) + bonusLimit;
      user.hpMax = (user.hpMax || 100) + 15;
      user.manaMax = (user.manaMax || 50) + 10;
      user.hp = user.hpMax;
      user.mana = user.manaMax;
      user.atk = (user.atk || 10) + 3;
      user.def = (user.def || 5) + 2;
      await db.write(global.db).catch(() => {});
      let avatarUrl = global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
      try {
        avatarUrl = await sock.profilePictureUrl(sender, "image");
      } catch {}
      const borderColor = isOwner ? "ff0055" : isPremium ? "ffd700" : "00b4d8";
      const avatarBorderColor = isOwner ? "ff0055" : isPremium ? "ffd700" : "ffffff";
      let mediaOutput = global.bot?.media?.banner1 || global.bot?.media?.thumb;
      try {
        const {
          data
        } = await axios.post(`${global.bot?.api?.wudysoft}/api/canvas/canvafy/levelup`, {
          avatar: avatarUrl,
          background: global.bot?.media?.banner1 || "https://picsum.photos/seed/level/800/400",
          username: userName.slice(0, 16),
          borderColor: borderColor,
          avatarBorderColor: avatarBorderColor,
          overlayOpacity: .7,
          currentLevel: currentLevel,
          nextLevel: nextLevel
        }, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
          },
          timeout: 15e3
        });
        if (data) mediaOutput = Buffer.from(data);
      } catch (err) {
        console.warn("[Levelup Card Fail]:", err.message);
      }
      const newRankTitle = getRankTitle(nextLevel);
      const levelUpText = `Hi ${userName}!
Selamat, level karakter kamu berhasil ditingkatkan.

–  *E V O L U T I O N*

┌  ◦  *Level* : Lv. ${currentLevel} ➔ *Lv. ${nextLevel}*
│  ◦  *Rank* : ${newRankTitle}
└  ◦  *Exp Left* : ${expRemaining.toLocaleString("id-ID")} XP

–  *B O N U S*

┌  ◦  *Balance* : +Rp ${bonusMoney.toLocaleString("id-ID")}
│  ◦  *Limit* : +${bonusLimit} Limit
│  ◦  *Max HP* : +15 (${user.hpMax})
│  ◦  *Max Mana* : +10 (${user.manaMax})
└  ◦  *Stats* : ATK +3 (${user.atk}) | DEF +2 (${user.def})

Gunakan menu di bawah untuk melanjutkan aktivitas berpetualang.`;
      const actionSections = [{
        title: `🚀 AKSI SETELAH LEVEL UP`,
        rows: [{
          title: "🌲 Mulai Adventure Baru",
          description: `Jelajahi dungeon tier ${newRankTitle}`,
          id: `${prefix}adventure`
        }, {
          title: "🎒 Periksa Inventory",
          description: "Buka tas penyimpanan dan kelola senjata",
          id: `${prefix}inv`
        }, {
          title: "📊 Cek Status & Limit",
          description: "Lihat ringkasan kartu profil karakter kamu",
          id: `${prefix}limit`
        }, {
          title: "🏰 Masuk Dungeon",
          description: "Lawan bos dungeon untuk hadiah langka",
          id: `${prefix}dungeon`
        }]
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎮 PILIH AKSI (LV. ${nextLevel})`,
          sections: actionSections
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📊 Cek Status",
          id: `${prefix}limit`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🌲 Adventure",
          id: `${prefix}adventure`
        })
      }];
      const options = {
        image: mediaOutput,
        title: `✦ ${botName} • Level Up (Lv. ${nextLevel}) ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Level Up Berhasil`,
            button_title: "Menu Petualang"
          },
          limited_time_offer: {
            text: `👑 BONUS SPESIAL EVOLUSI LV.${nextLevel} AKTIF! 👑`,
            url: channelUrl,
            copy_code: `CLAIM_BONUS_LV${nextLevel}`,
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          mentionedJid: [sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(levelUpText, botFooter, buttons, options);
      } else {
        await sock.sendMessage(chatId, {
          image: Buffer.isBuffer(mediaOutput) ? mediaOutput : {
            url: mediaOutput
          },
          caption: levelUpText,
          mentions: [sender]
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react?.("🎉");
    } catch (e) {
      await ctx.react?.("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
}, {
  name: "addlimit",
  aliases: ["tambahlimit", "addlmt"],
  description: "Tambah limit user (Owner)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args || ctx.args.length < 2) {
        return ctx.reply(`–  *A D D  L I M I T*

┌  ◦  *Format* : ${ctx.prefix}addlimit <nomor> <jumlah>
└  ◦  *Example* : ${ctx.prefix}addlimit 628xxx 50`);
      }
      const jid = makeJid(ctx.args[0]);
      const amount = parseInt(ctx.args[1], 10);
      if (isNaN(amount) || amount <= 0) return ctx.reply("❌ Jumlah limit tidak valid.");
      db.ensureUser(jid, jid.split("@")[0]);
      global.db.user[jid].limit = (global.db.user[jid].limit ?? 0) + amount;
      await db.write(global.db).catch(() => {});
      const targetNum = jid.split("@")[0];
      const resText = `–  *A D D  L I M I T*

┌  ◦  *Target* : @${targetNum}
│  ◦  *Added* : +${amount} Limit
└  ◦  *Total* : ${global.db.user[jid].limit} Limit`;
      ctx.reply(resText, {
        mentions: [jid]
      });
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
}, {
  name: "setlimit",
  aliases: ["setlmt"],
  description: "Set limit user ke nilai tertentu (Owner)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args || ctx.args.length < 2) {
        return ctx.reply(`–  *S E T  L I M I T*

┌  ◦  *Format* : ${ctx.prefix}setlimit <nomor> <jumlah>
└  ◦  *Example* : ${ctx.prefix}setlimit 628xxx 100`);
      }
      const jid = makeJid(ctx.args[0]);
      const amount = parseInt(ctx.args[1], 10);
      if (isNaN(amount) || amount < 0) return ctx.reply("❌ Jumlah limit tidak valid.");
      db.ensureUser(jid, jid.split("@")[0]);
      global.db.user[jid].limit = amount;
      await db.write(global.db).catch(() => {});
      const targetNum = jid.split("@")[0];
      const resText = `–  *S E T  L I M I T*

┌  ◦  *Target* : @${targetNum}
└  ◦  *Current Limit* : ${amount} Limit`;
      ctx.reply(resText, {
        mentions: [jid]
      });
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
}];