const assert = require('assert');
const db = require('../config/database');
const UsuarioModel = require('../models/usuarioModel');

(async () => {
  const sessionId = `regression-${Date.now()}`;
  const [usuarioRow] = await db.query('SELECT id FROM usuarios WHERE usuario = ? LIMIT 1', ['admin']);
  const usuarioId = usuarioRow[0]?.id;

  if (!usuarioId) {
    throw new Error('Usuário admin não encontrado para o teste de sessão.');
  }

  await db.query(
    `INSERT INTO sessoes (usuario_id, session_id, token_hash, expira_em, ultimo_acesso_em, criado_em)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW(), NOW())`,
    [usuarioId, sessionId, 'hash-teste']
  );

  try {
    await UsuarioModel.revogarSessao(sessionId);
    const [rows] = await db.query('SELECT revogada_em FROM sessoes WHERE session_id = ? LIMIT 1', [sessionId]);
    assert.ok(rows[0]?.revogada_em, 'A sessão deveria ter sido revogada.');
    console.log('Teste de revogação de sessão: OK');
  } finally {
    await db.query('DELETE FROM sessoes WHERE session_id = ?', [sessionId]);
    await db.end();
  }
})();
