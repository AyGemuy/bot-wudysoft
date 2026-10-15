"use strict";
import crypto from "crypto";
import {
  generateWAMessageFromContent,
  prepareWAMessageMedia
} from "@whiskeysockets/baileys";

function getBizBinaryNode(interactiveMessage) {
  return {
    tag: "biz",
    attrs: {},
    content: [{
      tag: "interactive",
      attrs: {
        type: "native_flow",
        v: "1"
      },
      content: [{
        tag: "native_flow",
        attrs: {
          v: "9",
          name: "mixed"
        }
      }]
    }, {
      tag: "quality_control",
      attrs: {
        decision_id: crypto.randomUUID().replace(/-/g, ""),
        source_type: "third_party"
      },
      content: [{
        tag: "decision_source",
        attrs: {
          value: "df"
        }
      }]
    }]
  };
}
class A2UI {
  constructor({
    catalogId = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
    version = "v0.9"
  } = {}) {
    this._version = version;
    this._catalogId = catalogId;
    this._components = new Map();
    this._counter = 0;
    this._rootChildren = [];
  }
  #nextId(prefix) {
    return `${prefix}_${(this._counter++).toString(36)}`;
  }
  #reg(id, component, extra = {}) {
    id ??= this.#nextId(component.toLowerCase());
    if (id === "root") throw new Error(`Component id "root" is reserved for the implicit root wrapper`);
    if (this._components.has(id)) throw new Error(`Component id "${id}" already used`);
    this._components.set(id, {
      id: id,
      component: component,
      ...extra
    });
    return id;
  }
  text(text, {
    id,
    variant = "body"
  } = {}) {
    return this.#reg(id, "Text", {
      text: text,
      variant: variant
    });
  }
  image(url, {
    id,
    variant,
    fit = "cover"
  } = {}) {
    return this.#reg(id, "Image", {
      url: url,
      ...variant ? {
        variant: variant
      } : {},
      fit: fit
    });
  }
  video(url, {
    id
  } = {}) {
    return this.#reg(id, "Video", {
      url: url
    });
  }
  checkbox(label, {
    id,
    value = false
  } = {}) {
    return this.#reg(id, "CheckBox", {
      label: label,
      value: value
    });
  }
  textField(label, {
    id,
    variant = "text"
  } = {}) {
    return this.#reg(id, "TextField", {
      label: label,
      variant: variant
    });
  }
  button(childId, {
    id,
    variant = "primary",
    action
  } = {}) {
    if (!childId) throw new TypeError("button(childId) requires the id of a child component (e.g. from .text())");
    return this.#reg(id, "Button", {
      child: childId,
      variant: variant,
      ...action ? {
        action: action
      } : {}
    });
  }
  card(childId, {
    id
  } = {}) {
    return this.#reg(id, "Card", {
      child: childId
    });
  }
  modal(triggerId, contentId, {
    id
  } = {}) {
    if (!triggerId) throw new TypeError("modal(triggerId, contentId) requires the id of the trigger component");
    if (!contentId) throw new TypeError("modal(triggerId, contentId) requires the id of the content component");
    return this.#reg(id, "Modal", {
      trigger: triggerId,
      content: contentId
    });
  }
  raw(component, props = {}, {
    id
  } = {}) {
    if (typeof component !== "string" || !component) throw new TypeError("raw(component, props) requires a non-empty component type string");
    return this.#reg(id, component, props);
  }
  column(children = [], {
    id
  } = {}) {
    if (!children.length) throw new TypeError("column(children) requires at least one child id");
    return this.#reg(id, "Column", {
      children: children
    });
  }
  row(children = [], {
    id
  } = {}) {
    if (!children.length) throw new TypeError("row(children) requires at least one child id");
    return this.#reg(id, "Row", {
      children: children
    });
  }
  divider({
    id
  } = {}) {
    return this.#reg(id, "Divider", {});
  }
  choicePicker(label, options, {
    id,
    variant = "mutuallyExclusive",
    value,
    displayStyle = "checkbox",
    filterable = false
  } = {}) {
    if (!Array.isArray(options) || !options.length) {
      throw new TypeError("choicePicker(label, options) requires a non-empty options array of {label, value}");
    }
    return this.#reg(id, "ChoicePicker", {
      label: label,
      variant: variant,
      ...value !== undefined ? {
        value: value
      } : {},
      options: options,
      displayStyle: displayStyle,
      filterable: filterable
    });
  }
  root(children) {
    if (!Array.isArray(children) || !children.length) {
      throw new TypeError("root(children) requires a non-empty array of top-level component ids");
    }
    this._rootChildren = children;
    return this;
  }
  listCard({
    title,
    items,
    fallbackText,
    uuid = crypto.randomUUID()
  } = {}) {
    if (!title) throw new TypeError("listCard requires a title");
    if (!Array.isArray(items) || !items.length) {
      throw new TypeError("listCard requires a non-empty items array");
    }
    this._listCardPayload = {
      uuid: uuid,
      data: JSON.stringify({
        type: "list_card",
        title: title,
        fallback_text: fallbackText ?? "",
        items: items.map(it => ({
          asset_id: it.assetId ?? crypto.randomUUID().replace(/-/g, "").slice(0, 17),
          asset_type: it.assetType ?? "PRODUCT_ITEM",
          title: it.title,
          trailing_label: it.price ?? it.trailingLabel ?? "",
          trailing_emphasis: it.emphasis ?? "strong"
        }))
      }),
      type: "im_a2ui",
      fallback: fallbackText ?? ""
    };
    return this;
  }
  async send(client, jid, opts = {}) {
    return sendA2UIWidget(client, jid, {
      ...opts,
      a2ui: this
    });
  }
  #validateRefs(components) {
    const validIds = new Set(components.map(c => c.id));
    for (const c of components) {
      for (const key of ["child", "trigger", "content"]) {
        if (c[key] !== undefined && !validIds.has(c[key])) {
          throw new Error(`A2UI: component "${c.id}" (${c.component}) references unknown id "${c[key]}" via "${key}"`);
        }
      }
      if (Array.isArray(c.children)) {
        for (const childId of c.children) {
          if (!validIds.has(childId)) {
            throw new Error(`A2UI: component "${c.id}" (${c.component}) references unknown id "${childId}" in "children"`);
          }
        }
      }
    }
  }
  build({
    uuid = crypto.randomUUID(),
    surfaceId,
    type = "im_a2ui",
    wrapped = true
  } = {}) {
    if (this._listCardPayload) return this._listCardPayload;
    if (!this._rootChildren.length) throw new Error("Call root([...ids]) before build()");
    const root = {
      id: "root",
      component: "Column",
      children: this._rootChildren
    };
    const components = [root, ...this._components.values()];
    this.#validateRefs(components);
    const data = wrapped ? {
      version: this._version,
      createSurface: {
        surfaceId: surfaceId ?? `starcore-widget=${uuid}`,
        catalogId: this._catalogId,
        components: components
      }
    } : {
      components: components
    };
    return {
      uuid: uuid,
      data: JSON.stringify(data),
      type: type
    };
  }
}
async function sendA2UIWidget(client, jid, {
  a2ui,
  bodyText = "",
  footer = "",
  buttons = [],
  contextInfo = {},
  expiration,
  quoted,
  type = "im_a2ui",
  wrapped = true,
  singleScreen = false,
  header
} = {}) {
  if (!client) throw new Error("Socket is required");
  if (!(a2ui instanceof A2UI)) throw new TypeError("a2ui must be an A2UI instance");
  const nativeFlowMessage = buttons && buttons.length ? {
    buttons: buttons.map(b => ({
      name: b.name ?? "cta_url",
      buttonParamsJson: typeof b.params === "string" ? b.params : JSON.stringify(b.params ?? {})
    })),
    messageParamsJson: "{}",
    messageVersion: 1
  } : {
    messageParamsJson: ""
  };
  const headerMediaData = header?.image ? {
    image: header.image
  } : header?.video ? {
    video: header.video
  } : header?.document ? {
    document: header.document
  } : null;
  const headerBlock = {
    ...header?.title !== undefined ? {
      title: header.title
    } : {},
    ...header?.subtitle !== undefined ? {
      subtitle: header.subtitle
    } : {},
    hasMediaAttachment: !!headerMediaData,
    ...headerMediaData ? await prepareWAMessageMedia(headerMediaData, {
      upload: client.waUploadToServer
    }).catch(e => {
      if (String(e).includes("Invalid media type")) return headerMediaData;
      throw e;
    }) : {}
  };
  const interactiveMessage = singleScreen ? {
    nativeFlowMessage: nativeFlowMessage,
    bloksWidget: a2ui.build({
      type: type,
      wrapped: wrapped
    }),
    ...expiration || Object.keys(contextInfo).length ? {
      contextInfo: {
        ...expiration ? {
          expiration: expiration
        } : {},
        ...contextInfo
      }
    } : {}
  } : {
    header: headerBlock,
    body: {
      text: bodyText
    },
    ...footer ? {
      footer: {
        text: footer
      }
    } : {},
    nativeFlowMessage: nativeFlowMessage,
    bloksWidget: a2ui.build({
      type: type,
      wrapped: wrapped
    }),
    ...expiration || Object.keys(contextInfo).length ? {
      contextInfo: {
        ...expiration ? {
          expiration: expiration
        } : {},
        ...contextInfo
      }
    } : {}
  };
  const msg = generateWAMessageFromContent(jid, {
    messageContextInfo: {
      messageSecret: crypto.randomBytes(32)
    },
    interactiveMessage: interactiveMessage
  }, {
    quoted: quoted
  });
  await client.relayMessage(msg.key.remoteJid, msg.message, {
    messageId: msg.key.id,
    additionalNodes: [getBizBinaryNode(msg.message)]
  });
  return msg;
}
export {
  A2UI,
  sendA2UIWidget,
  getBizBinaryNode
};