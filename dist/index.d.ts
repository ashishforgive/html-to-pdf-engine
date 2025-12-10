type PageFormat = "A4" | "Letter" | "Legal";
interface HeaderFooterRender {
    render: (ctx: CanvasRenderingContext2D, pageNumber: number, totalPages: number, pageWidth: number, pageHeight: number) => void;
    height?: number;
}
interface HtmlToPdfOptions {
    margin?: number;
    dpi?: number;
    format?: PageFormat;
    orientation?: "portrait" | "landscape";
    debug?: boolean;
    plugins?: string[];
    header?: HeaderFooterRender;
    footer?: HeaderFooterRender;
}
interface PdfPlugin {
    name: string;
    apply(engine: any): void;
}

declare class HtmlToPdfEngine {
    private options;
    constructor(options?: HtmlToPdfOptions);
    fromElement(element: HTMLElement): Promise<{
        download: (fileName?: string) => void;
        blob: () => Blob;
        base64: () => Promise<string>;
    }>;
}

declare function registerPlugin(plugin: PdfPlugin): void;

export { type HeaderFooterRender, HtmlToPdfEngine, type HtmlToPdfOptions, type PageFormat, type PdfPlugin, registerPlugin };
