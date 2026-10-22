import { TestBed } from '@angular/core/testing';

import { ConfirmacaoService, textoConfere } from '../nucleo/confirmacao.service';
import { Confirmacao } from './confirmacao';

describe('Confirmação (serviço + modal)', () => {
  function criar() {
    const fixture = TestBed.createComponent(Confirmacao);
    fixture.detectChanges();
    const servico = TestBed.inject(ConfirmacaoService);
    const dialogo = () => document.querySelector('dialog') as HTMLDialogElement;
    const botoes = () => [
      ...dialogo().querySelectorAll<HTMLButtonElement>('.confirmacao__acoes button'),
    ];
    return { fixture, servico, dialogo, botoes };
  }

  it('mostra a pergunta e o que vai acontecer; confirmar resolve true', async () => {
    const { fixture, servico, dialogo, botoes } = criar();
    const resposta = servico.confirmar({
      titulo: 'Remover a etapa “Proposta”?',
      mensagem: 'A etapa sai do funil Comercial.',
      detalhes: ['Nenhum negócio é afetado.'],
      confirmar: 'Remover etapa',
      perigo: true,
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialogo().textContent).toContain('Remover a etapa “Proposta”?');
    expect(dialogo().textContent).toContain('A etapa sai do funil Comercial.');
    expect(dialogo().textContent).toContain('Nenhum negócio é afetado.');
    expect(dialogo().textContent).toContain('isso não pode ser desfeito');
    expect(botoes().map((botao) => botao.textContent?.trim())).toEqual([
      'Cancelar',
      'Remover etapa',
    ]);
    botoes()[1].click();
    expect(await resposta).toBe(true);
    expect(servico.aberta()).toBeNull();
  });

  it('cancelar resolve false', async () => {
    const { fixture, servico, botoes } = criar();
    const resposta = servico.confirmar({ titulo: 'Sair?', mensagem: 'Você sai do CRM.' });
    fixture.detectChanges();
    await fixture.whenStable();
    botoes()[0].click();
    expect(await resposta).toBe(false);
  });

  it('confirmação forte: só libera depois de digitar o texto (sem acento/maiúscula)', async () => {
    const { fixture, servico, dialogo, botoes } = criar();
    const resposta = servico.confirmar({
      titulo: 'Desligar Pedro Santos?',
      mensagem: 'As atividades vão para Rafael.',
      confirmar: 'Desligar',
      exigirTexto: 'Pedro',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const campo = dialogo().querySelector('input') as HTMLInputElement;
    expect(dialogo().querySelector('label')?.textContent).toContain(
      'Digite “Pedro” para confirmar',
    );
    expect(botoes()[1].disabled).toBe(true);
    campo.value = ' pédro ';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(botoes()[1].disabled).toBe(false);
    botoes()[1].click();
    expect(await resposta).toBe(true);
  });

  it('com executar: espera a ação; se falhar, mostra o erro no modal e continua aberto', async () => {
    const { fixture, servico, dialogo, botoes } = criar();
    const executar = vi
      .fn()
      .mockRejectedValueOnce(new Error('falhou'))
      .mockResolvedValueOnce(undefined);
    const resposta = servico.confirmar({ titulo: 'Excluir?', mensagem: 'x', executar });
    fixture.detectChanges();
    await fixture.whenStable();

    botoes()[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(dialogo().querySelector('[role="alert"]')?.textContent).toContain('Algo deu errado');
    expect(servico.aberta()).not.toBeNull();

    botoes()[1].click();
    expect(await resposta).toBe(true);
    expect(executar).toHaveBeenCalledTimes(2);
  });

  it('uma confirmação nova cancela a anterior', async () => {
    const { servico } = criar();
    const primeira = servico.confirmar({ titulo: 'A?', mensagem: 'a' });
    void servico.confirmar({ titulo: 'B?', mensagem: 'b' });
    expect(await primeira).toBe(false);
    expect(servico.aberta()?.pedido.titulo).toBe('B?');
  });

  it('textoConfere ignora acentos, maiúsculas e espaços nas pontas', () => {
    expect(textoConfere(' JOÃO ', 'joao')).toBe(true);
    expect(textoConfere('Joa', 'João')).toBe(false);
    expect(textoConfere('', '')).toBe(false);
  });
});
