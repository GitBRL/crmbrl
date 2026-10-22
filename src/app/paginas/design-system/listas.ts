import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  LucideEye,
  LucidePlus,
  LucideRefreshCw,
  LucideShare2,
  LucideUserMinus,
} from '@lucide/angular';

import { Abas, type ItemAba } from '../../ui/abas/abas';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { FiltrosPilula, type OpcaoFiltro } from '../../ui/filtros-pilula/filtros-pilula';
import { MenuAcoes, type ItemMenuAcoes } from '../../ui/menu-acoes/menu-acoes';
import { PainelLateral } from '../../ui/painel-lateral/painel-lateral';
import { Paginacao } from '../../ui/paginacao/paginacao';
import { Selo } from '../../ui/selo/selo';
import { CelulaTabela } from '../../ui/tabela/celula-tabela';
import { Tabela, type ColunaTabela, type Ordenacao } from '../../ui/tabela/tabela';
import { Exemplo } from './exemplo';
import { Secao } from './secao';

interface ContatoExemplo {
  readonly id: number;
  readonly nome: string;
  readonly empresa: string;
  readonly origem: 'Site' | 'WhatsApp' | 'Indicação';
  readonly responsavel: string;
  readonly valor: number;
  readonly etiquetas: readonly string[];
}

const CONTATOS: readonly ContatoExemplo[] = [
  {
    id: 1,
    nome: 'Maria Souza',
    empresa: 'Escola Horizonte',
    origem: 'Site',
    responsavel: 'Ana Ribeiro',
    valor: 1500,
    etiquetas: ['quente'],
  },
  {
    id: 2,
    nome: 'João Batista',
    empresa: 'Colégio Atlas',
    origem: 'WhatsApp',
    responsavel: 'Carla Nogueira',
    valor: 4200,
    etiquetas: ['evento'],
  },
  {
    id: 3,
    nome: 'Beatriz Lima',
    empresa: 'Instituto Aurora',
    origem: 'Indicação',
    responsavel: 'Ana Ribeiro',
    valor: 980,
    etiquetas: ['indicacao'],
  },
  {
    id: 4,
    nome: 'Lucas Prado',
    empresa: 'Escola Nova Era',
    origem: 'Site',
    responsavel: 'Pedro Alves',
    valor: 2750,
    etiquetas: ['quente', 'evento'],
  },
  {
    id: 5,
    nome: 'Fernanda Rocha',
    empresa: 'Colégio Pioneiro',
    origem: 'WhatsApp',
    responsavel: 'Ana Ribeiro',
    valor: 3100,
    etiquetas: [],
  },
  {
    id: 6,
    nome: 'Rafael Souto',
    empresa: 'Escola Caminhos',
    origem: 'Indicação',
    responsavel: 'Carla Nogueira',
    valor: 640,
    etiquetas: ['indicacao'],
  },
  {
    id: 7,
    nome: 'Juliana Freitas',
    empresa: 'Colégio Vértice',
    origem: 'Site',
    responsavel: 'Pedro Alves',
    valor: 5300,
    etiquetas: ['quente'],
  },
  {
    id: 8,
    nome: 'Thiago Moreira',
    empresa: 'Escola do Saber',
    origem: 'WhatsApp',
    responsavel: 'Ana Ribeiro',
    valor: 1870,
    etiquetas: ['evento'],
  },
];

const SELO_ORIGEM = { Site: 'ciano', WhatsApp: 'menta', Indicação: 'lima' } as const;

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Seção 13 do catálogo: filtros, tabela (que vira cartões no estreito), paginação, esqueleto e
 * estado vazio — juntos, como numa tela de lista. A linha abre o painel lateral. Uso interno
 * de paginas/design-system.
 */
