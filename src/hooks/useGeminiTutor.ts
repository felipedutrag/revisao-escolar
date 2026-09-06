import { useState, useRef, useCallback } from "react";
import { jsPDF } from "jspdf";
import syllabusData from '../config/syllabus.json';

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcription, setTranscription] = useState<Transcription>({ userText: "", modelText: "" });
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlaybackTimeRef = useRef<number>(0);

  const currentUtteranceRef = useRef<Transcription>({ userText: "", modelText: "" });
  const resumptionHandleRef = useRef<string | null>(localStorage.getItem('astro_resume_handle') || null);

  const stopAllPlayback = useCallback(() => {
    activeSourcesRef.current.forEach(source => { try { source.stop() } catch (e) {} });
    activeSourcesRef.current = [];
    nextPlaybackTimeRef.current = 0;
    setIsSpeaking(false);
  }, []);

  const cleanupAudio = useCallback(() => {
    stopAllPlayback();
    if (micStreamRef.current) {
      try { micStreamRef.current.getTracks().forEach(track => track.stop()) } catch (e) {}
      micStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try { audioCtxRef.current.close() } catch (e) {}
      audioCtxRef.current = null;
    }
  }, [stopAllPlayback]);

  const stopLiveDialog = useCallback(() => {
    cleanupAudio();
    if (wsRef.current) { try { wsRef.current.close() } catch(e){} wsRef.current = null; }
    setIsRecordingVoice(false);
  }, [cleanupAudio]);

  const startLiveDialog = async (subject: string, topic: string) => {
    setIsRecordingVoice(true);
    setTranscription({ userText: "", modelText: "" });
    currentUtteranceRef.current = { userText: "", modelText: "" };

    try {
      if (!API_KEY) {
        console.error("API Key não encontrada.");
        setIsRecordingVoice(false);
        return;
      }

      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();

      const processorName = `audio-processor-${Date.now()}`;
      const workletCode = `
        class AudioProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input.length > 0 && input[0].length > 0) {
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

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;
      const micSource = audioCtxRef.current.createMediaStreamSource(micStream);
      const workletNode = new AudioWorkletNode(audioCtxRef.current, processorName);

      let audioPipelineStarted = false;

      const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`);
      wsRef.current = ws;

      const startAudioPipeline = () => {
        if (audioPipelineStarted || ws.readyState !== WebSocket.OPEN) return;
        audioPipelineStarted = true;

        workletNode.port.onmessage = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.data;
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 32768 : s * 32767;
          }
          ws.send(JSON.stringify({ realtimeInput: { audio: { data: window.btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer))), mimeType: "audio/pcm;rate=16000" } } }));
        }
        micSource.connect(workletNode);
      }

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

        const systemInstructionText = `
          Seu nome é Astro. Você é um tutor de revisão escolar super divertido, animado e paciente.
          Logo no início da primeira interação, você deve mencionar, de forma muito carinhosa, que este sistema (ou "este espaço de estudos") foi feito pelo papai dele com muito carinho para ajudá-lo a estudar para a prova, e que ele pode sempre contar com o papai.
          (INSTRUÇÃO ESPECIAL: Se o usuário disser que é o papai testando, ative o Modo Papai: pule as explicações infantis e o roleplay e aja diretamente para ajudá-lo a testar os quizzes e logs).
          
          O aluno escolheu estudar a matéria de ${subject}, focando no tópico: ${topic}.
          
          Conteúdo do tópico para você ensinar:
          """
          ${topicDetails}
          """
          
          Seu objetivo é primeiro fazer uma explicação clara, estruturada e divertida usando APENAS o conteúdo acima. 
          Depois, aplique um quiz curto com uma pergunta para testar o entendimento.
          Se o aluno errar, faça brincadeiras motivadoras e corrija o erro com paciência.
          Sempre que o aluno responder ao quiz, você DEVE usar a ferramenta 'registrar_progresso' para marcar se ele acertou ou errou.
        `;

        const setupPayload = {
          model: "models/gemini-3.1-flash-live-preview",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
          },
          tools,
          systemInstruction: { parts: [{ text: systemInstructionText }] }
        };

        if (resumptionHandleRef.current) {
          (setupPayload as any).sessionResumption = { handle: resumptionHandleRef.current };
          console.log("[Astro] Retomando sessão com handle:", resumptionHandleRef.current);
        }

        console.log("[Astro] Enviando Setup payload...", setupPayload);
        ws.send(JSON.stringify({ setup: setupPayload }));
      }

      ws.onmessage = async (event) => {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : await event.data.text());
        console.log("[Astro WS Message]", data);

        if (data.setupComplete) {
          console.log("[Astro] Setup completo, iniciando pipeline de áudio (microfone)");
          startAudioPipeline();
          return;
        }

        const resumptionUpdate = data.sessionResumptionUpdate;
        if (resumptionUpdate?.resumable && resumptionUpdate?.newHandle) {
          resumptionHandleRef.current = resumptionUpdate.newHandle;
          localStorage.setItem('astro_resume_handle', resumptionUpdate.newHandle);
        }

        if (data.serverContent?.interrupted) { 
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

          if (userTurn?.parts) {
            if (currentUtteranceRef.current.modelText) {
                currentUtteranceRef.current = { userText: "", modelText: "" };
            }
            userTurn.parts.filter((p: any) => p.text).forEach((p: any) => { currentUtteranceRef.current.userText += p.text; updated = true; });
          }

          if (modelTurn?.parts) {
            modelTurn.parts.filter((p: any) => p.text).forEach((p: any) => { currentUtteranceRef.current.modelText += p.text; updated = true; });
          }

          if (updated) {
            setTranscription({ ...currentUtteranceRef.current });
          }
        }

        if (serverContent?.modelTurn?.parts) {
          const parts = serverContent.modelTurn.parts;
          for (const part of parts) {
            if (part.inlineData?.data) {
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
                  }
                } catch(err) {
                  console.error("[Astro] Erro ao decodificar/reproduzir áudio:", err);
                }
              }
            }
          }
        }
      }
      
      ws.onerror = (e) => { console.error("[Astro WS Erro]", e); }
      ws.onclose = (e) => { console.log("[Astro WS Fechado]", e.code, e.reason); }
    } catch (e) {
      console.error("[Astro] Erro fatal no startLiveDialog:", e);
      setIsRecordingVoice(false);
    }
  };

  return { isRecordingVoice, isSpeaking, transcription, startLiveDialog, stopLiveDialog };
}
