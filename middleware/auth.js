const db = require('../config/database');
const { verificarToken, SESSION_TIMEOUT_MINUTES } = require('../utils/auth');

async function autenticar(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'] || req.query.token;

  if (!token) {
    return res.status(401).json({ sucesso: false, mensagem: 'Token de acesso ausente.' });
  }

  try {
    const claims = verificarToken(token);
    const [rows] = await db.query(`
      SELECT s.id, s.session_id, s.usuario_id, s.expira_em, s.ultimo_acesso_em, s.revogada_em,
             u.nome, u.usuario, u.perfil, u.ativo
      FROM sessoes s
      JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.session_id = ?
    `, [claims.sid]);

    const sessao = rows[0];
    if (!sessao || sessao.revogada_em || new Date(sessao.expira_em) < new Date()) {
      return res.status(401).json({ sucesso: false, mensagem: 'Sessão inválida ou expirada.' });
    }

    if (!sessao.ativo) {
      return res.status(403).json({ sucesso: false, mensagem: 'Usuário bloqueado.' });
    }

    const limiteInatividade = new Date(new Date(sessao.ultimo_acesso_em).getTime() + SESSION_TIMEOUT_MINUTES * 60000);
    if (new Date() > limiteInatividade) {
      await db.query('UPDATE sessoes SET revogada_em = NOW() WHERE id = ?', [sessao.id]);
      return res.status(401).json({ sucesso: false, mensagem: 'Sessão expirou por inatividade.' });
    }

    await db.query('UPDATE sessoes SET ultimo_acesso_em = NOW() WHERE id = ?', [sessao.id]);

    req.auth = {
      sessionId: sessao.session_id,
      usuarioId: sessao.usuario_id,
      perfil: sessao.perfil
    };
    req.usuario = {
      id: sessao.usuario_id,
      nome: sessao.nome,
      usuario: sessao.usuario,
      perfil: sessao.perfil,
      ativo: sessao.ativo
    };

    next();
  } catch (err) {
    return res.status(401).json({ sucesso: false, mensagem: 'Token inválido.' });
  }
}

module.exports = autenticar;
