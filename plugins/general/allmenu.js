import axios from "axios";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
export default {
  name: "allmenu",
  aliases: ["all", "fitur", "helpall"],
  description: "Menampilkan semua command atau kategori spesifik via Interactive List CTA UI dengan Custom ID Card",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const categories = global.loader?.getCommandsByCategory?.() || {};
      const catName = (ctx.args?.[0] || ctx.query || "").trim().toLowerCase();
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || "Wudysoft • Multi-Device";
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const userData = global.db?.user?.[ctx.sender];
      const userNumber = ctx.sender.split("@")[0];
      const isOwner = userData?.ownerAcces === true || (global.bot?.owner || []).some(o => String(o).replace(/\D/g, "") === userNumber);
      const isPremium = userData?.premium?.status === true || isOwner;
      const userLevel = userData?.level || 1;
      const totalCommands = Object.values(categories).flat().length;
      let profilePic = global.bot?.media?.avatar || "https://i.pravatar.cc/400?img=58";
      try {
        profilePic = await sock.profilePictureUrl(ctx.sender, "image");
      } catch {}
      let mediaOutput = global.bot?.media?.banner1 || global.bot?.media?.thumb || global.bot?.media?.banner2;
      try {
        const idCardPayload = {
          header: "NEBULA MECHA",
          tooltip: isOwner ? "CLEARANCE: ROOT" : isPremium ? "CLEARANCE: VIP" : "CLEARANCE: ALPHA",
          avatar: profilePic,
          badge: isOwner ? "OWNER 👑" : isPremium ? "PREMIUM ⭐" : `LEVEL ${userLevel} 🎮`,
          info_pre: "✦ CATALOG ENGINE ✦",
          info_badge: `${totalCommands} CMDS`,
          name: (ctx.pushname || userNumber).slice(0, 20).toUpperCase(),
          badge_line: catName ? `CAT: ${catName.toUpperCase()}` : `${botName} CATALOG`,
          role: isOwner ? "SYSTEM ADMINISTRATOR" : isPremium ? "PREMIUM CITIZEN" : "STANDARD CITIZEN",
          email: `${userNumber}@whatsapp.net`,
          phone: `+${userNumber}`,
          pin: `TOTAL: ${Object.keys(categories).length} CATS`,
          valid: isOwner || isPremium ? "VALID: LIFETIME" : "VALID: 3025",
          clearance: isOwner ? "CLEARANCE: ROOT" : `CLEARANCE: NEB-${userLevel}`,
          mag: isOwner || isPremium ? "LIMIT: INF" : `LIMIT: ${userData?.limit ?? global.bot?.defaultLimit ?? 20}`,
          model: Math.floor(Math.random() * 4) + 1
        };
        const {
          data
        } = await axios({
          method: "POST",
          url: `${global.bot?.api?.wudysoft}/api/maker/id/v1`,
          data: idCardPayload,
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
          },
          timeout: 15e3
        });
        if (data) {
          mediaOutput = Buffer.from(data);
        }
      } catch (err) {
        console.warn("[Allmenu ID Card Fail, fallback to default banner]:", err.message);
      }
      const baseContextInfo = {
        mentionedJid: [ctx.sender],
        ...global.bot?.utils?.contextInfo || {
          forwardingScore: 999,
          isForwarded: true
        }
      };
      if (catName) {
        const matched = Object.keys(categories).find(k => k.toLowerCase() === catName);
        if (matched) {
          const cmds = categories[matched] || [];
          const commandRows = cmds.map(cmd => {
            const badges = [cmd.limit ? "[LIMIT]" : "", cmd.owner ? "[OWNER]" : "", cmd.premium ? "[PREM]" : ""].filter(Boolean).join(" ");
            return {
              title: `${prefix}${cmd.name} ${badges}`.trim(),
              id: `${prefix}${cmd.name}`,
              description: cmd.description || "Ketuk untuk menjalankan perintah ini"
            };
          });
          const cmdLines = cmds.map((c, idx) => {
            const isLast = idx === cmds.length - 1;
            const branch = isLast ? "└" : "│";
            const badges = [c.limit ? "Ⓛ" : "", c.owner ? "Ⓞ" : "", c.premium ? "Ⓟ" : ""].filter(Boolean).join("");
            const badgeStr = badges ? ` ${badges}` : "";
            return `${branch}  ◦  ${prefix}${c.name || c}${badgeStr}`;
          }).join("\n");
          const categoryTitle = matched.toUpperCase().split("").join(" ");
          const bodyText = `–  *I N F O*

┌  ◦  *Category* : ${matched.toUpperCase()}
│  ◦  *Total* : ${cmds.length} Perintah
└  ◦  *Prefix* : [ ${prefix} ]

–  *${categoryTitle}*

${cmdLines}

Ketik perintah di atas atau pilih langsung melalui tombol di bawah.`;
          const footerText = `${botFooter}`;
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `📜 PILIH FITUR (${cmds.length})`,
              sections: [{
                title: `${botName} • ${matched.toUpperCase()}`,
                rows: commandRows
              }]
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏠 Menu Utama",
              id: `${prefix}menu`
            })
          }];
          const options = {
            image: mediaOutput,
            title: `✦ ${botName} • ${matched.toUpperCase()} ✦`,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • ${matched.toUpperCase()}`,
                button_title: "Pilih Menu Perintah"
              },
              limited_time_offer: {
                text: `🔥 JELAJAHI FITUR ${matched.toUpperCase()} SEPUASNYA! 🔥`,
                url: channelUrl,
                copy_code: `${prefix}allmenu`,
                expiration_time: Date.now() + 2 * 3600 * 1e3
              }
            },
            contextInfo: baseContextInfo,
            quoted: quotedMsg
          };
          await ctx.sendCta(bodyText, footerText, buttons, options);
          return await ctx.react("✅");
        }
      }
      const sortedEntries = Object.entries(categories).sort();
      let catalogText = "";
      for (const [cat, cmds] of sortedEntries) {
        if (!cmds || cmds.length === 0) continue;
        const cmdLines = cmds.map((c, idx) => {
          const isLast = idx === cmds.length - 1;
          const branch = isLast ? "└" : "│";
          const cmdObj = typeof c === "object" ? c : {
            name: c
          };
          const badges = [cmdObj.limit ? "Ⓛ" : "", cmdObj.owner ? "Ⓞ" : "", cmdObj.premium ? "Ⓟ" : ""].filter(Boolean).join("");
          const badgeStr = badges ? ` ${badges}` : "";
          return `${branch}  ◦  ${prefix}${cmdObj.name}${badgeStr}`;
        }).join("\n");
        const catTitle = cat.toUpperCase().split("").join(" ");
        catalogText += `–  *${catTitle}*\n\n${cmdLines}\n\n`;
      }
      const bodyText = `“Hi @${userNumber}!
Berikut adalah seluruh daftar perintah yang tersedia di sistem kami.”

–  *I N F O*

┌  ◦  *Name* : ${botName}
│  ◦  *Prefix* : [ ${prefix} ]
│  ◦  *Category* : ${sortedEntries.length} Kategori
└  ◦  *Commands* : ${totalCommands} Fitur

${catalogText.trim()}

–  *N O T E*

┌  ◦  Keterangan badge: Ⓛ = Limit, Ⓟ = Premium, Ⓞ = Owner.
└  ◦  Ketik *${prefix}owner* jika menemukan kendala.`;
      const footerText = `${botFooter}`;
      const catalogSections = [{
        title: `${botName} • PILIH KATEGORI`,
        rows: sortedEntries.map(([cat, cmds]) => ({
          title: `📁 ${cat.toUpperCase()}`,
          description: `Koleksi ${cmds.length} menu ${cat}`,
          id: `${prefix}allmenu ${cat}`
        }))
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📑 BUKA KATEGORI (${sortedEntries.length})`,
          sections: catalogSections
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏠 Menu Utama",
          id: `${prefix}menu`
        })
      }];
      const options = {
        image: mediaOutput,
        title: `✦ ${botName} • Full Catalog ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • All Features`,
            button_title: "Pilih Kategori Menu"
          },
          limited_time_offer: {
            text: `⚡ EVENT SPESIAL: AKSES ${totalCommands} FITUR BEBAS AKTIF ⚡`,
            url: channelUrl,
            copy_code: `${prefix}menu`,
            expiration_time: Date.now() + 4 * 3600 * 1e3
          }
        },
        contextInfo: baseContextInfo,
        quoted: quotedMsg
      };
      await ctx.sendCta(bodyText, footerText, buttons, options);
      await ctx.react("✅");
    } catch (e) {
      console.error("[ALLMENU ERROR]", e);
      await ctx.react("❌");
      ctx.reply(global.bot?.msg?.error || `❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};