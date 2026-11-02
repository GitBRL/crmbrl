/**
 * Dados do catálogo (DESIGN-SYSTEM.md §2): nome, papel e uso de cada token. Os valores (hex,
 * transparências) não ficam aqui: a página lê o valor real de cada token no CSS
 * (src/styles/_tokens.scss), nos dois temas, depois de renderizar (fundamentos.ts).
 */

export interface CorBase {
  readonly token: string;
  readonly papel: string;
}

export const PALETA_BASE: readonly CorBase[] = [
  { token: '--pb-preto', papel: 'Fundo do tema escuro' },
  { token: '--pb-branco', papel: 'Texto no escuro; superfície no claro' },
  { token: '--pb-ciano', papel: 'Dado 1 · informação' },
  { token: '--pb-menta', papel: 'Dado 2 · sucesso' },
  { token: '--pb-lima', papel: 'Dado 3 · marca · foco (escuro)' },
  { token: '--pb-coral', papel: 'Ativo/selecionado · arrastar · destaque' },
];

/** Como a amostra mostra o token: bloco de cor, texto "Aa", contorno ou o símbolo da marca. */
export type FormaAmostra = 'fundo' | 'texto' | 'borda' | 'logo';

export interface TokenCor {
  readonly token: string;
  readonly uso: string;
  readonly forma: FormaAmostra;
  /** Fundo da amostra de texto (tokens "sobre-*": o texto em cima da cor dele). */
  readonly fundo?: string;
}

export interface GrupoTokens {
  readonly titulo: string;
  readonly tokens: readonly TokenCor[];
}

export const TOKENS_COR: readonly GrupoTokens[] = [
  {
    titulo: 'Superfícies',
    tokens: [
      {
        token: '--cor-fundo',
        uso: 'Fundo da página',
        forma: 'fundo',
      },
      {
        token: '--cor-superficie',
        uso: 'Cartões e painéis',
        forma: 'fundo',
      },
      {
        token: '--cor-superficie-2',
        uso: 'Pílulas, chips e campos',
        forma: 'fundo',
      },
      {
        token: '--cor-superficie-3',
        uso: 'Botão-ícone, selo de tipo, hover',
        forma: 'fundo',
      },
      {
        token: '--cor-flutuante',
        uso: 'Balões e menus',
        forma: 'fundo',
      },
      {
        token: '--cor-vidro',
        uso: 'Controles sobre o palco',
        forma: 'fundo',
      },
      {
        token: '--cor-vidro-forte',
        uso: 'Selo neutro, botão da dica, hover sobre o palco',
        forma: 'fundo',
      },
      {
        token: '--cor-veu',
        uso: 'Véu atrás do modal',
        forma: 'fundo',
      },
      {
        token: '--cor-inverso',
        uso: 'Ação principal, item ativo',
        forma: 'fundo',
      },
      {
        token: '--cor-sobre-inverso',
        uso: 'Conteúdo sobre o inverso',
        forma: 'texto',
        fundo: '--cor-inverso',
      },
    ],
  },
  {
    titulo: 'Texto e linhas',
    tokens: [
      {
        token: '--cor-texto',
        uso: 'Texto principal',
        forma: 'texto',
      },
      {
        token: '--cor-texto-suave',
        uso: 'Secundário, abas inativas',
        forma: 'texto',
      },
      {
        token: '--cor-texto-fraco',
        uso: 'Legendas, segundo tom',
        forma: 'texto',
      },
      {
        token: '--cor-borda',
        uso: 'Divisórias e contornos sutis',
        forma: 'borda',
      },
      {
        token: '--cor-borda-forte',
        uso: 'Pílula contorno, zona de soltar',
        forma: 'borda',
      },
      {
        token: '--cor-contorno-dado',
        uso: 'Contorno de 1px nos preenchimentos de dado (só no claro)',
        forma: 'borda',
      },
      {
        token: '--cor-contorno-controle',
        uso: 'Contorno do botão-ícone neutro e da aba inativa (só no claro)',
        forma: 'borda',
      },
      {
        token: '--cor-logo',
        uso: 'Logo BRL CRM, sempre numa cor só: preto no claro, branco no escuro (§9)',
        forma: 'logo',
      },
    ],
  },
  {
    titulo: 'Destaque, marca e estados',
    tokens: [
      {
        token: '--cor-destaque',
        uso: 'Ativo, selecionado, arrastando',
        forma: 'fundo',
      },
      {
        token: '--cor-sobre-destaque',
        uso: 'Conteúdo sobre o coral',
        forma: 'texto',
        fundo: '--cor-destaque',
      },
      {
        token: '--cor-destaque-texto',
        uso: 'Coral usado como texto',
        forma: 'texto',
      },
      {
        token: '--cor-marca',
        uso: 'Assinatura: IA, selos de marca',
        forma: 'fundo',
      },
      {
        token: '--cor-sobre-marca',
        uso: 'Conteúdo sobre o lima',
        forma: 'texto',
        fundo: '--cor-marca',
      },
      {
        token: '--cor-foco',
        uso: 'Anel de foco',
        forma: 'borda',
      },
      {
        token: '--cor-sucesso',
        uso: 'Texto/ícone de sucesso',
        forma: 'texto',
      },
      {
        token: '--cor-info',
        uso: 'Texto/ícone informativo',
        forma: 'texto',
      },
      {
        token: '--cor-aviso',
        uso: 'Texto/ícone de atenção',
        forma: 'texto',
      },
      {
        token: '--cor-erro',
        uso: 'Erro e ponto de notificação',
        forma: 'texto',
      },
      {
        token: '--cor-sobre-erro',
        uso: 'Contagem sobre o ponto de erro',
        forma: 'texto',
        fundo: '--cor-erro',
      },
    ],
  },
];

