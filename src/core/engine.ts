import { HtmlToPdfOptions } from "./types";
import { HtmlRenderer } from "./renderer";
import { LayoutEngine } from "./layout-engine";
import { PdfWriter } from "./pdf-writer";
import { AssetInliner } from "./asset-inliner";
import { HeaderFooterPlugin } from "../plugins/header-footer.plugin";

export class HtmlToPdfEngine {
  private element?: HTMLElement;
  private options: HtmlToPdfOptions;

  constructor(options: HtmlToPdfOptions = {}) {
    this.options = {
      margin: options.margin ?? 10,
      dpi: options.dpi ?? 96,
      format: options.format ?? "A4",
      orientation: options.orientation ?? "portrait",
      debug: options.debug ?? false,
      plugins: options.plugins ?? []
    };
  }

  setOptions(options: HtmlToPdfOptions) {
    this.options = { ...this.options, ...options };
    return this;
  }

  setFormat(format: HtmlToPdfOptions["format"]) {
    this.options.format = format;
    return this;
  }

  setDpi(dpi: number) {
    this.options.dpi = dpi;
    return this;
  }

  addPlugin(name: string) {
    this.options.plugins?.push(name);
    return this;
  }

  async fromElement(element: HTMLElement) {
    this.element = element;

    if (!element) throw new Error("❌ No DOM element provided to HtmlToPdfEngine.");

    const { debug } = this.options;

    if (debug) console.log("🔧 Running asset inlining...");

    // ---- STEP 1: Inline fonts/images/css ----
    const inliner = new AssetInliner(element);
    const processedElement = await inliner.inline();

    if (debug) console.log("🎨 Rendering element to canvas...");

    // ---- STEP 2: Render DOM to canvas ----
    const renderer = new HtmlRenderer(processedElement, this.options);
    const fullCanvas = await renderer.renderToCanvas();

    if (debug) console.log("📄 Splitting canvas into pages...");

    // ---- STEP 3: Split into PDF pages ----
    const layout = new LayoutEngine(this.options);
    let pages = layout.splitIntoPages(fullCanvas);

    // ---- STEP 3B: Apply header/footer plugin ----
    if (this.options.header || this.options.footer) {
      const hf = new HeaderFooterPlugin(this.options.header, this.options.footer);
      pages = hf.apply(pages);
    }

    if (debug) console.log(`📚 Total PDF pages: ${pages.length}`);

    // ---- STEP 4: Write PDF ----
    const writer = new PdfWriter();
    const pdfBlob = await writer.write(pages);

    if (debug) console.log("📦 PDF Ready");

    return {
      /**
       * Download as file
       */
      download: (fileName = "document.pdf") => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(pdfBlob);
        link.download = fileName;
        link.click();
      },

      /**
       * Get Blob for upload/email
       */
      blob: () => pdfBlob,

      /**
       * Get Base64 string
       */
      base64: () =>
        new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(pdfBlob);
        })
    };
  }
}
