import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audio';
import { AvatarConfig } from '../types';

interface UseLiveAvatarProps {
  avatarConfig: AvatarConfig;
  onTranscriptUpdate: (text: string, isUser: boolean) => void;
}

export const useLiveAvatar = ({ avatarConfig, onTranscriptUpdate }: UseLiveAvatarProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false); // Model is talking
  const [error, setError] = useState<string | null>(null);
  
  // Audio Contexts and Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null); // For visualization
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Playback queue management
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  const disconnect = useCallback(async () => {
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session", e);
      }
      sessionPromiseRef.current = null;
    }

    // Stop all playing sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();

    // Close audio contexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    
    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsConnected(false);
    setIsTalking(false);
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // Create contexts
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      
      // CRITICAL: Ensure contexts are running (handle autoplay policy)
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
      }

      // Setup Analyser for Visualization
      analyserRef.current = outputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.1;

      inputNodeRef.current = inputAudioContextRef.current.createGain();
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      
      // Chain: Analyser -> Gain -> Destination
      // Note: Sources will connect to Analyser
      analyserRef.current.connect(outputNodeRef.current);
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);

      // Get Mic Stream
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micError) {
        console.error("Microphone permission denied or missing", micError);
        throw new Error("Microphone access required");
      }

      // Initialize Gemini Client
      // Check for API Key
      if (!process.env.API_KEY) {
         throw new Error("API Key is missing in environment variables");
      }
      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: avatarConfig.voice } },
          },
          systemInstruction: `You are ${avatarConfig.name}, a helpful English tutor. 
          Your accent is ${avatarConfig.accent}. 
          ${avatarConfig.systemInstruction}.
          Keep responses concise and encourage the user to speak.`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        }
      };

      sessionPromiseRef.current = aiRef.current.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            console.log("Connection opened");
            setIsConnected(true);
            
            // Start Audio Streaming
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            sourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Audio Resampling Logic: Ensure we send 16000Hz data to Gemini
              // Many browsers force 44.1k or 48k even if we request 16k
              const currentSampleRate = inputAudioContextRef.current?.sampleRate || 16000;
              const targetSampleRate = 16000;
              let finalData = inputData;

              if (currentSampleRate !== targetSampleRate) {
                  const ratio = currentSampleRate / targetSampleRate;
                  const newLength = Math.floor(inputData.length / ratio);
                  finalData = new Float32Array(newLength);
                  for (let i = 0; i < newLength; i++) {
                      finalData[i] = inputData[Math.floor(i * ratio)];
                  }
              }

              const pcmBlob = createBlob(finalData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };

            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Transcriptions
             if (message.serverContent?.outputTranscription?.text) {
                onTranscriptUpdate(message.serverContent.outputTranscription.text, false);
             }
             if (message.serverContent?.inputTranscription?.text) {
                onTranscriptUpdate(message.serverContent.inputTranscription.text, true);
             }

             // Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputAudioContextRef.current && analyserRef.current) {
                setIsTalking(true);
                const ctx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                try {
                  const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    ctx,
                    24000,
                    1
                  );
                  
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  // Connect source to Analyser (which goes to speakers)
                  source.connect(analyserRef.current);
                  
                  source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) {
                      setIsTalking(false);
                    }
                  });

                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                } catch (err) {
                  console.error("Audio decode error", err);
                }
             }

             // Handle Interruption
             if (message.serverContent?.interrupted) {
               sourcesRef.current.forEach(s => s.stop());
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setIsTalking(false);
             }
          },
          onclose: (event) => {
            console.log("Connection closed", event);
            setIsConnected(false);
            setIsTalking(false);
          },
          onerror: (err) => {
            console.error("Connection error", err);
            // Provide more specific error message if possible
            let msg = "Connection lost. Please try again.";
            if (err instanceof Error) {
                msg = err.message;
            } else if ((err as any)?.message) {
                msg = (err as any).message;
            }
            setError(msg);
            disconnect();
          }
        }
      });

    } catch (err: any) {
      console.error("Failed to connect", err);
      setError(err.message || "Failed to access microphone or connect to service.");
      disconnect();
    }
  }, [avatarConfig, disconnect, onTranscriptUpdate]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect, isConnected, isTalking, error, analyserNode: analyserRef.current };
};