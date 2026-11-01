import { useState, useRef, useCallback } from "react";
import { resolveLiveVoice } from "../config/aiConfig";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface LilithMessage {
  id: string;
  sender: 'user' | 'lilith';
  text: string;
  timestamp: string;
}

export const DEFAULT_LILITH_PROMPT = `Você é Lilith: inteligência afiada, direta, perspicaz e sem rodeios. Você fala com fluidez natural, voz calma, assertiva e envolvente. Não seja prolixa, responda com elegância e objetividade cirúrgica. Trate seu interlocutor com total atenção e foco operacional absoluto.`;

const STORAGE_RESUME_HANDLE = "lilith_resume_handle";

export function useLilithVoice() {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<LilithMessage[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState<{ user: string; lilith: string }>({ user: "", lilith: "" });

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlaybackTimeRef = useRef<number>(0);
  const currentUtteranceRef = useRef<{ user: string; lilith: string }>({ user: "", lilith: "" });
  const isInterruptedRef = useRef<boolean>(false);

  const shouldBeConnectedRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const resumptionHandleRef = useRef<string | null>(localStorage.getItem(STORAGE_RESUME_HANDLE) || null);
  const lastParamsRef = useRef<{ systemInstruction: string; voiceName: string }>({
    systemInstruction: DEFAULT_LILITH_PROMPT,
    voiceName: "Leda"
  });

  const stopAllPlayback = useCallback(() => {
    isInterruptedRef.current = true;
    activeSourcesRef.current.forEach(source => { 
      try { 
        source.stop(); 
      } catch (e) { 
        void e; 
      } 
    });
    activeSourcesRef.current = [];
    nextPlaybackTimeRef.current = 0;
    setIsSpeaking(false);
  }, []);

  const cleanupAudio = useCallback(() => {
    stopAllPlayback();
    if (micStreamRef.current) {
      try { micStreamRef.current.getTracks().forEach(track => track.stop()); } catch (e) { void e; }
      micStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { audioCtxRef.current.close(); } catch (e) { void e; }
      audioCtxRef.current = null;
    }
    setIsListening(false);
  }, [stopAllPlayback]);

  const disconnect = useCallback(() => {
    shouldBeConnectedRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    cleanupAudio();
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { void e; }
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsReconnecting(false);
    setIsListening(false);
    setIsSpeaking(false);
  }, [cleanupAudio]);

  const connect = async (
    systemInstruction: string = DEFAULT_LILITH_PROMPT, 
    voiceName: string = "Leda",
    isAutoResume: boolean = false
  ) => {
    shouldBeConnectedRef.current = true;
    lastParamsRef.current = { systemInstruction, voiceName };

    if (!isAutoResume) {
      setIsReconnecting(false);
      setCurrentTranscription({ user: "", lilith: "" });
      currentUtteranceRef.current = { user: "", lilith: "" };
      // Limpa qualquer sessão salva anterior ao conectar explicitamente
      resumptionHandleRef.current = null;
      localStorage.removeItem(STORAGE_RESUME_HANDLE);
    }

    // Se já havia socket aberto, fecha antes de reconectar
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { void e; }
      wsRef.current = null;
    }

    isInterruptedRef.current = false;

    try {
      if (!API_KEY) {
        console.error("[Lilith] API_KEY não encontrada");
        disconnect();
        return;
      }

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      const processorName = `lilith-audio-worklet-${Date.now()}`;
      const workletCode = `
        class AudioProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input.length > 0 && input[0].length > 0) {
              this.port.postMessage(input[0]);
            }
            return true;
          }
        }
        registerProcessor('${processorName}', AudioProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioCtxRef.current.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // Cancelamento de eco ativado para evitar loops e interrupção acidental
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      micStreamRef.current = micStream;
      const micSource = audioCtxRef.current.createMediaStreamSource(micStream);
      const workletNode = new AudioWorkletNode(audioCtxRef.current, processorName);

      let pipelineActive = false;
      let consecutiveSpeechFrames = 0;

      const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`);
      wsRef.current = ws;

      const startPipeline = () => {
        if (pipelineActive || ws.readyState !== WebSocket.OPEN) return;
        pipelineActive = true;
        setIsListening(true);
        setIsConnected(true);
        setIsReconnecting(false);

        workletNode.port.onmessage = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.data;
          const pcmData = new Int16Array(inputData.length);
          let sumSquares = 0;

          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 32768 : s * 32767;
            sumSquares += s * s;
          }

          // VAD local para interrupção instantânea ao falar
          const rms = Math.sqrt(sumSquares / inputData.length);
          if (rms > 0.035) {
            consecutiveSpeechFrames++;
            if (consecutiveSpeechFrames >= 2 && activeSourcesRef.current.length > 0) {
              console.log("[Lilith] Usuário falando: interrompendo áudio imediatamente");
              stopAllPlayback();
            }
          } else {
            consecutiveSpeechFrames = 0;
          }

          // Envio contínuo de PCM 16kHz que também serve como heartbeat/keep-alive contra idle timeout
          ws.send(JSON.stringify({
            realtimeInput: {
              audio: {
                data: window.btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer))),
                mimeType: "audio/pcm;rate=16000"
              }
            }
          }));
        };
        micSource.connect(workletNode);
      };

      ws.onopen = () => {
        console.log("[Lilith] WebSocket Conectado");

        const { liveVoiceName, customPromptEnhancement } = resolveLiveVoice(voiceName || "Leda");
        const finalInstruction = (systemInstruction || DEFAULT_LILITH_PROMPT) + (customPromptEnhancement || "");

        const setupPayload: any = {
          model: "models/gemini-3.1-flash-live-preview",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: liveVoiceName
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: finalInstruction }]
          }
        };

        // RETOMADA DE SESSÃO AUTOMÁTICA (Session Resumption)
        if (resumptionHandleRef.current) {
          setupPayload.sessionResumption = { handle: resumptionHandleRef.current };
          console.log("[Lilith] Reenviando sessão salva com handle:", resumptionHandleRef.current);
        }

        ws.send(JSON.stringify({ setup: setupPayload }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());

        if (data.setupComplete) {
          console.log("[Lilith] Setup concluído. Sessão ativa.");
          startPipeline();
          return;
        }

        // Armazena tokens de retomada de sessão recebidos do Gemini
        const resumptionUpdate = data.sessionResumptionUpdate;
        if (resumptionUpdate?.resumable && resumptionUpdate?.newHandle) {
          resumptionHandleRef.current = resumptionUpdate.newHandle;
          localStorage.setItem(STORAGE_RESUME_HANDLE, resumptionUpdate.newHandle);
          console.log("[Lilith] Novo token de retomada salvo:", resumptionUpdate.newHandle);
        }

        // Interrupção confirmada pelo servidor
        if (data.serverContent?.interrupted || data.interrupted) {
          console.log("[Lilith] Interrupção confirmada pelo Gemini Live");
          stopAllPlayback();
          return;
        }

        const serverContent = data.serverContent;
        if (serverContent) {
          const userTurn = serverContent.userTurn;
          const modelTurn = serverContent.modelTurn;
          let changed = false;

          // Se o servidor começou a processar fala do usuário, corta áudio imediatamente
          if (userTurn?.parts) {
            if (activeSourcesRef.current.length > 0) {
              stopAllPlayback();
            }
            if (currentUtteranceRef.current.lilith) {
              setMessages(prev => [
                ...prev,
                { id: `lilith-${Date.now()}`, sender: 'lilith', text: currentUtteranceRef.current.lilith, timestamp: new Date().toLocaleTimeString() }
              ]);
              currentUtteranceRef.current = { user: "", lilith: "" };
            }
            userTurn.parts.forEach((p: any) => {
              if (p.text) {
                currentUtteranceRef.current.user += p.text;
                changed = true;
              }
            });
          }

          if (modelTurn?.parts) {
            isInterruptedRef.current = false;

            if (currentUtteranceRef.current.user && !currentUtteranceRef.current.lilith) {
              setMessages(prev => [
                ...prev,
                { id: `user-${Date.now()}`, sender: 'user', text: currentUtteranceRef.current.user, timestamp: new Date().toLocaleTimeString() }
              ]);
            }
            modelTurn.parts.forEach((p: any) => {
              if (p.text) {
                currentUtteranceRef.current.lilith += p.text;
                changed = true;
              }
            });
          }

          if (changed) {
            setCurrentTranscription({ ...currentUtteranceRef.current });
          }
        }

        // Reprodução de áudio
        if (serverContent?.modelTurn?.parts && !isInterruptedRef.current) {
          for (const part of serverContent.modelTurn.parts) {
            if (part.inlineData?.data && !isInterruptedRef.current) {
              const audioData = window.atob(part.inlineData.data);
              const int16 = new Int16Array(new Uint8Array(Array.from(audioData).map(c => c.charCodeAt(0))).buffer);
              const float32 = new Float32Array(int16.length);
              for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

              if (audioCtxRef.current) {
                try {
                  const buffer = audioCtxRef.current.createBuffer(1, float32.length, 24000);
                  buffer.getChannelData(0).set(float32);
                  const source = audioCtxRef.current.createBufferSource();
                  source.buffer = buffer;
                  source.connect(audioCtxRef.current.destination);

                  const now = audioCtxRef.current.currentTime;
                  if (nextPlaybackTimeRef.current < now) nextPlaybackTimeRef.current = now + 0.04;

                  source.start(nextPlaybackTimeRef.current);
                  nextPlaybackTimeRef.current += buffer.duration;

                  activeSourcesRef.current.push(source);
                  setIsSpeaking(true);

                  source.onended = () => {
                    activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
                    if (activeSourcesRef.current.length === 0) setIsSpeaking(false);
                  };
                } catch (err) {
                  console.error("[Lilith] Erro ao reproduzir áudio:", err);
                }
              }
            }
          }
        }
      };

      ws.onerror = (err) => {
        console.error("[Lilith WS Error]", err);
      };

      // TRATAMENTO DE QUEDA COM RETOMADA AUTOMÁTICA
      ws.onclose = (event) => {
        console.warn(`[Lilith WS Close] Código: ${event.code}, Razão: ${event.reason || 'Conexão encerrada'}`);
        cleanupAudio();
        setIsListening(false);
        setIsSpeaking(false);

        // Erro 1007: parâmetro inválido (ex: voice replication não suportada no live)
        if (event.code === 1007 || (event.reason && event.reason.includes('Voice replication'))) {
          console.error("[Lilith] Erro nos parâmetros do Live API (Código 1007). Resetando sessão.");
          resumptionHandleRef.current = null;
          localStorage.removeItem(STORAGE_RESUME_HANDLE);
          shouldBeConnectedRef.current = false;
          setIsConnected(false);
          setIsReconnecting(false);
          return;
        }

        // Se o usuário não clicou manualmente em "Encerrar Sessão", reconecta imediatamente
        if (shouldBeConnectedRef.current) {
          setIsReconnecting(true);
          console.log("[Lilith] Queda inesperada da conexão. Reconectando e retomando sessão de onde parou em 1.5s...");
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = window.setTimeout(() => {
            if (shouldBeConnectedRef.current) {
              connect(lastParamsRef.current.systemInstruction, lastParamsRef.current.voiceName, true);
            }
          }, 1500);
        } else {
          setIsConnected(false);
          setIsReconnecting(false);
        }
      };
    } catch (err) {
      console.error("[Lilith Connect Error]", err);
      if (shouldBeConnectedRef.current) {
        setIsReconnecting(true);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          if (shouldBeConnectedRef.current) {
            connect(lastParamsRef.current.systemInstruction, lastParamsRef.current.voiceName, true);
          }
        }, 2000);
      } else {
        disconnect();
      }
    }
  };

  const clearHistory = () => {
    setMessages([]);
    setCurrentTranscription({ user: "", lilith: "" });
    currentUtteranceRef.current = { user: "", lilith: "" };
    resumptionHandleRef.current = null;
    localStorage.removeItem(STORAGE_RESUME_HANDLE);
  };

  return {
    isConnected,
    isReconnecting,
    isSpeaking,
    isListening,
    messages,
    currentTranscription,
    connect,
    disconnect,
    clearHistory
  };
}
