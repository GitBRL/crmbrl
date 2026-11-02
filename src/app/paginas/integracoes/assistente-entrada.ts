import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  type FormArray,
  type FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { LucideCheck, LucideEye, LucidePlus, LucideX } from '@lucide/angular';
import { startWith } from 'rxjs';

import { type ErroApi, erroDaApi } from '../../nucleo/api/erro-api';
import { AvisosService } from '../../nucleo/avisos.service';
import { Botao } from '../../ui/botao/botao';
import { BotaoIcone } from '../../ui/botao-icone/botao-icone';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { Dica } from '../../ui/dica/dica';
import { EstadoVazio } from '../../ui/estado-vazio/estado-vazio';
import { Esqueleto } from '../../ui/esqueleto/esqueleto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Modal } from '../../ui/modal/modal';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { BlocoCodigo } from './comum/bloco-codigo';
import { partesComCodigo } from './comum/copiar';
import { ValorUnico } from './comum/valor-unico';
import { CORPO_DE_EXEMPLO, exemploCurlEntrada } from './exemplos';
import { IntegracoesApi } from './integracoes.api';
import { PreviaMapeamento } from './previa-mapeamento';
import {
  type DadosWebhookEntrada,
  DICA_ESTRATEGIA,
  type EstrategiaDistribuicao,
  type FunilDoDestino,
  type Mapeamento,
  type ModeloMapeamento,
  type ModelosDeMapeamento,
  PREFIXO_CAMPO_PERSONALIZADO,
  type ResultadoDaPrevia,
  ROTULO_ESTRATEGIA,
  ROTULO_MODELO,
  rotuloDoDestino,
  type UsuarioDoDestino,
  type WebhookEntrada,
  type WebhookEntradaCriado,
} from './tipos';

type Passo = 1 | 2 | 3 | 4;
type Seguranca = 'NENHUMA' | 'GERAR' | 'INFORMAR';

/** Valor do seletor de destino que abre o campo da chave do campo personalizado. */
export const DESTINO_PERSONALIZADO = '__personalizado';

const TAMANHO_MINIMO_SEGREDO = 16;
const TAMANHO_MAXIMO_SEGREDO = 200;

const PASSOS_CRIACAO = ['Nome e destino', 'Mapeamento', 'Segurança'] as const;
const PASSOS_EDICAO = ['Nome e destino', 'Mapeamento'] as const;

const OPCOES_SEGURANCA: readonly OpcaoGrupo<Seguranca>[] = [
  {
    valor: 'NENHUMA',
    rotulo: 'Sem assinatura',
    dica: 'Basta o endereço, que é longo e aleatório. Serve para formulários e ferramentas que não sabem assinar.',
  },
  {
    valor: 'GERAR',
    rotulo: 'Gerar um segredo',
    dica: 'O CRM cria o segredo e o mostra uma única vez. O sistema que envia assina cada chamada com ele.',
  },
  {
    valor: 'INFORMAR',
    rotulo: 'Usar um segredo já combinado',
    dica: 'Cole o segredo que o sistema que envia já usa (16 a 200 caracteres).',
  },
];

/** "a, b , A" → ["a", "b"] (sem repetir, sem diferenciar maiúsculas). */
export function separarEtiquetas(texto: string): string[] {
  const etiquetas: string[] = [];
  const vistas = new Set<string>();
  for (const parte of texto.split(',')) {
    const etiqueta = parte.trim();
    const chave = etiqueta.toLocaleLowerCase('pt-BR');
    if (etiqueta && !vistas.has(chave)) {
      vistas.add(chave);
      etiquetas.push(etiqueta);
    }
  }
  return etiquetas;
}

/** Texto do exemplo → objeto JSON (ou a mensagem do erro). */
export function lerExemplo(texto: string): { valor: unknown } | { erro: string } {
  if (!texto.trim()) {
    return { erro: 'Cole um corpo de exemplo em JSON.' };
  }
  try {
    const valor: unknown = JSON.parse(texto);
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
      return { erro: 'O exemplo precisa ser um objeto JSON, entre chaves: { "name": "…" }.' };
    }
    return { valor };
  } catch {
    return { erro: 'O exemplo não é um JSON válido. Confira aspas, vírgulas e chaves.' };
  }
}

