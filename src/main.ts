/**
 * Obsidian plugin for hot-reloading plugins when they are updated.
 *
 * @license MIT
 */

import { lstatSync, statSync } from 'fs';
import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, debounce } from 'obsidian';

// Remember to rename these classes and interfaces!

interface HotReloadSettings {
  hotReloadSettings: string;
}

const DEFAULT_SETTINGS: HotReloadSettings = {
  hotReloadSettings: 'default'
};

export default class HotReloadPlugin extends Plugin {
  public settings: HotReloadSettings;

  private statCache = new Map(); // path -> Stat
  private queue = Promise.resolve();
  private pluginReloaders: Record<string, () => void>;

  private pluginNames: Map<string, string> = new Map<string, string>();
  private enabledPlugins: Set<string> = new Set<string>();

  /**
   * Ported from 'main.js'
   */
  async onload() {
    app.workspace.onLayoutReady(async () => {
      this.pluginReloaders = {};
      await this.getPluginNames();
      this.registerEvent(this.app.vault.on('raw', this.requestScan));
      this.watch('.obsidian/plugins');
      this.requestScan();
      this.addCommand({
        id: 'scan-for-changes',
        name: 'Check plugins for changes and reload them',
        callback: () => this.requestScan()
      });
    });

    await this.loadSettings();

    // // This creates an icon in the left ribbon.
    // const ribbonIconEl = this.addRibbonIcon("dice", "Sample Plugin", (evt: MouseEvent) => {
    //   // Called when the user clicks the icon.
    //   new Notice("This is a notice!");
    // });
    // // Perform additional things with the ribbon
    // ribbonIconEl.addClass("my-plugin-ribbon-class");

    // // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText("Status Bar Text");
    //
    // // This adds a simple command that can be triggered anywhere
    // this.addCommand({
    //   id: "open-sample-modal-simple",
    //   name: "Open sample modal (simple)",
    //   callback: () => {
    //     new HotReloadModal(this.app).open();
    //   }
    // });
    // // This adds an editor command that can perform some operation on the current editor instance
    // this.addCommand({
    //   id: "sample-editor-command",
    //   name: "Sample editor command",
    //   editorCallback: (editor: Editor, view: MarkdownView) => {
    //     // console.log(editor.getSelection());
    //     editor.replaceSelection("Sample Editor Command");
    //   }
    // });
    //
    // // This adds a complex command that can check whether the current state of the app allows execution of the command
    // this.addCommand({
    //   id: "open-sample-modal-complex",
    //   name: "Open sample modal (complex)",
    //   checkCallback: (checking: boolean) => {
    //     // Conditions to check
    //     const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    //     if (markdownView) {
    //       // If checking is true, we're simply "checking" if the command can be run.
    //       // If checking is false, then we want to actually perform the operation.
    //       if (!checking) {
    //         new HotReloadModal(this.app).open();
    //       }
    //       // This command will only show up in Command Palette when the check function returns true
    //       return true;
    //     }
    //   }
    // });
    // // This adds a settings tab so the user can configure various aspects of the plugin
    // this.addSettingTab(new HotReloadSettingTab(this.app, this));
    // // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // // Using this function will automatically remove the event listener when this plugin is disabled.
    // this.registerDomEvent(document, "click", (evt: MouseEvent) => {
    //   console.log("click", evt);
    // });

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    // this.registerInterval(window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000));
  }

  /**
   * Ported from 'main.js'
   */
  run(
    onfulfilled: (() => Promise<void>) | undefined | null = null,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    onrejected: ((value: void | null | undefined | any[]) => Promise<void> | void) | undefined | null = null
  ) {
    this.queue = this.queue.then(onfulfilled, onrejected);
  }

  public get watchNeeded(): boolean {
    // @ts-ignore
    return window.process.platform !== 'darwin' && window.process.platform !== 'win32';
  }

  public reindexPlugins() {
    return debounce(
      () => {
        return this.run(() => {
          return this.getPluginNames();
        });
      },
      500,
      true
    );
  }

  public requestScan() {
    return debounce(
      () => {
        return this.run(() => {
          return this.checkVersions();
        });
      },
      250,
      true
    );
  }

