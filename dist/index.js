"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  HtmlToPdfEngine: () => HtmlToPdfEngine,
  registerPlugin: () => registerPlugin
});
module.exports = __toCommonJS(index_exports);

// src/core/renderer.ts
var RendererV5 = class {
  constructor(root, options = {}) {
    this.root = root;
    this.options = {
      dpi: options.dpi ?? 96,
      debug: options.debug ?? false
    };
  }
  // -------------------------------------------------------------
  // Main API
  // -------------------------------------------------------------
  async renderToCanvas() {
    const { dpi = 96, debug } = this.options;
    const scale = dpi / 96;
    const rect = this.root.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0) {
      throw new Error("RendererV5: Element has zero size.");
    }
    if (debug) {
      console.log("\u{1F4D0} RenderV5 size:", { width, height, scale });
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    await this.renderNode(ctx, this.root, 0, 0);
    return canvas;
  }
  // -------------------------------------------------------------
  // Render a node
  // -------------------------------------------------------------
  async renderNode(ctx, node, offsetX, offsetY) {
    if (!(node instanceof HTMLElement)) return;
    const style = getComputedStyle(node);
    if (style.display === "none") return;
    if (style.visibility === "hidden") return;
    const rect = node.getBoundingClientRect();
    const x = rect.left - this.root.getBoundingClientRect().left + offsetX;
    const y = rect.top - this.root.getBoundingClientRect().top + offsetY;
    const w = rect.width;
    const h = rect.height;
    if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)") {
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(x, y, w, h);
    }
    const bg = style.backgroundImage;
    if (bg && bg !== "none" && bg.includes("data:")) {
      const url = bg.slice(5, -2);
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, x, y, w, h);
          resolve();
        };
        img.src = url;
      });
    }
    this.drawBorders(ctx, style, x, y, w, h);
    if (node.childNodes.length > 0) {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          this.drawText(ctx, child.textContent ?? "", style, x, y, w);
        }
      }
    }
    if (node.tagName === "IMG") {
      const el = node;
      if (el.src.startsWith("data:")) {
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, x, y, w, h);
            resolve();
          };
          img.src = el.src;
        });
      }
      return;
    }
    const children = Array.from(node.children);
    for (const child of children) {
      await this.renderNode(ctx, child, offsetX, offsetY);
    }
  }
  // -------------------------------------------------------------
  // Draw text
  // -------------------------------------------------------------
  drawText(ctx, text, style, x, y, maxWidth) {
    if (!text.trim()) return;
    const fontWeight = style.fontWeight || "normal";
    const fontSize = style.fontSize || "16px";
    const fontFamily = style.fontFamily || "sans-serif";
    ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
    ctx.fillStyle = style.color || "#000";
    const lineHeight = parseFloat(style.lineHeight || "20");
    let cursorY = y + lineHeight;
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth) {
        ctx.fillText(line, x, cursorY);
        line = word;
        cursorY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, cursorY);
  }
  // -------------------------------------------------------------
  // Draw borders
  // -------------------------------------------------------------
  drawBorders(ctx, style, x, y, w, h) {
    const borderWidth = parseFloat(style.borderWidth || "0");
    if (borderWidth <= 0) return;
    ctx.strokeStyle = style.borderColor || "#000";
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(x, y, w, h);
  }
};

// src/core/layout-engine.ts
var LayoutEngine = class {
  constructor(options = {}) {
    this.options = options;
    const dpi = options.dpi ?? 96;
    const format = options.format ?? "A4";
    const marginMm = options.margin ?? 10;
    const marginPx = marginMm * (dpi / 25.4);
    this.pageWidthPx = this.mmToPx(this.getPageFormat(format).widthMm, dpi) - marginPx * 2;
    this.pageHeightPx = this.mmToPx(this.getPageFormat(format).heightMm, dpi) - marginPx * 2;
    const headerHeightPx = options.header?.height ? this.mmToPx(options.header.height, dpi) : 0;
    const footerHeightPx = options.footer?.height ? this.mmToPx(options.footer.height, dpi) : 0;
    this.pageHeightPx -= headerHeightPx + footerHeightPx;
    if (this.pageWidthPx <= 0 || this.pageHeightPx <= 0) {
      throw new Error(
        "\u274C Computed page size is invalid. Check margin/header/footer sizes relative to the selected format."
      );
    }
  }
  mmToPx(mm, dpi) {
    return mm * (dpi / 25.4);
  }
  /** Standard PDF page definition */
  getPageFormat(format) {
    const formats = {
      A4: { widthMm: 210, heightMm: 297 },
      Letter: { widthMm: 216, heightMm: 279 },
      Legal: { widthMm: 216, heightMm: 356 }
    };
    return formats[format] ?? formats["A4"];
  }
  /**
   * Split a long canvas into multiple pages
   */
  splitIntoPages(sourceCanvas) {
    const pages = [];
    const totalHeight = sourceCanvas.height;
    let yOffset = 0;
    let pageNumber = 1;
    while (yOffset < totalHeight) {
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = this.pageWidthPx;
      pageCanvas.height = this.pageHeightPx;
      const ctx = pageCanvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        sourceCanvas,
        0,
        yOffset,
        // Source start
        this.pageWidthPx,
        this.pageHeightPx,
        // Crop size
        0,
        0,
        // Target position
        this.pageWidthPx,
        this.pageHeightPx
        // Target size
      );
      pages.push({ pageNumber, canvas: pageCanvas });
      yOffset += this.pageHeightPx;
      pageNumber++;
    }
    return pages;
  }
};

