
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const app = express();
const PORT = 3001;

// Configuração simplificada para aceitar Simple Requests do navegador
app.use(cors());

// Middleware para ler dados vindos de URLSearchParams (x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const VERCEL_API_URL = 'https://asaas-api-segura.vercel.app/api';

app.post('/api/processar-pagamento', async (req, res) => {
  try {
    console.log('--- PROXY: NOVO POST RECEBIDO ---');
    console.log('Body:', req.body);
    
    // O Proxy faz a chamada para a Vercel via Server-side Fetch.
    // Aqui não existe restrição de CORS, então enviamos como JSON para a Vercel.
    const response = await fetch(`${VERCEL_API_URL}/processar-pagamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    console.log('Status da Vercel:', response.status);

    if (!response.ok) {
        return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Erro no Proxy:', error.message);
    res.status(500).json({ error: 'Erro interno no proxy' });
  }
});

app.get('/api/checar-status', async (req, res) => {
  try {
    const { id } = req.query;
    const response = await fetch(`${VERCEL_API_URL}/checar-status?id=${id}`, {
        method: 'GET'
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro no proxy ao checar status.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy local rodando em http://localhost:${PORT}`);
});
