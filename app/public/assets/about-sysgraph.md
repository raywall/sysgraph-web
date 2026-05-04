# SysGraph Engine

Este documento serve como referência completa para a utilização do **SysGraph**. 
O SysGraph é um motor visual focado em representar topologias de sistemas distribuídos, utilizando a **latência** como o principal vetor físico. Vértices (serviços) crescem de acordo com o tempo de processamento, e as arestas (comunicações) mudam de espessura e cor dependendo dos gargalos (bottlenecks).

## Conceitos fundamentais

### O Motor Físico (D3.js)
Diferente de geradores de diagramas estáticos, o SysGraph possui física.
* **Repulsão:** Nós se empurram para evitar sobreposição.
* **Atração pela Latência:** Quanto maior a latência entre dois serviços, maior será a distância física entre eles no grafo, isolando os ofensores de performance.
* **Dimensionamento:** O raio de um nó é calculado proporcionalmente pela maior latência de comunicação que o envolve.


## 1. Configuração do Grafo (Frontmatter)

As configurações globais do grafo devem ser passadas no topo do arquivo, entre delimitadores `---` (estilo YAML). Elas controlam métricas, exibições e limites de alerta.

| Atributo | Descrição | Exemplo |
| --- | --- | --- |
| **title** | Título exibido no canto superior esquerdo do canvas. | `Arquitetura Core` |
| **background** | Habilita ou desabilita o grid de pontos no fundo do canvas. | `true` ou `false` |
| **duration.from** | A unidade de tempo originária (como extraída da sua base). | `ns` (nanossegundos) |
| **duration.to** | A unidade de tempo que será convertida e exibida na tela. | `ms` (milissegundos) |

### Limites (Thresholds)
A chave `limits` permite definir as janelas de performance. A cor das conexões e o brilho dos nós mudará automaticamente.

* **fast:** Tudo menor ou igual a este valor será verde (Rápido).
* **medium:** Tudo acima de `fast` e menor ou igual a este será amarelo (Aviso).
* **slow:** Tudo acima de `medium` e menor ou igual a este será vermelho (Lento).
* **[automático] bottleneck:** Qualquer valor acima do estabelecido em `slow` será roxo (Gargalo Crítico).

**Exemplo de Configuração:**
```yaml
---
config:
  title: Visão de Checkout
  background: true
  duration: 
    from: ns
    to: ms
  limits:
    fast: 100
    medium: 400
    slow: 1000

---
```

## 2. Escrevendo a Topologia

A escrita segue uma sintaxe declarativa simples, similar ao Mermaid.js.

### Declarando Nós Simples e Conexões

Use `alias["Nome Amigável"]` para declarar um nó. O alias será usado para fazer as ligações.Snippet de códigograph:

```
  # Declaração e ligação direta
  api["API Gateway"] --> |120| bff["BFF Mobile"]
  
  # Reutilizando alias já declarados
  api --> |300| catalog["Catalog Service"]
```

### Metadados e enriquecimento (Tooltips)

Para fornecer contexto arquitetural rico (Linguagem, Squad, Nuvem, etc.), adicione um bloco JSON-like `{ ... }` na frente do nó. Essas informações serão compiladas e exibidas quando o usuário passar o mouse (Hover/Tooltip) sobre o serviço.

```
  checkout["Checkout API"] { lang: Go, squad: Core Checkout, infra: EKS }
  db["PostgreSQL"] { type: Database, tier: Mission Critical, rds: true }
  
  checkout --> |450000| db
```


## 3. Importação de Dados do Datadog

A maior vantagem do SysGraph é sua integração com sistemas de Observabilidade. O SysGraph é capaz de compilar centenas de linhas de Traces e Spans e gerar a topologia matemática automaticamente.

### Como funciona o Parser CSV

Temos uma função `SysGraph.fromCSV(csvText)` nativa que:

1. Agrupa todas as chamadas entre serviços iguais (A -> B).
2. Calcula a média matemática da latência (duration).
3. Deduplica e consolida os metadados (squad, comunidade).
4. Escreve e devolve a sintaxe pronta do SysGraph.

### Formato esperado no CSV

Seu extrato de banco de dados/Datadog precisa conter as seguintes colunas (a ordem exata importará na hora da conversão, ou adapte as posições na função do parser):

Coluna,Descrição
sigla,Identificador do domínio.
trace_id,Hash do trace (ignorado na média final).
from_alias,ID único (UUID) do serviço de origem.
from_service,Nome legível do serviço de origem.
to_alias,ID único (UUID) do serviço de destino.
to_service,Nome legível do serviço de destino.
comunidade,Metadado organizacional.
squad,Metadado organizacional.
language,"Metadado técnico (Go, Node, Java)."
repo_url,Metadado técnico.
duration,O valor bruto da latência (ex: Nanossegundos).

### Exemplo de linha extraída:

`ECO, 1a2b3c, 111-111, API Gateway, 222-222, BFF Web, Plataforma, Edge, Nginx, github.com/api, 45000000`

Basta clicar em **+ Upload Datadog CSV** na interface principal, selecionar o arquivo e a mágica acontece.

## 4. Portabilidade (Angular, Obsidian e VS Code)

O core matemático do SysGraph (`sysgraph.js`) foi construído seguindo o padrão UMD (Universal Module Definition). Isso significa que a engine funciona em:

1. **Angular / Web Genérica:** Rodando via `window.d3` e injetando o SVG e o Tooltip direto no elemento referenciado via `@ViewChild`.
2. **Obsidian MD:** Importado via `require('./sysgraph')`, interceptando os blocos de código `sysgraph` e desenhando o layout nas anotações nativas.
3. **VS Code Extensions (Futuro):** Pode ser importado diretamente na Webview de uma extensão de arquitetura sem nenhuma alteração no Parser.