@Component({
  selector: 'app-ds-listas',
  imports: [
    Exemplo,
    Secao,
    Abas,
    Avatar,
    Botao,
    CelulaTabela,
    Esqueleto,
    EstadoVazio,
    FiltrosPilula,
    MenuAcoes,
    PainelLateral,
    Paginacao,
    Selo,
    Tabela,
  ],
  templateUrl: './listas.html',
  styleUrl: './listas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Listas {
  protected readonly iconeMais = LucidePlus;
  protected readonly iconeAtualizar = LucideRefreshCw;
  protected readonly seloOrigem = SELO_ORIGEM;
  protected readonly moeda = moeda;

  protected readonly escopos: readonly OpcaoFiltro[] = [
    { id: 'meus', rotulo: 'Meus' },
    { id: 'equipe', rotulo: 'Da equipe' },
    { id: 'todos', rotulo: 'Todos', desabilitada: true, motivo: 'Só C-level e Admin veem todos.' },
  ];
  protected readonly etiquetas: readonly OpcaoFiltro[] = [
    { id: 'quente', rotulo: 'Quente' },
    { id: 'evento', rotulo: 'Evento' },
    { id: 'indicacao', rotulo: 'Indicação' },
  ];
  protected readonly escopo = signal<string | null>('equipe');
  protected readonly etiquetasMarcadas = signal<readonly string[]>([]);

  protected readonly estados: readonly ItemAba[] = [
    { id: 'dados', rotulo: 'Dados' },
    { id: 'carregando', rotulo: 'Carregando' },
    { id: 'vazio', rotulo: 'Vazio' },
    { id: 'erro', rotulo: 'Erro' },
  ];
  protected readonly estado = signal<string | null>('dados');

  protected readonly colunas: readonly ColunaTabela[] = [
    { id: 'nome', rotulo: 'Nome', ordenavel: true },
    { id: 'empresa', rotulo: 'Empresa', ordenavel: true },
    { id: 'origem', rotulo: 'Origem' },
    { id: 'responsavel', rotulo: 'Responsável', noCartao: 'ocultar' },
    { id: 'valor', rotulo: 'Valor', alinhar: 'fim', ordenavel: true },
    {
      id: 'acoes',
      rotulo: 'Ações',
      rotuloOculto: true,
      alinhar: 'fim',
      largura: '4rem',
      fixa: true,
    },
  ];
  protected readonly ordenacao = signal<Ordenacao | null>({ coluna: 'nome', direcao: 'asc' });
  protected readonly pagina = signal(1);
  protected readonly porPagina = signal(5);

  protected readonly filtrados = computed(() => {
    if (this.estado() === 'vazio') {
      return [];
    }
    const marcadas = this.etiquetasMarcadas();
    const lista = CONTATOS.filter(
      (contato) =>
        (this.escopo() !== 'meus' || contato.responsavel === 'Ana Ribeiro') &&
        marcadas.every((etiqueta) => contato.etiquetas.includes(etiqueta)),
    );
    const ordem = this.ordenacao();
    if (!ordem) {
      return lista;
    }
    const chave = ordem.coluna as 'nome' | 'empresa' | 'valor';
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) =>
      typeof a[chave] === 'number'
        ? sinal * ((a[chave] as number) - (b[chave] as number))
        : sinal * String(a[chave]).localeCompare(String(b[chave]), 'pt-BR'),
    );
  });

  protected readonly paginaAtual = computed(() => {
    const inicio = (this.pagina() - 1) * this.porPagina();
    return this.filtrados().slice(inicio, inicio + this.porPagina());
  });

  // Painel lateral (detalhe do contato)
  protected readonly aberto = signal<ContatoExemplo | null>(null);
  protected readonly painelAberto = signal(false);
  protected readonly ultimaAcao = signal('');
  protected readonly acoesContato: readonly ItemMenuAcoes[] = [
    { id: 'ver', rotulo: 'Ver negócios', icone: LucideEye },
    { id: 'compartilhar', rotulo: 'Compartilhar', icone: LucideShare2 },
    {
      id: 'anonimizar',
      rotulo: 'Anonimizar (LGPD)',
      icone: LucideUserMinus,
      perigo: true,
      separarAntes: true,
      desabilitado: true,
      motivo: 'Só o Admin pode anonimizar.',
    },
  ];

  protected abrir(contato: ContatoExemplo): void {
    this.aberto.set(contato);
    this.painelAberto.set(true);
  }

  protected aoMudarFiltro(): void {
    this.pagina.set(1);
  }

  protected agir(acao: ItemMenuAcoes, contato: ContatoExemplo): void {
    this.ultimaAcao.set(`${acao.rotulo}: ${contato.nome}`);
  }
}
