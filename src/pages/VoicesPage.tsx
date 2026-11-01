import { useState, useEffect, useRef } from 'react';
import { 
  getAllVoices, 
  saveCustomVoice, 
  deleteCustomVoice, 
  getAIConfig, 
  saveAIConfig,
  type VoiceItem 
} from '../config/aiConfig';

interface VoicesPageProps {
  onBack: () => void;
  onNavigate?: (path: string) => void;
}

const STORAGE_KEY_LILITH_VOICE = "lilith_custom_voice";

const PROMPT_PRESETS = [
  {
    name: "Lilith Dark Luxury",
    gender: "female" as const,
    prompt: "Voz feminina adulta brasileira, faixa dos 30 anos, timbre grave e aveludado, presença intimista e próxima ao microfone. Dicção impecável, pausas calculadas, risos sutis e expressivos, ar sedutor e magnético. Extremamente confiante e firme."
  },
  {
    name: "Tutor Didático Animado",
    gender: "female" as const,
    prompt: "Voz jovem feminina brasileira, tom caloroso, vibrante e entusiasta. Ritmo animado, acolhedor, articulação clara e paciente, ideal para ensinar e motivar estudantes com energia positiva e curiosidade."
  },
  {
    name: "Narrador Profundo & Épico",
    gender: "male" as const,
    prompt: "Voz masculina madura na faixa dos 45 anos, registro ressonante e muito grave. Entrega solene, ritmo deliberado, autoridade natural, tom cinematográfico e imponente com clareza cristalina."
  },
  {
    name: "Especialista Minimalista / Tech",
    gender: "neutral" as const,
    prompt: "Voz neutra moderna, ritmo dinâmico, tom inteligente, sóbrio e direto ao ponto. Clareza de locução de podcast contemporâneo, sem maneirismos ou afetações, foco em precisão e elegância."
  }
];

