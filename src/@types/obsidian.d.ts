/**
 * Type extensions for Obsidian API.
 */

import 'obsidian';
import { DataviewApi } from 'obsidian-dataview';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataviewPlugin = /*unresolved*/ any;

declare module 'obsidian' {
  interface Manifest {
    id: string;
    dir: string;
  }

  interface PluginManager {
    enablePlugin(plugin: Plugin | string): Promise<void>;
    disablePlugin(plugin: Plugin | string): Promise<void>;
    getPluginFolder(): string;

    enabledPlugins: Set<string>;
    plugins: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [id: string]: any;
      dataview?: {
        api?: DataviewApi;
      };
    };
    manifests: {
      [id: string]: Manifest;
    };
  }

  interface DataAdapter {
    basePath: string;
    startWatchPath(path: string, start: boolean): void;
  }

  interface Vault {
    exists(path: string): boolean;

    adapter: DataAdapter;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(name: 'raw', callback: () => any, ctx?: any): EventRef;
  }

  interface App {
    plugins: PluginManager;
    vault: Vault;
  }

  interface MetadataCache {
    on(
      name: 'dataview:api-ready',

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (api: DataviewPlugin['api']) => any,

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx?: any
    ): EventRef;
    on(
      name: 'dataview:metadata-change',
      callback: (
        ...args:
          | [op: 'rename', file: TAbstractFile, oldPath: string]
          | [op: 'delete', file: TFile]
          | [op: 'update', file: TFile]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) => any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx?: any
    ): EventRef;
  }
}
