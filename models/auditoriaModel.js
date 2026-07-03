const db = require('../config/database');

const AuditoriaModel = {
  async registrar({ usuario_id = null, usuario_nome = null, tipo_acao, descricao, detalhes = null }) {
    await db.query(
      `INSERT INTO auditoria (usuario_id, usuario_nome, tipo_acao, descricao, detalhes)
       VALUES (?, ?, ?, ?, ?)`,
      [usuario_id, usuario_nome, tipo_acao, descricao, detalhes]
    );
    return true;
  },

  async listar({ limite = 20, offset = 0, periodo = null, tipo_acao = null, usuario_id = null }) {
    const params = [];
    let sql = `SELECT id, usuario_id, usuario_nome, tipo_acao, descricao, detalhes, criado_em FROM auditoria WHERE 1=1`;
    if (periodo?.inicio) {
      sql += ' AND criado_em >= ?';
      params.push(periodo.inicio);
    }
    if (periodo?.fim) {
      sql += ' AND criado_em <= ?';
      params.push(periodo.fim);
    }
    if (tipo_acao) {
      sql += ' AND tipo_acao LIKE ?';
      params.push(`%${tipo_acao}%`);
    }
    if (usuario_id) {
      sql += ' AND usuario_id = ?';
      params.push(usuario_id);
    }
    sql += ' ORDER BY criado_em DESC, id DESC LIMIT ? OFFSET ?';
    params.push(limite, offset);
    const [rows] = await db.query(sql, params);
    return rows;
  }
};

module.exports = AuditoriaModel;
