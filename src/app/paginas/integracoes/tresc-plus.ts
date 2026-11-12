import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { ConfirmacaoService } from '../../nucleo/confirmacao.service';
import { formatarDataHora } from '../../nucleo/formatos';
import { TrescPlusApi } from '../../nucleo/tresc-plus/tresc-plus.api';
import type {
  CampanhaTresc,
  ConexaoTrescPlus,
  DadosConexaoTrescPlus,
  EstadoDoOuvinte,
  VinculoDoUsuario,
} from '../../nucleo/tresc-plus/tresc-plus.tipos';
import { Alternador } from '../../ui/alternador/alternador';
import { Botao } from '../../ui/botao/botao';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Cartao } from '../../ui/cartao/cartao';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Selo, type VarianteSelo } from '../../ui/selo/selo';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';

const OUVINTE: Readonly<Record<EstadoDoOuvinte, { rotulo: string; variante: VarianteSelo }>> = {
  conectado: { rotulo: 'Ouvinte conectado', variante: 'menta' },
  reconectando: { rotulo: 'Reconectando…', variante: 'lima' },
  desconectado: { rotulo: 'Ouvinte desconectado', variante: 'neutro' },
  erro: { rotulo: 'Ouvinte com erro', variante: 'coral' },
};

const ENVELOPES: readonly OpcaoSeletor<ConexaoTrescPlus['formatoEnvelope']>[] = [
  { valor: 'AUTO', rotulo: 'Automático (detecta)' },
  { valor: 'EVENTO_DADOS', rotulo: 'Evento e dados ({event, data})' },
  { valor: 'OBJETO', rotulo: 'Objeto (nome do evento + objeto)' },
];

/**
 * Cartão "3C+" das Integrações (R34.1, Admin): a conexão da empresa (endereços, token do
 * gestor, campanha padrão), "Testar conexão", o estado do ouvinte de eventos, a reconciliação
 * manual e a lista de vendedores conectados, com "Desvincular".
 */