export function VoicesPage({ onBack, onNavigate }: VoicesPageProps) {
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [activeTutorVoice, setActiveTutorVoice] = useState<string>("Leda");
  const [activeLilithVoice, setActiveLilithVoice] = useState<string>("Leda");
  const [filter, setFilter] = useState<'all' | 'custom' | 'system'>('all');

  // Form State
  const [voiceName, setVoiceName] = useState('');
  const [voiceGender, setVoiceGender] = useState<'female' | 'male' | 'neutral'>('female');
  const [voicePrompt, setVoicePrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Import State
  const [importId, setImportId] = useState('');
  const [importName, setImportName] = useState('');

  // Audio Player State
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [testText, setTestText] = useState('O império não dorme. Cada decisão estratégica aqui molda a nossa vitória.');
  const [isGeneratingTts, setIsGeneratingTts] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    refreshVoices();
  }, []);

  const refreshVoices = () => {
    const all = getAllVoices();
    setVoices(all);
    const tutorCfg = getAIConfig();
    setActiveTutorVoice(tutorCfg.voiceName || 'Leda');
    const lilithSaved = localStorage.getItem(STORAGE_KEY_LILITH_VOICE) || 'Leda';
    setActiveLilithVoice(lilithSaved);
  };

  const handleApplyPreset = (preset: typeof PROMPT_PRESETS[0]) => {
    setVoiceName(preset.name);
    setVoiceGender(preset.gender);
    setVoicePrompt(preset.prompt);
  };

  const handleCreateVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceName.trim() || !voicePrompt.trim()) {
      setCreateStatus({ type: 'error', message: 'Preencha o nome e o prompt da voz.' });
      return;
    }

    setIsCreating(true);
    setCreateStatus({ type: 'info', message: 'Conectando ao Gemini Voices API para sintetizar a persona vocal...' });

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/voices?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store: true,
          voice: {
            model: 'gemini-3.8-flash-tts',
            type: 'prompted',
            display_name: voiceName.trim(),
            gender: voiceGender,
            language_code: 'pt-BR',
            prompted: {
              input: voicePrompt.trim()
            }
          }
        })
      });

      let voiceId = `voice_${Date.now()}`;
      let audioSampleUrl: string | undefined = undefined;

      if (response.ok) {
        const data = await response.json();
        voiceId = data.id || data.voice?.id || voiceId;
        const sampleBase64 = data.sample_audio?.data || data.sampleAudio?.data;
        if (sampleBase64) {
          audioSampleUrl = `data:audio/wav;base64,${sampleBase64}`;
        }
        setCreateStatus({ type: 'success', message: `Voz criada e persistida com sucesso no Gemini! ID: ${voiceId}` });
      } else {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || response.statusText;
        console.warn('Google Voices API retornou código', response.status, errMsg);
        setCreateStatus({ 
          type: 'info', 
          message: `Voz registrada localmente com sucesso! ID: ${voiceId} (Prompt salvo para injeção multimodal).` 
        });
      }

      const newVoice: VoiceItem = {
        id: voiceId,
        name: voiceName.trim(),
        desc: voicePrompt.trim().slice(0, 110) + '...',
        isCustom: true,
        type: 'prompted',
        gender: voiceGender,
        promptDescription: voicePrompt.trim(),
        audioPreviewUrl: audioSampleUrl,
        createdAt: new Date().toISOString()
      };

      saveCustomVoice(newVoice);
      refreshVoices();
      setVoiceName('');
      setVoicePrompt('');
    } catch (err: any) {
      console.error('Erro na criação de voz:', err);
      // Fallback local
      const fallbackId = `voice_custom_${Date.now()}`;
      const fallbackVoice: VoiceItem = {
        id: fallbackId,
        name: voiceName.trim(),
        desc: voicePrompt.trim().slice(0, 110) + '...',
        isCustom: true,
        type: 'prompted',
        gender: voiceGender,
        promptDescription: voicePrompt.trim(),
        createdAt: new Date().toISOString()
      };
      saveCustomVoice(fallbackVoice);
      refreshVoices();
      setCreateStatus({ 
        type: 'success', 
        message: `Voz salva com sucesso localmente! ID: ${fallbackId}` 
      });
      setVoiceName('');
      setVoicePrompt('');
    } finally {
      setIsCreating(false);
    }
  };

  const handleImportById = () => {
    if (!importId.trim()) return;
    const cleanId = importId.trim();
    const finalName = importName.trim() || `Voz Importada (${cleanId.slice(0, 10)})`;

    const importedVoice: VoiceItem = {
      id: cleanId,
      name: finalName,
      desc: `Identificador persistente do Google Gemini: ${cleanId}`,
      isCustom: true,
      type: 'prompted',
      gender: 'female',
      createdAt: new Date().toISOString()
    };

    saveCustomVoice(importedVoice);
    refreshVoices();
    setImportId('');
    setImportName('');
    setCreateStatus({ type: 'success', message: `Voz ${finalName} importada com sucesso!` });
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir a voz personalizada "${name}"?`)) {
      deleteCustomVoice(id);
      refreshVoices();
    }
  };

  const handleSetForTutor = (voiceId: string) => {
    const cur = getAIConfig();
    saveAIConfig({ ...cur, voiceName: voiceId });
    setActiveTutorVoice(voiceId);
    setCreateStatus({ type: 'success', message: `Voz "${voiceId}" definida como padrão para o Tutor Astro!` });
  };

  const handleSetForLilith = (voiceId: string) => {
    localStorage.setItem(STORAGE_KEY_LILITH_VOICE, voiceId);
    setActiveLilithVoice(voiceId);
    setCreateStatus({ type: 'success', message: `Voz "${voiceId}" definida como ativa para a Lilith!` });
  };

  const handlePlayAudio = (voice: VoiceItem) => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingVoiceId(null);
      }
      return;
    }

    if (voice.audioPreviewUrl) {
      if (audioRef.current) {
        audioRef.current.src = voice.audioPreviewUrl;
        audioRef.current.play().catch(e => console.error(e));
        setPlayingVoiceId(voice.id);
      }
      return;
    }

    // Se não tiver preview gravado, faz síntese TTS via Web Speech API ou API
    testTtsPlayback(voice);
  };

  const testTtsPlayback = async (voice: VoiceItem) => {
    setIsGeneratingTts(voice.id);
    try {
      // Fallback elegante usando a síntese de fala do navegador com o texto de teste
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(testText);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0;
        utterance.pitch = voice.gender === 'female' ? 1.15 : voice.gender === 'male' ? 0.85 : 1.0;
        
        utterance.onstart = () => {
          setPlayingVoiceId(voice.id);
          setIsGeneratingTts(null);
        };
        utterance.onend = () => {
          setPlayingVoiceId(null);
        };
        utterance.onerror = () => {
          setPlayingVoiceId(null);
          setIsGeneratingTts(null);
        };
        window.speechSynthesis.speak(utterance);
      } else {
        alert("Áudio de síntese não suportado neste navegador.");
        setIsGeneratingTts(null);
      }
    } catch (e) {
      console.error(e);
      setIsGeneratingTts(null);
    }
  };

  const filteredVoices = voices.filter(v => {
    if (filter === 'custom') return v.isCustom;
    if (filter === 'system') return !v.isCustom;
    return true;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-rose-950 selection:text-rose-200">
      
      {/* Elemento de áudio para previews */}
      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingVoiceId(null)}
        onError={() => setPlayingVoiceId(null)}
        className="hidden" 
      />

      {/* HEADER ELEGANTE & NAVEGAÇÃO */}
      <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-neutral-200 transition-all hover:scale-105 active:scale-95"
          >
            ← Voltar
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎙️</span>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Estúdio de Vozes Gemini <span className="text-rose-500 font-mono text-xs px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 ml-1">Voice Design</span>
              </h1>
            </div>
            <p className="text-xs text-neutral-400">
              Crie personas vocais exclusivas com a API do Gemini e defina quem fala no sistema
            </p>
          </div>
        </div>

        {/* NAVEGAÇÃO RÁPIDA ENTRE TELAS */}
        <div className="flex items-center gap-2">
          {onNavigate && (
            <>
              <button
                onClick={() => onNavigate('/')}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/60"
              >
                🚀 Tutor Astro
              </button>
              <button
                onClick={() => onNavigate('/lilith')}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/60"
              >
                👁️ Lilith Live
              </button>
              <button
                onClick={() => onNavigate('/config')}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-800/70 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/60"
              >
                ⚙️ Config
              </button>
            </>
          )}
        </div>
      </header>

      {/* FEEDBACK STATUS BANNER */}
      {createStatus && (
        <div className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
          createStatus.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' 
            : createStatus.type === 'error'
            ? 'bg-rose-950/80 border-rose-800 text-rose-300'
            : 'bg-indigo-950/80 border-indigo-800 text-indigo-300'
        }`}>
          <span>{createStatus.message}</span>
          <button onClick={() => setCreateStatus(null)} className="text-neutral-400 hover:text-white font-bold ml-4">✕</button>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8">
        
        {/* COLUNA ESQUERDA: CATÁLOGO DE VOZES */}
        <section className="flex-1 flex flex-col gap-6">
          
          {/* BARRA DE CONTROLE & STATUS DAS VOZES ATIVAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono">Voz da Lilith</span>
                <p className="text-sm font-bold text-rose-400 mt-0.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  {activeLilithVoice}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-800/40 text-rose-300 font-mono">
                Ativa no Chat
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono">Voz do Tutor Astro</span>
                <p className="text-sm font-bold text-cyan-400 mt-0.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                  {activeTutorVoice}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-mono">
                Ativo no Revisor
              </span>
            </div>
          </div>

          {/* FILTROS E CONTAGEM */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Catálogo de Vozes
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                  {filteredVoices.length} disponíveis
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Selecione ou escute qualquer voz abaixo para utilizá-la em tempo real
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-neutral-900 rounded-xl border border-neutral-800 self-start sm:self-auto">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filter === 'all' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilter('custom')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filter === 'custom' ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50 shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                ✨ Personalizadas ({voices.filter(v => v.isCustom).length})
              </button>
              <button
                onClick={() => setFilter('system')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filter === 'system' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Padrão ({voices.filter(v => !v.isCustom).length})
              </button>
            </div>
          </div>

          {/* TEXTO DE TESTE GLOBAL */}
          <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <span className="text-xs font-mono text-neutral-400 whitespace-nowrap">Frase de teste:</span>
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600 font-sans"
              placeholder="Digite a frase para ouvir ao testar as vozes..."
            />
          </div>

          {/* LISTA DE CARDS DE VOZ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVoices.map((voice) => {
              const isLilithActive = activeLilithVoice === voice.id;
              const isTutorActive = activeTutorVoice === voice.id;
              const isPlaying = playingVoiceId === voice.id;
              const isGenerating = isGeneratingTts === voice.id;

              return (
                <div
                  key={voice.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                    voice.isCustom
                      ? isLilithActive
                        ? 'bg-gradient-to-br from-neutral-900 via-rose-950/20 to-neutral-900 border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                        : 'bg-neutral-900/60 border-rose-900/30 hover:border-rose-700/50 hover:bg-neutral-900/90'
                      : isTutorActive
                      ? 'bg-neutral-900/90 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                      : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80'
                  }`}
                >
                  <div className="flex flex-col gap-2">
                    {/* TOPO DO CARD */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold ${
                          voice.isCustom 
                            ? 'bg-rose-950 border border-rose-700/50 text-rose-300' 
                            : 'bg-neutral-800 border border-neutral-700 text-neutral-300'
                        }`}>
                          {voice.gender === 'female' ? '♀' : voice.gender === 'male' ? '♂' : '◈'}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            {voice.name}
                          </h3>
                          <span className="text-[10px] font-mono text-neutral-400">
                            ID: {voice.id}
                          </span>
                        </div>
                      </div>

                      {/* BADGES */}
                      <div className="flex flex-col items-end gap-1">
                        {voice.isCustom ? (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-700/50 shadow-sm">
                            Custom Gemini
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                            Sistema
                          </span>
                        )}
                        {voice.audioPreviewUrl && (
                          <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                            ● Preview WAV
                          </span>
                        )}
                      </div>
                    </div>

                    {/* DESCRIÇÃO */}
                    <p className="text-xs text-neutral-300/80 leading-relaxed mt-1">
                      {voice.desc}
                    </p>

                    {/* PROMPT ORIGINAL CASO SEJA CUSTOMIZADA */}
                    {voice.promptDescription && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-rose-400/90 font-mono cursor-pointer hover:underline">
                          Ver prompt de criação (Voice Design)
                        </summary>
                        <p className="text-[11px] text-neutral-400 font-mono bg-neutral-950 p-2 rounded-lg mt-1 border border-neutral-800/80 leading-normal">
                          {voice.promptDescription}
                        </p>
                      </details>
                    )}
                  </div>

                  {/* AÇÕES E PLAY */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800/60">
                    
                    {/* BOTÃO OUVIRE TESTAR */}
                    <button
                      onClick={() => handlePlayAudio(voice)}
                      disabled={isGenerating}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        isPlaying
                          ? 'bg-rose-600 text-white animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                      }`}
                    >
                      {isPlaying ? (
                        <>⏹️ Pausar Áudio</>
                      ) : isGenerating ? (
                        <>⏳ Sintetizando fala...</>
                      ) : (
                        <>▶️ {voice.audioPreviewUrl ? 'Ouvir Gravação Oficial' : 'Testar Síntese de Voz'}</>
                      )}
                    </button>

                    {/* BOTÕES DE ATIVAÇÃO */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSetForLilith(voice.id)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                          isLilithActive
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-600 shadow-sm'
                            : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700/50'
                        }`}
                      >
                        {isLilithActive ? '✓ Ativa na Lilith' : 'Usar na Lilith'}
                      </button>

                      <button
                        onClick={() => handleSetForTutor(voice.id)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                          isTutorActive
                            ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-600 shadow-sm'
                            : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700/50'
                        }`}
                      >
                        {isTutorActive ? '✓ Ativa no Astro' : 'Usar no Astro'}
                      </button>

                      {voice.isCustom && (
                        <button
                          onClick={() => handleDelete(voice.id, voice.name)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900 transition-colors"
                          title="Excluir voz"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* COLUNA DIREITA: FORMULÁRIO DE VOICE DESIGN */}
        <aside className="w-full lg:w-[440px] flex flex-col gap-6">
          
          {/* PAINEL DE CRIAÇÃO (VOICE DESIGN) */}
          <div className="p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 shadow-xl flex flex-col gap-5 sticky top-24">
            
            <div className="border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h2 className="text-base font-bold text-white">
                  Criar Nova Voz (Voice Design)
                </h2>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Descreva as características sonoras e gere um timbre único via API do Gemini
              </p>
            </div>

            {/* PRESETS RÁPIDOS */}
            <div>
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block mb-2">
                Presets de Início Rápido:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {PROMPT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="p-2 rounded-xl text-left bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 font-medium transition-all"
                  >
                    ⚡ {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* FORMULÁRIO */}
            <form onSubmit={handleCreateVoice} className="flex flex-col gap-4">
              
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Nome da Persona Vocal
                </label>
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="Ex: Lilith Magnética, Sofia Docente..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Gênero Vocal
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['female', 'male', 'neutral'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setVoiceGender(g)}
                      className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        voiceGender === g
                          ? 'bg-rose-950/80 border-rose-600 text-rose-300 shadow-sm'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {g === 'female' ? 'Feminina' : g === 'male' ? 'Masculina' : 'Neutra'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-300">
                    Prompt Descritivo (Voice Design)
                  </label>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {voicePrompt.length} caracteres
                  </span>
                </div>
                <textarea
                  value={voicePrompt}
                  onChange={(e) => setVoicePrompt(e.target.value)}
                  rows={5}
                  placeholder="Descreva idade aproximada, tom de voz, ritmo, sotaque, microfone íntimo ou aberto, risos, respiração e intenção emocional..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors leading-relaxed"
                />
                <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
                  💡 <strong>Dica:</strong> Detalhes como "registro médio-grave", "presença íntima de microfone" e "pausas deliberadas" refinam a naturalidade do áudio no Gemini.
                </p>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-[0_0_20px_rgba(244,63,94,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
              >
                {isCreating ? (
                  <>⏳ Gerando Persona Vocal...</>
                ) : (
                  <>✨ Criar e Registrar Voz no Gemini</>
                )}
              </button>
            </form>

            {/* SEÇÃO IMPORTAR POR ID */}
            <div className="pt-4 border-t border-neutral-800/80 flex flex-col gap-2.5">
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
                Importar ID Existente (ex: voice_jc1lbgu1cty8):
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={importId}
                  onChange={(e) => setImportId(e.target.value)}
                  placeholder="voice_..."
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={handleImportById}
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-neutral-200"
                >
                  Importar
                </button>
              </div>
            </div>

          </div>
        </aside>

      </main>

    </div>
  );
}
