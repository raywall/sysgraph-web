const { Plugin, MarkdownRenderChild } = require('obsidian');
const SysGraph = require('./sysgraph'); 

class SysGraphRenderer extends MarkdownRenderChild {
  constructor(el, source) {
    super(el);
    this.source = source;
  }

  async onload() {
    if (!window.d3) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js');
    }

    const wrapper = this.containerEl.createDiv({ cls: 'sysgraph-obsidian-wrapper' });
    wrapper.style.cssText = `
      width: 100%; height: 400px;
      background: var(--background-secondary, #1a1a2e);
      border-radius: 12px; overflow: hidden;
      border: 1px solid var(--background-modifier-border, #333);
      margin: 12px 0; position: relative;
    `;

    const result = SysGraph.render(wrapper, this.source, { d3: window.d3 });

    if (result.error) {
      wrapper.innerHTML = `<p style="padding: 20px; color: var(--text-error, red);">⚠️ SysGraph: ${result.error}</p>`;
    }
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

module.exports = class SysGraphPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('sysgraph', (source, el) => {
      const renderer = new SysGraphRenderer(el, source);
      renderer.load();
    });
    console.log('SysGraph plugin loaded');
  }

  onunload() {
    console.log('SysGraph plugin unloaded');
  }
};