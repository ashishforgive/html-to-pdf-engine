import type { PageCanvas } from "../core/layout-engine";
import type { HeaderFooterRender } from "../core/types";

export class HeaderFooterPlugin {
  private header?: HeaderFooterRender;
  private footer?: HeaderFooterRender;

  constructor(header?: HeaderFooterRender, footer?: HeaderFooterRender) {
    this.header = header;
    this.footer = footer;
  }

  apply(pages: PageCanvas[]) {
    const totalPages = pages.length;

    pages.forEach((page, index) => {
      const ctx = page.canvas.getContext("2d")!;
      const pageNumber = index + 1;
      const { width, height } = page.canvas;

      // ---- Render Header ----
      if (this.header) {
        this.header.render(ctx, pageNumber, totalPages, width, height);
      }

      // ---- Render Footer ----
      if (this.footer) {
        this.footer.render(ctx, pageNumber, totalPages, width, height);
      }
    });

    return pages;
  }
}
