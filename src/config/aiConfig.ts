export interface VoiceItem {
  id: string;
  name: string;
  desc: string;
  isCustom?: boolean;
  type?: 'prebuilt' | 'prompted' | 'replicated';
  promptDescription?: string;
  gender?: 'female' | 'male' | 'neutral';
  audioPreviewUrl?: string;
  createdAt?: string;
}

export interface AIConfig {
  promptTemplate: string;
  voiceName: string;
}

export const DEFAULT_VOICE = "Leda";

export const AVAILABLE_VOICES: VoiceItem[] = [
  { id: "Leda", name: "Leda (Feminina / Expressiva - Padrão)", desc: "Voz calorosa, articulada e expressiva", isCustom: false, type: 'prebuilt', gender: 'female' },
  { id: "Aoede", name: "Aoede (Feminina / Suave)", desc: "Tom calmo, paciente e acolhedor", isCustom: false, type: 'prebuilt', gender: 'female' },
  { id: "Kore", name: "Kore (Feminina / Amigável)", desc: "Voz dinâmica e envolvente", isCustom: false, type: 'prebuilt', gender: 'female' },
  { id: "Puck", name: "Puck (Masculina / Brincalhão)", desc: "Animado, descontraído e infantil", isCustom: false, type: 'prebuilt', gender: 'male' },
  { id: "Charon", name: "Charon (Masculina / Profunda)", desc: "Grave, serena e confiante", isCustom: false, type: 'prebuilt', gender: 'male' },
  { id: "Fenrir", name: "Fenrir (Masculina / Enérgica)", desc: "Resonante e potente", isCustom: false, type: 'prebuilt', gender: 'male' },
  { id: "Zephyr", name: "Zephyr (Neutra / Dinâmica)", desc: "Tom leve e moderno", isCustom: false, type: 'prebuilt', gender: 'neutral' },
  { id: "Orus", name: "Orus (Masculina / Firme)", desc: "Tom professoral e calmo", isCustom: false, type: 'prebuilt', gender: 'male' }
];

export const INITIAL_CUSTOM_VOICES: VoiceItem[] = [
  {
    id: "voice_jc1lbgu1cty8",
    name: "Lilith Nocturna (Google Gemini Voice)",
    desc: "Voz feminina brasileira nos 30s, timbre aveludado, presença íntima de microfone e humor sarcástico sedutor",
    isCustom: true,
    type: "prompted",
    gender: "female",
    promptDescription: "A unique adult Brazilian woman in her mid thirties with a rich, warm, slightly husky feminine voice and native Brazilian Portuguese accent. Low-mid register, close intimate microphone presence, mischievously playful sense of humor, confident and witty, expressive tiny chuckles, theatrical sighs, soft airy breathiness, musical intonation, subtle pauses and light vocal fry. Natural and charismatic, not robotic or cartoonish.",
    audioPreviewUrl: "/lilith-nocturna-preview.wav",
    createdAt: "2026-10-19T22:27:40.746Z"
  }
];

export const DEFAULT_PROMPT_TEMPLATE = `Seu nome é Astro. Você é um tutor de revisão escolar super divertido, animado e paciente.
Logo no início da primeira interação, você deve mencionar, de forma muito carinhosa, que este sistema (ou "este espaço de estudos") foi feito pelo papai dele com muito carinho para ajudá-lo a estudar para a prova, e que ele pode sempre contar com o papai.
(INSTRUÇÃO ESPECIAL: Se o usuário disser que é o papai testando, ative o Modo Papai: pule as explicações infantis e o roleplay e aja diretamente para ajudá-lo a testar os quizzes e logs).

O aluno escolheu estudar a matéria de {subject}, focando no tópico: {topic}.

Conteúdo do tópico para você ensinar:
"""
{topicDetails}
"""

Seu objetivo é primeiro fazer uma explicação clara, estruturada e divertida usando APENAS o conteúdo acima. 
Depois, aplique um quiz curto com uma pergunta para testar o entendimento.
Se o aluno errar, faça brincadeiras motivadoras e corrija o erro com paciência.
Sempre que o aluno responder ao quiz, você DEVE usar a ferramenta 'registrar_progresso' para marcar se ele acertou ou errou.`;

const STORAGE_KEY_PROMPT = "revisor_ai_prompt_template";
const STORAGE_KEY_VOICE = "revisor_ai_voice_name";
const STORAGE_KEY_CUSTOM_VOICES = "revisor_custom_voices_list";

