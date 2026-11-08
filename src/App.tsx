import { useState, useEffect } from 'react';
import { useGeminiTutor, type ProgressData } from './hooks/useGeminiTutor';
import subjectsData from './config/subjects.json';
import { ConfigPage } from './pages/ConfigPage';
import { LilithPage } from './pages/LilithPage';
import { VoicesPage } from './pages/VoicesPage';
import { getAIConfig } from './config/aiConfig';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [selectedSubject, setSelectedSubject] = useState(subjectsData.subjects[0]);
  const [selectedTopic, setSelectedTopic] = useState(selectedSubject.topics[0]);
  const [progressLog, setProgressLog] = useState<ProgressData[]>([]);
  const [easterEggs, setEasterEggs] = useState<{id: number, left: string}[]>([]);
  const [activeVoice, setActiveVoice] = useState(() => getAIConfig().voiceName || 'Leda');

  // Roteador simples por URL (ex: '/' ou '/config' ou '/lilith')
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setActiveVoice(getAIConfig().voiceName || 'Leda');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    setActiveVoice(getAIConfig().voiceName || 'Leda');
  };

  const handleProgress = (data: ProgressData) => {
    setProgressLog(prev => [data, ...prev]);
  };

  const { isRecordingVoice, isReconnecting, isSpeaking, transcription, startLiveDialog, stopLiveDialog } = useGeminiTutor(handleProgress);

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subject = subjectsData.subjects.find(s => s.id === e.target.value);
    if (subject) {
      setSelectedSubject(subject);
      setSelectedTopic(subject.topics[0]);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      // 30% chance of spawning every 5 seconds
      if (Math.random() > 0.7) {
        setEasterEggs(prev => [...prev, { id: Date.now(), left: `${Math.random() * 80 + 10}vw` }]);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup old easter eggs
  useEffect(() => {
    if (easterEggs.length > 0) {
      const timer = setTimeout(() => {
        setEasterEggs(prev => prev.slice(1));
      }, 15000); // Remove after 15s (animation length)
      return () => clearTimeout(timer);
    }
  }, [easterEggs]);

  // ROTA 1: /voices (Estúdio de Criação de Vozes Gemini Voice Design)
  if (currentPath === '/voices') {
    return <VoicesPage onBack={() => navigate('/')} onNavigate={(path) => navigate(path)} />;
  }

  // ROTA 2: /config (Configuração de Prompt e IA)
  if (currentPath === '/config') {
    return (
      <>
        <div className="space-bg">
          <div className="stars"></div>
          <div className="stars2"></div>
        </div>
        <ConfigPage onBack={() => navigate('/')} onNavigate={(path) => navigate(path)} />
      </>
    );
  }

  // ROTA 3: /astro ou /revisor (Painel Espacial de Estudos e Revisão Escolar)
  if (currentPath === '/astro' || currentPath === '/revisor') {
    return (
      <>
        <div className="space-bg">
          <div className="stars"></div>
          <div className="stars2"></div>
        </div>

        {easterEggs.map(egg => (
          <div key={egg.id} className="easter-egg" style={{ left: egg.left }}>
            Papai ❤️ Boni
          </div>
        ))}

        <div className="min-h-[100dvh] text-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto w-full">
          <div className="w-full max-w-lg md:max-w-4xl flex flex-col md:flex-row-reverse gap-6 relative z-10 pt-4 pb-12">
            
            <div className="flex-1 flex flex-col gap-6 w-full">
              <div className="glass-panel p-6 sm:p-8 flex-1 flex flex-col items-center justify-center relative shadow-[0_0_40px_rgba(59,130,246,0.15)] border-t-2 border-t-blue-500/30">
                <div className="absolute top-3 left-3 flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-[0_0_10px_rgba(234,179,8,0.8)]"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></div>
                </div>

                <div className="relative w-32 h-32 sm:w-40 sm:h-40 my-4 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-900 rounded-full shadow-[0_0_40px_rgba(79,70,229,0.5)] border border-blue-400/30"></div>
                  {isSpeaking && (
                    <>
                      <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-60 mix-blend-screen"></div>
                      <div className="absolute -inset-6 border-[3px] border-indigo-500 rounded-full animate-[spin_2s_linear_infinite] opacity-70 border-t-transparent border-b-transparent"></div>
                      <div className="absolute -inset-2 border-[2px] border-cyan-400 rounded-full animate-[spin_4s_linear_infinite_reverse] opacity-50 border-l-transparent border-r-transparent"></div>
                    </>
                  )}
                  <div className="relative z-10 text-6xl sm:text-7xl filter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] transform hover:scale-110 transition-transform">
                    👩‍🚀
                  </div>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-center bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
                  {isReconnecting
                    ? "Reconectando e retomando sessão..."
                    : isSpeaking
                    ? "Astro transmitindo..."
                    : isRecordingVoice
                    ? "Radar ativado. Ouvindo..."
                    : "Nave em repouso"}
                </h2>

                {/* TRANSCRIÇÃO */}
                <div className="mt-6 w-full text-sm font-medium flex flex-col gap-2">
                  {transcription.userText && (
                    <div className="bg-indigo-900/50 p-3 rounded-xl rounded-tr-none border border-indigo-500/30 text-indigo-100 self-end text-right ml-8 shadow-md">
                      <span className="text-xs opacity-50 block mb-1">Você (Comandante Boni)</span>
                      {transcription.userText}
                    </div>
                  )}
                  {transcription.modelText && (
                    <div className="bg-cyan-900/40 p-3 rounded-xl rounded-tl-none border border-cyan-500/30 text-cyan-50 mr-8 shadow-md">
                      <span className="text-xs text-cyan-300 block mb-1">Astro ({activeVoice})</span>
                      {transcription.modelText}
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-panel p-5 sm:p-6 h-60 overflow-y-auto border-t-2 border-t-purple-500/30 custom-scrollbar flex-none">
                <h3 className="font-bold text-lg mb-4 text-purple-300 flex items-center gap-2">
                  <span>🛰️</span> Diário de Bordo
                </h3>
                {progressLog.length === 0 ? (
                  <p className="text-indigo-200/50 text-sm text-center mt-8">Nenhum registro intergaláctico ainda.</p>
                ) : (
                  <ul className="space-y-3">
                    {progressLog.map((log, idx) => (
                      <li key={idx} className="bg-slate-900/80 p-3 sm:p-4 rounded-xl text-sm border-l-4 border-indigo-500 shadow-md">
                        <span className="font-bold text-indigo-100">{log.topic}:</span>{' '}
                        <span className={log.result === 'acerto' ? 'text-green-400 font-bold drop-shadow-[0_0_5px_rgba(74,222,128,0.8)]' : 'text-orange-400 font-bold drop-shadow-[0_0_5px_rgba(251,146,60,0.8)]'}>
                          {log.result === 'acerto' ? 'SUCESSO 🟢' : 'FALHA 🟠'}
                        </span>
                        {log.failReason && (
                          <p className="mt-2 text-indigo-200 text-xs sm:text-sm bg-indigo-950/50 p-2 rounded-md">Alerta: {log.failReason}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex-1 glass-panel p-6 sm:p-8 flex flex-col justify-between border-t-2 border-t-cyan-500/30">
              <div>
                {/* CABEÇALHO DO PAINEL COM BOTÕES DE NAVEGAÇÃO */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl sm:text-4xl">🌌</span>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight leading-tight">
                        Painel de Controle
                      </h1>
                      <p className="text-indigo-200 text-xs sm:text-sm font-medium">Missão de Estudos e Revisão</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate('/voices')}
                      disabled={isRecordingVoice}
                      className="px-3 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-md flex-none disabled:opacity-50 disabled:pointer-events-none"
                      title="Estúdio de Criação de Vozes Gemini Voice Design"
                    >
                      <span>🎙️</span> Vozes da IA
                    </button>
                    <button
                      onClick={() => navigate('/')}
                      disabled={isRecordingVoice}
                      className="px-3 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-md flex-none disabled:opacity-50 disabled:pointer-events-none"
                      title="Abrir Lilith (Página Inicial)"
                    >
                      <span>⚡</span> Lilith
                    </button>
                    <button
                      onClick={() => navigate('/config')}
                      disabled={isRecordingVoice}
                      className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-indigo-500/40 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 shadow-md flex-none disabled:opacity-50 disabled:pointer-events-none"
                      title="Configurar Prompt do Sistema e Voz da IA"
                    >
                      <span>⚙️</span> Configurar IA
                    </button>
                  </div>
                </div>

                {/* BADGE DA VOZ ATIVA */}
                <div className="mb-6 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-indigo-300">Voz do Tutor:</span>
                  <button
                    onClick={() => navigate('/voices')}
                    disabled={isRecordingVoice}
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-900/50 hover:bg-purple-800/70 border border-purple-500/40 text-purple-200 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Clique para trocar ou criar vozes"
                  >
                    🎙️ {activeVoice} <span className="text-[10px] opacity-60">⇄</span>
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="group">
                    <label className="block font-bold mb-2 text-cyan-300 uppercase tracking-wider text-xs">Módulo de Conhecimento</label>
                    <select 
                      className="w-full bg-slate-900/80 border border-indigo-500/50 rounded-2xl p-4 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all text-indigo-50 font-medium appearance-none shadow-inner"
                      value={selectedSubject.id}
                      onChange={handleSubjectChange}
                      disabled={isRecordingVoice}
                    >
                      {subjectsData.subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="group">
                    <label className="block font-bold mb-2 text-cyan-300 uppercase tracking-wider text-xs">Destino / Tópico</label>
                    <select 
                      className="w-full bg-slate-900/80 border border-indigo-500/50 rounded-2xl p-4 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all text-indigo-50 font-medium appearance-none shadow-inner"
                      value={selectedTopic}
                      onChange={e => setSelectedTopic(e.target.value)}
                      disabled={isRecordingVoice}
                    >
                      {selectedSubject.topics.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-10 sm:mt-12">
                {!isRecordingVoice ? (
                  <button 
                    onClick={() => startLiveDialog(selectedSubject.title, selectedTopic)}
                    className="w-full py-5 rounded-2xl font-black text-lg sm:text-xl text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:shadow-[0_0_40px_rgba(6,182,212,0.8)] transform hover:-translate-y-1 active:translate-y-1 active:shadow-none uppercase tracking-wider flex items-center justify-center gap-3"
                  >
                    🚀 Iniciar Missão
                  </button>
                ) : (
                  <button 
                    onClick={stopLiveDialog}
                    className="w-full py-5 rounded-2xl font-black text-lg sm:text-xl text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 transition-all shadow-[0_0_30px_rgba(220,38,38,0.5)] transform hover:-translate-y-1 active:translate-y-1 active:shadow-none uppercase tracking-wider flex items-center justify-center gap-3"
                  >
                    🛑 Abortar Missão
                  </button>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </>
    );
  }

  // ROTA PADRÃO / PÁGINA INICIAL: Lilith (Pública, Dark Occult Luxury, Live Voice com Gemini Live Engine)
  return <LilithPage onBack={() => navigate('/astro')} onNavigate={(path) => navigate(path)} />;
}

export default App;
