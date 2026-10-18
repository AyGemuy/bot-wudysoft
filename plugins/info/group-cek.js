import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const formatDate = timestamp => {
  if (!timestamp) return "-";
  return new Date(Number(timestamp) * 1e3).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

function escapeHTML(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  };
  const payload = {
    html: htmlContent,
    fullPage: true,
    quality: 100
  };
  const versions = ["v5", "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10"];
  for (const ver of versions) {
    try {
      const res = await axios.post(`${baseUrl}${ver}`, payload, {
        headers: headers,
        timeout: 16e3
      });
      const imgUrl = res.data?.url || res.data?.result || (typeof res.data === "string" ? res.data : null);
      if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
        let buffer = null;
        try {
          const imgRes = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 12e3
          });
          if (imgRes.data) buffer = Buffer.from(imgRes.data);
        } catch {}
        return {
          url: imgUrl,
          buffer: buffer
        };
      }
    } catch {
      continue;
    }
  }
  return {
    url: null,
    buffer: null
  };
}

function generateGroupCardHTML({
  subject,
  groupId,
  ownerNumber,
  creationDate,
  memberCount,
  adminCount,
  isAnnounce,
  isRestrict,
  isCommunity,
  desc,
  groupPic
}) {
  const cleanSubject = escapeHTML(subject);
  const cleanDesc = escapeHTML(desc.slice(0, 320) + (desc.length > 320 ? "..." : ""));
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --bg-dark: #07090e;
      --glass-surface: rgba(255, 255, 255, 0.035);
      --glass-border: rgba(255, 255, 255, 0.12);
      --glass-specular: inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 2px rgba(0, 0, 0, 0.5);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 900px;
      height: auto;
      background-color: var(--bg-dark);
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .canvas-wrapper {
      width: 900px;
      min-height: 600px;
      padding: 26px 24px 36px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      background: radial-gradient(circle at 50% 20%, #10192d 0%, #07090e 100%);
      overflow: hidden;
    }

    /* Ambient Liquid Blobs */
    .ambient-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.35;
      pointer-events: none;
      z-index: 1;
    }
    .blob-1 { width: 340px; height: 340px; background: radial-gradient(circle, #0070f3, #00dfd8); top: 10px; left: 10px; }
    .blob-2 { width: 380px; height: 380px; background: radial-gradient(circle, #7928ca, #ff0080); bottom: 10px; right: 10px; }

    /* Hero Profile Card */
    .hero-card {
      width: 100%;
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 28px;
      backdrop-filter: blur(20px);
      padding: 22px 28px;
      display: flex;
      align-items: center;
      gap: 22px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.6), var(--glass-specular);
      margin-bottom: 18px;
      z-index: 10;
    }
    .avatar-wrapper {
      width: 92px;
      height: 92px;
      border-radius: 50%;
      border: 3px solid #00dfd8;
      box-shadow: 0 0 20px rgba(0, 223, 216, 0.5);
      overflow: hidden;
      flex-shrink: 0;
      background: #111;
    }
    .group-avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .hero-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
      overflow: hidden;
    }
    .group-title {
      font-size: 24px;
      font-weight: 900;
      color: #fff;
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .badge-row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .id-capsule {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 4px 10px;
      border-radius: 8px;
      box-shadow: var(--glass-specular);
    }
    .community-pill {
      font-size: 11px;
      font-weight: 900;
      color: #07090e;
      background: linear-gradient(135deg, #00f2fe, #4facfe);
      padding: 4px 12px;
      border-radius: 9999px;
      letter-spacing: 0.5px;
    }

    /* Grid Metrik 6 Kolom */
    .metrics-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 18px;
      z-index: 10;
    }
    .metric-card {
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 18px;
      backdrop-filter: blur(15px);
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.4), var(--glass-specular);
    }
    .metric-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-value { font-size: 16px; font-weight: 900; color: #00dfd8; }
    .metric-value.highlight { color: #f1c40f; }

    /* Description Box */
    .desc-card {
      width: 100%;
      background: var(--glass-surface);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      backdrop-filter: blur(15px);
      padding: 16px 22px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.4), var(--glass-specular);
      z-index: 10;
    }
    .desc-header {
      font-size: 12px;
      font-weight: 900;
      color: #ffaa40;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .desc-body {
      font-size: 12px;
      font-weight: 600;
      color: #cbd5e1;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="canvas-wrapper">
    <div class="ambient-blob blob-1"></div>
    <div class="ambient-blob blob-2"></div>

    <!-- Hero Card -->
    <div class="hero-card">
      <div class="avatar-wrapper">
        <img class="group-avatar" src="${groupPic}" alt="" />
      </div>
      <div class="hero-meta">
        <div class="group-title">${cleanSubject}</div>
        <div class="badge-row">
          <div class="id-capsule">🆔 ${groupId}</div>
          <div class="community-pill">${isCommunity}</div>
        </div>
      </div>
    </div>

    <!-- Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">👥 Total Anggota</span>
        <span class="metric-value">${memberCount} Member</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">🛡️ Jumlah Admin</span>
        <span class="metric-value highlight">${adminCount} Admin</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">👑 Pembuat / Owner</span>
        <span class="metric-value">${ownerNumber !== "-" ? "@" + ownerNumber : "-"}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">📅 Dibuat Pada</span>
        <span class="metric-value" style="font-size: 13px;">${creationDate}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">💬 Kirim Pesan</span>
        <span class="metric-value">${isAnnounce}</span>
      </div>
      <div class="metric-card">
        <span class="metric-label">⚙️ Edit Info Grup</span>
        <span class="metric-value">${isRestrict}</span>
      </div>
    </div>

    <!-- Description Card -->
    <div class="desc-card">
      <div class="desc-header">📝 DESKRIPSI GRUP</div>
      <div class="desc-body">${cleanDesc || "Tidak ada deskripsi yang disetel."}</div>
    </div>
  </div>
</body>
</html>`;
}
async function sendCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  image = null,
  quoted = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Group Inspector`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    if (b.name === "cta_url") {
      return {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text || b.text || "Buka Tautan",
          url: b.url || ""
        })
      };
    }
    if (b.name === "cta_copy") {
      return {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text || b.text || "Salin",
          copy_code: b.copy_code || ""
        })
      };
    }
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text || b.text || "Klik",
        id: b.id || b.command || ""
      })
    };
  });
  const destJid = targetId || ctx?.id;
  const options = {
    jid: destJid,
    to: destJid,
    image: image || undefined,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Group Actions`,
        button_title: "Menu Aksi"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      mentionedJid: mentions || []
    },
    quoted: quoted || undefined
  };
  return await ctx.sendCta(text, finalFooter, formattedButtons, options);
}
export default {
  name: "cekgc",
  aliases: ["checkgc", "inspectgc", "infogc", "cekgroup", "inspect"],
  description: "Periksa detail dan informasi grup WhatsApp dengan visual Liquid Glass Dark",
  category: "Tools",
  limit: true,
  example: "inspect (di grup) atau inspect https://chat.whatsapp.com/xxx",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const queryText = (ctx.query || ctx.args?.join(" ") || "").trim();
      const quotedText = (ctx.quoted?.text || "").trim();
      const combinedText = `${queryText} ${quotedText}`.trim();
      let target = "";
      let inviteCode = "";
      let inviteLink = "";
      const match = combinedText.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i);
      if (match) {
        inviteCode = match[1];
        inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        target = inviteLink;
      } else if (queryText.endsWith("@g.us")) {
        target = queryText;
      } else if (ctx.isGroup || ctx.group || ctx.chat?.endsWith("@g.us") || ctx.id?.endsWith("@g.us")) {
        target = ctx.chat || ctx.id;
      }
      if (!target) {
        await ctx.react("❌");
        return ctx.reply(`❌ Masukkan link grup WhatsApp atau gunakan perintah ini langsung di dalam grup!\n\n` + `👉 *Contoh Link:* \`${prefix}inspect https://chat.whatsapp.com/xxx\`\n` + `👉 *Di Dalam Grup:* Cukup ketik \`${prefix}inspect\`\n` + `👉 *Reply Link:* Balas pesan berisi link lalu ketik \`${prefix}inspect\``);
      }
      let groupInfo = null;
      if (inviteCode) {
        groupInfo = await sock.groupGetInviteInfo(inviteCode).catch(() => {
          throw new Error("Tautan grup telah kedaluwarsa, direset, atau tidak valid.");
        });
      } else if (target.endsWith("@g.us")) {
        groupInfo = await sock.groupMetadata(target).catch(() => {
          throw new Error("Gagal mengambil metadata grup atau bot tidak berada di dalam grup tersebut.");
        });
        try {
          const code = await sock.groupInviteCode(target);
          if (code) inviteLink = `https://chat.whatsapp.com/${code}`;
        } catch (_) {
          inviteLink = groupInfo.desc?.match(/https:\/\/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i)?.[0] || "";
        }
      }
      if (!groupInfo) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mendapatkan informasi grup.");
      }
      const groupId = groupInfo.id || target || "-";
      const subject = groupInfo.subject || "Grup WhatsApp";
      const rawOwner = groupInfo.ownerPn || groupInfo.owner || groupInfo.subjectOwnerPn || groupInfo.subjectOwner || "-";
      const ownerNumber = rawOwner !== "-" ? rawOwner.split("@")[0].split(":")[0] : "-";
      const creationDate = formatDate(groupInfo.creation);
      const memberCount = groupInfo.size || groupInfo.participants?.length || 0;
      let adminCount = "-";
      if (Array.isArray(groupInfo.participants)) {
        adminCount = groupInfo.participants.filter(p => p.admin).length;
      }
      const isAnnounce = groupInfo.announce ? "🔒 Hanya Admin" : "🔓 Semua Peserta";
      const isRestrict = groupInfo.restrict ? "🔒 Hanya Admin" : "🔓 Semua Peserta";
      const isCommunity = groupInfo.isCommunity ? "🏢 Induk Komunitas" : groupInfo.linkedParent ? "👥 Sub-Komunitas" : "Regular Group";
      const desc = groupInfo.desc || "Tidak ada deskripsi yang disetel.";
      const mentions = [];
      if (ownerNumber !== "-" && /^\d+$/.test(ownerNumber)) {
        mentions.push(`${ownerNumber}@s.whatsapp.net`);
      }
      let groupPic = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      try {
        if (groupId !== "-") {
          groupPic = await sock.profilePictureUrl(groupId, "image");
        }
      } catch (_) {}
      const htmlContent = generateGroupCardHTML({
        subject: subject,
        groupId: groupId,
        ownerNumber: ownerNumber,
        creationDate: creationDate,
        memberCount: memberCount,
        adminCount: adminCount,
        isAnnounce: isAnnounce,
        isRestrict: isRestrict,
        isCommunity: isCommunity,
        desc: desc,
        groupPic: groupPic
      });
      const {
        buffer: imgBuffer
      } = await renderHtmlToImage(htmlContent);
      const bodyText = `🏷️ *WHATSAPP GROUP INSPECTOR*\n\n` + `• 📌 *Nama:* ${subject}\n` + `• 🆔 *ID:* \`${groupId}\`\n` + `• 👑 *Owner:* ${ownerNumber !== "-" ? `@${ownerNumber}` : "-"}\n` + `• 👥 *Anggota:* ${memberCount} Member (${adminCount} Admin)\n\n` + `_Detail selengkapnya tercantum pada kartu visual di atas._`;
      const buttons = [];
      if (inviteLink) {
        buttons.push({
          name: "cta_url",
          display_text: "🔗 Buka / Gabung Grup",
          url: inviteLink
        });
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Link Grup",
          copy_code: inviteLink
        });
      }
      buttons.push({
        name: "cta_copy",
        display_text: "🆔 Salin ID Grup",
        copy_code: groupId
      });
      buttons.push({
        name: "quick_reply",
        display_text: "🔍 Cari Grup Lain",
        id: `${prefix}gcsearch`
      });
      await sendCTA(sock, ctx, ctx.id, {
        text: bodyText,
        buttons: buttons,
        image: imgBuffer || groupPic,
        mentions: mentions,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Cek Group Gagal: ${error.message}`);
    }
  }
};