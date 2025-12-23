
import React, { useState, useEffect } from 'react';
import { User, RANKS, AvatarConfig, AvatarVoice, SessionResult } from '../types';

interface DashboardProps {
  user: User;
  history: SessionResult[];
  onStartSession: (avatar: AvatarConfig) => void;
  onLogout: () => void;
  onAddCredits: () => void;
  onUpdateProfile: (data: { name: string, surname: string }) => Promise<boolean>;
}

const AVATARS: AvatarConfig[] = [
  {
    name: 'Léo',
    accent: 'American',
    voice: AvatarVoice.Puck,
    systemInstruction: 'You are Léo, a bilingual English tutor for Portuguese speakers. You understand Portuguese perfectly. Your goal is to teach English to beginners. If the user speaks Portuguese, kindly respond in simple, slow English. You can use Portuguese to explain difficult concepts if necessary, but primarily use English to immerse the learner. Be very patient and encouraging.',
    description: 'Perfeito para iniciantes. Ele entende seu português e ajuda você a começar a falar inglês com confiança.',
    color: 'bg-orange-500',
    avatarImage: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=800&auto=format&fit=crop',
    videoUrl: '' 
  },
  {
    name: 'Sophia',
    accent: 'American',
    voice: AvatarVoice.Zephyr,
    systemInstruction: 'You are Sophia, a friendly digital tutor. You speak ONLY English. You do NOT understand Portuguese. If the user speaks Portuguese, politely apologize and tell them you do not understand that language and ask them to try speaking in English. Use clear, standard American English. Be encouraging and smile often.',
    description: 'Uma tutora digital amigável. Ela usa um inglês americano claro e padrão. (Só fala inglês)',
    color: 'bg-purple-500',
    avatarImage: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop',
    videoUrl: '' 
  },
  {
    name: 'James',
    accent: 'British',
    voice: AvatarVoice.Fenrir,
    systemInstruction: 'You are James, a knowledgeable historian from London. You speak with a British accent. You speak ONLY English. You do NOT understand Portuguese. If the user speaks Portuguese, express confusion in a polite, formal British manner and request they switch to English.',
    description: 'Um historiador experiente de Londres. Ele fala com sotaque britânico e gosta de conversas intelectuais. (Só fala inglês)',
    color: 'bg-emerald-600',
    avatarImage: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=800&auto=format&fit=crop',
    videoUrl: '' 
  },
  {
    name: 'Maya',
    accent: 'American',
    voice: AvatarVoice.Kore,
    systemInstruction: 'You are Maya, a lifestyle vlogger. You use modern slang and are very energetic. You speak ONLY English. You do NOT understand Portuguese. If the user speaks Portuguese, say something like "Wait, what? I only know English!" or "No clue what that means, try English!"',
    description: 'Uma vlogger de estilo de vida. Ela usa gírias modernas e é muito enérgica. (Só fala inglês)',
    color: 'bg-rose-500',
    avatarImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop',
    videoUrl: '' 
  }
];

const FLUENCY_MAP: Record<string, string> = {
  'Beginner': 'Iniciante',
  'Intermediate': 'Intermediário',
  'Advanced': 'Avançado',
  'Native': 'Nativo'
};

const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400 border-green-500/30 bg-green-500/10';
    if (score >= 50) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    return 'text-red-400 border-red-500/30 bg-red-500/10';
};

const getBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
};

