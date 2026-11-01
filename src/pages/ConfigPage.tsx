import { useState, useEffect } from 'react';
import { 
  getAIConfig, 
  saveAIConfig, 
  resetAIConfig, 
  getAllVoices,
  DEFAULT_VOICE,
  formatSystemPrompt,
  type VoiceItem 
} from '../config/aiConfig';

interface ConfigPageProps {
  onBack: () => void;
  onNavigate?: (path: string) => void;
}

export function ConfigPage({ onBack, onNavigate }: ConfigPageProps) {
  const [promptTemplate, setPromptTemplate] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [voicesList, setVoicesList] = useState<VoiceItem[]>([]);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [previewSubject] = useState('Ciências');
  const [previewTopic] = useState('Sistema Solar');
  const [previewDetails] = useState('Planetas rochosos: Mercúrio, Vênus, Terra e Marte. Planetas gasosos: Júpiter, Saturno, Urano e Netuno.');

  useEffect(() => {
    const config = getAIConfig();
    setPromptTemplate(config.promptTemplate);
    setSelectedVoice(config.voiceName || DEFAULT_VOICE);
    setVoicesList(getAllVoices());
  }, []);

  const handleSave = () => {
    saveAIConfig({
      promptTemplate,
      voiceName: selectedVoice
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 3000);
  };

  const handleReset = () => {
    if (window.confirm('Deseja restaurar as configurações de prompt e voz para o padrão original?')) {
      const def = resetAIConfig();
      setPromptTemplate(def.promptTemplate);
      setSelectedVoice(def.voiceName);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 3000);
    }
  };

  const insertVariable = (variable: string) => {
    setPromptTemplate(prev => prev + ' ' + variable);
  };

  const previewText = formatSystemPrompt(promptTemplate, {
    subject: previewSubject,
    topic: previewTopic,
    topicDetails: previewDetails
  });

  const customVoices = voicesList.filter(v => v.isCustom);
  const systemVoices = voicesList.filter(v => !v.isCustom);

  return (
    <div className="min-h-[100dvh] text-slate-50 flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto w-full relative z-10">
      <div className="w-full max-w-4xl flex flex-col gap-6 pt-4 pb-16">
        
        {/* TOPO COM BOTÃO DE VOLTAR E STATUS */}
        <div className="glass-panel p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t-2 border-t-cyan-500/40">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-indigo-500/40 text-cyan-300 font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-md"
            >
              ← Voltar à Missão
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                Configuração da IA & Voz
              </h1>
              <p className="text-xs text-indigo-300 font-medium">
                Personalize o Prompt do Sistema e o timbre vocal do tutor Astro
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/voices')}
                className="px-3.5 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-xs font-bold transition-all hover:scale-105 flex items-center gap-1.5 shadow-md"
              >
                🎙️ Estúdio de Vozes (Criar / Gerenciar)
              </button>
            )}
            {savedFeedback && (
              <span className="text-xs font-bold text-green-400 bg-green-950/70 border border-green-500/40 px-3 py-1.5 rounded-full animate-pulse shadow-[0_0_15px_rgba(74,222,128,0.4)]">
                ✓ Salvo com sucesso!
              </span>
            )}
            <button
              onClick={handleReset}
              className="text-xs font-bold text-rose-300 hover:text-white px-3 py-2 rounded-xl border border-rose-500/30 hover:bg-rose-900/40 transition-colors"
            >
              Restaurar Padrão
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl font-black text-sm text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              💾 Salvar Alterações
            </button>
          </div>
        </div>

        {/* SELEÇÃO DE VOZ */}
        <div className="glass-panel p-6 sm:p-8 border-t-2 border-t-purple-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎙️</span>
              <div>
                <h2 className="text-xl font-bold text-purple-200">
                  Voz da IA (Gemini Multimodal Live)
                </h2>
                <p className="text-xs text-indigo-300/80">
                  Escolha quem dará voz às explicações e ao quiz
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-200">
                Voz Selecionada: <strong className="text-cyan-300">{selectedVoice}</strong>
              </span>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('/voices')}
                  className="text-xs font-bold px-3 py-1 rounded-full bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 transition-colors"
                >
                  + Criar Nova Voz
                </button>
              )}
            </div>
          </div>

          {/* SEÇÃO VOZES PERSONALIZADAS SE EXISTIREM */}
          {customVoices.length > 0 && (
            <div className="mb-6">
              <span className="text-xs font-mono uppercase tracking-wider text-rose-300 font-bold block mb-2.5 flex items-center gap-1.5">
                ✨ Suas Vozes Personalizadas (Voice Design Gemini)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {customVoices.map((v) => {
                  const isSelected = selectedVoice === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-rose-950/80 to-purple-950/80 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.35)] scale-[1.02]'
                          : 'bg-neutral-900/70 border-rose-900/40 hover:border-rose-500/60 hover:bg-neutral-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm text-rose-100 flex items-center gap-1.5 truncate">
                          {isSelected ? '🟣' : '⚪'} {v.name}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/40">
                          Custom
                        </span>
                      </div>
                      <p className="text-xs text-rose-200/70 line-clamp-2">
                        {v.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEÇÃO VOZES DO SISTEMA */}
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-indigo-300 font-bold block mb-2.5">
              Vozes Padrão do Sistema
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {systemVoices.map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoice(v.id)}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-indigo-900/80 to-purple-900/60 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] scale-[1.02]'
                        : 'bg-slate-900/60 border-indigo-500/30 hover:border-indigo-400/60 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-indigo-100 flex items-center gap-1.5">
                        {isSelected ? '🟣' : '⚪'} {v.id}
                      </span>
                      {v.id === 'Leda' && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-300/80 line-clamp-2">
                      {v.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* EDITOR DO PROMPT DO SISTEMA */}
        <div className="glass-panel p-6 sm:p-8 border-t-2 border-t-blue-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧠</span>
              <div>
                <h2 className="text-xl font-bold text-blue-200">
                  Prompt do Sistema (System Instruction)
                </h2>
                <p className="text-xs text-indigo-300/80">
                  Instruções mestras enviadas ao Gemini no início de cada sessão de voz
                </p>
              </div>
            </div>

            {/* VARIÁVEIS DISPONÍVEIS */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-indigo-300 mr-1 font-semibold">Tags:</span>
              <button
                type="button"
                onClick={() => insertVariable('{subject}')}
                className="text-[11px] font-mono px-2 py-1 rounded-md bg-indigo-950/80 border border-indigo-500/40 text-cyan-300 hover:bg-indigo-900"
                title="Insere a matéria escolhida"
              >
                +&#123;subject&#125;
              </button>
              <button
                type="button"
                onClick={() => insertVariable('{topic}')}
                className="text-[11px] font-mono px-2 py-1 rounded-md bg-indigo-950/80 border border-indigo-500/40 text-cyan-300 hover:bg-indigo-900"
                title="Insere o tópico selecionado"
              >
                +&#123;topic&#125;
              </button>
              <button
                type="button"
                onClick={() => insertVariable('{topicDetails}')}
                className="text-[11px] font-mono px-2 py-1 rounded-md bg-indigo-950/80 border border-indigo-500/40 text-cyan-300 hover:bg-indigo-900"
                title="Insere o conteúdo escolar a ser ensinado"
              >
                +&#123;topicDetails&#125;
              </button>
            </div>
          </div>

          <textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            rows={10}
            className="w-full bg-slate-950/80 border border-indigo-500/40 rounded-2xl p-4 text-sm font-mono text-indigo-100 placeholder-indigo-400/50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all leading-relaxed shadow-inner"
            placeholder="Digite as instruções mestras do sistema..."
          />

          <div className="mt-4 flex flex-col gap-2">
            <span className="text-xs font-bold text-indigo-300">
              👁️ Pré-visualização com dados reais de exemplo (Ciências - Sistema Solar):
            </span>
            <div className="bg-slate-900/60 border border-indigo-500/20 rounded-xl p-4 text-xs font-mono text-indigo-200/90 whitespace-pre-wrap max-h-48 overflow-y-auto shadow-inner">
              {previewText}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