@Component({
  selector: 'app-tresc-plus-integracao',
  imports: [
    ReactiveFormsModule,
    Alternador,
    Botao,
    CampoSenha,
    CampoTexto,
    Cartao,
    Esqueleto,
    EstadoVazio,
    Selo,
    Seletor,
  ],
  templateUrl: './tresc-plus.html',
  styleUrl: './tresc-plus.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrescPlusIntegracao {
  private readonly api = inject(TrescPlusApi);
  private readonly avisos = inject(AvisosService);
  private readonly confirmacao = inject(ConfirmacaoService);

  protected readonly envelopes = ENVELOPES;
  protected readonly dataHora = formatarDataHora;
  protected readonly conexao = signal<ConexaoTrescPlus | null>(null);
  protected readonly erroCarga = signal<ErroApi | null>(null);
  protected readonly carregando = signal(true);
  protected readonly vinculos = signal<readonly VinculoDoUsuario[] | null>(null);
  protected readonly erroVinculos = signal<string | null>(null);
  protected readonly campanhas = signal<readonly CampanhaTresc[] | null>(null);
  protected readonly erroCampanhas = signal<string | null>(null);
  protected readonly campanhaPadrao = signal<number | null>(null);

  protected readonly salvando = signal(false);
  protected readonly testando = signal(false);
  protected readonly reconciliando = signal(false);
  protected readonly desvinculando = signal<string | null>(null);
  protected readonly erroSalvar = signal<ErroApi | null>(null);
  protected readonly resultadoTeste = signal<{ ok: boolean; mensagem: string } | null>(null);

  protected readonly form = new FormGroup({
    ativa: new FormControl(false, { nonNullable: true }),
    urlApi: new FormControl('', { nonNullable: true }),
    urlSocket: new FormControl('', { nonNullable: true }),
    caminhoSocket: new FormControl('', { nonNullable: true }),
    formatoEnvelope: new FormControl<ConexaoTrescPlus['formatoEnvelope'] | null>('AUTO'),
    token: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    void this.carregar();
  }

  protected ouvinte(c: ConexaoTrescPlus) {
    return OUVINTE[c.ouvinte.estado ?? 'desconectado'];
  }

  protected opcoesCampanha(): readonly OpcaoSeletor<number>[] {
    const lista = (this.campanhas() ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }));
    const atual = this.conexao()?.campanhaPadrao;
    return atual && !lista.some((c) => c.valor === atual.id)
      ? [{ valor: atual.id, rotulo: atual.nome }, ...lista]
      : lista;
  }

  protected async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erroCarga.set(null);
    try {
      const conexao = await this.api.conexao();
      this.aplicar(conexao);
      void this.carregarVinculos();
      if (conexao.tokenConfigurado) {
        void this.carregarCampanhas();
      }
    } catch (falha) {
      this.erroCarga.set(erroDaApi(falha));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async carregarVinculos(): Promise<void> {
    this.erroVinculos.set(null);
    try {
      this.vinculos.set(await this.api.vinculos());
    } catch (falha) {
      this.erroVinculos.set(erroDaApi(falha).mensagem);
    }
  }

  protected async carregarCampanhas(): Promise<void> {
    this.erroCampanhas.set(null);
    try {
      this.campanhas.set(await this.api.campanhas());
    } catch (falha) {
      this.erroCampanhas.set(erroDaApi(falha).mensagem);
    }
  }

  protected async salvar(): Promise<void> {
    if (this.salvando()) {
      return;
    }
    const v = this.form.getRawValue();
    const atual = this.conexao();
    if (atual && (await this.trocouDeHost(atual, v.urlApi, v.urlSocket)) === false) {
      return;
    }
    const dados: {
      -readonly [K in keyof DadosConexaoTrescPlus]: DadosConexaoTrescPlus[K];
    } = {
      ativa: v.ativa,
      urlApi: v.urlApi.trim(),
      urlSocket: v.urlSocket.trim() || null,
      caminhoSocket: v.caminhoSocket.trim(),
      ...(v.formatoEnvelope ? { formatoEnvelope: v.formatoEnvelope } : {}),
    };
    if (v.token.trim()) {
      dados.token = v.token.trim();
    }
    const escolhida = this.campanhaPadrao();
    if (escolhida !== (atual?.campanhaPadrao?.id ?? null)) {
      dados.campanhaPadraoId = escolhida;
      dados.campanhaPadraoNome =
        this.opcoesCampanha().find((c) => c.valor === escolhida)?.rotulo ?? null;
    }
    this.salvando.set(true);
    this.erroSalvar.set(null);
    try {
      const conexao = await this.api.alterarConexao(dados);
      this.aplicar(conexao);
      this.avisos.sucesso('Conexão com o 3C+ salva.');
      if (conexao.tokenConfigurado) {
        void this.carregarCampanhas();
      }
    } catch (falha) {
      const erro = erroDaApi(falha);
      const daApi = erro.mensagemDoCampo('urlApi');
      const doSocket = erro.mensagemDoCampo('urlSocket');
      if (daApi) {
        this.form.controls.urlApi.setErrors({ api: daApi });
      }
      if (doSocket) {
        this.form.controls.urlSocket.setErrors({ api: doSocket });
      }
      this.erroSalvar.set(daApi || doSocket ? null : erro);
    } finally {
      this.salvando.set(false);
    }
  }

  protected async testar(): Promise<void> {
    if (this.testando()) {
      return;
    }
    this.testando.set(true);
    this.resultadoTeste.set(null);
    try {
      const r = await this.api.testarConexao();
      this.resultadoTeste.set({ ok: r.ok, mensagem: r.mensagem });
      this.conexao.set(await this.api.conexao());
    } catch (falha) {
      this.resultadoTeste.set({ ok: false, mensagem: erroDaApi(falha).mensagem });
    } finally {
      this.testando.set(false);
    }
  }

  protected async reconciliar(): Promise<void> {
    if (this.reconciliando()) {
      return;
    }
    this.reconciliando.set(true);
    try {
      await this.api.reconciliar();
      this.conexao.set(await this.api.conexao());
      this.avisos.sucesso('Reconciliação feita: as ligações do 3C+ foram conferidas.');
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.reconciliando.set(false);
    }
  }

  protected async desvincular(vinculo: VinculoDoUsuario): Promise<void> {
    const usuarioId = vinculo.usuarioId;
    if (!usuarioId) {
      return;
    }
    const nome = vinculo.usuarioNome ?? 'este usuário';
    const ok = await this.confirmacao.confirmar({
      titulo: `Desvincular ${nome}?`,
      mensagem: `${nome} deixa de ligar pelo 3C+ no CRM e precisa conectar de novo no Meu perfil.`,
      confirmar: 'Desvincular',
      perigo: true,
    });
    if (!ok) {
      return;
    }
    this.desvinculando.set(usuarioId);
    try {
      await this.api.desvincular(usuarioId);
      this.avisos.sucesso(`${nome} foi desvinculado do 3C+.`);
      await this.carregarVinculos();
    } catch (falha) {
      this.avisos.erro(falha);
    } finally {
      this.desvinculando.set(null);
    }
  }

  /** `false`: trocou o host e a pessoa desistiu depois do aviso. */
  private async trocouDeHost(
    atual: ConexaoTrescPlus,
    urlApi: string,
    urlSocket: string,
  ): Promise<boolean> {
    const host = (url: string | null) => {
      try {
        return url?.trim() ? new URL(url.trim()).host : null;
      } catch {
        return url;
      }
    };
    const mudou =
      host(urlApi) !== host(atual.urlApi) ||
      (host(urlSocket) !== null && host(urlSocket) !== host(atual.urlSocket));
    if (!mudou) {
      return true;
    }
    return this.confirmacao.confirmar({
      titulo: 'Trocar o endereço do 3C+?',
      mensagem:
        'Os vendedores vão precisar conectar de novo e o token do gestor será pedido de novo. Informe o token novo junto para manter a integração ativa.',
      confirmar: 'Trocar o endereço',
      perigo: true,
    });
  }

  private aplicar(conexao: ConexaoTrescPlus): void {
    this.conexao.set(conexao);
    this.campanhaPadrao.set(conexao.campanhaPadrao?.id ?? null);
    this.form.reset({
      ativa: conexao.ativa,
      urlApi: conexao.urlApi,
      urlSocket: conexao.urlSocket ?? '',
      caminhoSocket: conexao.caminhoSocket,
      formatoEnvelope: conexao.formatoEnvelope,
      token: '',
    });
  }
}
