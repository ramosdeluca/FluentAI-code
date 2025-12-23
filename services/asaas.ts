
// Service to handle Asaas API interactions

/**
 * Detecção inteligente da URL da API.
 */
const getApiUrl = () => {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isHttps = window.location.protocol === 'https:';

  // Se estamos em localhost e não é HTTPS, podemos usar o proxy local.
  // Caso contrário, usamos a API segura na Vercel diretamente.
  if (isLocalHost && !isHttps) {
    return 'http://localhost:3001/api';
  }
  
  return 'https://asaas-api-segura.vercel.app/api';
};

const API_URL = getApiUrl();

export interface CheckoutResponse {
  id: string;
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

/**
 * Helper para chamadas à API.
 * CRITICAL: Para evitar o pre-flight OPTIONS (CORS), não podemos enviar headers customizados
 * como 'Content-Type: application/json' ou 'Accept'.
 * Usamos apenas o que o navegador considera "Simple Request".
 */
const fetchAsaas = async (targetUrl: string, options: RequestInit) => {
  try {
    const response = await fetch(targetUrl, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Asaas Service] Erro HTTP:', response.status, errorText);
      throw new Error(`Erro do servidor: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[Asaas Service] Erro na chamada fetch:', error.message);
    throw error;
  }
};

/**
 * Gera a cobrança PIX via POST.
 * Para não disparar o verbo OPTIONS, enviamos os dados via URLSearchParams.
 * O navegador definirá automaticamente o Content-Type como 'application/x-www-form-urlencoded',
 * que é permitido em Simple Requests.
 */
export const generatePixCheckout = async (userData: { 
  name: string; 
  email: string; 
  cpf: string; 
  value: number; 
}): Promise<CheckoutResponse> => {
  
  const bodyParams = new URLSearchParams();
  bodyParams.append('nomeCliente', userData.name);
  bodyParams.append('cpfCnpj', userData.cpf);
  bodyParams.append('emailCliente', userData.email);
  bodyParams.append('valorCreditos', userData.value.toString());
  bodyParams.append('descricao', "Recarga de Minutos - FluentAI");

  console.log('[Asaas Service] Disparando POST simples (Sem OPTIONS)...');

  const rawData = await fetchAsaas(`${API_URL}/processar-pagamento`, {
    method: 'POST',
    // NÃO definimos headers aqui. O navegador cuida disso ao ver o URLSearchParams.
    body: bodyParams
  });

  console.log('[Asaas Service] Resposta recebida:', rawData);

  // Mapeamento resiliente para capturar os campos da Vercel
  const id = rawData.paymentId || rawData.id || (rawData.data && rawData.data.id) || '';
  
  const encodedImage = 
    rawData.encodedImage || 
    rawData.qrCode || 
    rawData.encodedImageBase64 || 
    rawData.image || 
    (rawData.pix && rawData.pix.encodedImage) || 
    (rawData.data && rawData.data.encodedImage) ||
    '';

  const payload = 
    rawData.payload || 
    rawData.copyPaste || 
    rawData.pixCopyPaste || 
    rawData.pixCode || 
    (rawData.pix && rawData.pix.payload) || 
    (rawData.data && rawData.data.payload) ||
    '';

  return {
    id,
    encodedImage,
    payload,
    expirationDate: rawData.expirationDate || ''
  };
};

/**
 * Consulta o status da cobrança via GET (Também é um Simple Request).
 */
export const checkPaymentStatus = async (paymentId: string): Promise<boolean> => {
  if (!paymentId) return false;
  
  try {
    const result = await fetchAsaas(`${API_URL}/checar-status?id=${paymentId}`, { 
      method: 'GET' 
    });
    
    const status = result.status || (result.data && result.data.status);
    return ['RECEIVED', 'CONFIRMED', 'PAID', 'RECEIVED_IN_CASH'].includes(String(status).toUpperCase());
  } catch (e) {
    return false;
  }
};
