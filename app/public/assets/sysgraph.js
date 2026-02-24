(function(global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    global.SysGraph = factory();
  }
})(this, function() {
  
  const UNIT_TO_MS = { ns: 1 / 1000000, us: 1 / 1000, ms: 1, s: 1000 };

  function parseConfig(source) {
    let config = { title: "", duration: { from: "ms", to: "ms" }, background: true, limits: { fast: 100, medium: 500, slow: null } };
    const configMatch = source.match(/^---\n([\s\S]+?)\n---\n/);
    if (configMatch) {
      const yamlStr = configMatch[1];
      const fromMatch = yamlStr.match(/from:\s*([a-zA-Z]+)/);
      if (fromMatch) config.duration.from = fromMatch[1].toLowerCase();
      const toMatch = yamlStr.match(/to:\s*([a-zA-Z]+)/);
      if (toMatch) config.duration.to = toMatch[1].toLowerCase();
      const bgMatch = yamlStr.match(/background:\s*(true|false)/);
      if (bgMatch) config.background = bgMatch[1] === 'true';
      const titleMatch = yamlStr.match(/title:\s*(.+)/);
      if (titleMatch) config.title = titleMatch[1].trim();

      const fastMatch = yamlStr.match(/fast:\s*(\d+)/);
      if (fastMatch) config.limits.fast = parseInt(fastMatch[1], 10);
      const medMatch = yamlStr.match(/medium:\s*(\d+)/);
      if (medMatch) config.limits.medium = parseInt(medMatch[1], 10);
      const slowMatch = yamlStr.match(/slow:\s*(\d+)/);
      if (slowMatch) config.limits.slow = parseInt(slowMatch[1], 10);
  
      source = source.replace(/^---\n[\s\S]+?\n---\n/, '');
    }
    return { config, source };
  }

  function parseSource(rawSource) {
    const { config, source } = parseConfig(rawSource);
    const lines = source.replace(/^graph:\s*/m, '').split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
    
    const nodes = new Map();
    const edges = [];
  
    const RE_NODE  = /^([a-zA-Z0-9_]+)(?:\["([^"]+)"\])?(?:\s*\{([^}]+)\})?$/;
    const RE_EDGE  = /^([a-zA-Z0-9_]+)(?:\["([^"]+)"\])?(?:\s*\{[^}]+\})?\s*-->\s*\|([^|]+)\|\s*([a-zA-Z0-9_]+)(?:\["([^"]+)"\])?(?:\s*\{[^}]+\})?$/;
    const RE_BARE  = /^([a-zA-Z0-9_]+)(?:\["([^"]+)"\])?(?:\s*\{[^}]+\})?\s*-->\s*([a-zA-Z0-9_]+)(?:\["([^"]+)"\])?(?:\s*\{[^}]+\})?$/;
  
    function registerNode(alias, label, metaStr) {
      const metaObj = {};
      if (metaStr) {
        metaStr.split(',').forEach(pair => {
          const parts = pair.split(':');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
            metaObj[key] = val;
          }
        });
      }
      if (!nodes.has(alias)) {
        nodes.set(alias, { id: alias, label: label || alias, meta: metaObj });
      } else {
        const existing = nodes.get(alias);
        if (label) existing.label = label;
        existing.meta = { ...existing.meta, ...metaObj };
      }
    }
  
    for (const line of lines) {
      let m = line.match(RE_EDGE);
      if (m) {
        const [, sA, sL, duration, tA, tL] = m;
        registerNode(sA, sL); registerNode(tA, tL);
        edges.push({ source: sA, target: tA, rawDuration: duration.trim() });
        continue;
      }
      m = line.match(RE_BARE);
      if (m) {
        const [, sA, sL, tA, tL] = m;
        registerNode(sA, sL); registerNode(tA, tL);
        edges.push({ source: sA, target: tA, rawDuration: null });
        continue;
      }
      m = line.match(RE_NODE);
      if (m) { 
        const [, alias, label, metaStr] = m; 
        registerNode(alias, label, metaStr); 
      }
    }
    return { nodes: [...nodes.values()], edges, config };
  }

  function durationToMs(rawDur, fromUnit) {
    if (!rawDur) return 0;
    if (/ms$/i.test(rawDur.trim())) return parseFloat(rawDur) * UNIT_TO_MS.ms;
    if (/s$/i.test(rawDur.trim()))  return parseFloat(rawDur) * UNIT_TO_MS.s;
    const val = parseFloat(rawDur.replace(/[^\d.-]/g, ''));
    if (isNaN(val)) return 0;
    return val * (UNIT_TO_MS[fromUnit] || 1);
  }

  function formatDuration(ms, toUnit) {
    if (!ms && ms !== 0) return '—';
    if (ms === 0) return '0' + toUnit;
    const converted = ms / (UNIT_TO_MS[toUnit] || 1);
    
    if (toUnit === 'ms' && ms >= 1000) {
      const totalSec = ms / 1000;
      if (totalSec < 60) return parseFloat(totalSec.toPrecision(3)) + 's';
      const m = Math.floor(totalSec / 60);
      const s = Math.round(totalSec % 60);
      return s > 0 ? m + 'm ' + s + 's' : m + 'm';
    }
    return parseFloat(converted.toFixed(2)) + toUnit;
  }

  // NOVA FUNÇÃO: Conversão de CSV do Datadog para SysGraph Script
  function fromCSV(csvText) {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return ""; 

    const nodes = {}; 
    const edges = {}; 

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 11) continue;

      const from_alias = cols[2].trim();
      const from_service = cols[3].trim();
      const to_alias = cols[4].trim();
      const to_service = cols[5].trim();
      const comunidade = cols[6].trim();
      const squad = cols[7].trim();
      const language = cols[8].trim();
      const repo_url = cols[9].trim();
      const duration = parseFloat(cols[10].trim());

      // Grava Origem
      if (!nodes[from_alias]) nodes[from_alias] = { label: from_service, meta: {} };
      if (comunidade && comunidade !== '-') nodes[from_alias].meta.comunidade = comunidade;
      if (squad && squad !== '-') nodes[from_alias].meta.squad = squad;
      if (language && language !== '-') nodes[from_alias].meta.lang = language;
      if (repo_url && repo_url !== '-') nodes[from_alias].meta.repo = repo_url;

      // Grava Destino (Metadados podem ser preenchidos quando ele for origem)
      if (!nodes[to_alias]) nodes[to_alias] = { label: to_service, meta: {} };

      // Grava Aresta e agrupa latências para tirar a média
      const edgeKey = `${from_alias}-->${to_alias}`;
      if (!edges[edgeKey]) edges[edgeKey] = [];
      if (!isNaN(duration)) edges[edgeKey].push(duration);
    }

    let script = `---\nconfig:\n  title: Datadog Auto-Generated Map\n  duration: \n    from: ns\n    to: ms\n  limits:\n    fast: 100\n    medium: 500\n    slow: 1500\n  background: true\n---\ngraph:\n`;

    for (const [alias, data] of Object.entries(nodes)) {
      let metaStr = Object.entries(data.meta).map(([k, v]) => `${k}: ${v}`).join(', ');
      script += `  ${alias}["${data.label}"]`;
      if (metaStr) script += ` { ${metaStr} }\n`;
      else script += '\n';
    }

    script += '\n';
    for (const [edgeKey, durations] of Object.entries(edges)) {
      const [from, to] = edgeKey.split('-->');
      const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      script += `  ${from} --> |${Math.round(avgDuration)}| ${to}\n`;
    }

    return script;
  }

  function injectStyles() {
    if (document.getElementById('sysgraph-styles')) return;
    const style = document.createElement('style');
    style.id = 'sysgraph-styles';
    style.textContent = `
      .sys-tooltip { position: absolute; background: var(--bg2, #0d1526); border: 1px solid var(--accent, #3b9eff); border-radius: 8px; padding: 10px 14px; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.15s; z-index: 1000; font-family: 'JetBrains Mono', monospace; color: var(--text-dim, #a8d8ea); box-shadow: 0 4px 12px rgba(0,0,0,0.5); max-width: 300px; }
      .sys-tooltip.visible { opacity: 1; }
      .sys-tooltip-title { font-weight: 700; color: var(--accent, #3b9eff); margin-bottom: 6px; font-size: 13px; border-bottom: 1px solid var(--border, #1e3355); padding-bottom: 4px; }
      .sys-tooltip strong { color: var(--text, #cde4ff); }
      .sys-kv-row { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 2px; }
      .sys-key { color: var(--text-dim, #a8d8ea); }
      .sys-val { color: var(--text, #cde4ff); font-weight: 600; text-align: right; }
    `;
    document.head.appendChild(style);
  }

  function render(containerElement, rawSource, options = {}) {
    const d3 = options.d3 || window.d3;
    if (!d3) throw new Error("D3.js is required for SysGraph.");
    
    injectStyles();
    
    const { nodes, edges, config } = parseSource(rawSource);
    if (nodes.length === 0) return { error: "No valid edges/nodes found." };

    containerElement.innerHTML = '';
    containerElement.style.position = 'relative';

    const W = containerElement.clientWidth || 640;
    const H = containerElement.clientHeight || Math.max(400, nodes.length * 90);

    const maxDur = {};
    for (const e of edges) {
      const ms = durationToMs(e.rawDuration, config.duration.from);
      maxDur[e.source] = Math.max(maxDur[e.source] || 0, ms);
      maxDur[e.target] = Math.max(maxDur[e.target] || 0, ms);
    }
    const allMs = Object.values(maxDur);
    const minMs = Math.min(...allMs, 0);
    const maxMs = Math.max(...allMs, 1);
    const sizeScale = d3.scaleLinear().domain([minMs, maxMs === minMs ? maxMs + 1 : maxMs]).range([52, 120]);
    
    const nodeW = id => sizeScale(maxDur[id] || minMs) * 1.9;
    const nodeH = id => sizeScale(maxDur[id] || minMs) * 0.75;
    const nodeR = id => sizeScale(maxDur[id] || minMs) * 0.55;

    const getCat = (ms) => {
      if (ms <= config.limits.fast) return 'ok';
      if (ms <= config.limits.medium) return 'warn';
      if (config.limits.slow) {
        if (ms <= config.limits.slow) return 'danger';
        return 'bottleneck';
      }
      return 'danger';
    };

    const defaultColors = { ok: '#00d4aa', warn: '#ffc94a', danger: '#ff6b6b', bottleneck: '#c044ff' };
    const cssVars = {};
    ['ok', 'warn', 'danger', 'bottleneck'].forEach(k => {
      const val = typeof getComputedStyle !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--' + k).trim() : '';
      cssVars[k] = val || defaultColors[k];
    });

    const svg = d3.select(containerElement).append('svg').attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${W} ${H}`);
    const tooltip = document.createElement('div');
    tooltip.className = 'sys-tooltip';
    containerElement.appendChild(tooltip);

    let selectedNode = null;
    let nodeEl, link, edgeLabel;

    const updateSelection = () => {
      if (!selectedNode) {
        if(nodeEl) nodeEl.transition().duration(200).style('opacity', 1);
        if(link) link.transition().duration(200).style('opacity', 0.85);
        if(edgeLabel) edgeLabel.transition().duration(200).style('opacity', 1);
      } else {
        nodeEl.transition().duration(200).style('opacity', o => isConnected(selectedNode, o) ? 1 : 0.15);
        link.transition().duration(200).style('opacity', o => (o.source.id === selectedNode.id || o.target.id === selectedNode.id) ? 0.85 : 0.05);
        edgeLabel.transition().duration(200).style('opacity', o => (o.source.id === selectedNode.id || o.target.id === selectedNode.id) ? 1 : 0.05);
      }
      if (options.onSelect) options.onSelect(selectedNode ? selectedNode.id : null);
    };

    const deselectAll = () => { if (selectedNode) { selectedNode = null; updateSelection(); } };
    svg.on('click', deselectAll);

    if (containerElement._sysgraphEscListener) window.removeEventListener('keydown', containerElement._sysgraphEscListener);
    containerElement._sysgraphEscListener = (e) => { if (e.key === 'Escape') deselectAll(); };
    window.addEventListener('keydown', containerElement._sysgraphEscListener);

    if (config.title) {
      svg.append('text').attr('x', 20).attr('y', 30).attr('fill', 'var(--text, #cde4ff)').attr('font-size', '16px').attr('font-weight', 'bold').attr('font-family', 'sans-serif').text(config.title);
    }

    const defs = svg.append('defs');
    ['ok', 'warn', 'danger', 'bottleneck'].forEach(k => {
      defs.append('marker').attr('id', `arrow-${k}`).attr('viewBox', '0 -5 10 10').attr('refX', 10).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto').append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', cssVars[k]);
      const f = defs.append('filter').attr('id', `glow-${k}`).attr('x', '-30%').attr('y', '-30%').attr('width', '160%').attr('height', '160%');
      f.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 4).attr('result', 'blur');
      const merge = f.append('feMerge'); merge.append('feMergeNode').attr('in', 'blur'); merge.append('feMergeNode').attr('in', 'SourceGraphic');
    });

    const gMain = svg.append('g').attr('class', 'g-main');
    const zoomBehavior = d3.zoom().scaleExtent([0.2, 4]).on('zoom', e => gMain.attr('transform', e.transform));
    svg.call(zoomBehavior);

    const linkedByIndex = {};
    edges.forEach(d => { linkedByIndex[`${d.source},${d.target}`] = true; linkedByIndex[`${d.target},${d.source}`] = true; });
    const isConnected = (a, b) => a.id === b.id || linkedByIndex[`${a.id},${b.id}`] || linkedByIndex[`${b.id},${a.id}`];

    const simNodes = nodes.map(n => ({ ...n }));
    const simEdges = edges.map(e => ({ ...e }));

    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id(d => d.id).distance(d => Math.min(600, 180 + (durationToMs(d.rawDuration, config.duration.from) * 0.3))).strength(0.8))
      .force('charge', d3.forceManyBody().strength(-1200))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius(d => nodeR(d.id) + 30));

    const edgeStrokeScale = d3.scaleLinear().domain([minMs, maxMs === minMs ? maxMs + 1 : maxMs]).range([1.5, 7]);

    const linkG = gMain.append('g').attr('class', 'links');
    link = linkG.selectAll('line').data(simEdges).join('line').attr('stroke-opacity', 0.85).each(function(d) {
      const ms = durationToMs(d.rawDuration, config.duration.from);
      const k = getCat(ms);
      d3.select(this).attr('stroke', cssVars[k]).attr('stroke-width', edgeStrokeScale(ms)).attr('marker-end', `url(#arrow-${k})`);
    });

    const edgeLabelG = gMain.append('g').attr('class', 'edge-labels');
    edgeLabel = edgeLabelG.selectAll('g').data(simEdges.filter(e => e.rawDuration !== null)).join('g');
    edgeLabel.append('rect').attr('rx', 4).attr('ry', 4).attr('fill', 'var(--node-fill, rgba(8,12,20,0.85))').attr('stroke', 'var(--border, #1e3355)').attr('stroke-width', 1);
    edgeLabel.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-family', 'monospace').attr('font-size', 11).each(function(d) {
      const ms = durationToMs(d.rawDuration, config.duration.from);
      const k = getCat(ms);
      d3.select(this).attr('fill', cssVars[k]).text(d => formatDuration(ms, config.duration.to));
    });
    edgeLabel.each(function(d) {
      const text = d3.select(this).select('text');
      const bbox = text.node().getBBox();
      d3.select(this).select('rect').attr('width', bbox.width + 12).attr('height', bbox.height + 6).attr('x', -(bbox.width + 12) / 2).attr('y', -(bbox.height + 6) / 2);
    });

    const nodeG = gMain.append('g').attr('class', 'nodes');
    nodeEl = nodeG.selectAll('g').data(simNodes).join('g').attr('class', 'node').style('cursor', 'grab')
      .call(d3.drag()
        .on('start', (ev, d) => { if (!ev.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end', (ev, d) => { if (!ev.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on('click', function(ev, d) {
        ev.stopPropagation(); 
        selectedNode = selectedNode === d ? null : d;
        updateSelection();
      });

    nodeEl.append('rect').attr('rx', 10).attr('ry', 10).attr('fill', 'none').attr('pointer-events', 'none').each(function(d) {
      const ms = maxDur[d.id] || 0; const k = getCat(ms);
      const w = nodeW(d.id); const h = nodeH(d.id);
      d3.select(this).attr('width', w + 8).attr('height', h + 8).attr('x', -(w + 8) / 2).attr('y', -(h + 8) / 2).attr('filter', `url(#glow-${k})`).attr('stroke', cssVars[k]).attr('stroke-width', 1).attr('opacity', 0.3);
    });

    nodeEl.append('rect').attr('rx', 10).attr('ry', 10).attr('fill', 'var(--node-fill, #0a1f3d)').each(function(d) {
      const ms = maxDur[d.id] || 0; const k = getCat(ms);
      const w = nodeW(d.id); const h = nodeH(d.id);
      d3.select(this).attr('width', w).attr('height', h).attr('x', -w / 2).attr('y', -h / 2).attr('stroke', cssVars[k]).attr('stroke-width', 1.5);
    });

    nodeEl.append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', 'var(--text, #cde4ff)')
      .attr('font-family', 'sans-serif').attr('font-weight', '600').attr('pointer-events', 'none').each(function(d) {
        const s = sizeScale(maxDur[d.id] || minMs);
        const fontSize = Math.max(11, s * 0.15);
        const maxChars = Math.max(3, Math.floor((nodeW(d.id) - 20) / (fontSize * 0.55)));
        let label = d.label;
        if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';
        d3.select(this).attr('font-size', fontSize).text(label);
      });

    nodeEl.on('mouseover', function(ev, d) {
      const ms = maxDur[d.id] || 0;
      let bodyHtml = `<div class="sys-tooltip-title">${d.label}</div>`;
      bodyHtml += `<div class="sys-kv-row"><span class="sys-key">Alias</span><span class="sys-val">${d.id}</span></div>`;
      bodyHtml += `<div class="sys-kv-row"><span class="sys-key">Max Latência</span><span class="sys-val">${ms ? formatDuration(ms, config.duration.to) : '–'}</span></div>`;

      if (d.meta && Object.keys(d.meta).length > 0) {
        bodyHtml += '<div style="margin:8px 0; border-top:1px dashed var(--border, #1e3355); opacity:0.5;"></div>';
        for (const [key, val] of Object.entries(d.meta)) {
          const niceKey = key.charAt(0).toUpperCase() + key.slice(1);
          bodyHtml += `<div class="sys-kv-row"><span class="sys-key">${niceKey}</span><span class="sys-val">${val}</span></div>`;
        }
      }
      tooltip.innerHTML = bodyHtml;
      tooltip.classList.add('visible');
    }).on('mousemove', function(ev) {
      const rect = containerElement.getBoundingClientRect();
      let left = ev.clientX - rect.left + 14;
      if (left + 200 > rect.width) left = ev.clientX - rect.left - 210;
      tooltip.style.left = left + 'px'; tooltip.style.top = (ev.clientY - rect.top - 10) + 'px';
    }).on('mouseout', () => tooltip.classList.remove('visible'));

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => { const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, dist = Math.sqrt(dx*dx + dy*dy) || 1, off = nodeW(d.target.id)/2 + 6; return d.target.x - (dx/dist)*off; })
        .attr('y2', d => { const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, dist = Math.sqrt(dx*dx + dy*dy) || 1, off = nodeW(d.target.id)/2 + 6; return d.target.y - (dy/dist)*off; });
      edgeLabel.attr('transform', d => `translate(${(d.source.x + d.target.x) / 2},${(d.source.y + d.target.y) / 2})`);
      nodeEl.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    const fitView = () => {
      if (!gMain.node()) return;
      try {
        const bbox = gMain.node().getBBox();
        if (!bbox.width || !bbox.height) return;
        const scale = 0.85 * Math.min(W / bbox.width, H / bbox.height);
        const tx = (W - bbox.width * scale) / 2 - bbox.x * scale;
        const ty = (H - bbox.height * scale) / 2 - bbox.y * scale;
        svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
      } catch(e) {}
    };
    simulation.on('end', fitView);

    const exportNodes = simNodes.map(n => {
       const ms = maxDur[n.id] || 0;
       const k = getCat(ms);
       return {
         id: n.id,
         label: n.label,
         ms: ms,
         formattedMs: ms ? formatDuration(ms, config.duration.to) : '–',
         color: cssVars[k]
       };
    });

    return {
      config,
      simulation,
      nodes: exportNodes,
      selectNode: (nodeId) => {
        const target = simNodes.find(n => n.id === nodeId);
        selectedNode = selectedNode === target ? null : target;
        updateSelection();
      },
      zoomIn: () => svg.transition().call(zoomBehavior.scaleBy, 1.3),
      zoomOut: () => svg.transition().call(zoomBehavior.scaleBy, 0.77),
      zoomFit: fitView,
      stats: { nodes: nodes.length, edges: edges.length }
    };
  }

  // AGORA EXPORTAMOS O fromCSV AQUI EMBAIXO:
  return { parse: parseSource, render: render, format: formatDuration, fromCSV: fromCSV };
});