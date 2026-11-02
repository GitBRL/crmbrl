import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SwPush, SwUpdate } from '@angular/service-worker';
import { BehaviorSubject, Subject } from 'rxjs';

import { AtualizacaoService } from './atualizacao.service';
import { detectarPlataforma, InstalacaoService } from './instalacao.service';
import { nomeDoAparelho, PushService } from './push.service';
import { RedeService } from './rede.service';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile Safari/604.1';

describe('detectarPlataforma e nomeDoAparelho', () => {
  it('separa Android, iOS (inclusive iPad que se diz Mac) e o resto', () => {
    expect(detectarPlataforma(ANDROID)).toBe('android');
    expect(detectarPlataforma(IPHONE)).toBe('ios');
    expect(detectarPlataforma('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(detectarPlataforma('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('outra');
    expect(detectarPlataforma('Mozilla/5.0 (X11; Linux x86_64) Chrome/130')).toBe('outra');
  });

  it('dá um nome curto ao aparelho', () => {
    expect(nomeDoAparelho(ANDROID)).toBe('Chrome em Android');
    expect(nomeDoAparelho(IPHONE)).toBe('Safari em iOS');
    expect(nomeDoAparelho('Mozilla/5.0 (X11; Linux x86_64) Firefox/130')).toBe('Firefox em Linux');
    expect(nomeDoAparelho('')).toBe('Navegador');
  });
});

describe('RedeService', () => {
  it('acompanha os eventos online e offline', () => {
    const rede = TestBed.inject(RedeService);
    window.dispatchEvent(new Event('offline'));
    expect(rede.online()).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(rede.online()).toBe(true);
  });
});

describe('InstalacaoService', () => {
  it('guarda o pedido de instalação e o abre só quando a pessoa pede', async () => {
    const instalacao = TestBed.inject(InstalacaoService);
    expect(instalacao.podeInstalar()).toBe(false);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const evento = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    window.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(true);
    expect(instalacao.podeInstalar()).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    expect(await instalacao.instalar()).toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
    expect(instalacao.podeInstalar()).toBe(false);
    window.dispatchEvent(new Event('appinstalled'));
    expect(instalacao.instalado()).toBe(true);
  });
});

describe('AtualizacaoService', () => {
  it('liga o aviso quando a versão nova está pronta e não faz nada sem service worker', () => {
    const eventos = new Subject<{ type: string }>();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: eventos,
            checkForUpdate: vi.fn().mockResolvedValue(false),
            activateUpdate: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    });
    const servico = TestBed.inject(AtualizacaoService);
    expect(servico.disponivel()).toBe(false);
    eventos.next({ type: 'VERSION_DETECTED' });
    expect(servico.disponivel()).toBe(false);
    eventos.next({ type: 'VERSION_READY' });
    expect(servico.disponivel()).toBe(true);
  });

  it('sem service worker (desenvolvimento) o aviso nunca liga', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: SwUpdate, useValue: { isEnabled: false } }],
    });
    expect(TestBed.inject(AtualizacaoService).disponivel()).toBe(false);
  });
});

describe('PushService', () => {
  const requestSubscription = vi.fn();
  const unsubscribe = vi.fn();
  let http: HttpTestingController;
  let assinatura: BehaviorSubject<PushSubscription | null>;
  let permissao: NotificationPermission;

  const inscricao = {
    endpoint: 'https://push.exemplo/abc',
    toJSON: () => ({ keys: { p256dh: 'P', auth: 'A' } }),
  } as unknown as PushSubscription;

  beforeEach(() => {
    assinatura = new BehaviorSubject<PushSubscription | null>(null);
    requestSubscription.mockReset().mockResolvedValue(inscricao);
    unsubscribe.mockReset().mockResolvedValue(undefined);
    permissao = 'default';
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', {
      get permission() {
        return permissao;
      },
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SwPush,
          useValue: { isEnabled: true, subscription: assinatura, requestSubscription, unsubscribe },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  const TIPOS = {
    conversa_atribuida: true,
    mencao: true,
    atividade_vencendo: true,
    sla_estourado: true,
    negocio_atribuido: true,
    parcela_atrasada: false,
  };

  it('carregar: sem inscrição fica "desativado" e não pede permissão', async () => {
    const push = TestBed.inject(PushService);
    const carga = push.carregar();
    http.expectOne('/api/v1/push/preferencias').flush({ tipos: TIPOS });
    await carga;
    expect(push.situacao()).toBe('desativado');
    expect(push.preferencias()).toEqual(TIPOS);
    expect(requestSubscription).not.toHaveBeenCalled();
  });

  it('carregar: permissão negada = "bloqueado"', async () => {
    permissao = 'denied';
    const push = TestBed.inject(PushService);
    const carga = push.carregar();
    http.expectOne('/api/v1/push/preferencias').flush({ tipos: TIPOS });
    await carga;
    expect(push.situacao()).toBe('bloqueado');
  });

  it('ativar: pega a chave, inscreve e registra endpoint, chaves e aparelho', async () => {
    const push = TestBed.inject(PushService);
    const ativando = push.ativar();
    http.expectOne('/api/v1/push/chave-publica').flush({ chavePublica: 'CHAVE' });
    await vi.waitFor(() => expect(requestSubscription).toHaveBeenCalled());
    expect(requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'CHAVE' });
    const req = await vi.waitFor(() => http.expectOne('/api/v1/push/inscricoes'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      endpoint: 'https://push.exemplo/abc',
      keys: { p256dh: 'P', auth: 'A' },
    });
    expect(typeof req.request.body.aparelho).toBe('string');
    req.flush({ id: 'i1' });
    await ativando;
    expect(push.situacao()).toBe('ativo');
    expect(push.inscricaoId()).toBe('i1');
  });

  it('ativar: 503 nao_configurado vira "nao-configurado"', async () => {
    const push = TestBed.inject(PushService);
    const ativando = push.ativar().catch((erro: unknown) => erro);
    http.expectOne('/api/v1/push/chave-publica').flush(
      {
        statusCode: 503,
        erro: 'indisponivel',
        mensagem: 'Push não configurado.',
        detalhes: { motivo: 'nao_configurado' },
        requisicaoId: 'r',
      },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await ativando;
    expect(push.situacao()).toBe('nao-configurado');
    expect(requestSubscription).not.toHaveBeenCalled();
  });

  it('desativar: remove no servidor e neste aparelho', async () => {
    const push = TestBed.inject(PushService);
    const ativando = push.ativar();
    http.expectOne('/api/v1/push/chave-publica').flush({ chavePublica: 'C' });
    (await vi.waitFor(() => http.expectOne('/api/v1/push/inscricoes'))).flush({ id: 'i9' });
    await ativando;
    const removendo = push.desativar();
    http.expectOne('/api/v1/push/inscricoes/i9').flush(null);
    await removendo;
    expect(unsubscribe).toHaveBeenCalled();
    expect(push.situacao()).toBe('desativado');
    expect(push.inscricaoId()).toBeNull();
  });

  it('preferências: salva o conjunto inteiro por PUT', async () => {
    const push = TestBed.inject(PushService);
    const salvando = push.salvarPreferencias({ ...TIPOS, mencao: false });
    const req = http.expectOne('/api/v1/push/preferencias');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ tipos: { ...TIPOS, mencao: false } });
    req.flush({ tipos: { ...TIPOS, mencao: false } });
    await salvando;
    expect(push.preferencias()?.mencao).toBe(false);
  });
});
