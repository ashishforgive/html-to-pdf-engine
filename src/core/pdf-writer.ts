import { base64ToBinary } from "../utils/image-utils";
import type { PageCanvas } from "./layout-engine";

interface PdfObject {
  id: number;
  content: string | Uint8Array;
  isBinary?: boolean;
}

export class PdfWriter {
  private objects: PdfObject[] = [];
  private objectCount = 0;

  private addObject(content: string | Uint8Array, isBinary = false): number {
    const id = ++this.objectCount;
    this.objects.push({ id, content, isBinary });
    return id;
  }

  async write(pages: PageCanvas[]): Promise<Blob> {
    this.objects = [];
    this.objectCount = 0;

    const imageObjectIds: number[] = [];

    // ---- STEP 1: Convert page canvases → encoded images ----
    for (const page of pages) {
      const imgBase64 = page.canvas.toDataURL("image/jpeg", 0.92);
      const imgBinary = base64ToBinary(imgBase64);

      const objId = this.addObject(imgBinary, true);
      imageObjectIds.push(objId);
    }

    // ---- STEP 2: Create single PDF pages ----
    const pageObjects = imageObjectIds.map((imgId) => {
      const pageId = this.addObject(
        `<< /Type /Page /Parent 1 0 R /Resources << /XObject << /Img${imgId} ${imgId} 0 R >> >> /MediaBox [0 0 595 842] /Contents ${imgId + 100} 0 R >>`
      );

      // Contents stream (draw image full page):
      this.addObject(
        `q 595 0 0 842 0 0 cm /Img${imgId} Do Q`,
        false // text stream, not binary
      );

      return pageId;
    });

    // ---- STEP 3: Pages Root ----
    const pagesId = this.addObject(
      `<< /Type /Pages /Kids [${pageObjects.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`
    );

    // ---- STEP 4: Catalog ----
    const catalogId = this.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    // ---- STEP 5: Build the PDF string ----
    let pdf = "%PDF-1.7\n";
    const xref: number[] = [0];
    let position = pdf.length;

    for (const obj of this.objects) {
      xref.push(position);
      pdf += `${obj.id} 0 obj\n`;

      if (obj.isBinary) {
        pdf += `<< /Length ${obj.content instanceof Uint8Array ? obj.content.length : 0} /Subtype /Image /Type /XObject /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode >>\nstream\n`;
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
