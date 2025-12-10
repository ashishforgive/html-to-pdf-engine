import { HtmlToPdfOptions } from "./types";

export interface PageCanvas {
  pageNumber: number;
  canvas: HTMLCanvasElement;
}

export class LayoutEngine {
  private options: HtmlToPdfOptions;
  private pageWidthPx: number;
  private pageHeightPx: number;

  constructor(options: HtmlToPdfOptions = {}) {
    this.options = options;

    const dpi = options.dpi ?? 96;
    const format = options.format ?? "A4";
    const marginMm = options.margin ?? 10;

    // Convert mm to pixels: px = mm * (dpi / 25.4)
    const marginPx = marginMm * (dpi / 25.4);

    this.pageWidthPx = this.mmToPx(this.getPageFormat(format).widthMm, dpi) - marginPx * 2;
    this.pageHeightPx = this.mmToPx(this.getPageFormat(format).heightMm, dpi) - marginPx * 2;

    const headerHeightPx = options.header?.height ? this.mmToPx(options.header.height, dpi) : 0;
    const footerHeightPx = options.footer?.height ? this.mmToPx(options.footer.height, dpi) : 0;

    this.pageHeightPx -= headerHeightPx + footerHeightPx;

    if (this.pageWidthPx <= 0 || this.pageHeightPx <= 0) {
      throw new Error(
        "❌ Computed page size is invalid. Check margin/header/footer sizes relative to the selected format."
      );
    }
  }

  private mmToPx(mm: number, dpi: number) {
    return mm * (dpi / 25.4);
  }

  /** Standard PDF page definition */
  private getPageFormat(format: string) {
    const formats: Record<string, { widthMm: number; heightMm: number }> = {
      A4: { widthMm: 210, heightMm: 297 },
      Letter: { widthMm: 216, heightMm: 279 },
      Legal: { widthMm: 216, heightMm: 356 },
    };
    return formats[format] ?? formats["A4"];
  }

  /**
   * Split a long canvas into multiple pages
   */
  splitIntoPages(sourceCanvas: HTMLCanvasElement): PageCanvas[] {
    const pages: PageCanvas[] = [];

    const totalHeight = sourceCanvas.height;
    let yOffset = 0;
    let pageNumber = 1;

    while (yOffset < totalHeight) {
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = this.pageWidthPx;
      pageCanvas.height = this.pageHeightPx;

      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      ctx.drawImage(
        sourceCanvas,
        0, yOffset, // Source start
        this.pageWidthPx, this.pageHeightPx, // Crop size
        0, 0, // Target position
        this.pageWidthPx, this.pageHeightPx // Target size
      );

      pages.push({ pageNumber, canvas: pageCanvas });

      yOffset += this.pageHeightPx;
      pageNumber++;
    }

    return pages;
  }
}
