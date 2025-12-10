// -------------------------------------------------------------
// RendererV5.1 — foreignObject-free DOM → Canvas renderer
// -------------------------------------------------------------
// - Adds outer page margin (options.margin, in px)
// - Uses padding for text positioning (better buttons)
// - Still zero SVG / foreignObject → no canvas taint
// -------------------------------------------------------------

import { HtmlToPdfOptions } from "./types";

export class RendererV5 {
  private root: HTMLElement;
  private options: HtmlToPdfOptions;

  constructor(root: HTMLElement, options: HtmlToPdfOptions = {}) {
    this.root = root;
    this.options = {
      dpi: options.dpi ?? 96,
      debug: options.debug ?? false,
      margin: options.margin ?? 0,
    };
  }

  // -------------------------------------------------------------
  // Main API
  // -------------------------------------------------------------
  async renderToCanvas(): Promise<HTMLCanvasElement> {
    const { dpi = 96, debug, margin = 0 } = this.options;
    const scale = dpi / 96;

    // Measure root
    const rootRect = this.root.getBoundingClientRect();
    const width = rootRect.width;
    const height = rootRect.height;

    if (width === 0 || height === 0) {
      throw new Error("RendererV5: Element has zero size.");
    }

    // Add outer margin on all sides (in px)
    const marginPx = typeof margin === "number" ? margin : 0;
    const canvasWidth = Math.round((width + marginPx * 2) * scale);
    const canvasHeight = Math.round((height + marginPx * 2) * scale);

    if (debug) {
      console.log("📐 RenderV5.1 size:", {
        width,
        height,
        marginPx,
        scale,
        canvasWidth,
        canvasHeight,
      });
    }

    // Create target canvas
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width + marginPx * 2, height + marginPx * 2);

    // Render tree recursively, offset by margin
    await this.renderNode(ctx, this.root, marginPx, marginPx, rootRect);

    return canvas;
  }

  // -------------------------------------------------------------
  // Render a node
  // -------------------------------------------------------------
  private async renderNode(
    ctx: CanvasRenderingContext2D,
    node: Element,
    offsetX: number,
    offsetY: number,
    rootRect: DOMRect
  ) {
    if (!(node instanceof HTMLElement)) return;

    const style = getComputedStyle(node);

    // Skip hidden
    if (style.display === "none" || style.visibility === "hidden") return;

    const rect = node.getBoundingClientRect();

    // Position relative to root + page margin offsets
    const x = rect.left - rootRect.left + offsetX;
    const y = rect.top - rootRect.top + offsetY;
    const w = rect.width;
    const h = rect.height;

    // -------------------------
    // Draw background-color
    // -------------------------
    if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)") {
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(x, y, w, h);
    }

    // -------------------------
    // Draw background-image (dataURL only)
    // -------------------------
    const bg = style.backgroundImage;
    if (bg && bg !== "none" && bg.includes("data:")) {
      const urlMatch = bg.match(/url\(["']?(data:[^"')]+)["']?\)/);
      const url = urlMatch?.[1];

      if (url) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, x, y, w, h);
            resolve();
          };
          img.src = url;
        });
      }
    }

    // -------------------------
    // Draw borders
    // -------------------------
    this.drawBorders(ctx, style, x, y, w, h);

    // -------------------------
    // Draw text (respect padding)
    // -------------------------
    if (node.childNodes.length > 0) {
      const paddingLeft = parseFloat(style.paddingLeft || "0");
      const paddingRight = parseFloat(style.paddingRight || "0");
      const paddingTop = parseFloat(style.paddingTop || "0");
      const paddingBottom = parseFloat(style.paddingBottom || "0");

      const contentX = x + paddingLeft;
      const contentY = y + paddingTop;
      const contentWidth = w - paddingLeft - paddingRight;
      const contentHeight = h - paddingTop - paddingBottom;

      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          this.drawText(
            ctx,
            child.textContent ?? "",
            style,
            contentX,
            contentY,
            contentWidth,
            contentHeight
          );
        }
      }
    }

    // -------------------------
    // Draw images (already sanitized)
    // -------------------------
    if (node.tagName === "IMG") {
      const el = node as HTMLImageElement;

      if (el.src.startsWith("data:")) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, x, y, w, h);
            resolve();
          };
          img.src = el.src;
        });
      }
      return; // no children to render
    }

    // -------------------------
    // Recurse children
    // -------------------------
    const children = Array.from(node.children);
    for (const child of children) {
      await this.renderNode(ctx, child, offsetX, offsetY, rootRect);
    }
  }

  // -------------------------------------------------------------
  // Draw text with simple wrapping + padding
  // -------------------------------------------------------------
  private drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    style: CSSStyleDeclaration,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number
  ) {
    if (!text.trim()) return;

    const fontWeight = style.fontWeight || "normal";
    const fontSize = style.fontSize || "14px";
    const fontFamily = style.fontFamily || "system-ui, -apple-system, sans-serif";

    ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
    ctx.fillStyle = style.color || "#000000";

    const lineHeightPx =
      style.lineHeight && style.lineHeight !== "normal"
        ? parseFloat(style.lineHeight)
        : parseFloat(fontSize) * 1.4;

    const words = text.trim().split(/\s+/);
    let line = "";
    let cursorY = y + lineHeightPx; // first baseline

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line !== "") {
        // Draw current line
        ctx.fillText(line, x, cursorY);
        // Move to next line
        line = word;
        cursorY += lineHeightPx;

        // Stop if we exceed the content area
        if (cursorY - y > maxHeight) {
          return;
        }
      } else {
        line = testLine;
      }
    }

    if (line) {
      ctx.fillText(line, x, cursorY);
    }
  }

  // -------------------------------------------------------------
  // Draw borders (simple, uniform)
  // -------------------------------------------------------------
  private drawBorders(
    ctx: CanvasRenderingContext2D,
    style: CSSStyleDeclaration,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const borderWidth = parseFloat(style.borderWidth || "0");
    if (!borderWidth || borderWidth <= 0) return;

    ctx.strokeStyle = style.borderColor || "#e5e7eb"; // Tailwind gray-200-ish
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(x + borderWidth / 2, y + borderWidth / 2, w - borderWidth, h - borderWidth);
  }
}
