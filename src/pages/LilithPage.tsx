import { useState, useEffect, useRef } from 'react';
import { useLilithVoice, DEFAULT_LILITH_PROMPT } from '../hooks/useLilithVoice';
import { getAllVoices, DEFAULT_VOICE, type VoiceItem } from '../config/aiConfig';

interface LilithPageProps {
  onBack: () => void;
  onNavigate?: (path: string) => void;
}

const STORAGE_KEY_LILITH_PROMPT = "lilith_custom_system_prompt";
const STORAGE_KEY_LILITH_VOICE = "lilith_custom_voice";

export function LilithPage({ onBack, onNavigate }: LilithPageProps) {
  const [systemPrompt, setSystemPrompt] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_LILITH_PROMPT) || DEFAULT_LILITH_PROMPT;
  });
  const [selectedVoice, setSelectedVoice] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_LILITH_VOICE) || DEFAULT_VOICE;
  });
  const [voicesList, setVoicesList] = useState<VoiceItem[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const {
    isConnected,
    isReconnecting,
    isSpeaking,
    isListening,
    messages,
    currentTranscription,
    connect,
    disconnect,
    clearHistory
  } = useLilithVoice();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscription]);

  useEffect(() => {
    setVoicesList(getAllVoices());
  }, []);

  const handleToggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect(systemPrompt, selectedVoice);
    }
  };

  const handleSavePrompt = (newPrompt: string) => {
    setSystemPrompt(newPrompt);
    localStorage.setItem(STORAGE_KEY_LILITH_PROMPT, newPrompt);
  };

  const handleSelectVoice = (voice: string) => {
    setSelectedVoice(voice);
    localStorage.setItem(STORAGE_KEY_LILITH_VOICE, voice);
  };

  const handleResetPrompt = () => {
    setSystemPrompt(DEFAULT_LILITH_PROMPT);
    localStorage.removeItem(STORAGE_KEY_LILITH_PROMPT);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-neutral-800 selection:text-white">
      
      {/* HEADER MINIMALISTA NEUTRO */}
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-widest uppercase text-neutral-100">
              LILITH
            </span>
            <span className="text-[10px] text-neutral-400 font-mono tracking-tight">
              NEUTRAL INTERFACE • GEMINI LIVE ENGINE
            </span>
          </div>

          <div className="ml-4 pl-4 border-l border-neutral-800 flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                isReconnecting
                  ? 'bg-amber-950 text-amber-300 border border-amber-700 animate-pulse'
                  : isSpeaking
                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                  : isListening
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : isConnected
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  isReconnecting
                    ? 'bg-amber-400 animate-ping'
                    : isSpeaking
                    ? 'bg-blue-400 animate-ping'
                    : isListening
                    ? 'bg-emerald-400 animate-pulse'
                    : isConnected
                    ? 'bg-amber-400'
                    : 'bg-neutral-500'
                }`}
              />
              {isReconnecting
                ? 'RECONECTANDO...'
                : isSpeaking
                ? 'FALANDO'
                : isListening
                ? 'OUVINDO'
                : isConnected
                ? 'CONECTADO'
                : 'DESCONECTADO'}
            </span>
            <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
              Voz: <strong className="text-neutral-200">{selectedVoice}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('/voices')}
              className="px-3 py-1.5 rounded text-xs font-mono bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors flex items-center gap-1.5 shadow-sm"
              title="Criar e gerenciar vozes com Gemini Voice Design"
            >
              <span>🎙️</span> Vozes da IA
            </button>
          )}

          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
              showConfig
                ? 'bg-neutral-100 text-neutral-900 border-neutral-100'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
            }`}
          >
            {showConfig ? 'Ocultar Prompt' : 'Configurar Prompt'}
          </button>

          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded text-xs font-mono bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 transition-colors"
          >
            ← Voltar ao Revisor
          </button>
        </div>
      </header>

      {/* DRAWER / PAINEL DE CONFIGURAÇÃO DE PROMPT & VOZ (COLLAPSIBLE) */}
      {showConfig && (
        <div className="border-b border-neutral-800 bg-neutral-900/90 px-4 sm:px-8 py-6">
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-200 font-mono">
                  Instrução do Sistema (Lilith Prompt)
                </h3>
                <p className="text-xs text-neutral-400">
                  Define a personalidade, tom de voz e comportamento da IA.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetPrompt}
                  className="text-xs font-mono text-neutral-400 hover:text-neutral-200 underline"
                >
                  Restaurar padrão
                </button>
              </div>
            </div>

            <textarea
              value={systemPrompt}
              onChange={(e) => handleSavePrompt(e.target.value)}
              rows={4}
              disabled={isConnected}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-400 transition-colors disabled:opacity-50"
              placeholder="Digite as instruções de Lilith..."
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-mono text-neutral-400 uppercase tracking-wide">
                  Seletor de Voz da IA
                </label>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('/voices')}
                    className="text-[11px] font-mono text-rose-400 hover:text-rose-300 underline"
                  >
                    + Criar ou Gerenciar Vozes
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {voicesList.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVoice(v.id)}
                    disabled={isConnected}
                    className={`p-2.5 rounded border text-left text-xs font-mono transition-all ${
                      selectedVoice === v.id
                        ? v.isCustom
                          ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                          : 'bg-neutral-800 border-neutral-400 text-white shadow-sm'
                        : v.isCustom
                        ? 'bg-neutral-950 border-rose-900/40 text-neutral-400 hover:border-rose-700 hover:text-rose-200'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold truncate">{v.name || v.id}</span>
                      {v.isCustom && (
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-900/60 text-rose-300 border border-rose-700/40">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-neutral-400 truncate">{v.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 sm:p-6 gap-6">

        {/* CONTROLE DE CONEXÃO & VISUALIZADOR DE VOZ */}
        <div className="border border-neutral-800 bg-neutral-900/40 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
          
          {/* Visualizador Minimalista */}
          <div className="relative w-36 h-36 flex items-center justify-center my-4">
            <div
              className={`absolute inset-0 rounded-full border transition-all duration-700 ${
                isSpeaking
                  ? 'border-neutral-300 scale-125 opacity-70 animate-ping'
                  : isListening
                  ? 'border-neutral-500 scale-110 opacity-40'
                  : 'border-neutral-800 scale-95 opacity-20'
              }`}
            />
            <div
              className={`absolute inset-3 rounded-full border transition-all duration-300 ${
                isSpeaking
                  ? 'border-neutral-100 scale-110 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                  : isListening
                  ? 'border-neutral-400 animate-pulse'
                  : 'border-neutral-800'
              }`}
            />
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isConnected
                  ? 'bg-neutral-100 text-neutral-950'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-base sm:text-lg font-mono font-medium text-neutral-200 mb-2">
            {isReconnecting
              ? 'Queda detectada. Retomando sessão de onde parou...'
              : isSpeaking
              ? 'Lilith sintetizando resposta...'
              : isListening
              ? 'Microfone ativo. Fale diretamente...'
              : isConnected
              ? 'Conexão aberta. Aguardando fala...'
              : 'Canal de voz em espera'}
          </h2>
          <p className="text-xs text-neutral-400 font-mono mb-6 max-w-md">
            Comunicação bidirecional direta (PCM 16kHz WebSocket com Session Resumption ativa).
          </p>

          {/* BOTÃO PRINCIPAL */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleConnection}
              className={`px-6 py-3 rounded-lg font-mono text-xs uppercase tracking-wider font-semibold transition-all shadow-sm ${
                isReconnecting
                  ? 'bg-amber-900/60 text-amber-200 border border-amber-600 animate-pulse'
                  : isConnected
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-rose-300 border border-neutral-700'
                  : 'bg-neutral-100 hover:bg-white text-neutral-950 border border-white'
              }`}
            >
              {isReconnecting ? 'Reconectando...' : isConnected ? 'Encerrar Sessão' : 'Iniciar Conexão de Voz'}
            </button>

            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="px-4 py-3 rounded-lg font-mono text-xs text-neutral-400 hover:text-neutral-200 border border-neutral-800 hover:bg-neutral-900 transition-colors"
                title="Limpar transcrições"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* FLUXO DE TRANSCRIÇÃO / MENSAGENS */}
        <div className="border border-neutral-800 bg-neutral-900/30 rounded-xl flex-1 flex flex-col overflow-hidden min-h-[320px]">
          <div className="px-5 py-3 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
              Log de Transcrição
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              {messages.length} registro(s)
            </span>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4 font-mono text-xs custom-scrollbar">
            {messages.length === 0 && !currentTranscription.user && !currentTranscription.lilith && (
              <div className="h-48 flex flex-col items-center justify-center text-center text-neutral-400">
                <span className="text-2xl mb-2 opacity-40">〰</span>
                <p>Nenhuma mensagem registrada nesta sessão.</p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Inicie a conexão e fale pelo microfone.
                </p>
              </div>
            )}

            {/* MENSAGENS ANTERIORES */}
            {messages.map((msg) => {
              const isLilith = msg.sender === 'lilith';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col p-3 rounded-lg border ${
                    isLilith
                      ? 'bg-neutral-900/80 border-neutral-800 text-neutral-200'
                      : 'bg-neutral-950 border-neutral-800/80 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 text-[10px] text-neutral-400">
                    <span className="font-bold tracking-wider">
                      {isLilith ? `LILITH (${selectedVoice})` : 'VOCÊ'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{msg.timestamp}</span>
                      <button
                        onClick={() => copyToClipboard(msg.text, msg.id)}
                        className="hover:text-neutral-200"
                        title="Copiar texto"
                      >
                        {copiedId === msg.id ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {/* FALA EM TEMPO REAL */}
            {currentTranscription.user && (
              <div className="flex flex-col p-3 rounded-lg bg-neutral-950 border border-neutral-700/60 text-neutral-300 animate-pulse">
                <span className="text-[10px] text-neutral-400 font-bold mb-1">
                  VOCÊ (FALANDO AGORA)
                </span>
                <div className="text-xs">{currentTranscription.user}</div>
              </div>
            )}

            {currentTranscription.lilith && (
              <div className="flex flex-col p-3 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100">
                <span className="text-[10px] text-neutral-400 font-bold mb-1">
                  LILITH (EMISSÃO ATIVA)
                </span>
                <div className="text-xs">{currentTranscription.lilith}</div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

      </main>

      {/* FOOTER TÉCNICO MINIMALISTA */}
      <footer className="border-t border-neutral-800 px-6 py-2.5 text-[11px] font-mono text-neutral-400 flex flex-col sm:flex-row items-center justify-between gap-2 bg-neutral-950">
        <div>
          MODEL: <strong>gemini-3.1-flash-live-preview</strong> • VOICE: <strong>{selectedVoice}</strong>
        </div>
        <div>
          STATUS: <span className="text-neutral-300">{isConnected ? 'ONLINE' : 'STANDBY'}</span>
        </div>
      </footer>

    </div>
  );
}
