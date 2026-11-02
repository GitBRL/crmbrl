import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideArrowRight, LucideChevronRight, LucidePlus, LucideRefreshCw } from '@lucide/angular';
import { LucideDynamicIcon } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../../nucleo/api/erro-api';
import { AvisosService } from '../../../nucleo/avisos.service';
import { aoReceber, aoReconectar } from '../../../nucleo/tempo-real/auxiliares';
import type { EventoWhatsappConexao } from '../../../nucleo/tempo-real/eventos';
import { Botao } from '../../../ui/botao/botao';
import { Cartao } from '../../../ui/cartao/cartao';
import { Esqueleto } from '../../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../../ui/estado-vazio/estado-vazio';
import { GrupoOpcoes, type OpcaoGrupo } from '../../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../../ui/modal/modal';
import { Selo } from '../../../ui/selo/selo';
import { Carregamento } from '../carregamento';
import {
  contagemDoTipo,
  detalheDoCanal,
  detalheDoOficial,
  enviosDeHoje,
  linkDoCanal,
  linkDoNovo,
  resumoDoAquecimento,
  type SituacaoVisual,
  SITUACAO_WHATSAPP,
  situacaoDoCanal,
  situacaoDoOficial,
  resumoDosTemplates,
  telefoneDoNumero,
  textoDaFila,
  TIPO_DE_CANAL,
} from './apresentacao';
import { CanaisApi } from './canais.api';
import {
  type CanalBase,
  type CanalOficial,
  type ListaDeCanais,
  type NumeroWhatsapp,
  type TipoCanal,
  TIPOS_CANAL,
} from './canais.modelos';
import { ICONE_DO_CANAL } from './icones';
import { NovoNumero } from './whatsapp/novo-numero';

/** Um canal pronto para a lista. */
interface ItemDaLista {
  readonly id: string;
  readonly nome: string;
  readonly detalhe: string;
  readonly meta: readonly string[];
  readonly situacao: SituacaoVisual;
  /** Selo a mais: "Envios pausados", "Não recebe conversas novas". */
  readonly aviso: string | null;
  readonly link: readonly string[];
}

interface GrupoDaLista {
  readonly tipo: TipoCanal;
  readonly rotulo: string;
  readonly complemento: string;
  readonly descricao: string;
  readonly textoNovo: string;
  readonly itens: readonly ItemDaLista[];
  readonly erro: ErroApi | null;
}

/** Resultado de um `Promise.allSettled`: os dados ou o erro daquele tipo. */
type Parte<T> = { readonly dados: readonly T[] } | { readonly erro: ErroApi };

interface DadosDaLista {
  readonly lista: ListaDeCanais;
  readonly erros: Readonly<Partial<Record<keyof ListaDeCanais, ErroApi>>>;
}

/**
 * Configurações → Canais (`/configuracoes/canais`, Admin) — §6/§7 do contrato da Onda A: um
 * cartão por tipo de canal (WhatsApp, chat do site, e-mail, Instagram e Messenger), com os canais
 * de cada um, a situação e o atalho para criar. Mesmo sem nenhum canal, cada cartão explica o que
 * o tipo faz. O status dos números de WhatsApp muda ao vivo (`whatsapp.conexao`).
 */