export interface TokenFonte {
  readonly token: string;
  readonly medida: string;
  readonly uso: string;
  readonly exemplo: string;
  readonly complemento?: string;
  /** Tracking do token, quando há (`--tracking-display`, `--tracking-titulo`). */
  readonly tracking?: string;
}

/** Os 13 tokens de fonte do DESIGN-SYSTEM.md §2.3, na mesma ordem. */
export const TIPOGRAFIA: readonly TokenFonte[] = [
  {
    token: '--fonte-display',
    medida: '56/1.05 · 300 · −0,02em (36px abaixo de 900px)',
    uso: 'Título da página',
    exemplo: 'Visão geral',
    complemento: '· outubro',
    tracking: '--tracking-display',
  },
  {
    token: '--fonte-numero',
    medida: '56/1 · 300 · −0,02em (44px abaixo de 600px)',
    uso: 'Métricas grandes (KPI); a unidade fica em 0,7em',
    exemplo: '17 %',
    tracking: '--tracking-display',
  },
  {
    token: '--fonte-h1',
    medida: '40/1.1 · 300 · −0,01em (30px abaixo de 600px)',
    uso: 'Títulos de seção grandes',
    exemplo: 'Funis e relacionamento',
    tracking: '--tracking-titulo',
  },
  {
    token: '--fonte-h2',
    medida: '28/1.2 · 400 (24px abaixo de 600px)',
    uso: 'Título de modais',
    exemplo: 'Análise com IA',
    complemento: '· beta',
  },
  {
    token: '--fonte-h3',
    medida: '20/1.3 · 500',
    uso: 'Título de cartão',
    exemplo: 'Atividades recentes',
  },
  {
    token: '--fonte-lead',
    medida: '17/1.5 · 400',
    uso: 'A frase de topo das páginas',
    exemplo: 'Da captação do lead ao sucesso do cliente, em um só lugar.',
  },
  {
    token: '--fonte-corpo',
    medida: '15/1.5 · 400',
    uso: 'Texto corrido',
    exemplo: 'O lead chega por webhook, é qualificado pelo Marketing e segue para o Comercial.',
  },
  {
    token: '--fonte-corpo-sm',
    medida: '14/1.5 · 400',
    uso: 'Texto de balões (dica), "quando usar" do catálogo',
    exemplo: 'Lead qualificado pelo Marketing: tem perfil e interesse para o Comercial abordar.',
  },
  {
    token: '--fonte-rotulo',
    medida: '14/1.2 · 500',
    uso: 'Botões, pílulas, abas, chips',
    exemplo: 'Compartilhar',
  },
  {
    token: '--fonte-legenda-lg',
    medida: '13/1.35 · 400',
    uso: 'Notas e metadados um pouco maiores que a legenda (nota do palco, status)',
    exemplo: 'Os números desta tela são de exemplo.',
  },
  {
    token: '--fonte-legenda',
    medida: '12/1.35 · 400',
    uso: 'Legendas de KPI, metadados',
    exemplo: 'Conversão total do funil',
  },
  {
    token: '--fonte-micro',
    medida: '11/1.2 · 500',
    uso: 'Rótulos dentro de barras de dado, selo sm',
    exemplo: 'Site 700 · WhatsApp 300',
  },
  {
    token: '--fonte-numero-pequeno',
    medida: '20/1.2 · 300',
    uso: 'Total da etapa no funil',
    exemplo: '1.600',
  },
];

