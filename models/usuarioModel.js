// =====================================================================
// MODEL: Usuários
// =====================================================================
const db = require('../config/database');

const UsuarioModel = {
  async listarTodos() {
    const [rows] = await db.query(`
      SELECT id, nome, usuario, perfil, ativo, primeiro_acesso, ultimo_login, criado_em, atualizado_em, cor
      FROM usuarios
      ORDER BY nome ASC
    `);
    return rows;
  },

  async buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    return rows[0];
  },

  async buscarPorUsuario(usuario) {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE usuario = ? ORDER BY id DESC LIMIT 1', [usuario]);
    return rows[0];
  },

  async criar({ nome, usuario, senhaHash, perfil = 'USUARIO', ativo = 1, primeiroAcesso = true }) {
    const [result] = await db.query(
      `INSERT INTO usuarios (nome, usuario, senha_hash, perfil, ativo, primeiro_acesso, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [nome, usuario, senhaHash, perfil, ativo, primeiroAcesso]
    );
    return { id: result.insertId, nome, usuario, perfil, ativo, primeiro_acesso: primeiroAcesso };
  },

  async atualizar(id, dados) {
    const colunas = [];
    const valores = [];
    Object.entries(dados).forEach(([chave, valor]) => {
      colunas.push(`${chave} = ?`);
      valores.push(valor);
    });
    if (!colunas.length) return null;
    valores.push(id);
    await db.query(`UPDATE usuarios SET ${colunas.join(', ')}, atualizado_em = NOW() WHERE id = ?`, valores);
    return true;
  },

  async atualizarSenha(id, senhaHash) {
    await db.query('UPDATE usuarios SET senha_hash = ?, atualizado_em = NOW() WHERE id = ?', [senhaHash, id]);
    return true;
  },

  async marcarPrimeiroAcesso(id) {
    await db.query('UPDATE usuarios SET primeiro_acesso = TRUE, atualizado_em = NOW() WHERE id = ?', [id]);
    return true;
  },

  async marcarPrimeiroAcessoConcluido(id) {
    await db.query('UPDATE usuarios SET primeiro_acesso = FALSE, atualizado_em = NOW() WHERE id = ?', [id]);
    return true;
  },

  async atualizarUltimoLogin(id) {
    await db.query('UPDATE usuarios SET ultimo_login = NOW(), atualizado_em = NOW() WHERE id = ?', [id]);
    return true;
  },

  async criarSessao({ usuarioId, sessionId, tokenHash, expiraEm }) {
    await db.query(
      `INSERT INTO sessoes (usuario_id, session_id, token_hash, expira_em, ultimo_acesso_em, criado_em)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [usuarioId, sessionId, tokenHash, expiraEm]
    );
    return true;
  },

  async revogarSessao(sessionId) {
    const valor = String(sessionId);
    await db.query('UPDATE sessoes SET revogada_em = NOW() WHERE session_id = ? OR CAST(id AS CHAR) = ?', [valor, valor]);
    return true;
  },

  async excluir(id) {
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    return true;
  }
};

module.exports = UsuarioModel;