@Component({
  selector: 'app-config-canais',
  imports: [
    RouterLink,
    LucideDynamicIcon,
    LucideChevronRight,
    Botao,
    Cartao,
    Esqueleto,
    EstadoVazio,
    GrupoOpcoes,
    Modal,
    NovoNumero,
    Selo,
  ],
  templateUrl: './canais.html',
  styleUrl: './canais.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Canais {
  private readonly api = inject(CanaisApi);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);

  protected readonly iconeNovo = LucidePlus;
  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly iconeSeguir = LucideArrowRight;
  protected readonly icones = ICONE_DO_CANAL;

  protected readonly dados = new Carregamento<DadosDaLista>();
  /** Status ao vivo dos números (evento `whatsapp.conexao`), por cima do que a lista trouxe. */
  private readonly aoVivo = signal<ReadonlyMap<string, EventoWhatsappConexao>>(new Map());

  protected readonly escolhendo = signal(false);
  protected readonly tipoEscolhido = signal<TipoCanal | null>('WHATSAPP');
  protected readonly novoNumeroAberto = signal(false);

  protected readonly opcoesTipo: readonly OpcaoGrupo<TipoCanal>[] = TIPOS_CANAL.map((tipo) => ({
    valor: tipo,
    rotulo: TIPO_DE_CANAL[tipo].rotulo,
    dica: TIPO_DE_CANAL[tipo].descricao,
    icone: ICONE_DO_CANAL[tipo],
  }));

  protected readonly grupos = computed<readonly GrupoDaLista[]>(() => {
    const dados = this.dados.dados();
    if (!dados) {
      return [];
    }
    const aoVivo = this.aoVivo();
    const { lista, erros } = dados;
    const meta = lista.meta ?? [];
    return TIPOS_CANAL.map((tipo) => {
      const visual = TIPO_DE_CANAL[tipo];
      let itens: readonly ItemDaLista[] = [];
      let erro: ErroApi | null = null;
      switch (tipo) {
        case 'WHATSAPP':
          erro = erros.whatsapp ?? null;
          itens = (lista.whatsapp ?? []).map((numero) => itemDoNumero(numero, aoVivo));
          break;
        case 'WHATSAPP_OFICIAL':
          erro = erros.oficial ?? null;
          itens = (lista.oficial ?? []).map(itemDoOficial);
          break;
        case 'WEBCHAT':
          erro = erros.site ?? null;
          itens = (lista.site ?? []).map(itemDoCanal);
          break;
        case 'EMAIL':
          erro = erros.email ?? null;
          itens = (lista.email ?? []).map(itemDoCanal);
          break;
        default:
          erro = erros.meta ?? null;
          itens = meta.filter((canal) => canal.tipo === tipo).map(itemDoCanal);
      }
      return {
        tipo,
        rotulo: visual.rotulo,
        complemento: erro ? '' : `· ${contagemDoTipo(tipo, itens.length)}`,
        descricao: visual.descricao,
        textoNovo: visual.textoNovo,
        itens,
        erro,
      };
    });
  });

  /** Todos os tipos falharam: a tela inteira vira o estado de erro. */
  protected readonly tudoFalhou = computed(() => {
    const dados = this.dados.dados();
    return dados !== null && Object.keys(dados.erros).length === 5 ? dados.erros.whatsapp! : null;
  });

  protected readonly nenhumCanal = computed(
    () =>
      this.dados.dados() !== null &&
      this.tudoFalhou() === null &&
      this.grupos().every((grupo) => grupo.itens.length === 0 && grupo.erro === null),
  );

  constructor() {
    this.carregar();
    aoReceber('whatsapp.conexao', (evento) =>
      this.aoVivo.update((atual) => new Map(atual).set(evento.numeroId, evento)),
    );
    aoReconectar(() => this.carregar());
  }

  protected carregar(): void {
    void this.dados.executar(async () => {
      const [whatsapp, site, email, meta, oficial] = await Promise.all([
        parte(this.api.listarNumeros()),
        parte(this.api.listarSites()),
        parte(this.api.listarEmails()),
        parte(this.api.listarMeta()),
        parte(this.api.listarOficiais()),
      ]);
      const erros: Partial<Record<keyof ListaDeCanais, ErroApi>> = {};
      const ler = <T>(chave: keyof ListaDeCanais, p: Parte<T>): readonly T[] | null => {
        if ('erro' in p) {
          erros[chave] = p.erro;
          return null;
        }
        return p.dados;
      };
      this.aoVivo.set(new Map());
      return {
        lista: {
          whatsapp: ler('whatsapp', whatsapp),
          site: ler('site', site),
          email: ler('email', email),
          meta: ler('meta', meta),
          oficial: ler('oficial', oficial),
        },
        erros,
      };
    });
  }

  protected abrirEscolha(): void {
    this.tipoEscolhido.set('WHATSAPP');
    this.escolhendo.set(true);
  }

  /** Segue para criar o tipo escolhido no modal "Novo canal". */
  protected seguirComEscolha(): void {
    const tipo = this.tipoEscolhido();
    if (!tipo) {
      return;
    }
    this.escolhendo.set(false);
    this.novo(tipo);
  }

  protected novo(tipo: TipoCanal): void {
    if (tipo === 'WHATSAPP') {
      this.novoNumeroAberto.set(true);
      return;
    }
    void this.router.navigate(linkDoNovo(tipo));
  }

  protected numeroCriado(numero: NumeroWhatsapp): void {
    this.avisos.sucesso(`Número “${numero.nome}” criado. Agora é só ler o QR.`);
    void this.router.navigate(linkDoCanal('WHATSAPP', numero.id), {
      queryParams: { conectar: '1' },
    });
  }
}

async function parte<T>(promessa: Promise<readonly T[]>): Promise<Parte<T>> {
  try {
    return { dados: await promessa };
  } catch (falha) {
    return { erro: erroDaApi(falha) };
  }
}

function itemDoNumero(
  numero: NumeroWhatsapp,
  aoVivo: ReadonlyMap<string, EventoWhatsappConexao>,
): ItemDaLista {
  const evento = aoVivo.get(numero.id);
  const status = evento?.status ?? numero.status;
  const telefone = evento?.telefone ?? numero.telefone;
  const meta = [textoDaFila(numero)];
  if (status === 'CONECTADO' || numero.hoje.enviados > 0) {
    meta.unshift(enviosDeHoje(numero));
  }
  if (numero.aquecimento.ativo) {
    meta.push(resumoDoAquecimento(numero));
  }
  return {
    id: numero.id,
    nome: numero.nome,
    detalhe: telefoneDoNumero({ telefone }),
    meta,
    situacao: SITUACAO_WHATSAPP[status],
    aviso: numero.pausa ? 'Envios pausados' : !numero.ativo ? 'Não recebe conversas novas' : null,
    link: linkDoCanal('WHATSAPP', numero.id),
  };
}

function itemDoOficial(canal: CanalOficial): ItemDaLista {
  return {
    id: canal.id,
    nome: canal.nome,
    detalhe: detalheDoOficial(canal),
    meta: [textoDaFila(canal), resumoDosTemplates(canal.templates)],
    situacao: situacaoDoOficial(canal),
    aviso: null,
    link: linkDoCanal(canal.tipo, canal.id),
  };
}

function itemDoCanal(
  canal: CanalBase & { dominios?: readonly string[]; endereco?: string; pageId?: string },
): ItemDaLista {
  return {
    id: canal.id,
    nome: canal.nome,
    detalhe: detalheDoCanal(canal),
    meta: [textoDaFila(canal)],
    situacao: situacaoDoCanal(canal),
    aviso: null,
    link: linkDoCanal(canal.tipo, canal.id),
  };
}
