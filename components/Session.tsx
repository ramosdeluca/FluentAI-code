
import React, { useState, useEffect, useRef } from 'react';
import { User, AvatarConfig, ChatMessage, SessionResult } from '../types';
import { useLiveAvatar } from '../hooks/useLiveAvatar';
import { evaluateSession } from '../services/gemini';

// Fix: Updated onComplete signature to match App.tsx (Omit date and avatarName which are handled in App.tsx)
interface SessionProps {
  user: User;
  avatar: AvatarConfig;
  onComplete: (result: Omit<SessionResult, 'date' | 'avatarName'>, finalCredits: number) => void;
  onCancel: () => void;
  onUpdateCredits: (remainingSeconds: number) => void;
  onBuyCredits: () => void;
}

const Session: React.FC<SessionProps> = ({ user, avatar, onComplete, onCancel, onUpdateCredits, onBuyCredits }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  // Alterado para false por padrão para não cobrir o avatar no mobile ao iniciar
  const [showTranscript, setShowTranscript] = useState(false); 
  const [hasStarted, setHasStarted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Credits Management
  const [remainingCredits, setRemainingCredits] = useState(user.credits);
  const [showCreditModal, setShowCreditModal] = useState(false);
  
  // Refs
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const fullTranscriptRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSyncCreditsRef = useRef<number>(user.credits);
  
  // Avatar Animation Ref
  const avatarImageRef = useRef<HTMLImageElement>(null);

  const [currentTurnText, setCurrentTurnText] = useState("");
  const [currentTurnRole, setCurrentTurnRole] = useState<'user' | 'model' | null>(null);

  // Hook Connection
  const { connect, disconnect, isConnected, isTalking, error: hookError, analyserNode } = useLiveAvatar({
    avatarConfig: avatar,
    onTranscriptUpdate: (text, isUser) => {
      const role = isUser ? 'user' : 'model';
      
      if (currentTurnRole && currentTurnRole !== role) {
         setMessages(prev => [...prev, {
            role: currentTurnRole,
            text: currentTurnText,
            timestamp: Date.now()
         }]);
         fullTranscriptRef.current += `${currentTurnRole === 'user' ? 'User' : 'Avatar'}: ${currentTurnText}\n`;
         setCurrentTurnText(text);
      } else {
         setCurrentTurnText(prev => prev + text);
      }
      setCurrentTurnRole(role);
    }
  });

  const error = localError || hookError;

  // Credit Deduction Timer
  useEffect(() => {
    if (!hasStarted || !isConnected || isFinishing || showCreditModal) return;

    const timer = setInterval(() => {
        setRemainingCredits(prev => {
            const newVal = prev - 1;
            if (newVal <= 0) {
                clearInterval(timer);
                onUpdateCredits(0); // Sincroniza 0 imediatamente no banco
                handleFinish(0); // Auto-finaliza para salvar o histórico
                setShowCreditModal(true);
                return 0;
            }
            return newVal;
        });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, isConnected, isFinishing, showCreditModal]);

  // Sync credits with Supabase periodically (safety net)
  useEffect(() => {
    if (!hasStarted || isFinishing) return;

    const syncInterval = setInterval(() => {
        if (Math.abs(lastSyncCreditsRef.current - remainingCredits) >= 5) {
            onUpdateCredits(remainingCredits);
            lastSyncCreditsRef.current = remainingCredits;
        }
    }, 10000);

    return () => clearInterval(syncInterval);
  }, [remainingCredits, hasStarted, isFinishing, onUpdateCredits]);

  useEffect(() => {
    if (hasStarted && userVideoRef.current && userStreamRef.current) {
        userVideoRef.current.srcObject = userStreamRef.current;
    }
  }, [hasStarted]);

  useEffect(() => {
      return () => {
          if (userStreamRef.current) {
              userStreamRef.current.getTracks().forEach(track => track.stop());
          }
      };
  }, []);

  useEffect(() => {
    if (!isTalking || !analyserNode) {
       if (avatarImageRef.current) {
          avatarImageRef.current.style.transform = 'scale(1) translateY(0)';
          avatarImageRef.current.style.filter = 'brightness(1)';
       }
       return;
    }

    let rafId: number;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let currentScaleY = 1;
    let currentScaleX = 1;
    let currentY = 0;

    const updateAnimation = () => {
      analyserNode.getByteFrequencyData(dataArray);
      let lowSum = 0;
      for(let i = 2; i < 18; i++) lowSum += dataArray[i];
      const lowEnergy = (lowSum / 16) / 255;
      let midSum = 0;
      for(let i = 21; i < 86; i++) midSum += dataArray[i];
      const midEnergy = (midSum / 65) / 255;
      const loudness = Math.max(lowEnergy, midEnergy);
      const targetScaleY = 1 + (lowEnergy * 0.12); 
      const targetScaleX = 1 - (loudness * 0.03); 
      const targetY = loudness * 6.0;
      const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;
      const attack = 0.5;
      const release = 0.2;
      const factorY = targetScaleY > currentScaleY ? attack : release;
      currentScaleY = lerp(currentScaleY, targetScaleY, factorY);
      const factorX = targetScaleX < currentScaleX ? attack : release; 
      currentScaleX = lerp(currentScaleX, targetScaleX, factorX);
      const factorTrans = targetY > currentY ? attack : release;
      currentY = lerp(currentY, targetY, factorTrans);

      if (avatarImageRef.current) {
        avatarImageRef.current.style.transform = `scale3d(${currentScaleX}, ${currentScaleY}, 1) translateY(${currentY}px)`;
        avatarImageRef.current.style.filter = `brightness(${1 + midEnergy * 0.15})`;
      }
      rafId = requestAnimationFrame(updateAnimation);
    };
    updateAnimation();
    return () => cancelAnimationFrame(rafId);
  }, [isTalking, analyserNode]);

  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentTurnText, showTranscript]);

  const handleStart = async () => {
      if (user.credits <= 0) {
        setShowCreditModal(true);
        return;
      }
      setLocalError(null);
      setHasStarted(true);
      setStartTime(Date.now());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        userStreamRef.current = stream;
        connect();
      } catch (err: any) {
        setLocalError("Acesso à câmera/microfone negado.");
        setHasStarted(false);
      }
  };

  const handleFinish = async (forcedCredits?: number) => {
    if (isFinishing) return;
    setIsFinishing(true);
    
    const finalCredits = typeof forcedCredits === 'number' ? forcedCredits : remainingCredits;
    
    await disconnect();
    if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    let finalTranscript = fullTranscriptRef.current;
    if (currentTurnRole && currentTurnText) {
       finalTranscript += `${currentTurnRole === 'user' ? 'User' : 'Avatar'}: ${currentTurnText}\n`;
    }

    // Calcula duração real da conversa
    const duration = startTime ? (Date.now() - startTime) / 1000 : 0;
    
    try {
      const result = await evaluateSession(finalTranscript);
      onComplete({ ...result, durationSeconds: duration }, finalCredits);
    } catch (e) {
      // Fallback em caso de erro na avaliação
      onComplete({
        overallScore: 0,
        vocabularyScore: 0,
        grammarScore: 0,
        pronunciationScore: 0,
        fluencyRating: 'Beginner',
        feedback: "Erro ao processar avaliação.",
        transcript: finalTranscript,
        durationSeconds: duration
      }, finalCredits);
    }
  };

  const handleCancelWithSync = () => {
    onUpdateCredits(remainingCredits);
    onCancel();
  };

  return (
    <div className="flex h-[100dvh] bg-gray-900 text-white overflow-hidden relative">
      <div className="relative flex-1 flex flex-col min-w-0">
        <header className="absolute top-0 left-0 right-0 z-20 p-4 sm:p-6 flex justify-between items-start pointer-events-none">
          <div className="bg-black/50 backdrop-blur-lg px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/10 flex items-center gap-2 sm:gap-3 pointer-events-auto shadow-lg">
              <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 animate-pulse'}`}></div>
              <span className="font-medium text-[10px] sm:text-sm tracking-wide">
                {hasStarted ? (isConnected ? 'AO VIVO' : 'CONECTANDO...') : 'PRONTO'}
              </span>
              <span className="text-white/40 text-sm">|</span>
              <span className="text-white/80 text-[10px] sm:text-sm font-bold truncate max-w-[60px] sm:max-w-none">{avatar.name}</span>
              <span className="text-white/40 text-sm">|</span>
              <span className={`text-[10px] sm:text-sm font-mono font-bold ${remainingCredits < 60 ? 'text-red-400' : 'text-green-400'}`}>
                {Math.floor(remainingCredits / 60)}:{String(remainingCredits % 60).padStart(2, '0')}
              </span>
          </div>
          <div className="flex gap-2 pointer-events-auto">
              <button 
                onClick={() => setShowTranscript(!showTranscript)}
                className={`p-2.5 sm:p-3 rounded-full backdrop-blur-md transition-all shadow-lg ${showTranscript ? 'bg-blue-600 text-white' : 'bg-black/40 text-white hover:bg-black/60 border border-white/10'}`}
                title="Histórico da conversa"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
              </button>
              <button 
                onClick={() => handleFinish()} 
                className="bg-red-600 hover:bg-red-700 p-2.5 sm:p-3 rounded-full text-white shadow-lg shadow-red-900/40 transition-transform active:scale-95"
                title="Finalizar prática"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center relative min-h-0 bg-gradient-to-b from-gray-800 to-gray-950">
            <div className={`absolute w-[280px] sm:w-[600px] h-[280px] sm:h-[600px] rounded-full blur-[80px] sm:blur-[120px] opacity-20 transition-all duration-500 pointer-events-none ${isTalking ? 'bg-blue-500/40' : 'bg-transparent'}`}></div>
            <div className="relative z-10 p-4 transition-transform duration-500">
                 <div className="relative w-52 h-52 sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[32rem] lg:h-[32rem] rounded-full overflow-hidden border-4 sm:border-[8px] border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-gray-800 ring-2 sm:ring-4 ring-black/20">
                     <img ref={avatarImageRef} src={avatar.avatarImage} alt={avatar.name} className={`w-full h-full object-cover ${!isTalking ? 'animate-alive' : 'transition-none'}`} />
                 </div>
                 {isConnected && (
                    <div className="absolute -bottom-6 sm:-bottom-10 left-1/2 -translate-x-1/2 flex gap-1 h-4 sm:h-6 items-center justify-center pointer-events-none">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className={`w-1 sm:w-1.5 bg-blue-400 rounded-full transition-all duration-100 ${isTalking ? 'animate-bounce' : 'h-1 sm:h-1.5 opacity-30'}`} style={{ animationDelay: `${i * 0.1}s`, height: isTalking ? `${Math.random() * 20 + 10}px` : '4px' }}></div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {!hasStarted && !error && !showCreditModal && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-2xl border border-gray-700 max-w-sm w-full text-center animate-fade-in">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full overflow-hidden border-4 border-blue-500 shadow-lg ring-4 ring-blue-500/20">
                        <img src={avatar.avatarImage} alt={avatar.name} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Conversar com {avatar.name}</h2>
                    <p className="text-gray-400 text-sm sm:text-base mb-6 sm:mb-8 leading-relaxed">{avatar.description}</p>
                    <button onClick={handleStart} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 sm:py-4 rounded-xl text-base sm:text-lg transition-all transform hover:scale-[1.02] active:scale-95 shadow-blue-900/50 shadow-lg flex items-center justify-center gap-2">Iniciar Conversa</button>
                    <button onClick={handleCancelWithSync} className="mt-4 sm:mt-6 text-gray-500 hover:text-white text-xs sm:text-sm font-bold tracking-widest uppercase">Cancelar</button>
                </div>
            </div>
        )}

        {hasStarted && (
            <div className="absolute bottom-6 left-6 sm:top-24 sm:right-6 sm:bottom-auto sm:left-auto z-20 w-24 sm:w-36 aspect-[3/4] bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/20">
                <video ref={userVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
            </div>
        )}
      </div>

      {/* Histórico - No mobile agora é uma sobreposição controlada */}
      {showTranscript && (
         <div className="w-full sm:w-80 md:w-96 absolute inset-y-0 right-0 sm:relative flex-shrink-0 bg-gray-900 border-l border-white/10 flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] z-40 animate-slide-in-right">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gray-800/80 backdrop-blur-md">
               <h3 className="font-bold text-gray-200 text-xs uppercase tracking-widest">Transcrição em Tempo Real</h3>
               <button onClick={() => setShowTranscript(false)} className="text-white/50 hover:text-white p-2 bg-white/5 rounded-full transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
               </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950/30 custom-scrollbar">
               {messages.length === 0 && !currentTurnText && <div className="text-center text-gray-600 mt-20 px-4"><p className="text-xs font-medium italic">Aguardando início da conversa...</p></div>}
               {messages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                     <span className="text-[9px] text-gray-500 mb-1 font-black uppercase tracking-tighter">{msg.role === 'user' ? 'VOCÊ' : avatar.name}</span>
                     <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-md ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'}`}>{msg.text}</div>
                  </div>
               ))}
               {currentTurnText && (
                   <div className={`flex flex-col ${currentTurnRole === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="text-[9px] text-gray-500 mb-1 font-black uppercase tracking-tighter">{currentTurnRole === 'user' ? 'VOCÊ' : avatar.name}</span>
                       <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed opacity-90 ${currentTurnRole === 'user' ? 'bg-blue-600/70 text-white rounded-tr-none' : 'bg-gray-800/70 text-gray-200 rounded-tl-none border border-gray-700/50'}`}>
                          {currentTurnText}
                          <span className="inline-block w-1.5 h-3 ml-1 bg-white/50 animate-pulse rounded-full align-middle"></span>
                       </div>
                   </div>
               )}
               <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-gray-900 border-t border-white/5 text-[10px] text-gray-600 text-center uppercase font-bold tracking-widest">
               FluentAI Tutor Live
            </div>
         </div>
      )}

      {showCreditModal && (
         <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
            <div className="bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-red-500/20">
                <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Créditos Esgotados!</h3>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">Seus minutos acabaram, mas não se preocupe: sua sessão foi salva e avaliada para que você não perca seu progresso.</p>
                <button onClick={() => { setShowCreditModal(false); onBuyCredits(); }} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-xl mb-3 shadow-lg shadow-green-900/20 transition-all active:scale-95">Comprar Créditos</button>
                <button onClick={handleCancelWithSync} className="text-gray-500 hover:text-white text-xs sm:text-sm font-medium">VOLTAR AO MENU</button>
            </div>
         </div>
      )}

      {error && (
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600/95 text-white px-6 py-5 rounded-2xl backdrop-blur-lg shadow-2xl z-[70] text-center max-w-xs w-full animate-shake">
            <p className="font-bold text-sm mb-4 leading-relaxed">{error}</p>
            <button onClick={() => { setHasStarted(false); setLocalError(null); }} className="w-full bg-white text-red-600 py-2.5 rounded-xl text-xs font-black hover:bg-gray-100 transition-colors uppercase tracking-widest">Entendi</button>
         </div>
      )}
    </div>
  );
};

export default Session;
