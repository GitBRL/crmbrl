import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideDownload, LucideShieldCheck, LucideTriangleAlert } from '@lucide/angular';

import { erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService, textoConfere } from '../../nucleo/confirmacao.service';
import { formatarData, paraCampoData } from '../../nucleo/formatos';
import { SessaoService } from '../../nucleo/sessao/sessao.service';
import { Alternador } from '../../ui/alternador/alternador';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CampoData, localParaIso } from '../../ui/campo-data/campo-data';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Dica } from '../../ui/dica/dica';
import { Modal } from '../../ui/modal/modal';
import { gerarId } from '../../ui/tipos';
import { ContatosApi } from './contatos.api';
import {
  alteracaoNaoContatarWhatsapp,
  type Contato,
  marcadoNaoContatarWhatsapp,
  primeiroNome,
} from './contatos.tipos';

/**
 * Bloco LGPD do contato (R4.6): opt-out de marketing (efeito imediato), consentimento (de onde
 * veio e quando; registrar ou remover) e, só para o Admin, a exclusão com anonimização, com
 * confirmação forte (digitar o primeiro nome) e o motivo, que fica na auditoria.
 */
@Component({
  selector: 'app-bloco-lgpd',
  imports: [
    Alternador,
    AreaTexto,
    Botao,
    CampoData,
    CampoTexto,
    Dica,
    LucideShieldCheck,
    LucideTriangleAlert,
    Modal,
  ],
  templateUrl: './bloco-lgpd.html',
  styleUrl: './bloco-lgpd.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlocoLgpd {
  readonly contato = input.required<Contato>();
  /** O contato mudou (opt-out, consentimento): o detalhe troca o que mostra. */
  readonly atualizado = output<Contato>();
  /** Anonimizado: o contato some das listas (o detalhe volta para a lista). */
  readonly anonimizado = output<void>();

  private readonly api = inject(ContatosApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly sessao = inject(SessaoService);

  protected readonly formatarData = formatarData;
  protected readonly idTitulo = gerarId('lgpd');
  protected readonly podeAnonimizar = computed(
    () => this.sessao.permissoes()?.anonimizarContatos === true,
  );
  protected readonly podeEditar = computed(() => this.contato().podeEditar);
  protected readonly salvandoOptOut = signal(false);
  private readonly optOutPendente = signal<boolean | null>(null);
  /** Valor otimista do alternador enquanto a API responde. */
  protected readonly optOut = computed(
    () => this.optOutPendente() ?? this.contato().optOutMarketing,
  );
  protected readonly dicaOptOut = computed(() => {
    const contato = this.contato();
    const situacao = contato.optOutMarketing
      ? `Não recebe disparos nem automações de marketing${contato.optOutEm ? ` desde ${formatarData(contato.optOutEm)}` : ''}.`
      : 'Pode receber disparos e automações de marketing.';
    return contato.podeEditar ? situacao : `${situacao} ${this.motivoSemEdicao()}`;
  });

  // ----- Não contatar por WhatsApp (régua de cobrança, R24) ---------------------------------------

  protected readonly salvandoWhatsapp = signal(false);
  private readonly whatsappPendente = signal<boolean | null>(null);
  protected readonly naoContatar = computed(
    () => this.whatsappPendente() ?? marcadoNaoContatarWhatsapp(this.contato()),
  );
  protected readonly dicaWhatsapp = computed(() => {
    const situacao = marcadoNaoContatarWhatsapp(this.contato())
      ? 'A cobrança deste contato não sai por WhatsApp: a régua usa só e-mail e ligação.'
      : 'A régua de cobrança pode cobrar este contato por WhatsApp.';
    return this.contato().podeEditar ? situacao : `${situacao} ${this.motivoSemEdicao()}`;
  });

  // ----- Consentimento --------------------------------------------------------------------------

  protected readonly consentimentoAberto = signal(false);
  protected readonly origemConsentimento = signal('');
  protected readonly idFormConsentimento = gerarId('consentimento');
  protected readonly idFormAnonimizar = gerarId('anonimizar');
  protected readonly dataConsentimento = signal<string | null>(null);
  protected readonly erroConsentimento = signal<string | null>(null);
  protected readonly salvandoConsentimento = signal(false);
  protected readonly hoje = paraCampoData(new Date());

  // ----- Exportação dos dados pessoais (LGPD art. 18, só Admin) ---------------------------------

  protected readonly iconeBaixar = LucideDownload;
  protected readonly exportando = signal(false);
  protected readonly erroExportacao = signal<string | null>(null);

  protected async exportar(): Promise<void> {
    this.exportando.set(true);
    this.erroExportacao.set(null);
    try {
      const dados = await this.api.dadosPessoais(this.contato().id);
      const arquivo = new Blob([JSON.stringify(dados, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = url;
      // O nome do arquivo usa o identificador, não o nome da pessoa.
      link.download = `dados-pessoais-${this.contato().id}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      this.avisos.sucesso('Arquivo com os dados pessoais baixado.');
    } catch (falha) {
      this.erroExportacao.set(erroDaApi(falha).mensagem);
    } finally {
      this.exportando.set(false);
    }
  }

  // ----- Anonimização ---------------------------------------------------------------------------

  protected readonly anonimizacaoAberta = signal(false);
  protected readonly motivo = signal('');
  protected readonly confirmacaoDigitada = signal('');
  protected readonly anonimizando = signal(false);
  protected readonly erroAnonimizacao = signal<string | null>(null);
  protected readonly nomeEsperado = computed(() => primeiroNome(this.contato().nome));
  protected readonly confere = computed(() =>
    textoConfere(this.confirmacaoDigitada(), this.nomeEsperado()),
  );

  protected readonly motivoSemEdicao = computed(() => {
    switch (this.sessao.permissoes()?.editarContatos) {
      case 'EQUIPE':
        return 'Só quem é responsável pelo contato (você ou alguém da sua equipe) muda isso.';
      case 'PROPRIOS':
        return 'Só o responsável pelo contato muda isso.';
      default:
        return 'Seu papel não altera contatos.';
    }
  });

  protected async mudarWhatsapp(ligado: boolean): Promise<void> {
    const contato = this.contato();
    this.whatsappPendente.set(ligado);
    this.salvandoWhatsapp.set(true);
    try {
      const atualizado = await this.api.atualizarContato(
        contato.id,
        alteracaoNaoContatarWhatsapp(contato, ligado),
      );
      this.avisos.sucesso(
        ligado
          ? `${primeiroNome(contato.nome)} não será mais cobrado por WhatsApp.`
          : `${primeiroNome(contato.nome)} pode voltar a ser cobrado por WhatsApp.`,
      );
      this.atualizado.emit(atualizado);
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.whatsappPendente.set(null);
      this.salvandoWhatsapp.set(false);
    }
  }

  protected async mudarOptOut(ligado: boolean): Promise<void> {
    const contato = this.contato();
    this.optOutPendente.set(ligado);
    this.salvandoOptOut.set(true);
    try {
      const atualizado = await this.api.atualizarContato(contato.id, { optOutMarketing: ligado });
      this.avisos.sucesso(
        ligado
          ? `Opt-out ligado: ${primeiroNome(contato.nome)} não recebe mais marketing.`
          : `Opt-out desligado: ${primeiroNome(contato.nome)} pode voltar a receber marketing.`,
      );
      this.atualizado.emit(atualizado);
    } catch (falha) {
      this.avisos.erro(erroDaApi(falha));
    } finally {
      this.optOutPendente.set(null);
      this.salvandoOptOut.set(false);
    }
  }

  protected abrirConsentimento(): void {
    this.origemConsentimento.set('');
    this.dataConsentimento.set(this.hoje);
    this.erroConsentimento.set(null);
    this.consentimentoAberto.set(true);
  }

  protected async salvarConsentimento(): Promise<void> {
    const origem = this.origemConsentimento().trim();
    if (!origem) {
      this.erroConsentimento.set('Diga de onde veio o consentimento (ex.: formulário do site).');
      return;
    }
    const data = this.dataConsentimento();
    // Hoje vale "agora" (a meia-noite de hoje também serviria, mas a hora certa é melhor).
    const em = data && data !== this.hoje ? localParaIso(data, 'data') : null;
    this.salvandoConsentimento.set(true);
    try {
      const atualizado = await this.api.atualizarContato(this.contato().id, {
        consentimento: em ? { origem, em } : { origem },
      });
      this.avisos.sucesso('Consentimento registrado.');
      this.consentimentoAberto.set(false);
      this.atualizado.emit(atualizado);
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.erroConsentimento.set(
        erro.mensagemDoCampo('consentimento.em') ??
          erro.mensagemDoCampo('consentimento.origem') ??
          erro.mensagem,
      );
    } finally {
      this.salvandoConsentimento.set(false);
    }
  }

  protected async removerConsentimento(): Promise<void> {
    const contato = this.contato();
    let atualizado: Contato | null = null;
    const confirmado = await this.confirmacao.confirmar({
      titulo: 'Remover o consentimento?',
      mensagem: `O registro de consentimento de ${contato.nome} sai do contato. A auditoria guarda que ele existiu.`,
      confirmar: 'Remover consentimento',
      perigo: true,
      executar: async () => {
        atualizado = await this.api.atualizarContato(contato.id, { consentimento: null });
      },
    });
    if (confirmado && atualizado) {
      this.avisos.sucesso('Consentimento removido.');
      this.atualizado.emit(atualizado);
    }
  }

  protected abrirAnonimizacao(): void {
    this.motivo.set('');
    this.confirmacaoDigitada.set('');
    this.erroAnonimizacao.set(null);
    this.anonimizacaoAberta.set(true);
  }

  protected async anonimizar(): Promise<void> {
    if (!this.confere()) {
      this.erroAnonimizacao.set(`Digite “${this.nomeEsperado()}” para confirmar.`);
      return;
    }
    this.anonimizando.set(true);
    this.erroAnonimizacao.set(null);
    try {
      await this.api.anonimizarContato(this.contato().id, this.motivo());
      this.avisos.sucesso('Contato anonimizado: os dados pessoais foram apagados do CRM.');
      this.anonimizacaoAberta.set(false);
      this.anonimizado.emit();
    } catch (falha) {
      this.erroAnonimizacao.set(erroDaApi(falha).mensagem);
    } finally {
      this.anonimizando.set(false);
    }
  }
}
