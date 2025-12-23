
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { User, SessionResult } from '../types';

// Credenciais do Supabase
const supabaseUrl = (process.env.SUPABASE_URL || 'https://ebjihooaxlqulzrlyoyc.supabase.co').trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViamlob29heGxxdWx6cmx5b3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNTAxMDgsImV4cCI6MjA4MTcyNjEwOH0.qAvWao3bj2CpOpkI9HK558DuuG6_kGOMDMtuYsEAH-c').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

/**
 * Busca o e-mail de um usuário pelo username
 */
export const getEmailByUsername = async (username: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('username', username.toLowerCase())
    .single();

  if (error) return null;
  return data?.email || null;
};

/**
 * Busca o perfil completo do usuário.
 */
export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[Supabase] Erro ao buscar perfil:', profileError.message);
      return null;
    }

    let email = profileData.email;
    if (!email) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === userId && session.user.email) {
        email = session.user.email;
      } else {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.id === userId) {
          email = authUser.email;
        }
      }
    }

    // Fix: Mapped joined_date to joinedDate to match the User interface.
    return {
      id: profileData.id,
      username: profileData.username,
      email: email || undefined,
      name: profileData.name,
      surname: profileData.surname,
      rank: profileData.rank,
      points: profileData.points,
      sessionsCompleted: profileData.sessions_completed,
      joinedDate: profileData.joined_date,
      credits: profileData.credits
    } as User;
  } catch (err) {
    console.error('[Supabase] Exceção em getUserProfile:', err);
    return null;
  }
};

/**
 * Atualiza dados básicos do perfil
 */
export const updateUserProfile = async (userId: string, data: { name: string, surname: string }) => {
  const { error } = await supabase
    .from('profiles')
    .update({ 
      name: data.name, 
      surname: data.surname 
    })
    .eq('id', userId);
    
  return !error;
};

/**
 * Salva o resultado de uma sessão de prática na tabela 'sessions'
 */
export const saveSession = async (userId: string, session: SessionResult) => {
  try {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const activeUserId = authSession?.user?.id || userId;

    const payload = {
      user_id: activeUserId,
      avatar_name: session.avatarName,
      overall_score: Number(session.overallScore),
      vocabulary_score: Number(session.vocabularyScore),
      grammar_score: Number(session.grammarScore),
      pronunciation_score: Number(session.pronunciationScore),
      fluency_rating: session.fluencyRating,
      feedback: session.feedback,
      duration_seconds: Math.floor(session.durationSeconds || 0),
      transcript: session.transcript || "",
      date: session.date || new Date().toISOString()
    };

    const { error } = await supabase
      .from('sessions')
      .insert([payload]);

    if (error) return false;
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Atualiza estatísticas e CRÉDITOS na tabela 'profiles'
 */
export const updateUserStats = async (userId: string, updates: Partial<User>) => {
  try {
    const dbUpdates: any = {};
    if (updates.points !== undefined) dbUpdates.points = updates.points;
    if (updates.credits !== undefined) dbUpdates.credits = updates.credits;
    if (updates.rank !== undefined) dbUpdates.rank = updates.rank;
    if (updates.sessionsCompleted !== undefined) dbUpdates.sessions_completed = updates.sessionsCompleted;

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userId);

    if (error) return false;
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Busca o histórico de sessões
 */
export const getUserHistory = async (userId: string): Promise<SessionResult[]> => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) return [];

    // Fix: Corrected key mappings to match the SessionResult camelCase properties.
    return (data || []).map(s => ({
      avatarName: s.avatar_name,
      overallScore: s.overall_score,
      vocabularyScore: s.vocabulary_score,
      grammarScore: s.grammar_score,
      pronunciationScore: s.pronunciation_score,
      fluencyRating: s.fluency_rating,
      feedback: s.feedback,
      durationSeconds: s.duration_seconds,
      transcript: s.transcript,
      date: s.date
    }));
  } catch (err) {
    return [];
  }
};

/**
 * Registra o início de um pagamento na tabela 'payments'
 */
export const logPayment = async (userId: string, asaasId: string, amount: number, minutes: number) => {
  await supabase.from('payments').insert([{
    user_id: userId,
    asaas_id: asaasId,
    amount,
    minutes,
    status: 'PENDING',
    processed: false 
  }]);
};

/**
 * Consulta o status de um pagamento na tabela payments
 */
export const getPaymentStatusFromDB = async (asaasId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('payments')
    .select('status')
    .eq('asaas_id', asaasId)
    .single();

  if (error) return null;
  return data?.status || null;
};

/**
 * Atualiza o status do pagamento manualmente (opcional, se necessário).
 */
export const updatePaymentStatus = async (asaasId: string, status: string) => {
  const { error } = await supabase
    .from('payments')
    .update({ status })
    .eq('asaas_id', asaasId);
    
  return !error;
};
