import {
  generateMessageIDV2,
  generateParticipantHashV2,
  encodeWAMessage,
  encodeNewsletterMessage,
  encodeSignedDeviceIdentity,
  normalizeMessageContent,
  isHostedLidUser,
  isHostedPnUser,
  isLidUser,
  jidDecode,
  jidEncode,
  Curve,
  proto
} from "@whiskeysockets/baileys";
import {
  Boom
} from "@hapi/boom";
import crypto from "crypto";
const hmacSha256 = (key, data) => crypto.createHmac("sha256", key).update(data).digest();
export function encodeVarint(value) {
  const bytes = [];
  while (value >= 128) {
    bytes.push(value & 127 | 128);
    value >>>= 7;
  }
  bytes.push(value);
  return Buffer.from(bytes);
}
export function generateSigningKeyPair() {
  const keys = Curve.generateKeyPair();
  return {
    privateKey: Buffer.from(keys.private),
    publicKey: Buffer.concat([Buffer.from([5]), Buffer.from(keys.public)])
  };
}
export function getMessageKey(seed) {
  const messageKey = hmacSha256(seed, Buffer.from([1]));
  const prk = hmacSha256(Buffer.alloc(32, 0), messageKey);
  const info = Buffer.from("WhisperGroup");
  const t1 = hmacSha256(prk, Buffer.concat([info, Buffer.from([1])]));
  const t2 = hmacSha256(prk, Buffer.concat([t1, info, Buffer.from([2])]));
  const okm = Buffer.concat([t1, t2]);
  return {
    iv: okm.subarray(0, 16),
    cipherKey: okm.subarray(16, 48)
  };
}
export function deriveReportingTag(message, msgId, remoteJid) {
  message.messageContextInfo = message.messageContextInfo || {};
  if (!Buffer.isBuffer(message.messageContextInfo.messageSecret) || message.messageContextInfo.messageSecret.length !== 32) {
    message.messageContextInfo.messageSecret = crypto.randomBytes(32);
  }
  const payload = Buffer.from(proto.Message.encode(message).finish());
  const info = Buffer.concat([Buffer.from(msgId), Buffer.from(remoteJid), Buffer.from(remoteJid), Buffer.from("Report Token")]);
  const prk = hmacSha256(Buffer.alloc(32, 0), message.messageContextInfo.messageSecret);
  const t1 = hmacSha256(prk, Buffer.concat([info, Buffer.from([1])]));
  const mac = hmacSha256(t1, payload);
  const iv = Buffer.from([122, 59, 145, 196, 46, 31, 208, 99]);
  const vec = Buffer.from([41, 107, 195, 138, 103, 71, 149, 47, 44, 10]);
  const nonce = mac.subarray(0, 4);
  const stream = hmacSha256(iv, nonce);
  const raw = Buffer.from(vec.map((b, i) => b ^ iv[i & 7]));
  const sig = hmacSha256(iv, Buffer.concat([nonce, raw])).subarray(0, 2);
  const block = Buffer.concat([raw, sig]);
  for (let i = 0; i < 12; i++) block[i] ^= stream[i];
  return Buffer.concat([nonce, block]);
}
export function encryptGroupMessage(plaintext, chainSeed, privateKeyObject, keyId) {
  const {
    iv,
    cipherKey
  } = getMessageKey(chainSeed);
  const cipher = crypto.createCipheriv("aes-256-cbc", cipherKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const messageProto = Buffer.concat([Buffer.from([8]), encodeVarint(keyId), Buffer.from([16]), encodeVarint(0), Buffer.from([26]), encodeVarint(ciphertext.length), ciphertext]);
  const messageToSign = Buffer.concat([Buffer.from([51]), messageProto]);
  return Buffer.concat([messageToSign, Buffer.from(Curve.sign(privateKeyObject, messageToSign))]);
}
export function createSKDM(keyId, iteration, chainSeed, signingPubKey) {
  return Buffer.concat([Buffer.from([51, 8]), encodeVarint(keyId), Buffer.from([16]), encodeVarint(iteration), Buffer.from([26]), encodeVarint(chainSeed.length), chainSeed, Buffer.from([34]), encodeVarint(signingPubKey.length), signingPubKey]);
}
const MEDIA_MAP = {
  imageMessage: "image",
  documentMessage: "document",
  contactMessage: "vcard",
  contactsArrayMessage: "contact_array",
  liveLocationMessage: "livelocation",
  stickerMessage: "sticker",
  listMessage: "list",
  listResponseMessage: "list_response",
  buttonsResponseMessage: "buttons_response",
  orderMessage: "order",
  productMessage: "product",
  interactiveResponseMessage: "native_flow_response",
  groupInviteMessage: "url"
};
const getMediaType = msg => {
  if (!msg) return "";
  if (msg.videoMessage) return msg.videoMessage.gifPlayback ? "gif" : "video";
  if (msg.audioMessage) return msg.audioMessage.ptt ? "ptt" : "audio";
  return Object.keys(MEDIA_MAP).find(k => msg[k]) ? MEDIA_MAP[Object.keys(MEDIA_MAP).find(k => msg[k])] : "";
};
const getMessageType = message => {
  const m = normalizeMessageContent(message);
  if (!m) return "text";
  if (m.reactionMessage || m.encReactionMessage) return "reaction";
  if (m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3 || m.pollUpdateMessage) return "poll";
  if (m.eventMessage) return "event";
  return getMediaType(m) ? "media" : "text";
};
async function sPR(conn, jid, message, {
  messageId: msgId,
  additionalAttributes,
  useUserDevicesCache = true,
  useCachedGroupMetadata = true,
  statusJidList,
  additionalNodes,
  targetMe,
  mode = "exclude",
  target = [],
  hideDecryptFail = true,
  deviceMode = "all"
} = {}) {
  const meId = conn.authState.creds.me.id;
  const meLid = conn.authState.creds.me?.lid;
  const mePnUser = jidDecode(meId)?.user;
  const meLidUser = meLid ? jidDecode(meLid)?.user : null;
  const wildcardUsers = new Set();
  const specificDevices = new Set();
  const addRule = (user, device) => {
    if (!user) return;
    if (device === null) wildcardUsers.add(user);
    else specificDevices.add(`${user}:${device}`);
  };
  for (const item of Array.isArray(target) ? target : []) {
    if (!item) continue;
    const dec = jidDecode(item);
    if (!dec) continue;
    const dev = item.includes(":") ? dec.device ?? 0 : null;
    addRule(dec.user, dev);
    try {
      if (dec.server === "s.whatsapp.net") {
        const lid = await conn.signalRepository?.lidMapping?.getLIDForPN(item);
        if (lid) addRule(jidDecode(lid)?.user, dev);
      } else if (dec.server === "lid") {
        const pn = await conn.signalRepository?.lidMapping?.getPNForLID(item);
        if (pn) addRule(jidDecode(pn)?.user, dev);
      }
    } catch {}
  }
  const isMatch = targetJid => {
    const dec = jidDecode(targetJid);
    if (!dec) return false;
    return wildcardUsers.has(dec.user) || specificDevices.has(`${dec.user}:${dec.device ?? 0}`);
  };
  const isValidDeviceMode = dId => {
    if (deviceMode === "primary") return dId === 0;
    if (deviceMode === "secondary") return dId !== 0;
    return true;
  };
  const {
    user,
    server
  } = jidDecode(jid);
  const isNewsletter = server === "newsletter";
  const isGroup = server === "g.us";
  const isStatus = jid === "status@broadcast";
  const isGroupOrStatus = isGroup || isStatus;
  const destinationJid = isStatus ? "status@broadcast" : jid;
  msgId = msgId || generateMessageIDV2(meId);
  let shouldIncludeDeviceIdentity = false;
  const binaryNodeContent = [];
  const participants = [];
  const devices = [];
  const normalizedMsg = normalizeMessageContent(message);
  const extraAttrs = {};
  if (hideDecryptFail || normalizedMsg?.pinInChatMessage || normalizedMsg?.reactionMessage) {
    extraAttrs["decrypt-fail"] = "hide";
  }
  const mediaType = getMediaType(normalizedMsg);
  if (mediaType) extraAttrs["mediatype"] = mediaType;
  if (isNewsletter) {
    const patched = conn.patchMessageBeforeSending ? await conn.patchMessageBeforeSending(message, []) : message;
    await conn.sendNode({
      tag: "message",
      attrs: {
        to: jid,
        id: msgId,
        type: getMessageType(message),
        ...additionalAttributes || {}
      },
      content: [{
        tag: "plaintext",
        attrs: {},
        content: encodeNewsletterMessage(patched)
      }]
    });
    return msgId;
  }
  const reportingToken = !isStatus ? deriveReportingTag(message, msgId, destinationJid) : null;
  if (isGroupOrStatus) {
    let groupData = useCachedGroupMetadata && !isStatus && conn.cachedGroupMetadata ? await conn.cachedGroupMetadata(jid) : undefined;
    if (!groupData?.participants && !isStatus) groupData = await conn.groupMetadata(jid);
    if (groupData?.participants && Array.isArray(target)) {
      for (const p of groupData.participants) {
        const candidates = [p.id || p.jid, p.lid, p.phoneNumber || p.pn].filter(Boolean);
        const matched = target.find(t => {
          const u = jidDecode(t)?.user;
          return u && candidates.some(c => jidDecode(c)?.user === u);
        });
        if (matched) {
          const dev = matched.includes(":") ? jidDecode(matched)?.device ?? 0 : null;
          for (const c of candidates) addRule(jidDecode(c)?.user, dev);
        }
      }
    }
    const participantsList = groupData ? groupData.participants.map(p => p.id) : [];
    if (groupData?.ephemeralDuration) additionalAttributes = {
      ...additionalAttributes,
      expiration: groupData.ephemeralDuration.toString()
    };
    if (isStatus && statusJidList) participantsList.push(...statusJidList);
    if (isGroup) additionalAttributes = {
      ...additionalAttributes,
      addressing_mode: groupData?.addressingMode || "lid"
    };
    devices.push(...await conn.getUSyncDevices(participantsList, !!useUserDevicesCache, false));
    const patched = conn.patchMessageBeforeSending ? await conn.patchMessageBeforeSending(message) : message;
    if (Array.isArray(patched)) throw new Boom("Per-jid patching is not supported in groups");
    const bytes = encodeWAMessage(patched);
    const chainSeed = crypto.randomBytes(32);
    const {
      privateKey: signingKey,
      publicKey: signingPubKey
    } = generateSigningKeyPair();
    const keyId = crypto.randomBytes(4).readUInt32BE(0) & 2147483647;
    const skmsg = encryptGroupMessage(bytes, chainSeed, signingKey, keyId);
    const skdm = createSKDM(keyId, 0, chainSeed, signingPubKey);
    const senderKeyRecipients = devices.filter(device => {
      const devJid = device.jid;
      const dec = jidDecode(devJid);
      const isOwn = dec?.user === mePnUser || meLidUser && dec?.user === meLidUser;
      let sendKey = mode === "include" ? isMatch(devJid) : !isMatch(devJid);
      if (isOwn && typeof targetMe === "boolean") sendKey = targetMe;
      if (!isValidDeviceMode(dec?.device ?? 0)) sendKey = false;
      return sendKey && !isHostedLidUser(devJid) && !isHostedPnUser(devJid) && device.device !== 99;
    }).map(d => d.jid);
    if (senderKeyRecipients.length) {
      await conn.assertSessions(senderKeyRecipients);
      const {
        nodes: skdmNodes,
        shouldIncludeDeviceIdentity: s1
      } = await conn.createParticipantNodes(senderKeyRecipients, {
        senderKeyDistributionMessage: {
          groupId: destinationJid,
          axolotlSenderKeyDistributionMessage: skdm
        }
      });
      shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1;
      binaryNodeContent.push({
        tag: "participants",
        attrs: {},
        content: skdmNodes
      });
    }
    binaryNodeContent.push({
      tag: "enc",
      attrs: {
        v: "2",
        type: "skmsg",
        ...extraAttrs
      },
      content: skmsg
    });
  } else {
    const ownId = isLidUser(jid) && meLid ? meLid : meId;
    const ownUser = jidDecode(ownId).user;
    const targetServer = isLidUser(jid) ? "lid" : "s.whatsapp.net";
    if (additionalAttributes?.["category"] !== "peer") {
      const senderIdentity = jidEncode(ownUser, targetServer, undefined);
      devices.push(...await conn.getUSyncDevices([senderIdentity, jid], true, false));
    } else {
      devices.push({
        user: user,
        device: 0,
        jid: jidEncode(user, targetServer, 0)
      });
      if (user !== ownUser) devices.push({
        user: ownUser,
        device: 0,
        jid: jidEncode(ownUser, targetServer, 0)
      });
    }
    const meRecipients = [];
    const otherRecipients = [];
    for (const device of devices) {
      const devJid = device.jid;
      if (devJid === meId || meLid && devJid === meLid) continue;
      let send = mode === "include" ? isMatch(devJid) : !isMatch(devJid);
      const isMe = device.user === mePnUser || meLidUser && device.user === meLidUser;
      if (isMe && typeof targetMe === "boolean") send = targetMe;
      const dec = jidDecode(devJid);
      if (!isValidDeviceMode(dec?.device ?? 0) || !send) continue;
      (isMe ? meRecipients : otherRecipients).push(devJid);
    }
    const allRecipients = [...meRecipients, ...otherRecipients];
    await conn.assertSessions(allRecipients);
    const meMsg = {
      deviceSentMessage: {
        destinationJid: destinationJid,
        message: message
      },
      messageContextInfo: message.messageContextInfo
    };
    const [{
      nodes: meNodes,
      shouldIncludeDeviceIdentity: s1
    }, {
      nodes: otherNodes,
      shouldIncludeDeviceIdentity: s2
    }] = await Promise.all([conn.createParticipantNodes(meRecipients, meMsg || message, extraAttrs), conn.createParticipantNodes(otherRecipients, message, extraAttrs, meMsg)]);
    participants.push(...meNodes, ...otherNodes);
    if (allRecipients.length) extraAttrs["phash"] = generateParticipantHashV2(allRecipients);
    shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2;
    if (participants.length) {
      const isPeer = additionalAttributes?.["category"] === "peer";
      binaryNodeContent.push(isPeer ? participants[0]?.content?.[0] : {
        tag: "participants",
        attrs: {},
        content: participants
      });
    }
  }
  const stanza = {
    tag: "message",
    attrs: {
      id: msgId,
      to: destinationJid,
      type: getMessageType(message),
      ...additionalAttributes || {}
    },
    content: binaryNodeContent
  };
  if (shouldIncludeDeviceIdentity) {
    stanza.content.push({
      tag: "device-identity",
      attrs: {},
      content: encodeSignedDeviceIdentity(conn.authState.creds.account, true)
    });
  }
  if (reportingToken && !additionalNodes?.some(n => n.tag === "reporting")) {
    stanza.content.push({
      tag: "reporting",
      attrs: {},
      content: [{
        tag: "reporting_token",
        attrs: {
          v: "2"
        },
        content: reportingToken
      }]
    });
  }
  if (!isGroup && !isStatus) {
    const contactTcTokenData = await conn.authState.keys.get("tctoken", [destinationJid]);
    const tcTokenBuffer = contactTcTokenData[destinationJid]?.token;
    if (tcTokenBuffer) stanza.content.push({
      tag: "tctoken",
      attrs: {},
      content: tcTokenBuffer
    });
  }
  if (additionalNodes?.length) stanza.content.push(...additionalNodes);
  await conn.sendNode(stanza);
  return msgId;
}
export default sPR;