export const ESPACOS: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];

export interface TokenRaio {
  readonly token: string;
  readonly valor: string;
  readonly uso: string;
}

export const RAIOS: readonly TokenRaio[] = [
  { token: '--raio-sm', valor: '12px', uso: 'Balões, itens pequenos' },
  { token: '--raio-md', valor: '16px', uso: 'Campos multilinha, miniaturas' },
  { token: '--raio-lg', valor: '24px', uso: 'Painéis internos, cartões no mobile' },
  { token: '--raio-xl', valor: '28px', uso: 'Cartões' },
  { token: '--raio-2xl', valor: '36px', uso: 'Palco e modais' },
  { token: '--raio-pilula', valor: '999px', uso: 'Pílulas, chips, selos, barras' },
];

export interface TokenSimples {
  readonly token: string;
  readonly valor: string;
  readonly uso: string;
}

export const ALTURAS: readonly TokenSimples[] = [
  { token: '--altura-sm', valor: '36px', uso: 'Chips, botões pequenos' },
  { token: '--altura-md', valor: '44px', uso: 'Padrão (alvo de toque)' },
  { token: '--altura-lg', valor: '52px', uso: 'Ação de destaque' },
];

export const MOVIMENTO: readonly TokenSimples[] = [
  { token: '--duracao-rapida', valor: '120ms', uso: 'Pressionar, pequenos retornos' },
  { token: '--duracao', valor: '200ms', uso: 'Cores, hover, abrir e fechar' },
  { token: '--duracao-lenta', valor: '320ms', uso: 'Barras de dado crescendo' },
  { token: '--duracao-opacidade', valor: '120ms', uso: 'Fades curtos de balão e modal' },
  { token: '--curva', valor: 'cubic-bezier(.2, 0, 0, 1)', uso: 'Todas as transições' },
];

/** Camadas (z-index) do que fica por cima do conteúdo. */
export const CAMADAS: readonly TokenSimples[] = [
  { token: '--z-cabecalho', valor: '20', uso: 'Barra superior fixa' },
  { token: '--z-gaveta', valor: '40', uso: 'Gaveta da navegação no mobile' },
  { token: '--z-flutuante', valor: '60', uso: 'Menus e balões' },
];

export const PONTOS_DE_QUEBRA: readonly TokenSimples[] = [
  { token: 'sm', valor: '600px', uso: 'Abaixo: tipografia e paddings menores' },
  { token: 'md', valor: '900px', uso: 'Abaixo: mobile (gaveta, uma coluna)' },
  { token: 'lg', valor: '1200px', uso: 'A partir daqui: desktop' },
  { token: 'xl', valor: '1440px', uso: 'Telas largas' },
];
