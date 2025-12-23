import React, { useState } from 'react';
import { User } from '../types';
import { supabase, getUserProfile, getEmailByUsername } from '../services/supabase';

interface LoginProps {
  onLogin: (user: User) => void;
}

type AuthMode = 'login' | 'register' | 'reset';

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    surname: '',
  });
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let loginEmail = formData.username; // O campo "usuário" serve para ambos no login

    // Se não for um e-mail, tentamos resolver o username para o e-mail real
    if (!loginEmail.includes('@')) {
      const resolvedEmail = await getEmailByUsername(loginEmail);
      if (resolvedEmail) {
        loginEmail = resolvedEmail;
      } else {
        // Fallback para o comportamento antigo caso o perfil não tenha e-mail gravado ainda
        loginEmail = `${loginEmail.toLowerCase()}@fluentai.com`;
      }
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: formData.password,
    });

    if (authError) {
      setError("Credenciais inválidas. Verifique e-mail/usuário e senha.");
      setLoading(false);
      return;
    }

    if (data.user) {
      const profile = await getUserProfile(data.user.id);
      if (profile) {
        onLogin(profile);
      } else {
        setError("Erro ao carregar perfil do banco de dados.");
      }
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validações básicas
    if (!formData.name || !formData.surname || !formData.username || !formData.email || !formData.password) {
      setError("Todos os campos são obrigatórios.");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          username: formData.username.toLowerCase(),
          name: formData.name,
          surname: formData.surname,
          email: formData.email // Passando no metadata para a trigger de perfil
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      setSuccess("Conta criada com sucesso! Entrando...");
      
      // Lógica de Redirecionamento Robusta:
      // Tenta buscar o perfil até 3 vezes caso a trigger do banco demore
      let attempts = 0;
      const fetchProfileWithRetry = async () => {
        attempts++;
        const profile = await getUserProfile(data.user!.id);
        
        if (profile) {
          onLogin(profile);
        } else if (attempts < 3) {
          setTimeout(fetchProfileWithRetry, 1000); 
        } else {
          setError("Perfil criado, mas houve um atraso na sincronização. Por favor, faça login.");
          setLoading(false);
          setMode('login');
        }
      };

      fetchProfileWithRetry();
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("Função de redefinição via e-mail em desenvolvimento.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 relative overflow-hidden">
        
        <div className="text-center relative z-10">
          <h2 className="mt-2 text-3xl font-extrabold text-white tracking-tight">FluentAI</h2>
          <p className="mt-2 text-sm text-gray-400">
            {mode === 'login' && 'Acesse sua conta para praticar'}
            {mode === 'register' && 'Crie sua conta e ganhe 10 min grátis'}
            {mode === 'reset' && 'Redefina sua senha'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm text-center animate-shake">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm text-center">
            {success}
          </div>
        )}

        <div className="mt-8">
          {mode === 'login' && (
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">E-mail ou Usuário</label>
                <input
                  name="username"
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Seu e-mail ou usuário"
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Senha</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Sua senha"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={loading}
                />
                <div className="flex justify-end mt-2">
                  <button type="button" onClick={() => setMode('reset')} className="text-xs text-blue-400 hover:text-blue-300">
                    Esqueceu a senha?
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-gray-400 mb-1">Nome</label>
                   <input
                     name="name"
                     type="text"
                     required
                     className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                     placeholder="Nome"
                     value={formData.name}
                     onChange={handleInputChange}
                     disabled={loading}
                   />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-400 mb-1">Sobrenome</label>
                   <input
                     name="surname"
                     type="text"
                     required
                     className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                     placeholder="Sobrenome"
                     value={formData.surname}
                     onChange={handleInputChange}
                     disabled={loading}
                   />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Nome de Usuário</label>
                <input
                  name="username"
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ex: joaosilva"
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Senha</label>
                  <input
                    name="password"
                    type="password"
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="******"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Confirmar</label>
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="******"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 transition-all transform hover:-translate-y-0.5 mt-2 disabled:opacity-50"
              >
                {loading ? "Criando conta..." : "Criar Conta"}
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form className="space-y-6" onSubmit={handleResetPassword}>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-xl transition-all"
              >
                Enviar Recuperação
              </button>
            </form>
          )}
        </div>

        <div className="mt-8 text-center border-t border-gray-700 pt-6">
          {mode === 'login' && (
            <p className="text-gray-400 text-sm">
              Não tem uma conta?{' '}
              <button onClick={() => { setMode('register'); setError(null); }} className="text-blue-400 font-semibold hover:text-blue-300 ml-1">
                Cadastre-se
              </button>
            </p>
          )}
          {mode === 'register' && (
            <p className="text-gray-400 text-sm">
              Já tem conta?{' '}
              <button onClick={() => { setMode('login'); setError(null); }} className="text-blue-400 font-semibold hover:text-blue-300 ml-1">
                Faça Login
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <button onClick={() => { setMode('login'); setError(null); }} className="text-blue-400 font-semibold hover:text-blue-300 text-sm">
              Voltar ao Login
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default Login;