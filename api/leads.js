const crypto = require('crypto');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = req.body;
    
    // Captura o IP do usuário no ambiente da Vercel
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    
    // Constrói payload unificado
    const payload = {
      ...data,
      ip: clientIp.split(',')[0].trim(),
      server_timestamp: new Date().toISOString()
    };

    console.log(`[API Leads] Novo lead recebido: ${payload.lead_id}`);

    // 1. Enviar para o Google Sheets via Webhook
    const sheetsWebhook = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    if (sheetsWebhook) {
      try {
        await fetch(sheetsWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        console.log(`[API Leads] Dados enviados para o Google Sheets (${payload.lead_id})`);
      } catch (err) {
        console.error(`[API Leads] Erro ao enviar para o Sheets:`, err);
        // Pode ser ideal não quebrar o fluxo se o Sheets falhar, dependendo da criticidade
      }
    } else {
      console.warn(`[API Leads] AVISO: GOOGLE_SHEETS_WEBHOOK_URL não configurada no ambiente.`);
    }

    // 2. Preparar e enviar para Meta Conversions API (CAPI)
    const metaPixelId = process.env.META_PIXEL_ID;
    const metaAccessToken = process.env.META_ACCESS_TOKEN;

    if (metaPixelId && metaAccessToken) {
      try {
        // Função para normalizar e fazer hash SHA256 (Requisito da API do Meta)
        const hashData = (str) => {
          if (!str) return undefined;
          const normalized = str.trim().toLowerCase();
          return crypto.createHash('sha256').update(normalized).digest('hex');
        };

        const fbp = payload.fbp;
        const fbc = payload.fbc;
        const eventId = payload.event_id;

        // Normalização de telefone (remover não numéricos, adicionar DDI)
        let phone = payload.whatsapp ? payload.whatsapp.replace(/\D/g, '') : '';
        if (phone && !phone.startsWith('55')) {
          phone = '55' + phone;
        }

        const capiPayload = {
          data: [
            {
              event_name: 'Lead',
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventId,
              event_source_url: payload.page_url,
              action_source: 'website',
              user_data: {
                client_ip_address: payload.ip,
                client_user_agent: payload.user_agent,
                em: [hashData(payload.email)],
                ph: [hashData(phone)],
                fbp: fbp,
                fbc: fbc
              },
              custom_data: {
                lead_id: payload.lead_id,
                origem: payload.origem
              }
            }
          ]
        };

        const metaUrl = `https://graph.facebook.com/v21.0/${metaPixelId}/events?access_token=${metaAccessToken}`;
        
        const metaResponse = await fetch(metaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(capiPayload)
        });

        const metaResult = await metaResponse.json();
        console.log(`[API Leads] CAPI response (${eventId}):`, JSON.stringify(metaResult));
        
        if (!metaResponse.ok) {
          console.error(`[API Leads] CAPI erro HTTP ${metaResponse.status}:`, JSON.stringify(metaResult));
        }
      } catch (metaErr) {
        console.error(`[API Leads] Erro ao enviar para Meta CAPI:`, metaErr);
      }
    } else {
      console.warn(`[API Leads] AVISO: Credenciais do Meta (Pixel ID ou Token) não configuradas. CAPI ignorado.`);
    }

    // Resposta de Sucesso (mesmo que CAPI/Sheets falhem ou não estejam configurados, o lead foi aceito)
    return res.status(200).json({
      ok: true,
      lead_id: payload.lead_id,
      event_id: payload.event_id
    });

  } catch (error) {
    console.error(`[API Leads] Erro interno:`, error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
