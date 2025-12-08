# 📄 HTML-to-PDF Engine  
### A modern, dependency-free HTML → PDF renderer for the browser.

![License](https://img.shields.io/badge/license-MIT-green)
![Build](https://img.shields.io/badge/status-alpha-orange)
![Size](https://img.shields.io/bundlephobia/minzip/html-to-pdf-engine)
![Typescript](https://img.shields.io/badge/TypeScript-Supported-blue)

---

### 🚀 Why this library?

Most existing HTML→PDF libraries are:

❌ dependent on html2canvas / jspdf  
❌ inaccurate rendering of CSS/fonts  
❌ bad at multi-page layouts  
❌ limited plugin capability (no watermark / header / footer / page numbers)

**HTML-to-PDF Engine solves this:**

| Feature | Supported |
|--------|-----------|
| No external dependencies | ✅ |
| Multi-page layout splitting | ✅ |
| Header + footer plugin system | ✅ |
| Page numbers support | ✔ via plugin |
| Font + image auto-inline (no CORS issues) | ✅ |
| Works in browser (no server required) | ✅ |

---

## 🧠 Quick Start

```ts
import { HtmlToPdfEngine } from "html-to-pdf-engine";

const engine = new HtmlToPdfEngine({
  dpi: 150,
  margin: 10,
  format: "A4",
  debug: true,
  header: {
    height: 12,
    render: (ctx, page, total) => {
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("Invoice", 20, 20);
    }
  },
  footer: {
    height: 10,
    render: (ctx, page, total, width, height) => {
      ctx.font = "12px sans-serif";
      ctx.fillText(`Page ${page} / ${total}`, width - 80, height - 20);
    }
  }
});

const result = await engine.fromElement(document.getElementById("content"));

result.download("document.pdf");

```


## Contributing

PRs and feature proposals are welcome.
Before submitting large features, open an issue to align design and scope.

## 🪪 License

MIT © 2025
HTML-to-PDF Engine