// =====================================================================
// MODEL: Receitas
// =====================================================================
const db = require('../config/database');

const ReceitaModel = {
  async listar(filtros = {}) {
    let sql = `
      SELECT r.*, u.nome AS usuario_nome, u.cor AS usuario_cor
      FROM receitas r
      INNER JOIN usuarios u ON u.id = r.usuario_id
      WHERE 1=1
    `;
    const params = [];

    if (filtros.usuario_id) {
      sql += ' AND r.usuario_id = ?';
      params.push(filtros.usuario_id);
    }
    if (filtros.categoria) {
      sql += ' AND r.categoria = ?';
      params.push(filtros.categoria);
    }
    if (filtros.mes && filtros.ano) {
      sql += ' AND MONTH(r.data_recebimento) = ? AND YEAR(r.data_recebimento) = ?';
      params.push(filtros.mes, filtros.ano);
    }
    if (filtros.data_inicio) {
      sql += ' AND r.data_recebimento >= ?';
      params.push(filtros.data_inicio);
    }
    if (filtros.data_fim) {
      sql += ' AND r.data_recebimento <= ?';
      params.push(filtros.data_fim);
    }

    sql += ' ORDER BY r.data_recebimento DESC';

    const [rows] = await db.query(sql, params);
    return rows;
  },

  async buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM receitas WHERE id = ?', [id]);
    return rows[0];
  },

  async criar(dados) {
    const { usuario_id, descricao, categoria, valor, data_recebimento, observacao } = dados;
    const [result] = await db.query(
      `INSERT INTO receitas (usuario_id, descricao, categoria, valor, data_recebimento, observacao)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuario_id, descricao, categoria, valor, data_recebimento, observacao || null]
    );
    return this.buscarPorId(result.insertId);
  },

  async atualizar(id, dados) {
    const { usuario_id, descricao, categoria, valor, data_recebimento, observacao } = dados;
    await db.query(
      `UPDATE receitas
       SET usuario_id = ?, descricao = ?, categoria = ?, valor = ?, data_recebimento = ?, observacao = ?
       WHERE id = ?`,
      [usuario_id, descricao, categoria, valor, data_recebimento, observacao || null, id]
    );
    return this.buscarPorId(id);
  },

  async excluir(id) {
    await db.query('DELETE FROM receitas WHERE id = ?', [id]);
    return true;
  },

  // Soma total de receitas em um intervalo (usado no dashboard e projeção)
  async totalPorPeriodo(mes, ano, usuario_id = null) {
    let sql = `
      SELECT COALESCE(SUM(valor),0) AS total
      FROM receitas
      WHERE MONTH(data_recebimento) = ? AND YEAR(data_recebimento) = ?
    `;
    const params = [mes, ano];
    if (usuario_id) {
      sql += ' AND usuario_id = ?';
      params.push(usuario_id);
    }
    const [rows] = await db.query(sql, params);
    return Number(rows[0].total);
  },

  async totalPorIntervalo(inicio, fim, usuario_id = null) {
    let sql = 'SELECT COALESCE(SUM(valor),0) total FROM receitas WHERE 1=1';
    const params = [];
    if (inicio) { sql += ' AND data_recebimento >= ?'; params.push(inicio); }
    if (fim) { sql += ' AND data_recebimento <= ?'; params.push(fim); }
    if (usuario_id) { sql += ' AND usuario_id=?'; params.push(usuario_id); }
    const [rows] = await db.query(sql, params);
    return Number(rows[0].total);
  },

  // Média mensal de receitas dos últimos N meses (usado para projetar meses futuros)
  async mediaMensal(meses = 3) {
    const [rows] = await db.query(
      `SELECT COALESCE(AVG(total_mes),0) AS media FROM (
         SELECT SUM(valor) AS total_mes
         FROM receitas
         WHERE data_recebimento >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
         GROUP BY YEAR(data_recebimento), MONTH(data_recebimento)
       ) AS sub`,
      [meses]
    );
    return Number(rows[0].media);
  }
};

module.exports = ReceitaModel;
