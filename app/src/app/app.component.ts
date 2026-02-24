import { Component, ViewChild, ElementRef, OnInit, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked'; // Importando o marked

declare var window: any;
declare var SysGraph: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('graphContainer', { static: false }) graphContainer!: ElementRef;

  // Estado da Aplicação
  sourceText: string = '';
  modalSourceText: string = '';
  isModalOpen: boolean = false;
  isHelpModalOpen: boolean = false;
  hasGrid: boolean = true;
  
  // HTML da Documentação Renderizada
  helpHtml: string | Promise<string> = '<p class="text-slate-400">Loading help...</p>';
  
  // Dados extraídos do Grafo
  graphInstance: any = null;
  nodesList: any[] = [];
  activeNodeId: string | null = null;
  legendItems: any[] = [];
  statusText: string = 'Loading...';
  errorMsg: string | null = null;

  samples: Record<string, string> = {};

  constructor(private ngZone: NgZone, private http: HttpClient) {}

  ngOnInit() {
    // 1. Carrega os Exemplos (Samples)
    this.http.get<Record<string, string>>('assets/samples.json').subscribe({
      next: (data) => {
        this.samples = data;
        this.sourceText = this.samples['completo'];
      },
      error: (err) => {
        console.error('Erro ao carregar os samples', err);
        this.statusText = 'Erro ao carregar exemplos.';
      }
    });

    // 2. Carrega a Documentação Markdown
    marked.use({ breaks: true, gfm: true });
    this.http.get('assets/about-sysgraph.md', { responseType: 'text' }).subscribe({
        next: async (data) => {
            try {
                // Parseia o markdown para HTML
                const parsed = await marked.parse(data);
                this.helpHtml = parsed;
            } catch (e) {
                this.helpHtml = '<p class="text-red-400">Error parsing markdown.</p>';
            }
        },
        error: (err) => {
            this.helpHtml = '<div class="text-red-400">Error: Could not load <b>assets/about-sysgraph.md</b>.</div>';
        }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.renderGraph(), 100);
  }

  // --- CONTROLE DE TELA ---
  loadSample(name: string) {
    if (this.samples[name]) {
      this.sourceText = this.samples[name];
      this.renderGraph();
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') this.renderGraph();
  }

  onModalKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') this.applyModalChanges();
  }

  // Controle do Modal Editor
  openModal() { this.modalSourceText = this.sourceText; this.isModalOpen = true; }
  closeModal() { this.isModalOpen = false; }
  applyModalChanges() { this.sourceText = this.modalSourceText; this.closeModal(); this.renderGraph(); }

  // Controle do Modal de Documentação
  openHelpModal() { this.isHelpModalOpen = true; }
  closeHelpModal() { this.isHelpModalOpen = false; }

  // --- UPLOAD CSV ---
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const csvText = e.target.result;
      const sysgraphCode = SysGraph.fromCSV(csvText);
      
      if (sysgraphCode) {
        this.sourceText = sysgraphCode;
        this.renderGraph();
      } else {
        alert("Erro ao processar CSV. Verifique o formato.");
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // --- RENDERIZAÇÃO DO GRAFO E LEGENDA ---
  renderGraph() {
    if (!this.graphContainer) return;
    const containerEl = this.graphContainer.nativeElement;
    
    const parsed = SysGraph.parse(this.sourceText);
    this.hasGrid = parsed.config.background;

    this.graphInstance = SysGraph.render(containerEl, this.sourceText, {
      d3: window.d3,
      onSelect: (selectedId: string | null) => {
        this.ngZone.run(() => { this.activeNodeId = selectedId; });
      }
    });

    if (this.graphInstance.error) {
      this.errorMsg = this.graphInstance.error;
      this.statusText = `Erro: ${this.errorMsg}`;
      this.nodesList = [];
      this.legendItems = [];
    } else {
      this.errorMsg = null;
      this.statusText = `${this.graphInstance.stats.nodes} nodes · ${this.graphInstance.stats.edges} edges`;
      this.nodesList = this.graphInstance.nodes || [];
      this.buildLegend();
    }
  }

  selectNode(id: string) {
    if (this.graphInstance) this.graphInstance.selectNode(id);
  }

  private buildLegend() {
    const limits = this.graphInstance.config.limits;
    const toUnit = this.graphInstance.config.duration.to;
    const fmt = (val: number) => SysGraph.format(val, toUnit);

    this.legendItems = [
      { color: 'var(--ok)', label: `Fast (≤ ${fmt(limits.fast)})` },
      { color: 'var(--warn)', label: `Medium (${fmt(limits.fast)} – ${fmt(limits.medium)})` }
    ];

    if (limits.slow) {
      this.legendItems.push({ color: 'var(--danger)', label: `Slow (${fmt(limits.medium)} – ${fmt(limits.slow)})` });
      this.legendItems.push({ color: 'var(--bottleneck)', label: `Bottleneck (> ${fmt(limits.slow)})` });
    } else {
      this.legendItems.push({ color: 'var(--danger)', label: `Slow (> ${fmt(limits.medium)})` });
    }
  }
}