import { useState, useRef, useCallback } from "react";
import { jsPDF } from "jspdf";
import syllabusData from '../config/syllabus.json';
import { getAIConfig, formatSystemPrompt, resolveLiveVoice } from '../config/aiConfig';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface ProgressData {
  topic: string;
  result: "acerto" | "erro";
  failReason?: string;
}

export interface Transcription {
  userText: string;
  modelText: string;
}

export function useGeminiTutor(onProgressUpdate?: (data: ProgressData) => void) {
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcription, setTranscription] = useState<Transcription>({ userText: "", modelText: "" });
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlaybackTimeRef = useRef<number>(0);
  const isInterruptedRef = useRef<boolean>(false);

  const currentUtteranceRef = useRef<Transcription>({ userText: "", modelText: "" });
  const resumptionHandleRef = useRef<string | null>(localStorage.getItem('astro_resume_handle') || null);
  const shouldBeConnectedRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastParamsRef = useRef<{ subject: string; topic: string }>({ subject: "", topic: "" });

  const stopAllPlayback = useCallback(() => {
    isInterruptedRef.current = true;
    activeSourcesRef.current.forEach(source => { try { source.stop(); } catch (e) { void e; } });
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
  }, [stopAllPlayback]);

  const stopLiveDialog = useCallback(() => {
    shouldBeConnectedRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    cleanupAudio();
    if (wsRef.current) { try { wsRef.current.close(); } catch(e){ void e; } wsRef.current = null; }
    setIsRecordingVoice(false);
    setIsReconnecting(false);
  }, [cleanupAudio]);

  const startLiveDialog = async (subject: string, topic: string, isAutoResume: boolean = false) => {
    shouldBeConnectedRef.current = true;
    lastParamsRef.current = { subject, topic };

    if (!isAutoResume) {
      setIsRecordingVoice(true);
      setIsReconnecting(false);
      setTranscription({ userText: "", modelText: "" });
      currentUtteranceRef.current = { userText: "", modelText: "" };
      resumptionHandleRef.current = null;
      localStorage.removeItem('astro_resume_handle');
    }

    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { void e; }
      wsRef.current = null;
    }

    isInterruptedRef.current = false;

    try {
      if (!API_KEY) {
        console.error("API Key não encontrada.");
        stopLiveDialog();
        return;
      }

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();

      const processorName = `audio-processor-${Date.now()}`;
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

      // Cancelamento de eco ativado
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

      let audioPipelineStarted = false;
      let consecutiveSpeechFrames = 0;

      const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`);
      wsRef.current = ws;

      const startAudioPipeline = () => {
        if (audioPipelineStarted || ws.readyState !== WebSocket.OPEN) return;
        audioPipelineStarted = true;
        setIsRecordingVoice(true);
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

          // VAD local para interrupção imediata quando o usuário começar a falar
          const rms = Math.sqrt(sumSquares / inputData.length);
          if (rms > 0.035) {
            consecutiveSpeechFrames++;
            if (consecutiveSpeechFrames >= 2 && activeSourcesRef.current.length > 0) {
              console.log("[Astro] Interrupção local: usuário falando no microfone");
              stopAllPlayback();
            }
          } else {
            consecutiveSpeechFrames = 0;
          }

          ws.send(JSON.stringify({ realtimeInput: { audio: { data: window.btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer))), mimeType: "audio/pcm;rate=16000" } } }));
        };
        micSource.connect(workletNode);
      };

      ws.onopen = () => {
        console.log("[Astro] WebSocket conectado!");
        const tools = [{
          functionDeclarations: [
            {
              name: "registrar_progresso",
              description: "Registra se o aluno acertou ou errou a pergunta do quiz, bem como a razão do erro, para adaptar o estudo.",
              parameters: {
                type: "OBJECT",
                properties: {
                  topic: { type: "STRING", description: "O tópico que foi testado" },
                  result: { type: "STRING", description: "acerto ou erro" },
                  failReason: { type: "STRING", description: "Se houve erro, descreva brevemente qual foi a dificuldade" }
                },
                required: ["topic", "result"]
              }
            },
            {
              name: "gerar_resumo_pdf",
              description: "Gera um documento PDF para o aluno com um grande resumo do que foi estudado. Deve ser acionado ao final da revisão.",
              parameters: {
                type: "OBJECT",
                properties: {
                  conteudo: { type: "STRING", description: "O texto extenso do resumo formatado para o PDF. Separe as ideias de forma limpa." }
                },
                required: ["conteudo"]
              }
            }
          ]
        }];

        const topicDetails = (syllabusData as Record<string, string>)[topic] || "Explique este tópico da sua base de dados genérica.";

        const aiConfig = getAIConfig();
        const { liveVoiceName, customPromptEnhancement } = resolveLiveVoice(aiConfig.voiceName || "Leda");
        const systemInstructionText = formatSystemPrompt(aiConfig.promptTemplate, {
          subject,
          topic,
          topicDetails
        }) + (customPromptEnhancement || "");

        const setupPayload: any = {
          model: "models/gemini-3.1-flash-live-preview",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: liveVoiceName } } }
          },
          tools,
          systemInstruction: { parts: [{ text: systemInstructionText }] }
        };

        if (resumptionHandleRef.current) {
          setupPayload.sessionResumption = { handle: resumptionHandleRef.current };
          console.log("[Astro] Retomando sessão com handle salvo:", resumptionHandleRef.current);
        }

        console.log("[Astro] Enviando Setup payload...", setupPayload);
        ws.send(JSON.stringify({ setup: setupPayload }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());

        if (data.setupComplete) {
          console.log("[Astro] Setup completo, iniciando pipeline de áudio (microfone)");
          startAudioPipeline();
          return;
        }

        const resumptionUpdate = data.sessionResumptionUpdate;
        if (resumptionUpdate?.resumable && resumptionUpdate?.newHandle) {
          resumptionHandleRef.current = resumptionUpdate.newHandle;
          localStorage.setItem('astro_resume_handle', resumptionUpdate.newHandle);
          console.log("[Astro] Novo token de retomada salvo:", resumptionUpdate.newHandle);
        }

        // Interrupção confirmada pelo servidor
        if (data.serverContent?.interrupted || data.interrupted) { 
          console.log("[Astro] Interrompido pelo servidor");
          stopAllPlayback(); 
          return; 
        }

        if (data.toolCall) {
            const calls = data.toolCall.functionCalls;
            const functionResponses = calls.map((call: any) => {
              const args = call.args;
              if (call.name === "registrar_progresso") {
                  console.log("[Astro] Progresso registrado:", args);
                  if (onProgressUpdate) onProgressUpdate(args as ProgressData);
              } else if (call.name === "gerar_resumo_pdf") {
                  console.log("[Astro] Gerando PDF...", args.conteudo);
                  try {
                    const doc = new jsPDF();
                    doc.setFontSize(20);
                    doc.setTextColor(0, 50, 150);
                    doc.text("Resumo Oficial da Missão", 20, 20);
                    
                    doc.setFontSize(12);
                    doc.setTextColor(50, 50, 50);
                    const splitText = doc.splitTextToSize(args.conteudo || "Resumo vazio.", 170);
                    doc.text(splitText, 20, 35);
                    
                    doc.save("Astro_Diario_De_Bordo.pdf");
                  } catch (err) {
                    console.error("[Astro] Erro ao gerar PDF:", err);
                  }
              }
              
              return {
                  id: call.id,
                  name: call.name,
                  response: { success: true }
              };
            });

            ws.send(JSON.stringify({
                toolResponse: { functionResponses }
            }));
        }

        const serverContent = data.serverContent;
        if (serverContent) {
          const modelTurn = serverContent.modelTurn;
          const userTurn = serverContent.userTurn;
          let updated = false;

          // Se o servidor detectou fala do usuário, interrompe o áudio imediatamente
          if (userTurn?.parts) {
            if (activeSourcesRef.current.length > 0) {
              stopAllPlayback();
            }
            if (currentUtteranceRef.current.modelText) {
                currentUtteranceRef.current = { userText: "", modelText: "" };
            }
            userTurn.parts.filter((p: any) => p.text).forEach((p: any) => { currentUtteranceRef.current.userText += p.text; updated = true; });
          }

          if (modelTurn?.parts) {
            isInterruptedRef.current = false;
            modelTurn.parts.filter((p: any) => p.text).forEach((p: any) => { currentUtteranceRef.current.modelText += p.text; updated = true; });
          }

          if (updated) {
            setTranscription({ ...currentUtteranceRef.current });
          }
        }

        // Reprodução de áudio respeitando o estado de interrupção
        if (serverContent?.modelTurn?.parts && !isInterruptedRef.current) {
          const parts = serverContent.modelTurn.parts;
          for (const part of parts) {
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
                } catch(err) {
                  console.error("[Astro] Erro ao decodificar/reproduzir áudio:", err);
                }
              }
            }
          }
        }
      };
      
      ws.onerror = (e) => { console.error("[Astro WS Erro]", e); };
      
      // AUTO RECONNECT EM CASO DE QUEDA INESPERADA
      ws.onclose = (e) => { 
        console.warn(`[Astro WS Fechado] Código: ${e.code}, Razão: ${e.reason || 'Sessão terminada'}`);
        cleanupAudio();
        setIsSpeaking(false);

        if (e.code === 1007 || (e.reason && e.reason.includes('Voice replication'))) {
          console.error("[Astro] Erro nos parâmetros do Live API (Código 1007). Resetando sessão.");
          resumptionHandleRef.current = null;
          localStorage.removeItem('astro_resume_handle');
          shouldBeConnectedRef.current = false;
          setIsRecordingVoice(false);
          setIsReconnecting(false);
          return;
        }

        if (shouldBeConnectedRef.current) {
          setIsReconnecting(true);
          console.log("[Astro] Queda detectada. Reconectando e retomando sessão em 1.5s...");
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = window.setTimeout(() => {
            if (shouldBeConnectedRef.current) {
              startLiveDialog(lastParamsRef.current.subject, lastParamsRef.current.topic, true);
            }
          }, 1500);
        } else {
          setIsRecordingVoice(false);
          setIsReconnecting(false);
        }
      };
    } catch (e) {
      console.error("[Astro] Erro fatal no startLiveDialog:", e);
      if (shouldBeConnectedRef.current) {
        setIsReconnecting(true);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          if (shouldBeConnectedRef.current) {
            startLiveDialog(lastParamsRef.current.subject, lastParamsRef.current.topic, true);
          }
        }, 2000);
      } else {
        stopLiveDialog();
      }
    }
  };

  return { isRecordingVoice, isReconnecting, isSpeaking, transcription, startLiveDialog, stopLiveDialog };
}