// src/utils/image-utils.ts
function base64ToBinary(base64) {
  const raw = atob(base64.split(",")[1]);
  const len = raw.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) buffer[i] = raw.charCodeAt(i);
  return buffer;
}

// src/core/pdf-writer.ts
var PdfWriter = class {
  constructor() {
    this.objects = [];
    this.objectCount = 0;
  }
  addObject(content, isBinary = false, extraDict) {
    const id = ++this.objectCount;
    this.objects.push({ id, content, isBinary, extraDict });
    return id;
  }
  async write(pages) {
    this.objects = [];
    this.objectCount = 0;
    const pageObjectIds = [];
    const pagesRootId = this.addObject("", false);
    for (const page of pages) {
      const imgBase64 = page.canvas.toDataURL("image/jpeg", 0.92);
      const imgBinary = base64ToBinary(imgBase64);
      const objId = this.addObject(
        imgBinary,
        true,
        `/Width ${page.canvas.width} /Height ${page.canvas.height}`
      );
      const drawImage = `q ${page.canvas.width} 0 0 ${page.canvas.height} 0 0 cm /Img${objId} Do Q`;
      const contentStream = `<< /Length ${drawImage.length} >>
stream
${drawImage}
endstream`;
      const contentId = this.addObject(contentStream);
      const pageId = this.addObject(
        `<< /Type /Page /Parent ${pagesRootId} 0 R /Resources << /XObject << /Img${objId} ${objId} 0 R >> >> /MediaBox [0 0 ${page.canvas.width} ${page.canvas.height}] /Contents ${contentId} 0 R >>`
      );
      pageObjectIds.push(pageId);
    }
    const pagesRoot = this.objects.find((obj) => obj.id === pagesRootId);
    if (pagesRoot) {
      pagesRoot.content = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;
    }
    const catalogId = this.addObject(`<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`);
    let pdf = "%PDF-1.7\n";
    const xref = [0];
    let position = pdf.length;
    for (const obj of this.objects) {
      xref.push(position);
      pdf += `${obj.id} 0 obj
`;
      if (obj.isBinary) {
        const extra = obj.extraDict ? ` ${obj.extraDict}` : "";
        pdf += `<< /Length ${obj.content instanceof Uint8Array ? obj.content.length : 0} /Subtype /Image /Type /XObject /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode${extra} >>
stream
`;
        position = pdf.length;
        pdf += "BINARY_PLACEHOLDER";
        pdf += `
endstream
endobj
`;
      } else {
        pdf += `${obj.content}
endobj
`;
      }
      position = pdf.length;
    }
    const xrefStart = position;
    pdf += `xref
0 ${xref.length}
0000000000 65535 f 
`;
    xref.slice(1).forEach((offset) => {
      pdf += `${offset.toString().padStart(10, "0")} 00000 n 
`;
    });
    pdf += `trailer << /Size ${xref.length} /Root ${catalogId} 0 R >>
startxref
${xrefStart}
%%EOF`;
    const encoder = new TextEncoder();
    let pdfBytes = encoder.encode(pdf);
    const findPlaceholder = (buffer, pattern) => {
      for (let i = 0; i <= buffer.length - pattern.length; i++) {
        let found = true;
        for (let j = 0; j < pattern.length; j++) {
          if (buffer[i + j] !== pattern[j]) {
            found = false;
            break;
          }
        }
        if (found) return i;
      }
      return -1;
    };
    const placeholder = encoder.encode("BINARY_PLACEHOLDER");
    pages.forEach((_, i) => {
      const index = findPlaceholder(pdfBytes, placeholder);
      if (index !== -1) {
        const binary = base64ToBinary(pages[i].canvas.toDataURL("image/jpeg", 0.92));
        const before = pdfBytes.slice(0, index);
        const after = pdfBytes.slice(index + placeholder.length);
        const merged = new Uint8Array(before.length + binary.length + after.length);
        merged.set(before);
        merged.set(binary, before.length);
        merged.set(after, before.length + binary.length);
        pdfBytes = merged;
      }
    });
    return new Blob([pdfBytes], { type: "application/pdf" });
  }
};