/** "true"/"false" viram booleanos; o resto vai como texto. */
function valorDaCondicao(texto: string): string | boolean {
  const limpo = texto.trim();
  if (limpo.toLowerCase() === 'true') {
    return true;
  }
  if (limpo.toLowerCase() === 'false') {
    return false;
  }
  return limpo;
}

/**
 * Assistente do webhook de entrada (TELAS-FASE1 §7, R8.1): em passos — 1) nome e destino
 * (funil, etapa, distribuição); 2) mapeamento (modelo pronto ou personalizado, com a prévia
 * aplicada a um JSON de exemplo); 3) segurança (segredo HMAC opcional). Ao criar, mostra o
 * endereço **uma única vez**, com "Copiar" e um exemplo `curl`. Com `webhook`, edita os passos
 * 1 e 2 (o segredo e o endereço têm ações próprias no painel).
 */
@Component({
  selector: 'app-assistente-entrada',
  imports: [
    ReactiveFormsModule,
    Modal,
    Botao,
    BotaoIcone,
    CampoTexto,
    CampoSenha,
    AreaTexto,
    Seletor,
    GrupoOpcoes,
    Dica,
    Esqueleto,
    EstadoVazio,
    PreviaMapeamento,
    ValorUnico,
    BlocoCodigo,
    LucideCheck,
  ],
  templateUrl: './assistente-entrada.html',
  styleUrl: './assistente-entrada.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistenteEntrada {
  private readonly api = inject(IntegracoesApi);
  private readonly avisos = inject(AvisosService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly aberto = model(false);
  /** Webhook a editar; sem ele, cria um novo. */
  readonly webhook = input<WebhookEntrada | null>(null);
  readonly criado = output<WebhookEntradaCriado>();
  readonly salvo = output<WebhookEntrada>();
  /** "Ver recebimentos" no fim da criação. */
  readonly verRecebimentos = output<WebhookEntrada>();

  protected readonly icones = {
    adicionar: LucidePlus,
    remover: LucideX,
    previa: LucideEye,
  };
  protected readonly opcoesSeguranca = OPCOES_SEGURANCA;
  protected readonly destinoPersonalizado = DESTINO_PERSONALIZADO;

  protected readonly passo = signal<Passo>(1);
  protected readonly carregandoApoio = signal(false);
  protected readonly erroApoio = signal<ErroApi | null>(null);
  private readonly funis = signal<readonly FunilDoDestino[]>([]);
  private readonly usuarios = signal<readonly UsuarioDoDestino[]>([]);
  protected readonly modelos = signal<ModelosDeMapeamento | null>(null);
  protected readonly previa = signal<ResultadoDaPrevia | null>(null);
  protected readonly carregandoPrevia = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal<string | null>(null);
  protected readonly resultado = signal<WebhookEntradaCriado | null>(null);
  /** Erro da API no nome (409 nome repetido): fica até a pessoa mudar o nome. */
  protected readonly erroNome = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(100)]],
    funilId: this.fb.control<string | null>(null, Validators.required),
    etapaId: this.fb.control<string | null>(null, Validators.required),
    estrategia: this.fb.control<EstrategiaDistribuicao>('RODIZIO'),
    responsavelFixoId: this.fb.control<string | null>(null),
    modelo: this.fb.control<ModeloMapeamento>('GENERICO'),
    regras: this.fb.array<FormGroup>([]),
    ignorar: this.fb.array<FormGroup>([]),
    etiquetas: [''],
    exemplo: [''],
    seguranca: this.fb.control<Seguranca>('NENHUMA'),
    segredo: [''],
  });

  private readonly valores = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly editando = computed(() => this.webhook() !== null);
  protected readonly passos = computed(() => (this.editando() ? PASSOS_EDICAO : PASSOS_CRIACAO));
  protected readonly titulo = computed(() => {
    if (this.resultado()) {
      return 'Webhook criado';
    }
    return this.editando() ? 'Editar webhook de entrada' : 'Novo webhook de entrada';
  });
  protected readonly complemento = computed(() =>
    this.resultado() ? null : `· passo ${this.passo()} de ${this.passos().length}`,
  );

  protected readonly opcoesFunil = computed<readonly OpcaoSeletor<string>[]>(() =>
    this.funis()
      .filter((funil) => funil.ativo)
      .map((funil) => ({ valor: funil.id, rotulo: funil.nome })),
  );

  private readonly funilEscolhido = computed(
    () => this.funis().find((funil) => funil.id === this.valores().funilId) ?? null,
  );

  protected readonly opcoesEtapa = computed<readonly OpcaoSeletor<string>[]>(() =>
    (this.funilEscolhido()?.etapas ?? [])
      .filter((etapa) => etapa.tipo !== 'PERDIDO')
      .map((etapa) => ({
        valor: etapa.id,
        rotulo: etapa.tipo === 'GANHO' ? `${etapa.nome} (etapa de ganho)` : etapa.nome,
      })),
  );

  protected readonly opcoesEstrategia = computed<readonly OpcaoGrupo<EstrategiaDistribuicao>[]>(
    () => {
      const area = this.funilEscolhido()?.nome ?? 'do funil';
      return (['RODIZIO', 'RESPONSAVEL_FIXO', 'LIDER_DA_AREA'] as const).map((valor) => ({
        valor,
        rotulo: valor === 'RODIZIO' ? `Rodízio da área (${area})` : ROTULO_ESTRATEGIA[valor],
        dica: DICA_ESTRATEGIA[valor],
      }));
    },
  );

  /** Quem pode ser responsável fixo: ativo e que vê o funil (da área, C-level ou Admin). */
  protected readonly opcoesResponsavel = computed<readonly OpcaoSeletor<string>[]>(() => {
    const area = this.funilEscolhido()?.area;
    return this.usuarios()
      .filter(
        (usuario) =>
          usuario.ativo &&
          (usuario.papel === 'ADMIN' || usuario.papel === 'C_LEVEL' || usuario.area === area),
      )
      .map((usuario) => ({
        valor: usuario.id,
        rotulo: `${usuario.nome} — ${usuario.rotuloPapel}`,
      }));
  });

  protected readonly ehFixo = computed(() => this.valores().estrategia === 'RESPONSAVEL_FIXO');
  protected readonly ehPersonalizado = computed(() => this.valores().modelo === 'PERSONALIZADO');

  protected readonly opcoesModelo = computed<readonly OpcaoGrupo<ModeloMapeamento>[]>(() => [
    { valor: 'GENERICO', rotulo: ROTULO_MODELO.GENERICO },
    { valor: 'DISPAROS_BRL', rotulo: ROTULO_MODELO.DISPAROS_BRL },
    { valor: 'PERSONALIZADO', rotulo: ROTULO_MODELO.PERSONALIZADO },
  ]);

  protected readonly modeloPronto = computed(() => {
    const modelo = this.valores().modelo;
    return this.modelos()?.modelos.find((item) => item.modelo === modelo) ?? null;
  });

  protected readonly opcoesDestino = computed<readonly OpcaoSeletor<string>[]>(() => [
    ...(this.modelos()?.destinos ?? []).map((destino) => ({
      valor: destino.destino,
      rotulo: rotuloDoDestino(destino.destino),
    })),
    { valor: DESTINO_PERSONALIZADO, rotulo: 'Campo personalizado…' },
  ]);

  protected readonly descricaoDestinos = computed(() =>
    (this.modelos()?.destinos ?? [])
      .map((destino) => `${rotuloDoDestino(destino.destino)}: ${destino.descricao}`)
      .join(' '),
  );

  protected readonly rotuloAvancar = computed(() => {
    if (this.passo() === 2 && this.editando()) {
      return 'Salvar alterações';
    }
    return this.passo() === 3 ? 'Criar webhook' : 'Continuar';
  });

  /** O endereço e o exemplo `curl` do fim da criação. */
  protected readonly curl = computed(() => {
    const criado = this.resultado();
    if (!criado) {
      return '';
    }
    const exemplo = lerExemplo(this.form.controls.exemplo.value);
    return exemploCurlEntrada(criado.url, 'valor' in exemplo ? exemplo.valor : CORPO_DE_EXEMPLO, {
      exige: criado.webhook.exigeAssinatura,
      segredo:
        criado.segredo ?? (this.valores().seguranca === 'INFORMAR' ? this.valores().segredo : null),
    });
  });

  protected readonly resumo = computed(() => {
    const valores = this.valores();
    const funil = this.funilEscolhido();
    const etapa = funil?.etapas.find((item) => item.id === valores.etapaId);
    const responsavel = this.usuarios().find((item) => item.id === valores.responsavelFixoId);
    const estrategia = valores.estrategia ?? 'RODIZIO';
    return {
      nome: valores.nome || '—',
      destino: funil && etapa ? `${funil.nome} · ${etapa.nome}` : '—',
      distribuicao:
        estrategia === 'RESPONSAVEL_FIXO' && responsavel
          ? `Responsável fixo: ${responsavel.nome}`
          : ROTULO_ESTRATEGIA[estrategia],
      mapeamento: ROTULO_MODELO[valores.modelo ?? 'GENERICO'],
      etiquetas: separarEtiquetas(valores.etiquetas ?? '').join(', ') || 'nenhuma',
    };
  });

  constructor() {
    // Ao abrir: volta ao começo, preenche (edição) e carrega funis, usuários e modelos.
    effect(() => {
      if (this.aberto()) {
        untracked(() => this.iniciar());
      } else {
        untracked(() => this.avisarCriacao());
      }
    });

    // Trocar de funil leva a etapa para a primeira aberta dele (se a atual for de outro funil).
    this.form.controls.funilId.valueChanges.pipe(takeUntilDestroyed()).subscribe((funilId) => {
      const funil = this.funis().find((item) => item.id === funilId);
      if (!funil) {
        return;
      }
      const etapaAtual = this.form.controls.etapaId.value;
      if (!funil.etapas.some((etapa) => etapa.id === etapaAtual && etapa.tipo !== 'PERDIDO')) {
        const primeira = funil.etapas.find((etapa) => etapa.tipo === 'ABERTA');
        this.form.controls.etapaId.setValue(primeira?.id ?? null);
      }
    });

    this.form.controls.nome.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.erroNome.set(null));

    // Responsável fixo só é obrigatório com essa distribuição.
    this.form.controls.estrategia.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((estrategia) => {
        const controle = this.form.controls.responsavelFixoId;
        controle.setValidators(estrategia === 'RESPONSAVEL_FIXO' ? Validators.required : null);
        controle.updateValueAndValidity({ emitEvent: false });
      });

    // Trocar de modelo: o exemplo acompanha (se ainda é o do modelo anterior) e a prévia refaz.
    let modeloAnterior: ModeloMapeamento = this.form.controls.modelo.value;
    this.form.controls.modelo.valueChanges.pipe(takeUntilDestroyed()).subscribe((modelo) => {
      this.aoTrocarModelo(modeloAnterior, modelo);
      modeloAnterior = modelo;
    });

    // Segredo informado: 16 a 200 caracteres.
    this.form.controls.seguranca.valueChanges.pipe(takeUntilDestroyed()).subscribe((seguranca) => {
      const controle = this.form.controls.segredo;
      controle.setValidators(
        seguranca === 'INFORMAR'
          ? [
              Validators.required,
              Validators.minLength(TAMANHO_MINIMO_SEGREDO),
              Validators.maxLength(TAMANHO_MAXIMO_SEGREDO),
            ]
          : null,
      );
      controle.updateValueAndValidity({ emitEvent: false });
    });
  }

  // --- Estrutura do formulário -----------------------------------------------------------------

  protected get regras(): FormArray<FormGroup> {
    return this.form.controls.regras;
  }

  protected get ignorar(): FormArray<FormGroup> {
    return this.form.controls.ignorar;
  }

  protected destinoDaRegra(indice: number): string {
    return (this.regras.at(indice)?.get('destino')?.value as string | null) ?? '';
  }

  protected adicionarRegra(caminho = '', destino = ''): void {
    let chave = '';
    let destinoDoSeletor: string | null = destino || null;
    if (destino.startsWith(PREFIXO_CAMPO_PERSONALIZADO)) {
      chave = destino.slice(PREFIXO_CAMPO_PERSONALIZADO.length);
      destinoDoSeletor = DESTINO_PERSONALIZADO;
    }
    const grupo = this.fb.group({
      caminho: [caminho, [Validators.required, Validators.maxLength(200)]],
      destino: this.fb.control<string | null>(destinoDoSeletor, Validators.required),
      chave: [chave],
    });
    grupo.controls.destino.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => {
        grupo.controls.chave.setValidators(
          valor === DESTINO_PERSONALIZADO ? [Validators.required, Validators.maxLength(100)] : null,
        );
        grupo.controls.chave.updateValueAndValidity({ emitEvent: false });
      });
    if (destinoDoSeletor === DESTINO_PERSONALIZADO) {
      grupo.controls.chave.setValidators([Validators.required, Validators.maxLength(100)]);
    }
    this.regras.push(grupo);
  }

  protected removerRegra(indice: number): void {
    this.regras.removeAt(indice);
  }

  protected adicionarCondicao(caminho = '', valor = ''): void {
    this.ignorar.push(
      this.fb.group({
        caminho: [caminho, Validators.required],
        valor: [valor, Validators.required],
      }),
    );
  }

  protected removerCondicao(indice: number): void {
    this.ignorar.removeAt(indice);
  }

  protected partesDaDescricao(texto: string) {
    return partesComCodigo(texto);
  }

  protected rotuloDestino(destino: string): string {
    return rotuloDoDestino(destino);
  }

  // --- Navegação -------------------------------------------------------------------------------

  protected async recarregarApoio(): Promise<void> {
    await this.carregarApoio(true);
  }

  protected voltar(): void {
    this.erroGeral.set(null);
    if (this.passo() > 1) {
      this.irPara((this.passo() - 1) as Passo);
    }
  }

  protected async avancar(): Promise<void> {
    this.erroGeral.set(null);
    const passo = this.passo();
    if (!this.passoValido(passo)) {
      return;
    }
    if (passo === 1) {
      this.irPara(2);
      if (!this.previa()) {
        void this.verPrevia(false);
      }
      return;
    }
    if (passo === 2) {
      if (this.editando()) {
        await this.salvarEdicao();
      } else {
        this.irPara(3);
      }
      return;
    }
    if (passo === 3) {
      await this.criar();
    }
  }

  protected fechar(): void {
    this.aberto.set(false);
  }

  protected abrirRecebimentos(): void {
    const criado = this.resultado();
    this.aberto.set(false);
    if (criado) {
      this.verRecebimentos.emit(criado.webhook);
    }
  }

  // --- Prévia ----------------------------------------------------------------------------------

  /** Aplica o mapeamento ao exemplo (`POST /webhooks/entradas/previa`). */
  protected async verPrevia(validarRegras = true): Promise<void> {
    const controleExemplo = this.form.controls.exemplo;
    const exemplo = lerExemplo(controleExemplo.value);
    if ('erro' in exemplo) {
      controleExemplo.setErrors({ json: exemplo.erro });
      controleExemplo.markAsTouched();
      this.previa.set(null);
      return;
    }
    if (this.ehPersonalizado() && (this.regras.invalid || !this.regras.length)) {
      if (validarRegras) {
        this.regras.markAllAsTouched();
        this.erroGeral.set(
          this.regras.length
            ? 'Complete as regras do mapeamento antes da prévia.'
            : 'Adicione as regras do mapeamento (pelo menos o nome e o e-mail ou o telefone).',
        );
      }
      return;
    }
    this.carregandoPrevia.set(true);
    try {
      const resultado = await this.api.previa({
        modeloMapeamento: this.form.controls.modelo.value,
        mapeamento: this.ehPersonalizado() ? this.montarMapeamento() : undefined,
        etiquetasFixas: separarEtiquetas(this.form.controls.etiquetas.value),
        exemplo: exemplo.valor,
      });
      this.previa.set(resultado);
    } catch (falha) {
      const erro = erroDaApi(falha);
      this.previa.set(null);
      if (erro.ehDadosInvalidos || erro.ehRegraViolada) {
        this.erroGeral.set(erro.resumo);
      } else {
        this.avisos.erro(erro);
      }
    } finally {
      this.carregandoPrevia.set(false);
    }
  }

  // --- Envio -----------------------------------------------------------------------------------

  private async criar(): Promise<void> {
    const seguranca = this.form.controls.seguranca.value;
    const dados: DadosWebhookEntrada = {
      ...this.montarDados(),
      ...(seguranca === 'GERAR' ? { gerarSegredo: true } : {}),
      ...(seguranca === 'INFORMAR' ? { segredo: this.form.controls.segredo.value.trim() } : {}),
    };
    this.enviando.set(true);
    try {
      const criado = await this.api.criarEntrada(dados);
      this.resultado.set(criado);
      this.passo.set(4);
      this.criado.emit(criado);
      // O passo "Webhook criado" (com o foco no título) é o retorno imediato; o aviso curto
      // vem ao fechar, para não cobrir os botões do modal.
      this.focarTitulo();
    } catch (falha) {
      this.tratarErroDeEnvio(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  private async salvarEdicao(): Promise<void> {
    const webhook = this.webhook();
    if (!webhook) {
      return;
    }
    this.enviando.set(true);
    try {
      const salvo = await this.api.atualizarEntrada(webhook.id, this.montarDados());
      this.salvo.emit(salvo);
      this.avisos.sucesso(`Webhook “${salvo.nome}” atualizado.`);
      this.aberto.set(false);
    } catch (falha) {
      this.tratarErroDeEnvio(erroDaApi(falha));
    } finally {
      this.enviando.set(false);
    }
  }

  private montarDados(): DadosWebhookEntrada {
    const valores = this.form.getRawValue();
    const fixo = valores.estrategia === 'RESPONSAVEL_FIXO';
    return {
      nome: valores.nome.trim(),
      funilId: valores.funilId ?? '',
      etapaId: valores.etapaId ?? '',
      estrategia: valores.estrategia,
      responsavelFixoId: fixo ? valores.responsavelFixoId : null,
      modeloMapeamento: valores.modelo,
      ...(valores.modelo === 'PERSONALIZADO' ? { mapeamento: this.montarMapeamento() } : {}),
      etiquetasFixas: separarEtiquetas(valores.etiquetas),
    };
  }

  private montarMapeamento(): Mapeamento {
    const campos = this.regras.controls.map((grupo) => {
      const { caminho, destino, chave } = grupo.getRawValue() as {
        caminho: string;
        destino: string | null;
        chave: string;
      };
      return {
        caminho: caminho.trim(),
        destino:
          destino === DESTINO_PERSONALIZADO
            ? `${PREFIXO_CAMPO_PERSONALIZADO}${chave.trim()}`
            : (destino ?? ''),
      };
    });
    const ignorarQuando = this.ignorar.controls.map((grupo) => {
      const { caminho, valor } = grupo.getRawValue() as { caminho: string; valor: string };
      return { caminho: caminho.trim(), valor: valorDaCondicao(valor) };
    });
    return { campos, ignorarQuando };
  }

  /** Erro da API no envio: vai para o campo (e o passo) certo, ou para o alerta do passo. */
  private tratarErroDeEnvio(erro: ErroApi): void {
    const nome = erro.mensagemDoCampo('nome');
    if (erro.ehConflito || nome) {
      this.erroNome.set(nome ?? erro.resumo);
      this.irPara(1);
      return;
    }
    const segredo = erro.mensagemDoCampo('segredo');
    if (segredo && this.passo() === 3) {
      this.form.controls.segredo.setErrors({ api: segredo });
      this.form.controls.segredo.markAsTouched();
      return;
    }
    if (erro.ehDadosInvalidos || erro.ehRegraViolada) {
      this.erroGeral.set(erro.resumo);
      return;
    }
    this.avisos.erro(erro);
  }

  // --- Interno ---------------------------------------------------------------------------------

  private avisarCriacao(): void {
    const criado = this.resultado();
    if (criado) {
      this.resultado.set(null);
      this.avisos.sucesso(`Webhook “${criado.webhook.nome}” criado.`);
    }
  }

  private iniciar(): void {
    this.passo.set(1);
    this.resultado.set(null);
    this.previa.set(null);
    this.erroGeral.set(null);
    this.erroNome.set(null);
    this.regras.clear();
    this.ignorar.clear();
    const webhook = this.webhook();
    this.form.reset({
      nome: webhook?.nome ?? '',
      funilId: webhook?.funil.id ?? null,
      etapaId: webhook?.etapa.id ?? null,
      estrategia: webhook?.estrategia ?? 'RODIZIO',
      responsavelFixoId: webhook?.responsavelFixo?.id ?? null,
      modelo: webhook?.modeloMapeamento ?? 'GENERICO',
      etiquetas: webhook?.etiquetasFixas.join(', ') ?? '',
      exemplo: '',
      seguranca: 'NENHUMA',
      segredo: '',
    });
    if (webhook?.modeloMapeamento === 'PERSONALIZADO') {
      this.preencherRegras(webhook.mapeamento);
    }
    void this.carregarApoio();
  }

  private async carregarApoio(forcar = false): Promise<void> {
    if (!forcar && this.modelos() && this.funis().length) {
      this.aplicarPadroes();
      return;
    }
    this.carregandoApoio.set(true);
    this.erroApoio.set(null);
    try {
      const [funis, usuarios, modelos] = await Promise.all([
        this.api.funis(),
        this.api.usuariosAtivos(),
        this.api.modelos(),
      ]);
      this.funis.set(funis);
      this.usuarios.set(usuarios);
      this.modelos.set(modelos);
      this.aplicarPadroes();
    } catch (falha) {
      this.erroApoio.set(erroDaApi(falha));
    } finally {
      this.carregandoApoio.set(false);
    }
  }

  /** Funil de Marketing e o exemplo do modelo, quando ainda não escolhidos. */
  private aplicarPadroes(): void {
    if (!this.form.controls.funilId.value) {
      const marketing =
        this.funis().find((funil) => funil.area === 'MARKETING' && funil.ativo) ??
        this.funis().find((funil) => funil.ativo);
      if (marketing) {
        this.form.controls.funilId.setValue(marketing.id);
      }
    }
    if (!this.form.controls.exemplo.value) {
      this.form.controls.exemplo.setValue(this.exemploDoModelo(this.form.controls.modelo.value));
    }
  }

  private aoTrocarModelo(anterior: ModeloMapeamento, modelo: ModeloMapeamento): void {
    const exemploAtual = this.form.controls.exemplo.value;
    if (!exemploAtual.trim() || exemploAtual === this.exemploDoModelo(anterior)) {
      this.form.controls.exemplo.setValue(this.exemploDoModelo(modelo));
    }
    // Personalizado começa com as regras do modelo que estava escolhido.
    if (modelo === 'PERSONALIZADO' && !this.regras.length) {
      const base = this.modelos()?.modelos.find((item) => item.modelo === anterior);
      this.preencherRegras(base?.mapeamento ?? { campos: [], ignorarQuando: [] });
      if (!this.regras.length) {
        this.adicionarRegra('name', 'nome');
        this.adicionarRegra('email', 'email');
      }
    }
    this.previa.set(null);
    this.erroGeral.set(null);
    if (this.passo() === 2) {
      void this.verPrevia(false);
    }
  }

  private exemploDoModelo(modelo: ModeloMapeamento): string {
    const pronto = this.modelos()?.modelos.find((item) => item.modelo === modelo);
    return JSON.stringify(pronto?.exemplo ?? CORPO_DE_EXEMPLO, null, 2);
  }

  private preencherRegras(mapeamento: Mapeamento): void {
    for (const regra of mapeamento.campos) {
      this.adicionarRegra(regra.caminho, regra.destino);
    }
    for (const condicao of mapeamento.ignorarQuando) {
      this.adicionarCondicao(condicao.caminho, String(condicao.valor));
    }
  }

  private passoValido(passo: Passo): boolean {
    const controles: AbstractControl[] =
      passo === 1
        ? [
            this.form.controls.nome,
            this.form.controls.funilId,
            this.form.controls.etapaId,
            this.form.controls.estrategia,
            this.form.controls.responsavelFixoId,
          ]
        : passo === 2
          ? [this.form.controls.etiquetas, this.regras, this.ignorar]
          : [this.form.controls.segredo];
    for (const controle of controles) {
      controle.markAllAsTouched();
      controle.updateValueAndValidity({ emitEvent: false });
    }
    if (passo === 2 && this.ehPersonalizado()) {
      const problema = this.problemaDasRegras();
      if (problema) {
        this.erroGeral.set(problema);
        return false;
      }
    }
    const invalido = controles.some((controle) => controle.invalid);
    if (invalido) {
      this.focarPrimeiroInvalido();
    }
    return !invalido;
  }

  /** O que a API recusaria num mapeamento personalizado (R8.1). */
  private problemaDasRegras(): string | null {
    if (this.regras.invalid) {
      return 'Complete as regras do mapeamento: cada uma precisa do caminho e do campo do CRM.';
    }
    const destinos = this.regras.controls.map((grupo) => grupo.get('destino')?.value as string);
    if (!destinos.includes('nome')) {
      return 'O mapeamento precisa de uma regra para o Nome do contato.';
    }
    if (!destinos.includes('email') && !destinos.includes('telefone')) {
      return 'O mapeamento precisa de uma regra para o E-mail ou o Telefone.';
    }
    return null;
  }

  private irPara(passo: Passo): void {
    this.passo.set(passo);
    this.focarTitulo();
  }

  private focarTitulo(): void {
    setTimeout(() =>
      this.elemento.nativeElement.querySelector<HTMLElement>('.assistente__titulo-passo')?.focus(),
    );
  }

  private focarPrimeiroInvalido(): void {
    setTimeout(() =>
      this.elemento.nativeElement
        .querySelector<HTMLElement>('.assistente [aria-invalid="true"]')
        ?.focus(),
    );
  }
}