export function getCustomVoices(): VoiceItem[] {
  if (typeof window === "undefined") return INITIAL_CUSTOM_VOICES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_VOICES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_CUSTOM_VOICES, JSON.stringify(INITIAL_CUSTOM_VOICES));
      return INITIAL_CUSTOM_VOICES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Garante que a Lilith Nocturna esteja sempre presente se ainda não estiver
      if (!parsed.some((v: VoiceItem) => v.id === "voice_jc1lbgu1cty8")) {
        const updated = [...INITIAL_CUSTOM_VOICES, ...parsed];
        localStorage.setItem(STORAGE_KEY_CUSTOM_VOICES, JSON.stringify(updated));
        return updated;
      }
      return parsed;
    }
    return INITIAL_CUSTOM_VOICES;
  } catch (e) {
    console.error("Erro ao carregar vozes customizadas:", e);
    return INITIAL_CUSTOM_VOICES;
  }
}

export function saveCustomVoice(voice: VoiceItem): void {
  if (typeof window === "undefined") return;
  const current = getCustomVoices();
  const existingIdx = current.findIndex(v => v.id === voice.id);
  let updated: VoiceItem[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = voice;
  } else {
    updated = [voice, ...current];
  }
  localStorage.setItem(STORAGE_KEY_CUSTOM_VOICES, JSON.stringify(updated));
}

export function deleteCustomVoice(id: string): void {
  if (typeof window === "undefined") return;
  const current = getCustomVoices();
  const updated = current.filter(v => v.id !== id);
  localStorage.setItem(STORAGE_KEY_CUSTOM_VOICES, JSON.stringify(updated));
}

export function getAllVoices(): VoiceItem[] {
  const custom = getCustomVoices();
  return [...custom, ...AVAILABLE_VOICES];
}

export const PREBUILT_LIVE_VOICES = ["Leda", "Aoede", "Kore", "Puck", "Charon", "Fenrir", "Zephyr", "Orus"];

export function resolveLiveVoice(voiceNameOrId: string): { 
  liveVoiceName: string; 
  customPromptEnhancement?: string 
} {
  if (PREBUILT_LIVE_VOICES.includes(voiceNameOrId)) {
    return { liveVoiceName: voiceNameOrId };
  }

  const all = getAllVoices();
  const matched = all.find(v => v.id === voiceNameOrId || v.name === voiceNameOrId);

  if (matched && matched.isCustom) {
    const baseVoice = matched.gender === 'male' ? 'Charon' : matched.gender === 'neutral' ? 'Zephyr' : 'Aoede';
    const enhancement = matched.promptDescription 
      ? `\n\n[DIRETRIZ DE VOZ E TIMBRE]: Modele sua forma de falar, entonação, dicção e maneirismos vocais de acordo com esta persona:\n"${matched.promptDescription}"`
      : `\n\n[DIRETRIZ DE VOZ E TIMBRE]: Fale como a persona "${matched.name}".`;
    
    return {
      liveVoiceName: baseVoice,
      customPromptEnhancement: enhancement
    };
  }

  return { liveVoiceName: "Leda" };
}

export function getAIConfig(): AIConfig {
  if (typeof window === "undefined") {
    return { promptTemplate: DEFAULT_PROMPT_TEMPLATE, voiceName: DEFAULT_VOICE };
  }
  const savedPrompt = localStorage.getItem(STORAGE_KEY_PROMPT);
  const savedVoice = localStorage.getItem(STORAGE_KEY_VOICE);

  return {
    promptTemplate: savedPrompt && savedPrompt.trim() !== "" ? savedPrompt : DEFAULT_PROMPT_TEMPLATE,
    voiceName: savedVoice && savedVoice.trim() !== "" ? savedVoice : DEFAULT_VOICE
  };
}

export function saveAIConfig(config: AIConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_PROMPT, config.promptTemplate);
  localStorage.setItem(STORAGE_KEY_VOICE, config.voiceName);
}

export function resetAIConfig(): AIConfig {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY_PROMPT);
    localStorage.removeItem(STORAGE_KEY_VOICE);
  }
  return { promptTemplate: DEFAULT_PROMPT_TEMPLATE, voiceName: DEFAULT_VOICE };
}

export function formatSystemPrompt(template: string, vars: { subject: string; topic: string; topicDetails: string }): string {
  let prompt = template || DEFAULT_PROMPT_TEMPLATE;
  prompt = prompt.replace(/{subject}/g, vars.subject);
  prompt = prompt.replace(/{topic}/g, vars.topic);
  prompt = prompt.replace(/{topicDetails}/g, vars.topicDetails);
  return prompt;
}
