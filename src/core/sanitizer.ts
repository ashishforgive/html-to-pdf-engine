export class SanitizerV5_1 {
  private static TRANSPARENT =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAqMBgUr0YpIAAAAASUVORK5CYII=";

  private static NAMESPACE_WHITELIST = [
    "w3.org/1999/xhtml",
    "w3.org/2000/svg",
    "w3.org/1999/xlink"
  ];

  // ----------------------------------------
  // Utility: allow XML namespace URLs
  // ----------------------------------------
  private static isWhitelistedNamespace(url: string): boolean {
    return this.NAMESPACE_WHITELIST.some(ns => url.includes(ns));
  }

  private static isSameOrigin(url: string): boolean {
    if (this.isWhitelistedNamespace(url)) return true;

    try {
      const u = new URL(url, window.location.href);
      return u.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  // Entry point
  static async clean(root: HTMLElement): Promise<HTMLElement> {
    this.measureSize(root);
    await this.inlineImages(root);
    await this.inlineBackgrounds(root);
    await this.inlineFonts(root);
    this.stripSvgForeignObjects(root);
    this.replaceCanvas(root);
    this.stripFilters(root);
    this.stripRemainingUnsafe(root);
    return root;
  }

  // ----------------------------------------
  private static measureSize(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    el.dataset.htmlToPdfWidth = `${rect.width}`;
    el.dataset.htmlToPdfHeight = `${rect.height}`;
  }

  // ----------------------------------------
  private static async inlineImages(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];

    for (const img of imgs) {
      if (!img.src) continue;
      if (img.src.startsWith("data:")) continue;
      if (!this.isSameOrigin(img.src)) {
        img.src = this.TRANSPARENT;
        continue;
      }

      try {
        img.crossOrigin = "anonymous";
        img.src = await this.fetchAsDataUrl(img.src);
      } catch {
        img.src = this.TRANSPARENT;
      }
    }
  }

  // ----------------------------------------
  private static async inlineBackgrounds(root: HTMLElement) {
    const nodes = Array.from(root.querySelectorAll("*")) as HTMLElement[];
    const urlRegex = /url\(["']?([^"')]+)["']?\)/g;

    for (const node of nodes) {
      const style = getComputedStyle(node);
      const bg = style.backgroundImage;

      if (!bg || bg === "none") continue;

      const matches = [...bg.matchAll(urlRegex)];

      for (const match of matches) {
        const url = match[1];
        if (!url) continue;

        if (url.startsWith("data:")) continue;

        if (!this.isSameOrigin(url) && !this.isWhitelistedNamespace(url)) {
          node.style.backgroundImage = "none";
          continue;
        }

        try {
          const data = await this.fetchAsDataUrl(url);
          node.style.backgroundImage = bg.replace(match[0], `url("${data}")`);
        } catch {
          node.style.backgroundImage = "none";
        }
      }
    }
  }

  // ----------------------------------------
  private static async inlineFonts(root: HTMLElement) {
    const links = Array.from(document.querySelectorAll("link[rel='stylesheet']")) as HTMLLinkElement[];

    for (const link of links) {
      if (!link.href) continue;

      if (!this.isSameOrigin(link.href)) {
        continue;
      }

      try {
        const css = await (await fetch(link.href)).text();
        const styleEl = document.createElement("style");
        styleEl.textContent = css;
        root.prepend(styleEl);
      } catch {}
    }
  }

  // ----------------------------------------
  private static stripSvgForeignObjects(root: HTMLElement) {
    const nodes = Array.from(
      root.querySelectorAll("svg image, svg use")
    ) as Array<SVGImageElement | SVGUseElement>;

    for (const el of nodes) {
      const href =
        (el as any).href?.baseVal ||
        el.getAttribute("href") ||
        el.getAttribute("xlink:href");

      if (!href) continue;

      if (href.startsWith("#")) continue;

      if (!this.isSameOrigin(href) && !this.isWhitelistedNamespace(href)) {
        el.setAttribute("href", "");
        el.setAttribute("xlink:href", "");
      }
    }
  }

  // ----------------------------------------
  private static replaceCanvas(root: HTMLElement) {
    const cvs = Array.from(root.querySelectorAll("canvas")) as HTMLCanvasElement[];

    for (const c of cvs) {
      let data: string;
      try {
        data = c.toDataURL("image/png");
      } catch {
        data = this.TRANSPARENT;
      }

      const img = document.createElement("img");
      img.src = data;
      img.width = c.width;
      img.height = c.height;
      img.style.width = c.style.width;
      img.style.height = c.style.height;
      c.replaceWith(img);
    }
  }

  // ----------------------------------------
  private static stripFilters(root: HTMLElement) {
    const nodes = Array.from(root.querySelectorAll("*")) as HTMLElement[];

    for (const node of nodes) {
      const style = getComputedStyle(node);

      if (style.filter !== "none") node.style.filter = "none";
      if (style.backdropFilter !== "none") node.style.backdropFilter = "none";
      if (style.boxShadow !== "none") node.style.boxShadow = "none";
    }
  }

  // ----------------------------------------
  private static stripRemainingUnsafe(root: HTMLElement) {
    const nodes = Array.from(root.querySelectorAll("*")) as HTMLElement[];

    for (const node of nodes) {
      const bg = getComputedStyle(node).backgroundImage;

      if (bg.includes("http") && !this.isWhitelistedNamespace(bg)) {
        node.style.backgroundImage = "none";
      }

      if (node.tagName === "IMG") {
        const img = node as HTMLImageElement;
        if (img.src.startsWith("http") && !this.isWhitelistedNamespace(img.src)) {
          img.src = this.TRANSPARENT;
        }
      }
    }
  }

  // ----------------------------------------
  private static async fetchAsDataUrl(url: string): Promise<string> {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
}
