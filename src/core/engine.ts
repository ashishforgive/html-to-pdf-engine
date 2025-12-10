// --------------------------------------------------------
// HtmlToPdfEngine v3.3 (Final Production Version)
// --------------------------------------------------------
// Pipeline:
// 1. Clone DOM
// 2. Sanitize deeply (SanitizerV5.1)
// 3. Attach to sandbox & measure layout
// 4. Render via RendererV4 (SVG → Image → Canvas)
// 5. Split pages
// 6. Apply header/footer
// 7. Write PDF
// --------------------------------------------------------

import { HtmlToPdfOptions } from "./types";
import { RendererV5 } from "./renderer";
import { LayoutEngine } from "./layout-engine";
import { PdfWriter } from "./pdf-writer";
import { SanitizerV5_1 } from "./sanitizer";
import { HeaderFooterPlugin } from "../plugins/header-footer.plugin";

export class HtmlToPdfEngine {
  private options: HtmlToPdfOptions;

  constructor(options: HtmlToPdfOptions = {}) {
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
  async fromElement(element: HTMLElement) {
    const { debug } = this.options;
    if (!element) throw new Error("❌ HtmlToPdfEngine: No DOM element provided.");

    if (debug) console.log("🧩 Cloning DOM element...");
    const clone = element.cloneNode(true) as HTMLElement;

    // --------------------------------------------------------
    // STEP 1: Sanitize (critical for taint-free canvas)
    // --------------------------------------------------------
    if (debug) console.log("🧼 Sanitizing DOM...");
    const cleanDom = await SanitizerV5_1.clean(clone);

    // --------------------------------------------------------
    // STEP 2: Measure layout inside sandbox
    // --------------------------------------------------------
    if (debug) console.log("📐 Measuring layout in sandbox...");

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

    // ensure browser applies layout
    await new Promise(r => requestAnimationFrame(r));

    const rect = cleanDom.getBoundingClientRect();

    if (debug) console.log("📏 Measured size:", { width: rect.width, height: rect.height });

    if (rect.width === 0 || rect.height === 0) {
      sandbox.remove();
      throw new Error(
        "❌ HtmlToPdfEngine: Element has zero width/height. Ensure it is visible before converting."
      );
    }

    // --------------------------------------------------------
    // STEP 3: Render sanitized DOM → Canvas
    // --------------------------------------------------------
    if (debug) console.log("🎨 Rendering sanitized DOM to canvas...");

    const renderer = new RendererV5(cleanDom, this.options);
    const fullCanvas = await renderer.renderToCanvas();

    // cleanup sandbox before proceeding
    sandbox.remove();

    if (fullCanvas.width === 0 || fullCanvas.height === 0) {
      throw new Error("❌ Render failed: Canvas produced zero size.");
    }

    // --------------------------------------------------------
    // STEP 4: Paginate
    // --------------------------------------------------------
    if (debug) console.log("📄 Splitting canvas into pages...");
    const layout = new LayoutEngine(this.options);
    let pages = layout.splitIntoPages(fullCanvas);

    // --------------------------------------------------------
    // STEP 5: Optional header/footer plugin
    // --------------------------------------------------------
    if (this.options.header || this.options.footer) {
      if (debug) console.log("📝 Applying header/footer plugin...");
      const hf = new HeaderFooterPlugin(this.options.header, this.options.footer);
      pages = hf.apply(pages);
    }

    if (debug) console.log(`📚 Total pages generated: ${pages.length}`);

    // --------------------------------------------------------
    // STEP 6: Write PDF
    // --------------------------------------------------------
    const writer = new PdfWriter();
    const pdfBlob = await writer.write(pages);

    if (debug) console.log("📦 PDF ready");

    // --------------------------------------------------------
    // RETURN API
    // --------------------------------------------------------
    return {
      download: (fileName = "document.pdf") => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(pdfBlob);
        a.download = fileName;
        a.click();
      },

      blob: () => pdfBlob,

      base64: () =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(pdfBlob);
        })
    };
  }
}
