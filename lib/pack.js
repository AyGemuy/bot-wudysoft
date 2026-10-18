import crypto from "crypto";
import https from "https";
import JSZip from "jszip";
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  timeout: 45e3
});

function sha256(buffer) {
  try {
    return crypto.createHash("sha256").update(buffer).digest();
  } catch (err) {
    console.error("[sha256 Error]:", err?.message || err);
    throw err;
  }
}

function toB64Url(buffer) {
  try {
    return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch (err) {
    console.error("[toB64Url Error]:", err?.message || err);
    throw err;
  }
}
export function isWebP(buffer) {
  try {
    return Buffer.isBuffer(buffer) && buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  } catch {
    return false;
  }
}
export function isAnimatedWebP(buffer) {
  try {
    if (!isWebP(buffer)) return false;
    let offset = 12;
    while (offset < buffer.length - 8) {
      const chunk = buffer.toString("ascii", offset, offset + 4);
      const size = buffer.readUInt32LE(offset + 4);
      if (chunk === "VP8X" && buffer.length > offset + 8 && buffer[offset + 8] & 2) {
        return true;
      }
      if (chunk === "ANIM" || chunk === "ANMF") {
        return true;
      }
      offset += 8 + size + size % 2;
    }
    return false;
  } catch {
    return false;
  }
}
async function buildZip(files = []) {
  try {
    const zip = new JSZip();
    for (const file of files) {
      zip.file(file.name, Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data));
    }
    return await zip.generateAsync({
      type: "nodebuffer",
      compression: "STORE"
    });
  } catch (err) {
    console.error("[buildZip Error]:", err?.message || err);
    throw new Error(`Gagal membuat file arsip zip stiker: ${err?.message || err}`);
  }
}
async function uploadToServer(conn, buffer, {
  hkdf,
  mediaPath,
  mediaKey = crypto.randomBytes(32)
}) {
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Buffer untuk upload MMS tidak boleh kosong");
    }
    const expanded = Buffer.from(crypto.hkdfSync("sha256", mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112));
    const iv = expanded.subarray(0, 16);
    const cipherKey = expanded.subarray(16, 48);
    const macKey = expanded.subarray(48, 80);
    const cipher = crypto.createCipheriv("aes-256-cbc", cipherKey, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const mac = crypto.createHmac("sha256", macKey).update(iv).update(encrypted).digest().subarray(0, 10);
    const encBuffer = Buffer.concat([encrypted, mac]);
    const fileSha256 = sha256(buffer);
    const fileEncSha256 = sha256(encBuffer);
    const iq = await conn.query({
      tag: "iq",
      attrs: {
        id: conn.generateMessageTag?.() ?? Date.now().toString(),
        to: "s.whatsapp.net",
        type: "set",
        xmlns: "w:m"
      },
      content: [{
        tag: "media_conn",
        attrs: {}
      }]
    });
    const mediaConn = iq?.content?.find(v => v?.tag === "media_conn");
    if (!mediaConn) throw new Error("media_conn tidak ditemukan dari WhatsApp");
    const auth = mediaConn.attrs?.auth;
    if (!auth) throw new Error("auth token upload tidak ditemukan");
    const hosts = (mediaConn.content || []).filter(v => v?.tag === "host").map(v => v.attrs?.hostname).filter(Boolean);
    if (!hosts.length) throw new Error("Host upload MMS tidak ditemukan");
    const token = encodeURIComponent(toB64Url(fileEncSha256));
    let lastError = null;
    for (const host of hosts) {
      try {
        const json = await new Promise((resolve, reject) => {
          const url = new URL(`https://${host}${mediaPath}/${token}?auth=${encodeURIComponent(auth)}&token=${token}`);
          const req = https.request({
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: "POST",
            agent: httpsAgent,
            timeout: 45e3,
            headers: {
              Origin: "https://web.whatsapp.com",
              Referer: "https://web.whatsapp.com/",
              "Content-Type": "application/octet-stream",
              "Content-Length": encBuffer.length
            }
          }, res => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
              if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Upload MMS Gagal (${res.statusCode}): ${body}`));
              }
              try {
                resolve(JSON.parse(body));
              } catch {
                reject(new Error(`Respons MMS bukan JSON: ${body}`));
              }
            });
          });
          req.on("timeout", () => {
            req.destroy(new Error(`Timeout koneksi upload ke ${host}`));
          });
          req.on("error", reject);
          req.write(encBuffer);
          req.end();
        });
        const directPath = json?.direct_path || json?.directPath || json?.url || json?.path;
        if (!directPath) throw new Error("directPath tidak ditemukan di respons MMS");
        return {
          mediaKey: mediaKey,
          fileLength: buffer.length,
          fileSha256: fileSha256,
          fileEncSha256: fileEncSha256,
          directPath: directPath,
          ...json
        };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error("Semua endpoint host upload WhatsApp gagal");
  } catch (err) {
    console.error("[uploadToServer Error]:", err?.message || err);
    throw err;
  }
}
export async function stickerPack(sock, jid, stickers = [], options = {}) {
  try {
    if (!sock || typeof sock.relayMessage !== "function") {
      throw new Error("Parameter sock Baileys tidak valid");
    }
    if (!jid) {
      throw new Error("Target JID WhatsApp tidak valid");
    }
    if (!Array.isArray(stickers) || stickers.length === 0) {
      throw new Error("Daftar stiker tidak boleh kosong.");
    }
    const {
      name = "Auto Gen Pack",
        publisher = "WhatsApp Bot",
        description = "Generated Sticker Pack",
        maxPerPack = 30,
        maxPackBytes = 10 * 1024 * 1024,
        cover = null,
        trayIcon = null,
        delayMs = 1500,
        quoted = null
    } = options;
    const normalized = stickers.map(item => {
      if (Buffer.isBuffer(item)) {
        return {
          buffer: item,
          emoji: "✨",
          isAnimated: isAnimatedWebP(item)
        };
      }
      const buf = item.buffer;
      return {
        buffer: buf,
        emoji: item.emoji || "✨",
        isAnimated: item.isAnimated !== undefined ? item.isAnimated : isAnimatedWebP(buf)
      };
    });
    const chunks = [];
    let currentChunk = [];
    let currentChunkBytes = 0;
    for (const item of normalized) {
      const itemBytes = item.buffer.length;
      const isExceedCount = currentChunk.length >= maxPerPack;
      const isExceedSize = currentChunkBytes + itemBytes > maxPackBytes;
      if (currentChunk.length > 0 && (isExceedCount || isExceedSize)) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentChunkBytes = 0;
      }
      currentChunk.push(item);
      currentChunkBytes += itemBytes;
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    for (const chunk of chunks) {
      while (chunk.length < 3) {
        chunk.push({
          ...chunk[0]
        });
      }
    }
    const results = [];
    const usedCoverHashes = new Set();
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const packNumber = idx + 1;
      const totalPacks = chunks.length;
      const packLabel = totalPacks > 1 ? ` (${packNumber}/${totalPacks})` : "";
      const currentPackName = `${name}${packLabel}`;
      const zipFiles = [];
      const stickersMetadata = [];
      for (let i = 0; i < chunk.length; i++) {
        const item = chunk[i];
        const fileName = `${toB64Url(sha256(item.buffer))}.webp`;
        zipFiles.push({
          name: fileName,
          data: item.buffer
        });
        stickersMetadata.push({
          fileName: fileName,
          isAnimated: Boolean(item.isAnimated),
          emojis: Array.isArray(item.emoji) ? item.emoji : [item.emoji || "✨"],
          accessibilityLabel: `${currentPackName} ${i + 1}`,
          isLottie: false,
          mimetype: "image/webp"
        });
      }
      let trayBuffer = null;
      const customCover = cover || trayIcon;
      if (customCover) {
        if (Array.isArray(customCover)) {
          trayBuffer = customCover[idx] || customCover[0];
        } else if (Buffer.isBuffer(customCover)) {
          trayBuffer = customCover;
        }
      }
      if (!trayBuffer) {
        let candidate = chunk.find(s => {
          const hash = sha256(s.buffer).toString("hex");
          return !usedCoverHashes.has(hash) && !s.isAnimated;
        });
        if (!candidate) {
          candidate = chunk.find(s => !s.isAnimated);
        }
        if (!candidate) {
          candidate = chunk.find(s => {
            const hash = sha256(s.buffer).toString("hex");
            return !usedCoverHashes.has(hash);
          });
        }
        if (!candidate) {
          candidate = chunk[idx % chunk.length] || chunk[0];
        }
        trayBuffer = candidate.buffer;
        usedCoverHashes.add(sha256(trayBuffer).toString("hex"));
      }
      const trayIconFileName = "tray_icon.webp";
      zipFiles.push({
        name: trayIconFileName,
        data: trayBuffer
      });
      const archive = await buildZip(zipFiles);
      const packUpload = await uploadToServer(sock, archive, {
        hkdf: "WhatsApp Sticker Pack Keys",
        mediaPath: "/mms/sticker-pack"
      });
      const thumbUpload = await uploadToServer(sock, trayBuffer, {
        hkdf: "WhatsApp Sticker Pack Thumbnail Keys",
        mediaPath: "/mms/thumbnail-sticker-pack",
        mediaKey: packUpload.mediaKey
      });
      const packId = `Pack_${crypto.randomBytes(8).toString("hex")}`;
      const messageResponse = await sock.relayMessage(jid, {
        messageContextInfo: {
          messageSecret: crypto.randomBytes(32)
        },
        stickerPackMessage: {
          stickerPackId: packId,
          name: currentPackName,
          publisher: publisher,
          packDescription: description,
          stickers: stickersMetadata,
          fileLength: packUpload.fileLength,
          fileSha256: packUpload.fileSha256,
          fileEncSha256: packUpload.fileEncSha256,
          mediaKey: packUpload.mediaKey,
          directPath: packUpload.directPath,
          mediaKeyTimestamp: Math.floor(Date.now() / 1e3),
          stickerPackSize: packUpload.fileLength,
          stickerPackOrigin: 2,
          trayIconFileName: trayIconFileName,
          thumbnailDirectPath: thumbUpload.directPath,
          thumbnailSha256: thumbUpload.fileSha256,
          thumbnailEncSha256: thumbUpload.fileEncSha256,
          thumbnailHeight: 252,
          thumbnailWidth: 252,
          imageDataHash: thumbUpload.fileSha256.toString("base64")
        }
      }, {
        quoted: quoted
      });
      results.push(messageResponse);
      if (idx < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    return {
      status: true,
      total_packs: chunks.length,
      total_stickers: normalized.length,
      results: results
    };
  } catch (err) {
    console.error("[stickerPack Error]:", err?.message || err);
    throw err;
  }
}
export default {
  stickerPack: stickerPack,
  isWebP: isWebP,
  isAnimatedWebP: isAnimatedWebP
};