const formatDuration = (seconds: number) => {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}min ${secs}s`;
  }
  return `${secs}s`;
};

const Dashboard: React.FC<DashboardProps> = ({ user, history, onStartSession, onLogout, onAddCredits, onUpdateProfile }) => {
  const [activeTab, setActiveTab] = useState<'practice' | 'history' | 'profile'>('practice');
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  
  const [profileForm, setProfileForm] = useState({ name: user.name || '', surname: user.surname || '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    setProfileForm({ name: user.name || '', surname: user.surname || '' });
  }, [user]);

  const nextRank = RANKS.find(r => r.minPoints > user.points) || RANKS[RANKS.length - 1];
  const progressPercent = Math.min(100, (user.points / nextRank.minPoints) * 100);

  const toggleHistoryItem = (index: number) => {
    setExpandedHistoryId(expandedHistoryId === index ? null : index);
  };

  const formatCredits = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      return `${mins} min`;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    
    const success = await onUpdateProfile(profileForm);
    
    if (success) {
      setSaveMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } else {
      setSaveMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
    }
    
    setIsSaving(false);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 max-w-6xl mx-auto gap-4">
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-blue-400 tracking-tight">FluentAI</h1>
            <div className="h-6 w-px bg-gray-700 mx-2 hidden md:block"></div>
            <p className="text-xs text-gray-400 uppercase font-bold tracking-widest hidden md:block">Tutor Inteligente</p>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-700 gap-3">
             <div className="text-right">
                 <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Créditos</p>
                 <p className={`font-mono font-bold leading-none ${user.credits < 60 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatCredits(user.credits)}
                 </p>
             </div>
             <button 
               onClick={onAddCredits}
               className="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1.5 rounded font-bold transition-colors"
             >
                +
             </button>
          </div>
          
          <div className="text-center md:text-right hidden sm:block">
            <p className="font-semibold text-lg text-white">
               {user.name && user.surname ? `${user.name} ${user.surname}` : user.username}
            </p>
            <p className="text-xs text-blue-300 uppercase tracking-wider font-bold">{user.rank}</p>
          </div>
          <button 
            onClick={onLogout}
            className="text-sm px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-12">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-gray-800 to-gray-800/50 backdrop-blur p-6 rounded-2xl border border-gray-700 shadow-xl">
            <h3 className="text-gray-400 text-sm mb-2 font-medium uppercase tracking-wider">Pontos Totais</h3>
            <p className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">{user.points}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-800 to-gray-800/50 backdrop-blur p-6 rounded-2xl border border-gray-700 shadow-xl">
            <h3 className="text-gray-400 text-sm mb-2 font-medium uppercase tracking-wider">Classificação Atual</h3>
            <div className="flex justify-between items-end mb-2">
                 <p className="text-3xl font-bold text-white">{user.rank}</p>
                 <span className="text-xs text-gray-500">{user.points} / {nextRank.minPoints}</span>
            </div>
            <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden border border-gray-600">
               <div className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-800 to-gray-800/50 backdrop-blur p-6 rounded-2xl border border-gray-700 shadow-xl">
            <h3 className="text-gray-400 text-sm mb-2 font-medium uppercase tracking-wider">Sessões Completas</h3>
            <p className="text-5xl font-extrabold text-white">{user.sessionsCompleted}</p>
          </div>
        </section>

        <div className="flex space-x-8 border-b border-gray-700 pb-1">
           <button 
             onClick={() => setActiveTab('practice')}
             className={`pb-3 text-lg font-medium transition-all relative ${activeTab === 'practice' ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
           >
             Praticar
             {activeTab === 'practice' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full"></span>}
           </button>
           <button 
             onClick={() => setActiveTab('history')}
             className={`pb-3 text-lg font-medium transition-all relative ${activeTab === 'history' ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
           >
             Histórico
             {activeTab === 'history' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full"></span>}
           </button>
           <button 
             onClick={() => setActiveTab('profile')}
             className={`pb-3 text-lg font-medium transition-all relative ${activeTab === 'profile' ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
           >
             Perfil
             {activeTab === 'profile' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 rounded-full"></span>}
           </button>
        </div>

        {activeTab === 'practice' && (
        <section className="animate-fade-in">
          <div className="flex items-end justify-between mb-6">
             <h2 className="text-xl font-bold text-gray-200">Selecione um Avatar</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {AVATARS.map((avatar) => (
              <div 
                key={avatar.name} 
                className="group relative bg-gray-800 rounded-3xl overflow-hidden cursor-pointer border border-gray-700 hover:border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1"
                onClick={() => onStartSession(avatar)}
              >
                <div className="h-80 w-full relative overflow-hidden">
                   <img 
                      src={avatar.avatarImage} 
                      alt={avatar.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90"></div>
                   
                   <div className="absolute bottom-4 left-6 right-6">
                      <h3 className="text-3xl font-bold text-white flex items-center gap-3 drop-shadow-md">
                         {avatar.name}
                         <span className="text-xs font-semibold px-2 py-1 bg-white/10 backdrop-blur-md rounded-lg text-white/90 border border-white/10 uppercase tracking-wide">{avatar.accent}</span>
                      </h3>
                   </div>
                </div>
                
                <div className="p-6">
                  <p className="text-sm text-gray-400 leading-relaxed min-h-[3rem] mb-4">
                    {avatar.description}
                  </p>
                  <div className="flex justify-between items-center border-t border-gray-700 pt-4">
                     <span className="text-xs text-gray-500 font-medium uppercase">VOZ: {avatar.voice}</span>
                     <button className="bg-blue-600 text-white px-5 py-2 rounded-full font-semibold text-sm hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">
                      Conectar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {activeTab === 'history' && (
        <section className="animate-fade-in space-y-4">
             {history.length === 0 ? (
                 <div className="text-center py-20 bg-gray-800/30 rounded-3xl border border-gray-700 border-dashed">
                     <p className="text-gray-400 text-lg">Nenhuma sessão gravada ainda. Comece a praticar!</p>
                 </div>
             ) : (
                 history.map((session, idx) => (
                     <div key={idx} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden transition-all duration-200">
                         <div 
                            className="p-6 flex flex-col md:flex-row justify-between items-center cursor-pointer hover:bg-gray-750 transition-colors"
                            onClick={() => toggleHistoryItem(idx)}
                         >
                             <div className="flex items-center gap-4 w-full md:w-auto mb-4 md:mb-0">
                                 <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center border-4 ${
                                     session.overallScore >= 80 ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                                     session.overallScore >= 50 ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' :
                                     'border-red-500/30 bg-red-500/10 text-red-400'
                                 }`}>
                                     <span className="font-extrabold text-lg leading-none">{session.overallScore}</span>
                                     <span className="text-[9px] uppercase font-bold tracking-wide opacity-70">Geral</span>
                                 </div>
                                 <div className="flex-1">
                                     <h4 className="font-bold text-lg text-white">Conversa com {session.avatarName}</h4>
                                     <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400 mt-0.5">
                                         <span>{new Date(session.date).toLocaleDateString()} • {new Date(session.date).toLocaleTimeString()}</span>
                                         <div className="w-1 h-1 rounded-full bg-gray-600"></div>
                                         <div className="flex items-center gap-1.5 text-blue-300/80 font-medium">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            {formatDuration(session.durationSeconds)}
                                         </div>
                                     </div>
                                 </div>
                             </div>
                             
                             <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                 <div className="hidden sm:flex flex-col gap-2 w-36 md:mr-4">
                                     <div className="flex items-center gap-2" title={`Vocabulário: ${session.vocabularyScore}`}>
                                         <span className="text-[10px] w-6 text-gray-500 font-bold uppercase">Voc</span>
                                         <div className="h-1.5 flex-1 bg-gray-700 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${getBarColor(session.vocabularyScore)}`} style={{width: `${session.vocabularyScore}%`}}></div>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-2" title={`Gramática: ${session.grammarScore}`}>
                                         <span className="text-[10px] w-6 text-gray-500 font-bold uppercase">Gra</span>
                                         <div className="h-1.5 flex-1 bg-gray-700 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${getBarColor(session.grammarScore)}`} style={{width: `${session.grammarScore}%`}}></div>
                                         </div>
                                     </div>
                                     <div className="flex items-center gap-2" title={`Pronúncia: ${session.pronunciationScore}`}>
                                         <span className="text-[10px] w-6 text-gray-500 font-bold uppercase">Pro</span>
                                         <div className="h-1.5 flex-1 bg-gray-700 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${getBarColor(session.pronunciationScore)}`} style={{width: `${session.pronunciationScore}%`}}></div>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="flex items-center gap-6">
                                    <div className="text-right hidden md:block">
                                        <div className="text-xs text-gray-400 uppercase tracking-wider">Nível</div>
                                        <div className="font-semibold text-blue-300">{FLUENCY_MAP[session.fluencyRating] || 'Calculando...'}</div>
                                    </div>
                                    <svg className={`w-5 h-5 text-gray-500 transform transition-transform ${expandedHistoryId === idx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                 </div>
                             </div>
                         </div>

                         {expandedHistoryId === idx && (
                             <div className="px-6 pb-6 pt-2 border-t border-gray-700 bg-gray-800/50">
                                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                                     <div className={`p-4 rounded-xl border ${getScoreColor(session.vocabularyScore)} flex flex-col items-center justify-center`}>
                                         <span className="text-xs font-bold uppercase tracking-widest mb-1 opacity-80">Vocabulário</span>
                                         <span className="text-3xl font-extrabold">{session.vocabularyScore}</span>
                                         <div className="w-full bg-gray-700/50 h-1.5 rounded-full mt-2 overflow-hidden">
                                            <div className="bg-current h-full rounded-full opacity-60" style={{ width: `${session.vocabularyScore}%` }}></div>
                                         </div>
                                     </div>
                                     <div className={`p-4 rounded-xl border ${getScoreColor(session.grammarScore)} flex flex-col items-center justify-center`}>
                                         <span className="text-xs font-bold uppercase tracking-widest mb-1 opacity-80">Gramática</span>
                                         <span className="text-3xl font-extrabold">{session.grammarScore}</span>
                                         <div className="w-full bg-gray-700/50 h-1.5 rounded-full mt-2 overflow-hidden">
                                            <div className="bg-current h-full rounded-full opacity-60" style={{ width: `${session.grammarScore}%` }}></div>
                                         </div>
                                     </div>
                                     <div className={`p-4 rounded-xl border ${getScoreColor(session.pronunciationScore)} flex flex-col items-center justify-center`}>
                                         <span className="text-xs font-bold uppercase tracking-widest mb-1 opacity-80">Pronúncia</span>
                                         <span className="text-3xl font-extrabold">{session.pronunciationScore}</span>
                                         <div className="w-full bg-gray-700/50 h-1.5 rounded-full mt-2 overflow-hidden">
                                            <div className="bg-current h-full rounded-full opacity-60" style={{ width: `${session.pronunciationScore}%` }}></div>
                                         </div>
                                     </div>
                                     <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 flex flex-col items-center justify-center">
                                         <span className="text-xs font-bold uppercase tracking-widest mb-1 opacity-80">Fluência</span>
                                         <span className="text-xl font-extrabold text-center leading-tight">{FLUENCY_MAP[session.fluencyRating] || '---'}</span>
                                         <div className="text-[10px] mt-2 font-medium opacity-70 uppercase">Avaliação de Nível</div>
                                     </div>
                                 </div>

                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <div>
                                         <h5 className="font-semibold text-white mb-2 text-sm uppercase tracking-wide flex items-center gap-2">
                                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            Feedback do Tutor
                                         </h5>
                                         <div className="text-gray-300 leading-relaxed text-sm bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 h-full">
                                             {session.feedback}
                                         </div>
                                     </div>
                                     
                                     <div>
                                         <h5 className="font-semibold text-white mb-2 text-sm uppercase tracking-wide flex items-center gap-2">
                                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                                            Trecho da Conversa
                                         </h5>
                                         <div className="text-gray-500 text-xs italic bg-gray-900 p-4 rounded-xl font-mono h-32 overflow-y-auto custom-scrollbar">
                                             {session.transcript}
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         )}
                     </div>
                 ))
             )}
        </section>
        )}

        {activeTab === 'profile' && (
        <section className="animate-fade-in max-w-2xl">
            <div className="bg-gray-800 rounded-3xl border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-gray-700 bg-gray-850">
                    <h2 className="text-xl font-bold text-white mb-1">Meus Dados</h2>
                    <p className="text-sm text-gray-400">Gerencie as informações da sua conta.</p>
                </div>
                
                <form onSubmit={handleSaveProfile} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Nome</label>
                            <input 
                                type="text" 
                                value={profileForm.name}
                                onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Seu nome"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Sobrenome</label>
                            <input 
                                type="text" 
                                value={profileForm.surname}
                                onChange={(e) => setProfileForm({...profileForm, surname: e.target.value})}
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Seu sobrenome"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Usuário (Não alterável)</label>
                            <input 
                                type="text" 
                                value={user.username}
                                disabled
                                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-400 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">E-mail (Não alterável)</label>
                            <input 
                                type="text" 
                                value={user.email || 'Não informado'}
                                disabled
                                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-gray-400 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div className="text-xs text-blue-300">
                            <p className="font-bold uppercase tracking-wider mb-0.5">Membro desde</p>
                            <p>{new Date(user.joinedDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>

                    {saveMessage && (
                        <div className={`p-4 rounded-xl text-sm font-medium text-center animate-fade-in ${saveMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {saveMessage.text}
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Salvando...
                            </>
                        ) : 'Salvar Alterações'}
                    </button>
                </form>
            </div>
        </section>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
