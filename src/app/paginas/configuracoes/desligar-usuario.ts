import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { LucideRefreshCw, LucideTriangleAlert } from '@lucide/angular';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { textoConfere } from '../../nucleo/confirmacao.service';
import { Avatar } from '../../ui/avatar/avatar';
import { Botao } from '../../ui/botao/botao';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Modal } from '../../ui/modal/modal';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { gerarId } from '../../ui/tipos';
import { Carregamento } from './carregamento';
import { ConfiguracoesApi } from './configuracoes.api';
import type {
  PreviaDesligamento,
  ResultadoDesligamento,
  Usuario,
  UsuarioResumo,
} from './configuracoes.modelos';
import { fraseDoEncaminhamento, itensEncaminhados, juntarNomes, primeiroNome } from './hierarquia';

/**
 * Desligar usuário (TELAS-FASE1 §6, R7): o modal mostra a prévia da API (R7.1) — quem recebe e
 * quanto —, pede o C-level destinatário quando quem sai é C-level (R7.2) e só libera o botão
 * depois de digitar o primeiro nome da pessoa. Se a situação mudar entre a prévia e a
 * confirmação (409), a prévia é refeita e o motivo aparece no próprio modal.
 */
@Component({
  selector: 'app-desligar-usuario',
  imports: [Modal, Botao, Seletor, CampoTexto, Avatar, Esqueleto, EstadoVazio, LucideTriangleAlert],
  templateUrl: './desligar-usuario.html',
  styleUrl: './desligar-usuario.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesligarUsuario {
  /** Quem será desligado; `null` = fechado. */
  readonly usuario = input<Usuario | null>(null);
  readonly desligado = output<ResultadoDesligamento>();
  readonly fechado = output<void>();

  private readonly api = inject(ConfiguracoesApi);
  private readonly avisos = inject(AvisosService);

  protected readonly iconeTentar = LucideRefreshCw;
  protected readonly idFormulario = gerarId('desligar');
  protected readonly previa = new Carregamento<PreviaDesligamento>();
  /** C-level desligado: os C-levels que podem receber (vêm da primeira prévia). */
  protected readonly candidatos = signal<readonly UsuarioResumo[]>([]);
  protected readonly exigeEscolha = signal(false);
  protected readonly escolhido = signal<string | null>(null);
  protected readonly digitado = signal('');
  protected readonly enviando = signal(false);
  protected readonly erroAcao = signal<ErroApi | null>(null);

  protected readonly aberto = computed(() => this.usuario() !== null);
  protected readonly nome = computed(() => this.usuario()?.nome ?? '');
  protected readonly primeiro = computed(() => primeiroNome(this.nome()));
  protected readonly rotuloConfirmacao = computed(
    () => `Digite “${this.primeiro()}” para confirmar`,
  );
  protected readonly opcoesCandidatos = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.candidatos().map((candidato) => ({ valor: candidato.id, rotulo: candidato.nome })),
  );
  protected readonly frase = computed(() => {
    const previa = this.previa.dados();
    return previa ? fraseDoEncaminhamento(previa) : '';
  });
  /** Liderados, responsável fixo: o que vai junto além dos itens da frase. */
  protected readonly consequencias = computed(() => {
    const previa = this.previa.dados();
    if (!previa) {
      return [];
    }
    const primeiro = this.primeiro();
    const destino = previa.destinatario?.nome ?? 'o C-level escolhido';
    const lista: string[] = [];
    if (previa.liderados.length > 0) {
      const nomes = juntarNomes(previa.liderados.map((liderado) => liderado.nome));
      const verbo = previa.liderados.length === 1 ? 'passa' : 'passam';
      lista.push(`${nomes} ${verbo} a responder a ${destino} até você definir um novo líder.`);
    }
    const fixo = itensEncaminhados(previa.contagens).find((i) => i.chave === 'responsavelFixo');
    if (fixo) {
      lista.push(`${fixo.quantidade} ${fixo.rotulo} passam a ter ${destino} como responsável.`);
    }
    if (previa.alertaEquipeSemLider) {
      lista.push('Os Admins recebem o alerta “equipe sem líder” para escolher o novo líder.');
    }
    lista.push(
      `${primeiro} perde o acesso na hora (as sessões abertas são encerradas) e sai dos rodízios de distribuição.`,
    );
    return lista;
  });
  protected readonly confere = computed(() => textoConfere(this.digitado(), this.primeiro()));
  protected readonly podeDesligar = computed(
    () =>
      this.previa.dados()?.destinatario != null &&
      !this.previa.carregando() &&
      this.confere() &&
      !this.enviando(),
  );

  constructor() {
    effect(() => {
      const usuario = this.usuario();
      if (usuario) {
        untracked(() => this.comecar(usuario));
      }
    });
  }

  protected fechar(): void {
    this.fechado.emit();
  }

  protected aoEscolher(destinatarioId: string | null): void {
    this.escolhido.set(destinatarioId);
    this.erroAcao.set(null);
    const usuario = this.usuario();
    if (usuario && destinatarioId) {
      void this.carregarPrevia(usuario.id, destinatarioId);
    }
  }

  protected tentarDeNovo(): void {
    const usuario = this.usuario();
    if (usuario) {
      void this.carregarPrevia(usuario.id, this.escolhido());
    }
  }

  protected async desligar(evento?: Event): Promise<void> {
    evento?.preventDefault();
    const usuario = this.usuario();
    const destinatario = this.previa.dados()?.destinatario;
    if (!usuario || !destinatario || !this.podeDesligar()) {
      return;
    }
    this.enviando.set(true);
    this.erroAcao.set(null);
    try {
      const resultado = await this.api.desligar(usuario.id, destinatario.id);
      this.avisos.sucesso(this.resumo(resultado));
      this.desligado.emit(resultado);
      this.fechado.emit();
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.erroAcao.set(erro);
      if (erro.ehConflito) {
        // A situação mudou desde a prévia (outro destinatário, ou já desligado): refaz.
        void this.carregarPrevia(usuario.id, this.escolhido(), false);
      }
    } finally {
      this.enviando.set(false);
    }
  }

  private comecar(usuario: Usuario): void {
    this.previa.limpar();
    this.candidatos.set([]);
    this.exigeEscolha.set(usuario.papel === 'C_LEVEL');
    this.escolhido.set(null);
    this.digitado.set('');
    this.erroAcao.set(null);
    this.enviando.set(false);
    void this.carregarPrevia(usuario.id, null, true);
  }

  private async carregarPrevia(
    id: string,
    destinatarioId: string | null,
    primeira = false,
  ): Promise<void> {
    const ok = await this.previa.executar(() => this.api.previaDesligamento(id, destinatarioId));
    const previa = this.previa.dados();
    if (ok && previa) {
      if (primeira) {
        this.exigeEscolha.set(previa.exigeEscolha);
      }
      // Com o destinatário escolhido a API não repete os candidatos: guarda os da primeira.
      if (previa.candidatos.length > 0) {
        this.candidatos.set(previa.candidatos);
      }
    }
  }

  /** "Pedro Santos foi desligado. 3 atividades, 2 negócios e 2 contatos foram para Rafael." */
  private resumo(resultado: ResultadoDesligamento): string {
    const itens = itensEncaminhados(resultado.contagens).filter((item) =>
      ['atividades', 'negocios', 'contatos', 'empresas'].includes(item.chave),
    );
    if (itens.length === 0) {
      return `${resultado.usuario.nome} foi desligado(a). Não havia nada para encaminhar.`;
    }
    const total = itens.reduce((soma, item) => soma + item.quantidade, 0);
    const lista = juntarNomes(itens.map((item) => `${item.quantidade} ${item.rotulo}`));
    const verbo = total === 1 ? 'foi' : 'foram';
    return `${resultado.usuario.nome} foi desligado(a). ${lista} ${verbo} para ${resultado.destinatario.nome}.`;
  }
}
