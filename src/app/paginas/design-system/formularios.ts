import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideCalendarCheck,
  LucideCalendarDays,
  LucideMessageCircle,
  LucideSend,
} from '@lucide/angular';

import { Alternador } from '../../ui/alternador/alternador';
import { AreaTexto } from '../../ui/area-texto/area-texto';
import { Botao } from '../../ui/botao/botao';
import { CaixaSelecao } from '../../ui/caixa-selecao/caixa-selecao';
import { CampoData } from '../../ui/campo-data/campo-data';
import { CampoSenha } from '../../ui/campo-senha/campo-senha';
import { CampoTexto } from '../../ui/campo-texto/campo-texto';
import { GrupoOpcoes, type OpcaoGrupo } from '../../ui/grupo-opcoes/grupo-opcoes';
import { Seletor, type OpcaoSeletor } from '../../ui/seletor/seletor';
import { Exemplo } from './exemplo';
import { Secao } from './secao';

/**
 * Seção 12 do catálogo: os campos de formulário, ligados a um formulário reativo de verdade
 * (validação ao sair do campo e ao enviar, erro da API no campo certo) e soltos, em cada
 * estado. Uso interno de paginas/design-system.
 */
@Component({
  selector: 'app-ds-formularios',
  imports: [
    ReactiveFormsModule,
    Exemplo,
    Secao,
    Alternador,
    AreaTexto,
    Botao,
    CaixaSelecao,
    CampoData,
    CampoSenha,
    CampoTexto,
    GrupoOpcoes,
    Seletor,
  ],
  templateUrl: './formularios.html',
  styleUrl: './formularios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Formularios {
  protected readonly iconeEnviar = LucideSend;

  protected readonly papeis: readonly OpcaoSeletor<string>[] = [
    { valor: 'vendedor', rotulo: 'Vendedor' },
    { valor: 'lider', rotulo: 'Líder Comercial' },
    { valor: 'clevel', rotulo: 'C-level' },
    { valor: 'admin', rotulo: 'Administrador', desabilitada: true },
  ];

  protected readonly tiposAtividade: readonly OpcaoGrupo<string>[] = [
    { valor: 'conversa', rotulo: 'Conversa', icone: LucideMessageCircle },
    { valor: 'reuniao', rotulo: 'Reunião', icone: LucideCalendarDays },
    { valor: 'tarefa', rotulo: 'Tarefa', icone: LucideCalendarCheck },
    { valor: 'email', rotulo: 'E-mail', icone: LucideSend },
  ];

  protected readonly modelos: readonly OpcaoGrupo<string>[] = [
    {
      valor: 'generico',
      rotulo: 'Genérico',
      dica: 'Campos com os nomes do CRM (nome, email, telefone).',
    },
    { valor: 'disparos', rotulo: 'Disparos BRL', dica: 'O formato da ferramenta de disparos.' },
    { valor: 'proprio', rotulo: 'Personalizado', dica: 'Você diz de onde vem cada campo.' },
  ];

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: Validators.required }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    valor: new FormControl<number | null>(null, Validators.min(0)),
    papel: new FormControl<string | null>(null, Validators.required),
    tipo: new FormControl<string | null>('conversa'),
    quando: new FormControl<string | null>(null),
    observacao: new FormControl('', { nonNullable: true }),
    aceite: new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
  });

  /** Erro da API mostrado no campo de e-mail (como um 422 `regra_violada`). */
  protected readonly erroEmail = signal<string | null>(null);
  protected readonly resultado = signal('');

  // Campos soltos, com [(valor)]
  protected readonly senha = signal('');
  protected readonly rodizio = signal(true);
  protected readonly passagem = signal(false);
  protected readonly modelo = signal<string | null>('generico');
  protected readonly todos = signal(false);
  protected readonly alguns = signal(true);
  protected readonly concluida = signal(false);
  protected readonly json = signal(
    '{\n  "nome": "Maria Souza",\n  "email": "maria@escola.com.br"\n}',
  );

  protected enviar(): void {
    this.erroEmail.set(null);
    if (this.form.invalid) {
      this.resultado.set('Confira os campos marcados.');
      return;
    }
    this.resultado.set(`Pronto: ${this.form.getRawValue().nome} validado.`);
  }

  protected simularErroDaApi(): void {
    this.erroEmail.set('Já existe um contato com este e-mail: Maria Souza.');
    this.resultado.set('');
  }

  protected limpar(): void {
    this.form.reset();
    this.erroEmail.set(null);
    this.resultado.set('');
  }
}
