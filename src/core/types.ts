export type PageFormat = "A4" | "Letter" | "Legal";

export interface HeaderFooterRender {
  render: (
    ctx: CanvasRenderingContext2D,
    pageNumber: number,
    totalPages: number,
    pageWidth: number,
    pageHeight: number
  ) => void;
  height?: number; // reserved space
}


export interface HtmlToPdfOptions {
  margin?: number;
  dpi?: number;
  format?: PageFormat;
  orientation?: "portrait" | "landscape";
  debug?: boolean;
  plugins?: string[];
  header?: HeaderFooterRender;
  footer?: HeaderFooterRender;
}

export interface PdfPlugin {
  name: string;
  apply(engine: any): void; // will be refined later
}

