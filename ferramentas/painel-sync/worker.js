// Planor · estado compartilhado do painel de prospecção (Cloudflare Worker + D1).
// GET  /estado            → { estado: { lead_id: {status, vendedor, enviado_em, notas, contato_nome, atualizado_em, atualizado_por} } }
// POST /estado {id, por, campos} → grava só os campos enviados e devolve a linha.
// Autenticação: header X-Chave = sha256hex('planor-sync:' + senha); o Worker guarda só o sha256 dessa chave (secret CHAVE_HASH).

const ORIGENS = ['https://gustavomarcelloprf.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];
const VENDEDORES = ['Kevin', 'Guilherme'];
const STATUS = ['novo', 'enviado', 'respondeu', 'proposta', 'fechado', 'sem_interesse', 'sem_whatsapp'];
const CAMPOS = ['status', 'notas', 'contato_nome'];

const sha256 = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

function cors(req) {
  const o = req.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ORIGENS.includes(o) ? o : ORIGENS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Chave',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
const json = (req, corpo, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req) },
});

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    if (url.pathname !== '/estado') return json(req, { erro: 'não encontrado' }, 404);

    const chave = req.headers.get('X-Chave') || '';
    if (!chave || await sha256(chave) !== env.CHAVE_HASH) return json(req, { erro: 'chave inválida' }, 401);

    if (req.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM estado').all();
      return json(req, { estado: Object.fromEntries(results.map(r => [r.lead_id, r])) });
    }

    if (req.method === 'POST') {
      let b; try { b = await req.json(); } catch { return json(req, { erro: 'json inválido' }, 400); }
      const id = String(b.id || '').slice(0, 120), por = b.por;
      if (!id || !VENDEDORES.includes(por)) return json(req, { erro: 'id ou vendedor inválido' }, 400);
      const c = Object.fromEntries(CAMPOS.filter(k => k in (b.campos || {})).map(k => [k, String(b.campos[k] ?? '').slice(0, 2000)]));
      if (c.status && !STATUS.includes(c.status)) return json(req, { erro: 'status inválido' }, 400);

      const agora = new Date().toISOString();
      const atual = await env.DB.prepare('SELECT * FROM estado WHERE lead_id = ?').bind(id).first()
        || { status: 'novo', vendedor: '', enviado_em: '', notas: '', contato_nome: '' };
      const novo = { ...atual, ...c };
      // Quem chamou = quem tirou o lead de "novo". Voltar para "novo" libera o lead.
      if (novo.status === 'novo') { novo.vendedor = ''; novo.enviado_em = ''; }
      else if (!atual.vendedor || atual.status === 'novo') { novo.vendedor = por; novo.enviado_em = atual.enviado_em || agora; }

      await env.DB.batch([
        env.DB.prepare(`INSERT INTO estado (lead_id, status, vendedor, enviado_em, notas, contato_nome, atualizado_em, atualizado_por)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
          ON CONFLICT(lead_id) DO UPDATE SET status=?2, vendedor=?3, enviado_em=?4, notas=?5, contato_nome=?6, atualizado_em=?7, atualizado_por=?8`)
          .bind(id, novo.status, novo.vendedor, novo.enviado_em, novo.notas, novo.contato_nome, agora, por),
        env.DB.prepare('INSERT INTO historico (lead_id, por, campos, em) VALUES (?, ?, ?, ?)').bind(id, por, JSON.stringify(c), agora),
      ]);
      return json(req, { ...novo, lead_id: id, atualizado_em: agora, atualizado_por: por });
    }
    return json(req, { erro: 'método não suportado' }, 405);
  },
};
