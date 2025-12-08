import { HtmlToPdfOptions } from "./types";
import { AssetInliner } from "./asset-inliner";

export class HtmlRenderer {
  private element: HTMLElement;
  private options: HtmlToPdfOptions;

  constructor(element: HTMLElement, options: HtmlToPdfOptions = {}) {
    this.element = element;
    this.options = {
      dpi: options.dpi ?? 96,
      debug: options.debug ?? false,
    };
  }

  /**
   * Converts the HTML element into a high-resolution canvas using
   * DOM → SVG → Image → Canvas technique.
   */
  async renderToCanvas(): Promise<HTMLCanvasElement> {
    const { dpi, debug } = this.options;

    const rect = this.element.getBoundingClientRect();
    const scale = dpi ? dpi / 96 : 1;

    const width = rect.width;
    const height = rect.height;

    if (debug) {
      console.log(`📐 Render width: ${width} height: ${height} scale: ${scale}`);
    }

    // ---- STEP 1: Serialize DOM as inline SVG ----
    const inliner = new AssetInliner(this.element);
    const sanitized = await inliner.inline();
    const serialized = new XMLSerializer().serializeToString(sanitized);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%" style="overflow: visible;">
          ${serialized}
        </foreignObject>
      </svg>
    `.trim();

    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    // ---- STEP 2: Load SVG into Image ----
    const img = await this.loadImage(svgUrl);

    // ---- STEP 3: Draw image onto canvas ----
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    // White background to avoid transparent PDF
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(img, 0, 0, width, height);

    // Cleanup
    URL.revokeObjectURL(svgUrl);

    return canvas;
  }

  /**
   * Helper to load image asynchronously
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }
}
