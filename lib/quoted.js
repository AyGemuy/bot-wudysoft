import "../core/config.js";
const getBaseKey = () => ({
  participant: "13135550002@s.whatsapp.net",
  remoteJid: "status@broadcast"
});
export const metaQuoted = ctx => {
  const name = ctx?.pushname || ctx?.getName?.() || "User";
  return {
    key: {
      participant: "13135550002@s.whatsapp.net",
      remoteJid: "status@broadcast"
    },
    message: {
      contactMessage: {
        displayName: name,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${name};;;\nFN:${name}\nTEL;waid=13135550002:+13135550002\nEND:VCARD`
      }
    }
  };
};
export const textQuoted = ctx => {
  return {
    key: getBaseKey(),
    message: {
      conversation: `Hai ${ctx?.pushname || ctx?.getName?.() || "User"} 👋`
    }
  };
};
export const contactQuoted = ctx => {
  const botName = global.bot?.name || "Bot";
  const botNum = global.bot?.author?.number || "628000000000";
  return {
    key: getBaseKey(),
    message: {
      contactMessage: {
        displayName: "─ " + botName,
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${botName};;;\nFN:${botName}\nitem1.TEL;waid=${botNum}:+${botNum}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
        sendEphemeral: true
      }
    }
  };
};
export const locationQuoted = ctx => {
  return {
    key: getBaseKey(),
    message: {
      locationMessage: {
        name: `📍 Hai ${ctx?.pushname || ctx?.getName?.() || "User"}`,
        jpegThumbnail: ""
      }
    }
  };
};
export const extendedQuoted = ctx => {
  return {
    key: getBaseKey(),
    message: {
      extendedTextMessage: {
        text: `Powered by ${global.bot?.name || "Bot"}`,
        title: `${global.bot?.name || "Bot"} WhatsApp Assistant`,
        description: `Halo ${ctx?.pushname || ctx?.getName?.() || "User"}, ada yang bisa saya bantu?`,
        matchedText: "https://whatsapp.com",
        previewType: "NONE",
        renderLargerThumbnail: false
      }
    }
  };
};
export const documentQuoted = ctx => {
  return {
    key: getBaseKey(),
    message: {
      documentMessage: {
        title: `${global.bot?.name || "Bot"}.pdf`,
        fileName: `${global.bot?.name || "Bot"} - Assistant.pdf`,
        mimetype: "application/pdf",
        pageCount: 100,
        fileLength: "999999999999",
        jpegThumbnail: ""
      }
    }
  };
};
export const orderQuoted = ctx => {
  return {
    key: getBaseKey(),
    message: {
      orderMessage: {
        orderId: "BOT-" + Date.now(),
        thumbnail: "",
        itemCount: 1,
        status: "INQUIRY",
        surface: "CATALOG",
        message: `${global.bot?.name || "Bot"} Service`,
        orderTitle: `Notification for ${ctx?.pushname || ctx?.getName?.() || "User"}`,
        sellerJid: "0@s.whatsapp.net",
        token: "AR4+",
        totalAmount1000: "5000000",
        totalCurrencyCode: "IDR"
      }
    }
  };
};
export const productQuoted = ctx => {
  return {
    key: getBaseKey(),
    message: {
      productMessage: {
        product: {
          productImage: {
            mimetype: "image/jpeg",
            jpegThumbnail: ""
          },
          productId: "BOT-" + Math.floor(Math.random() * 1e4),
          title: `Service by ${global.bot?.name || "Bot"}`,
          description: `Halo ${ctx?.pushname || ctx?.getName?.() || "User"}!`,
          currencyCode: "IDR",
          priceAmount1000: "0",
          retailerId: global.bot?.name || "Bot",
          url: "https://whatsapp.com",
          productImageCount: 1
        },
        businessOwnerJid: "0@s.whatsapp.net"
      }
    }
  };
};
export const liveLocationQuoted = ctx => {
  return {
    key: getBaseKey(),
    message: {
      liveLocationMessage: {
        degreesLatitude: -6.2088,
        degreesLongitude: 106.8456,
        caption: `📌 Lokasi Aktif: ${global.bot?.name || "Bot"}`,
        sequenceNumber: "165723847289",
        timeOffset: 86400,
        jpegThumbnail: ""
      }
    }
  };
};
export const pollQuoted = ctx => {
  return {
    key: getBaseKey(),
    message: {
      pollCreationMessage: {
        name: `Halo ${ctx?.pushname || ctx?.getName?.() || "User"}!`,
        options: [{
          optionName: "Menu"
        }, {
          optionName: "Owner"
        }, {
          optionName: "Ping"
        }],
        selectableOptionsCount: 1
      }
    }
  };
};
export const simpleQuoted = ctx => {
  const quotedList = [metaQuoted, contactQuoted, locationQuoted, textQuoted, extendedQuoted, documentQuoted, orderQuoted, productQuoted, liveLocationQuoted, pollQuoted];
  const randomIndex = Math.floor(Math.random() * quotedList.length);
  return quotedList[randomIndex](ctx);
};