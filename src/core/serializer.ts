export class HtmlSerializer {
  constructor(private element: HTMLElement) {}

  serialize(): string {
    return new XMLSerializer().serializeToString(this.element);
  }
}
