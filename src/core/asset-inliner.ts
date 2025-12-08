export class AssetInliner {
  private element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element.cloneNode(true) as HTMLElement;
  }

  async inline(): Promise<HTMLElement> {
    await this.inlineImages();
    await this.inlineFonts();
    return this.element;
  }

  /** Convert all <img> and CSS background-images into base64 */
  private async inlineImages() {
    const images = this.element.querySelectorAll<HTMLImageElement>("img");

    const promises = Array.from(images).map(async (img) => {
      if (!img.src.startsWith("data:")) {
        try {
          const data = await this.urlToBase64(img.src);
          img.src = data;
        } catch {
          console.warn("⚠️ Failed to inline image:", img.src);
        }
      }
    });

    return Promise.all(promises);
  }

  /** Fetch external fonts and embed them inside CSS */
  private async inlineFonts() {
    const fontLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']")
    );

    const cssRules: string[] = [];

    for (const link of fontLinks) {
      try {
        const res = await fetch(link.href);
        const css = await res.text();
        cssRules.push(css);
      } catch {
        console.warn("⚠️ Failed to inline font stylesheet:", link.href);
      }
    }

    if (cssRules.length > 0) {
      const style = document.createElement("style");
      style.textContent = cssRules.join("\n");
      this.element.prepend(style);
    }
  }

  /** Helper: fetch URL → blob → base64 */
  private async urlToBase64(url: string): Promise<string> {
    const res = await fetch(url);
    const blob = await res.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
}
