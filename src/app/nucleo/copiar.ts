/**
 * Copia um texto para a área de transferência. Usa a Clipboard API e, onde ela não existe ou
 * não tem permissão (página servida por http fora do `localhost`, como o CRM aberto pelo IP da
 * rede, ou navegador antigo), o modo antigo com um campo temporário e `execCommand('copy')`,
 * devolvendo o foco a quem estava com ele. Devolve `false` quando nenhum dos dois funciona: a
 * tela então pede para a pessoa selecionar e copiar à mão.
 *
 * O campo temporário nasce dentro do `<dialog>` modal aberto, se houver: fora dele tudo fica
 * inerte, o campo não recebe foco e a cópia sairia vazia (com `execCommand` dizendo que deu
 * certo). Por isso só copia se o campo ficou mesmo com o foco e o texto selecionado.
 *
 * Usada pelo "Compartilhar" da visão geral, pelos botões de copiar das integrações e pelo
 * e-mail/telefone do detalhe do contato.
 */
export async function copiarTexto(
  texto: string,
  documento: Document | undefined = typeof document === 'undefined' ? undefined : document,
): Promise<boolean> {
  if (!documento) {
    return false;
  }
  const area = documento.defaultView?.navigator.clipboard;
  if (area?.writeText) {
    try {
      await area.writeText(texto);
      return true;
    } catch {
      // Sem permissão: tenta o modo antigo.
    }
  }
  if (typeof documento.execCommand !== 'function') {
    return false;
  }
  const focado = documento.activeElement as HTMLElement | null;
  const campo = documento.createElement('textarea');
  campo.value = texto;
  campo.setAttribute('readonly', '');
  campo.setAttribute('aria-hidden', 'true');
  campo.style.position = 'fixed';
  campo.style.opacity = '0';
  (dialogoModalAberto(documento) ?? documento.body).append(campo);
  campo.focus({ preventScroll: true });
  campo.select();
  try {
    const selecionado =
      documento.activeElement === campo &&
      campo.selectionEnd - campo.selectionStart === texto.length;
    return texto.length > 0 && selecionado && documento.execCommand('copy');
  } catch {
    return false;
  } finally {
    campo.remove();
    focado?.focus?.();
  }
}

/**
 * O `<dialog>` aberto com `showModal()` que está por cima: o que tem o foco ou, sem isso, o
 * último aberto no DOM. `null` sem nenhum.
 */
function dialogoModalAberto(documento: Document): HTMLElement | null {
  const doFoco = documento.activeElement?.closest('dialog[open]');
  if (doFoco && ehModal(doFoco)) {
    return doFoco as HTMLElement;
  }
  const abertos = [...documento.querySelectorAll<HTMLDialogElement>('dialog[open]')];
  return abertos.filter(ehModal).at(-1) ?? null;
}

function ehModal(dialogo: Element): boolean {
  try {
    return dialogo.matches(':modal');
  } catch {
    return true; // navegador sem `:modal`: todo diálogo aberto é tratado como modal
  }
}
