import { base64ToBinary } from "../utils/image-utils";
import type { PageCanvas } from "./layout-engine";

interface PdfObject {
  id: number;
  content: string | Uint8Array;
  isBinary?: boolean;
  extraDict?: string;
}

export class PdfWriter {
  private objects: PdfObject[] = [];
  private objectCount = 0;

  private addObject(content: string | Uint8Array, isBinary = false, extraDict?: string): number {
    const id = ++this.objectCount;
    this.objects.push({ id, content, isBinary, extraDict });
    return id;
  }

  async write(pages: PageCanvas[]): Promise<Blob> {
    this.objects = [];
    this.objectCount = 0;

    const pageObjectIds: number[] = [];

    // Reserve /Pages object so we know the ID for page parents
    const pagesRootId = this.addObject("", false);

    // ---- STEP 1: Convert page canvases → encoded images ----
    for (const page of pages) {
      const imgBase64 = page.canvas.toDataURL("image/jpeg", 0.92);
      const imgBinary = base64ToBinary(imgBase64);

      const objId = this.addObject(
        imgBinary,
        true,
        `/Width ${page.canvas.width} /Height ${page.canvas.height}`
      );

      const drawImage = `q ${page.canvas.width} 0 0 ${page.canvas.height} 0 0 cm /Img${objId} Do Q`;
      const contentStream = `<< /Length ${drawImage.length} >>\nstream\n${drawImage}\nendstream`;
      const contentId = this.addObject(contentStream);

      const pageId = this.addObject(
        `<< /Type /Page /Parent ${pagesRootId} 0 R /Resources << /XObject << /Img${objId} ${objId} 0 R >> >> /MediaBox [0 0 ${page.canvas.width} ${page.canvas.height}] /Contents ${contentId} 0 R >>`
      );
      pageObjectIds.push(pageId);
    }

    // ---- STEP 3: Pages Root ----
    const pagesRoot = this.objects.find((obj) => obj.id === pagesRootId);
    if (pagesRoot) {
      pagesRoot.content = `<< /Type /Pages /Kids [${pageObjectIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] /Count ${pageObjectIds.length} >>`;
    }

    // ---- STEP 4: Catalog ----
    const catalogId = this.addObject(`<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`);

    // ---- STEP 5: Build the PDF string ----
    let pdf = "%PDF-1.7\n";
    const xref: number[] = [0];
    let position = pdf.length;

    for (const obj of this.objects) {
      xref.push(position);
      pdf += `${obj.id} 0 obj\n`;

      if (obj.isBinary) {
        const extra = obj.extraDict ? ` ${obj.extraDict}` : "";
        pdf += `<< /Length ${obj.content instanceof Uint8Array ? obj.content.length : 0} /Subtype /Image /Type /XObject /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode${extra} >>\nstream\n`;
        position = pdf.length;
        pdf += "BINARY_PLACEHOLDER";
        pdf += `\nendstream\nendobj\n`;
      } else {
        pdf += `${obj.content}\nendobj\n`;
      }

      position = pdf.length;
    }

    // ---- STEP 6: XREF table ----
    const xrefStart = position;
    pdf += `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
    xref.slice(1).forEach((offset) => {
      pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
    });

    // ---- STEP 7: Trailer ----
    pdf += `trailer << /Size ${xref.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    // ---- STEP 8: Inject Binary Data ----
    const encoder = new TextEncoder();
    let pdfBytes = encoder.encode(pdf);

    const findPlaceholder = (buffer: Uint8Array, pattern: Uint8Array) => {
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

    // Replace placeholders with binary content
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
}
