import { PdfPlugin } from "../core/types";

const registeredPlugins = new Map<string, PdfPlugin>();

export function registerPlugin(plugin: PdfPlugin) {
  registeredPlugins.set(plugin.name, plugin);
}

export function getPlugin(name: string): PdfPlugin | undefined {
  return registeredPlugins.get(name);
}