// src/core/sanitizer.ts
var SanitizerV5_1 = class {
  // ----------------------------------------
  // Utility: allow XML namespace URLs
  // ----------------------------------------
  static isWhitelistedNamespace(url) {
    return this.NAMESPACE_WHITELIST.some((ns) => url.includes(ns));
  }
  static isSameOrigin(url) {
    if (this.isWhitelistedNamespace(url)) return true;
    try {
      const u = new URL(url, window.location.href);
      return u.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  // Entry point
  static async clean(root) {
    this.measureSize(root);
    await this.inlineImages(root);
    await this.inlineBackgrounds(root);
    await this.inlineFonts(root);
    this.stripSvgForeignObjects(root);
    this.replaceCanvas(root);
    this.stripFilters(root);
    this.stripRemainingUnsafe(root);
    return root;
  }
  // ----------------------------------------
  static measureSize(el) {
    const rect = el.getBoundingClientRect();
    el.dataset.htmlToPdfWidth = `${rect.width}`;
    el.dataset.htmlToPdfHeight = `${rect.height}`;
  }
  // ----------------------------------------
  static async inlineImages(root) {
    const imgs = Array.from(root.querySelectorAll("img"));
    for (const img of imgs) {
      if (!img.src) continue;
      if (img.src.startsWith("data:")) continue;
      if (!this.isSameOrigin(img.src)) {
        img.src = this.TRANSPARENT;
        continue;
      }
      try {
        img.crossOrigin = "anonymous";
        img.src = await this.fetchAsDataUrl(img.src);
      } catch {
        img.src = this.TRANSPARENT;
      }
    }
  }
  // ----------------------------------------
  static async inlineBackgrounds(root) {
    const nodes = Array.from(root.querySelectorAll("*"));
    const urlRegex = /url\(["']?([^"')]+)["']?\)/g;
    for (const node of nodes) {
      const style = getComputedStyle(node);
      const bg = style.backgroundImage;
      if (!bg || bg === "none") continue;
      const matches = [...bg.matchAll(urlRegex)];
      for (const match of matches) {
        const url = match[1];
        if (!url) continue;
        if (url.startsWith("data:")) continue;
        if (!this.isSameOrigin(url) && !this.isWhitelistedNamespace(url)) {
          node.style.backgroundImage = "none";
          continue;
        }
        try {
          const data = await this.fetchAsDataUrl(url);
          node.style.backgroundImage = bg.replace(match[0], `url("${data}")`);
        } catch {
          node.style.backgroundImage = "none";
        }
      }
    }
  }
  // ----------------------------------------
  static async inlineFonts(root) {
    const links = Array.from(document.querySelectorAll("link[rel='stylesheet']"));
    for (const link of links) {
      if (!link.href) continue;
      if (!this.isSameOrigin(link.href)) {
        continue;
      }
      try {
        const css = await (await fetch(link.href)).text();
        const styleEl = document.createElement("style");
        styleEl.textContent = css;
        root.prepend(styleEl);
      } catch {
      }
    }
  }
  // ----------------------------------------
  static stripSvgForeignObjects(root) {
    const nodes = Array.from(
      root.querySelectorAll("svg image, svg use")
    );
    for (const el of nodes) {
      const href = el.href?.baseVal || el.getAttribute("href") || el.getAttribute("xlink:href");
      if (!href) continue;
      if (href.startsWith("#")) continue;
      if (!this.isSameOrigin(href) && !this.isWhitelistedNamespace(href)) {
        el.setAttribute("href", "");
        el.setAttribute("xlink:href", "");
      }
    }
  }
  // ----------------------------------------
  static replaceCanvas(root) {
    const cvs = Array.from(root.querySelectorAll("canvas"));
    for (const c of cvs) {
      let data;
      try {
        data = c.toDataURL("image/png");
      } catch {
        data = this.TRANSPARENT;
      }
      const img = document.createElement("img");
      img.src = data;
      img.width = c.width;
      img.height = c.height;
      img.style.width = c.style.width;
      img.style.height = c.style.height;
      c.replaceWith(img);
    }
  }
  // ----------------------------------------
  static stripFilters(root) {
    const nodes = Array.from(root.querySelectorAll("*"));
    for (const node of nodes) {
      const style = getComputedStyle(node);
      if (style.filter !== "none") node.style.filter = "none";
      if (style.backdropFilter !== "none") node.style.backdropFilter = "none";
      if (style.boxShadow !== "none") node.style.boxShadow = "none";
    }
  }
  // ----------------------------------------
  static stripRemainingUnsafe(root) {
    const nodes = Array.from(root.querySelectorAll("*"));
    for (const node of nodes) {
      const bg = getComputedStyle(node).backgroundImage;
      if (bg.includes("http") && !this.isWhitelistedNamespace(bg)) {
        node.style.backgroundImage = "none";
      }
      if (node.tagName === "IMG") {
        const img = node;
        if (img.src.startsWith("http") && !this.isWhitelistedNamespace(img.src)) {
          img.src = this.TRANSPARENT;
        }
      }
    }
  }
  // ----------------------------------------
  static async fetchAsDataUrl(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }
};
SanitizerV5_1.TRANSPARENT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAqMBgUr0YpIAAAAASUVORK5CYII=";
SanitizerV5_1.NAMESPACE_WHITELIST = [
  "w3.org/1999/xhtml",
  "w3.org/2000/svg",
  "w3.org/1999/xlink"
];

// src/plugins/header-footer.plugin.ts
var HeaderFooterPlugin = class {
  constructor(header, footer) {
    this.header = header;
    this.footer = footer;
  }
  apply(pages) {
    const totalPages = pages.length;
    pages.forEach((page, index) => {
      const ctx = page.canvas.getContext("2d");
      const pageNumber = index + 1;
      const { width, height } = page.canvas;
      if (this.header) {
        this.header.render(ctx, pageNumber, totalPages, width, height);
      }
      if (this.footer) {
        this.footer.render(ctx, pageNumber, totalPages, width, height);
      }
    });
    return pages;
  }
};

// src/core/engine.ts
var HtmlToPdfEngine = class {
  constructor(options = {}) {
    this.options = {
      margin: options.margin ?? 10,
      dpi: options.dpi ?? 96,
      format: options.format ?? "A4",
      orientation: options.orientation ?? "portrait",
      debug: options.debug ?? false,
      plugins: options.plugins ?? [],
      header: options.header,
      footer: options.footer
    };
  }
  // --------------------------------------------------------
  // PUBLIC API: Convert DOM → PDF
  // --------------------------------------------------------
  async fromElement(element) {
    const { debug } = this.options;
    if (!element) throw new Error("\u274C HtmlToPdfEngine: No DOM element provided.");
    if (debug) console.log("\u{1F9E9} Cloning DOM element...");
    const clone = element.cloneNode(true);
    if (debug) console.log("\u{1F9FC} Sanitizing DOM...");
    const cleanDom = await SanitizerV5_1.clean(clone);
    if (debug) console.log("\u{1F4D0} Measuring layout in sandbox...");
    const sandbox = document.createElement("div");
    sandbox.style.cssText = `
      position: fixed;
      left: -99999px;
      top: 0;
      z-index: -1;
      opacity: 0;
      pointer-events: none;
      width: auto;
      height: auto;
    `;
    document.body.appendChild(sandbox);
    sandbox.appendChild(cleanDom);
    await new Promise((r) => requestAnimationFrame(r));
    const rect = cleanDom.getBoundingClientRect();
    if (debug) console.log("\u{1F4CF} Measured size:", { width: rect.width, height: rect.height });
    if (rect.width === 0 || rect.height === 0) {
      sandbox.remove();
      throw new Error(
        "\u274C HtmlToPdfEngine: Element has zero width/height. Ensure it is visible before converting."
      );
    }
    if (debug) console.log("\u{1F3A8} Rendering sanitized DOM to canvas...");
    const renderer = new RendererV5(cleanDom, this.options);
    const fullCanvas = await renderer.renderToCanvas();
    sandbox.remove();
    if (fullCanvas.width === 0 || fullCanvas.height === 0) {
      throw new Error("\u274C Render failed: Canvas produced zero size.");
    }
    if (debug) console.log("\u{1F4C4} Splitting canvas into pages...");
    const layout = new LayoutEngine(this.options);
    let pages = layout.splitIntoPages(fullCanvas);
    if (this.options.header || this.options.footer) {
      if (debug) console.log("\u{1F4DD} Applying header/footer plugin...");
      const hf = new HeaderFooterPlugin(this.options.header, this.options.footer);
      pages = hf.apply(pages);
    }
    if (debug) console.log(`\u{1F4DA} Total pages generated: ${pages.length}`);
    const writer = new PdfWriter();
    const pdfBlob = await writer.write(pages);
    if (debug) console.log("\u{1F4E6} PDF ready");
    return {
      download: (fileName = "document.pdf") => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(pdfBlob);
        a.download = fileName;
        a.click();
      },
      blob: () => pdfBlob,
      base64: () => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(pdfBlob);
      })
    };
  }
};

// src/plugins/registry.ts
var registeredPlugins = /* @__PURE__ */ new Map();
function registerPlugin(plugin) {
  registeredPlugins.set(plugin.name, plugin);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HtmlToPdfEngine,
  registerPlugin
});
