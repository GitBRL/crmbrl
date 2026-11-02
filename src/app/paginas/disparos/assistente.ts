import type { Segmento } from '../../ui/construtor-segmento/segmento';
import { validarModelo, type VariavelModelo } from '../../ui/editor-modelo/modelo-mensagem';
import { type Agenda, erroDaAgenda } from '../../ui/seletor-agenda/agenda';
import { erroDaJanela, type JanelaEnvio } from '../../ui/seletor-janela-envio/janela-envio';
import { janelaParaApi, segmentoParaApi } from './conversao';
import type { CanalCampanha, DadosCampanha, TipoPublico } from './disparos.tipos';

/** Lógica pura do assistente de criação de campanha (validação e montagem do corpo da API). */

export type PresetRitmo = 'seguro' | 'padrao' | 'rapido' | 'personalizado';

export const PRESETS_RITMO: Readonly<
  Record<Exclude<PresetRitmo, 'personalizado'>, { min: number; max: number }>
> = {
  seguro: { min: 40, max: 120 },
  padrao: { min: 20, max: 60 },
  rapido: { min: 8, max: 20 },
};

export function presetDoRitmo(min: number, max: number): PresetRitmo {
  const achado = (Object.keys(PRESETS_RITMO) as (keyof typeof PRESETS_RITMO)[]).find(
    (chave) => PRESETS_RITMO[chave].min === min && PRESETS_RITMO[chave].max === max,
  );
  return achado ?? 'personalizado';
}

export interface EstadoAssistente {
  nome: string;
  canal: CanalCampanha;
  area: string | null;
  tipoPublico: TipoPublico;
  segmento: Segmento;
  importacaoId: string | null;
  elegiveis: number | null;
  assunto: string;
  texto: string;
  modeloId: string | null;
  arquivoId: string | null;
  canalIds: readonly string[];
  intervaloMinimo: number;
  intervaloMaximo: number;
  usarLote: boolean;
  loteTamanho: number;
  lotePausa: number;
  simularDigitando: boolean;
  pausarAposFalhas: number;
  janelaAtiva: boolean;
  janela: JanelaEnvio;
  agenda: Agenda;
}

export const PASSOS = [
  { id: 1, rotulo: 'Público' },
  { id: 2, rotulo: 'Mensagem' },
  { id: 3, rotulo: 'Números e ritmo' },
  { id: 4, rotulo: 'Quando enviar' },
  { id: 5, rotulo: 'Revisão' },
] as const;

function inteiro(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor);
}

/** Motivo de o passo não estar pronto, ou `null`. `variaveis` vem da API. */
export function erroDoPasso(
  passo: number,
  e: EstadoAssistente,
  variaveis?: readonly VariavelModelo[],
): string | null {
  switch (passo) {
    case 1:
      if (e.nome.trim() === '') {
        return 'Dê um nome à campanha, só para você achar depois.';
      }
      if (e.tipoPublico === 'IMPORTACAO' && !e.importacaoId) {
        return 'Escolha a importação que serve de lista.';
      }
      if (e.elegiveis === 0) {
        return 'Nenhum contato com esses filtros pode receber. Mude os filtros.';
      }
      return null;
    case 2: {
      if (e.canal === 'EMAIL' && e.assunto.trim() === '') {
        return 'Escreva o assunto do e-mail.';
      }
      if (e.texto.trim() === '') {
        return 'Escreva a mensagem.';
      }
      const problema = validarModelo(e.texto, variaveis)[0];
      return problema ? problema.mensagem : null;
    }
    case 3:
      if (e.canalIds.length === 0) {
        return e.canal === 'EMAIL'
          ? 'Escolha o e-mail de envio.'
          : 'Escolha ao menos um número de WhatsApp.';
      }
      if (!inteiro(e.intervaloMinimo) || e.intervaloMinimo < 1) {
        return 'O tempo mínimo entre mensagens precisa ser de ao menos 1 segundo.';
      }
      if (!inteiro(e.intervaloMaximo) || e.intervaloMaximo < e.intervaloMinimo) {
        return 'O tempo máximo não pode ser menor que o mínimo.';
      }
      if (
        e.usarLote &&
        (!inteiro(e.loteTamanho) || e.loteTamanho < 1 || !inteiro(e.lotePausa) || e.lotePausa < 1)
      ) {
        return 'Informe o tamanho do lote e a pausa, ambos maiores que zero.';
      }
      if (!inteiro(e.pausarAposFalhas) || e.pausarAposFalhas < 1) {
        return 'Informe depois de quantas falhas seguidas a campanha pausa.';
      }
      return null;
    case 4:
      if (e.janelaAtiva) {
        const erro = erroDaJanela(e.janela);
        if (erro) {
          return erro;
        }
      }
      return erroDaAgenda(e.agenda);
    default:
      return null;
  }
}

/** "AAAA-MM-DDTHH:mm" de Brasília → ISO com fuso (o Brasil não tem horário de verão desde 2019). */
export function agendaParaIso(dataHora: string | null): string | null {
  return dataHora ? `${dataHora}:00-03:00` : null;
}

/** ISO → "AAAA-MM-DDTHH:mm" em Brasília. */
export function isoParaAgenda(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : new Date(t - 3 * 3_600_000).toISOString().slice(0, 16);
}

/**
 * Corpo do `POST`/`PATCH`. Com `limitado` (campanha já agendada, em andamento ou pausada) só vão
 * os campos que a API aceita nesses status; com `existente` (rascunho já criado), sem canal e área.
 */
export function montarDados(
  e: EstadoAssistente,
  limitado: boolean,
  existente = false,
): DadosCampanha {
  const ritmo = {
    intervaloMinimoSegundos: e.intervaloMinimo,
    intervaloMaximoSegundos: e.intervaloMaximo,
    loteTamanho: e.usarLote ? e.loteTamanho : null,
    lotePausaSegundos: e.usarLote ? e.lotePausa : null,
    simularDigitando: e.canal === 'WHATSAPP' ? e.simularDigitando : false,
    pausarAposFalhas: e.pausarAposFalhas,
  };
  const comum: DadosCampanha = {
    nome: e.nome.trim(),
    // A API não aceita lista vazia: o rascunho fica sem números até a pessoa escolher.
    ...(e.canalIds.length > 0 ? { canalIds: e.canalIds } : {}),
    ...ritmo,
    janelaEnvio: e.janelaAtiva ? janelaParaApi(e.janela) : null,
  };
  if (limitado) {
    return comum;
  }
  return {
    ...comum,
    // O canal e a área não mudam depois que o rascunho existe (o PATCH não os aceita).
    ...(existente ? {} : { canal: e.canal }),
    tipoPublico: e.tipoPublico,
    segmento: e.tipoPublico === 'SEGMENTO' ? segmentoParaApi(e.segmento) : null,
    importacaoId: e.tipoPublico === 'IMPORTACAO' ? e.importacaoId : null,
    modeloId: e.modeloId,
    assunto: e.canal === 'EMAIL' ? e.assunto.trim() : null,
    texto: e.texto,
    arquivoId: e.arquivoId,
    ...(e.area && !existente ? { area: e.area } : {}),
  };
}
