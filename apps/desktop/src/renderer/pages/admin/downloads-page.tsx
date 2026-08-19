import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Laptop,
  MonitorDown,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

const CURRENT_VERSION = '0.1.3';
const GITHUB_REPO = 'Nycolazs/PH-Motopecas-Ponto';
const RELEASE_BASE_URL = `https://github.com/${GITHUB_REPO}/releases/download/v${CURRENT_VERSION}`;

export function AdminDownloadsPage(): React.JSX.Element {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string): void => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const downloads = [
    {
      id: 'windows',
      name: 'Microsoft Windows',
      arch: 'Windows 10 / 11 (64-bit)',
      badge: 'Recomendado',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      icon: (
        <svg className="w-8 h-8 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.901-1.8" />
        </svg>
      ),
      description:
        'Instalador oficial executável (.exe) com assistente passo a passo, atalhos na Área de Trabalho e inicialização automática.',
      primaryButton: {
        label: `Baixar Instalador Windows (.exe)`,
        filename: `PH-Ponto-Setup-${CURRENT_VERSION}.exe`,
        url: `${RELEASE_BASE_URL}/PH-Ponto-Setup-${CURRENT_VERSION}.exe`,
      },
      secondaryButton: null,
      instructions: [
        'Baixe o instalador e execute o arquivo no computador do colaborador.',
        'O instalador cria automaticamente o atalho com o ícone oficial da PH Motopeças.',
        'O aplicativo se configura para iniciar com o Windows em segundo plano na bandeja do sistema.',
      ],
      terminalCommand: null,
    },
    {
      id: 'linux',
      name: 'Linux (Debian / Ubuntu)',
      arch: 'Debian, Ubuntu, Mint & Distros Linux (64-bit)',
      badge: 'Debian & AppImage',
      badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      icon: (
        <svg className="w-8 h-8 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.002 0c-4.97 0-9 4.03-9 9 0 3.75 2.3 6.96 5.56 8.32-.08-.66-.14-1.68.03-2.41.15-.65 1-4.24 1-4.24s-.26-.51-.26-1.27c0-1.19.69-2.08 1.55-2.08.73 0 1.08.55 1.08 1.21 0 .74-.47 1.84-.71 2.87-.2.86.43 1.56 1.28 1.56 1.54 0 2.72-1.62 2.72-3.96 0-2.07-1.49-3.52-3.61-3.52-2.46 0-3.9 1.85-3.9 3.76 0 .75.29 1.54.65 1.98.07.09.08.16.06.25-.07.28-.22.89-.25 1.01-.04.16-.13.2-.3.12-1.12-.52-1.82-2.15-1.82-3.46 0-2.82 2.05-5.41 5.91-5.41 3.1 0 5.52 2.21 5.52 5.17 0 3.09-1.95 5.57-4.65 5.57-.91 0-1.76-.47-2.06-1.03l-.56 2.13c-.2 1.13-.76 2.55-1.13 3.45 1.05.32 2.15.5 3.3.5 4.97 0 9-4.03 9-9s-4.03-9-9-9z" />
        </svg>
      ),
      description:
        'Pacote nativo `.deb` para instalação com gerenciador de pacotes e `.AppImage` portátil sem necessidade de instalação.',
      primaryButton: {
        label: `Baixar Pacote Debian (.deb)`,
        filename: `PH-Ponto-${CURRENT_VERSION}-amd64.deb`,
        url: `${RELEASE_BASE_URL}/PH-Ponto-${CURRENT_VERSION}-amd64.deb`,
      },
      secondaryButton: {
        label: `Baixar AppImage (.AppImage)`,
        filename: `PH-Ponto-${CURRENT_VERSION}-x86_64.AppImage`,
        url: `${RELEASE_BASE_URL}/PH-Ponto-${CURRENT_VERSION}-x86_64.AppImage`,
      },
      instructions: [
        'Para instalar o pacote Debian, execute o comando abaixo no terminal:',
        'O aplicativo será integrado ao menu de programas com o ícone oficial e autostart.',
      ],
      terminalCommand: `sudo dpkg -i PH-Ponto-${CURRENT_VERSION}-amd64.deb`,
    },
    {
      id: 'mac',
      name: 'Apple macOS',
      arch: 'macOS Monterey, Ventura, Sonoma & Sequoia',
      badge: 'Apple Silicon & Intel',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      icon: (
        <svg className="w-8 h-8 text-slate-700 dark:text-slate-200" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.85-.92.04-2.07.62-2.73 1.37-.58.66-1.09 1.73-1.02 2.76 1.03.08 2.12-.53 2.74-1.28z" />
        </svg>
      ),
      description:
        'Imagem de disco `.dmg` compatível com Macs com processador Apple Silicon (M1/M2/M3/M4) e processadores Intel.',
      primaryButton: {
        label: `Baixar para Apple Silicon (.dmg)`,
        filename: `PH-Ponto-${CURRENT_VERSION}-arm64.dmg`,
        url: `${RELEASE_BASE_URL}/PH-Ponto-${CURRENT_VERSION}-arm64.dmg`,
      },
      secondaryButton: {
        label: `Baixar para Intel (.dmg)`,
        filename: `PH-Ponto-${CURRENT_VERSION}-x64.dmg`,
        url: `${RELEASE_BASE_URL}/PH-Ponto-${CURRENT_VERSION}-x64.dmg`,
      },
      instructions: [
        'Abra o arquivo `.dmg` baixado e arraste o ícone do PH-Ponto para a pasta Aplicativos.',
        'Na primeira abertura, clique com o botão direito e selecione Abrir.',
      ],
      terminalCommand: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Versão Oficial v{CURRENT_VERSION}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">Build Estável</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <MonitorDown className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Download do Aplicativo Desktop
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            Instale o aplicativo de registro de ponto nos computadores dos colaboradores. O aplicativo conta com
            verificação de horário oficial do servidor, ícone oficial da PH Motopeças, inicialização automática com o sistema e atualizações em segundo plano.
          </p>
        </div>
      </div>

      {/* OS Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {downloads.map((os) => (
          <div
            key={os.id}
            className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all hover:shadow-md hover:border-blue-500/30"
          >
            {/* Card Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-start justify-between gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700">
                  {os.icon}
                </div>
                <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${os.badgeColor}`}>
                  {os.badge}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-4">{os.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{os.arch}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                {os.description}
              </p>
            </div>

            {/* Action Buttons & Details */}
            <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
              <div className="space-y-2.5">
                {os.primaryButton && (
                  <a
                    href={os.primaryButton.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs hover:shadow-md transition active:scale-[0.99]"
                  >
                    <Download className="w-4 h-4" />
                    <span>{os.primaryButton.label}</span>
                  </a>
                )}

                {os.secondaryButton && (
                  <a
                    href={os.secondaryButton.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition border border-slate-200 dark:border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{os.secondaryButton.label}</span>
                  </a>
                )}
              </div>

              {/* Terminal command if present */}
              {os.terminalCommand && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Terminal className="w-3.5 h-3.5" /> Comando de instalação rápida:
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(os.terminalCommand ?? '', os.id)}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === os.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-2.5 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800 selection:bg-blue-500 selection:text-white">
                    <code>{os.terminalCommand}</code>
                  </pre>
                </div>
              )}

              {/* Instructions list */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Instruções de instalação:
                </p>
                <ul className="space-y-1.5">
                  {os.instructions.map((instruction, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Highlights Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Segurança & Confiabilidade</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Horário com autoridade do servidor de Fortaleza, criptografia de dados e bloqueio de adulterações locais.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800 shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Atualizações Automáticas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verificação silenciosa em segundo plano e instalação automática para que o app esteja sempre na versão mais recente.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-800 shrink-0">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Iniciar com o Sistema</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Minimiza para a bandeja do sistema ao fechar e inicia automaticamente com o computador pronto para o colaborador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