  /**
   * Ported from 'main.js'
   */
  watch(path: string) {
    const realPath = [this.app.vault.adapter.basePath, path].join('/');
    const lstat = lstatSync(realPath);
    if (lstat && (this.watchNeeded || lstat.isSymbolicLink()) && statSync(realPath).isDirectory()) {
      this.app.vault.adapter.startWatchPath(path, false);
    }
  }

  /**
   * Ported from 'main.js'
   */
  async checkVersions() {
    const base = this.app.plugins.getPluginFolder();
    this.pluginNames.forEach(async (id, dir) => {
      for (const dir of Object.keys(this.pluginNames)) {
        for (const file of ['manifest.json', 'main.js', 'styles.css', '.hotreload']) {
          const path = `${base}/${dir}/${file}`;
          const stat = await app.vault.adapter.stat(path);
          if (stat) {
            if (this.statCache.has(path) && stat.mtime !== this.statCache.get(path).mtime) {
              this.onFileChange(path);
            }
            this.statCache.set(path, stat);
          }
        }
      }
    });
  }

  /**
   * Ported from 'main.js'
   */
  async getPluginNames() {
    const plugins = new Map<string, string>();
    const enabled = new Set<string>();

    for (const key in app.plugins.manifests) {
      const manifest = app.plugins.manifests[key];
      this.watch(manifest.dir);
      plugins[manifest.dir.split('/').pop()] = manifest.id;
      if (
        (await this.app.vault.exists(manifest.dir + '/.git')) ||
        (await this.app.vault.exists(manifest.dir + '/.hotreload'))
      ) {
        enabled.add(manifest.id);
      }
    }

    this.pluginNames.clear();
    plugins.forEach((value, key) => {
      this.pluginNames.set(value, key);
    });

    this.enabledPlugins.clear();
    enabled.forEach((value) => {
      this.enabledPlugins.add(value);
    });
  }

  /**
   * Ported from 'main.js'
   */
  onFileChange(filename: string) {
    if (!filename.startsWith(this.app.plugins.getPluginFolder() + '/')) return;
    const path = filename.split('/');
    const base = path.pop();
    const dir = path.pop();
    if (path.length === 1 && dir === 'plugins') return this.watch(filename);
    if (path.length != 2) return;
    const plugin = dir && this.pluginNames[dir];
    if (base === 'manifest.json' || base === '.hotreload' || base === '.git' || !plugin) return this.reindexPlugins();
    if (base !== 'main.js' && base !== 'styles.css') return;
    if (!this.enabledPlugins.has(plugin)) return;
    const reloader =
      this.pluginReloaders[plugin] ||
      (this.pluginReloaders[plugin] = debounce(
        () => {
          return this.run(() => {
            return this.reload(plugin);
          }, console.error);
        },
        750,
        true
      ));
    reloader();
  }

  /**
   * Ported from 'main.js'
   */
  async reload(plugin: string) {
    const plugins = app.plugins;

    // Don't reload disabled plugins
    if (!plugins.enabledPlugins.has(plugin)) return;

    await plugins.disablePlugin(plugin);
    console.debug('disabled', plugin);

    // Ensure sourcemaps are loaded (Obsidian 14+)
    const oldDebug = localStorage.getItem('debug-plugin');
    localStorage.setItem('debug-plugin', '1');
    try {
      await plugins.enablePlugin(plugin);
    } finally {
      // Restore previous setting
      if (oldDebug === null) {
        localStorage.removeItem('debug-plugin');
      } else {
        localStorage.setItem('debug-plugin', oldDebug);
      }
    }

    console.debug('enabled', plugin);
    new Notice(`Plugin "${plugin}" has been reloaded`);
  }

  onunload() {
    // Nothing to do here yet.
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class HotReloadModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText('Hot Reload message.');
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class HotReloadSettingTab extends PluginSettingTab {
  plugin: HotReloadPlugin;

  constructor(app: App, plugin: HotReloadPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName('Setting #1')
      .setDesc("It's a secret")
      .addText((text) =>
        text
          .setPlaceholder('Enter your secret')
          .setValue(this.plugin.settings.hotReloadSettings)
          .onChange(async (value) => {
            this.plugin.settings.hotReloadSettings = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
