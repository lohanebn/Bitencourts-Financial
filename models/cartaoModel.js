// =====================================================================
// MODEL: Cartões
// =====================================================================
const db = require('../config/database');
const { aplicarPeriodo } = require('../utils/periodo');

const CartaoModel = {
  async listar(periodo = null) {
    const params = [];
    let totalPeriodoSql = '0';
    if (periodo && (periodo.inicio || periodo.fim)) {
      const p = [];
      let sub = `SELECT COALESCE(SUM(pa.valor),0) FROM parcelas pa
        JOIN parcelamentos pm ON pm.id=pa.parcelamento_id
        WHERE pm.cartao_id=c.id AND pa.status='Pendente'`;
      sub = aplicarPeriodo(sub, p, 'pa.data_vencimento', periodo);
      totalPeriodoSql = `(${sub})`;
      params.push(...p);
    }
    const [rows] = await db.query(
      `SELECT c.*,
              CASE WHEN c.rateado=1 THEN 'Casal' ELSE u.nome END AS usuario_nome,
              CASE WHEN c.rateado=1 THEN '#4A7FE8' ELSE COALESCE(u.cor,'#888') END AS usuario_cor,
              ${totalPeriodoSql} AS total_periodo
       FROM cartoes c
       LEFT JOIN usuarios u ON u.id = c.usuario_id
       ORDER BY c.nome_cartao ASC`,
      params
    );
    return rows;
  },

  async buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM cartoes WHERE id = ?', [id]);
    return rows[0];
  },

  async criar(dados) {
    const { nome_cartao, banco, limite, dia_fechamento, dia_vencimento } = dados;
    const rateado = dados.rateado ? 1 : 0;
    const usuario_id = rateado ? null : (dados.usuario_id || null);
    const [result] = await db.query(
      `INSERT INTO cartoes (usuario_id, rateado, nome_cartao, banco, limite, dia_fechamento, dia_vencimento)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [usuario_id, rateado, nome_cartao, banco, limite || 0, dia_fechamento, dia_vencimento]
    );
    return this.buscarPorId(result.insertId);
  },

  async atualizar(id, dados) {
    const { nome_cartao, banco, limite, dia_fechamento, dia_vencimento } = dados;
    const rateado = dados.rateado ? 1 : 0;
    const usuario_id = rateado ? null : (dados.usuario_id || null);
    await db.query(
      `UPDATE cartoes
       SET usuario_id = ?, rateado = ?, nome_cartao = ?, banco = ?, limite = ?, dia_fechamento = ?, dia_vencimento = ?
       WHERE id = ?`,
      [usuario_id, rateado, nome_cartao, banco, limite || 0, dia_fechamento, dia_vencimento, id]
    );
    return this.buscarPorId(id);
  },

  async listarFatura(id, periodo) {
    const params = [id];
    let sql = `SELECT pa.id, p.id AS parcelamento_id, p.descricao_compra, pa.numero_parcela, pa.total_parcelas,
      pa.valor, pa.data_vencimento, p.data_compra, p.categoria
      FROM parcelas pa
      JOIN parcelamentos p ON p.id = pa.parcelamento_id
      WHERE p.cartao_id = ? AND pa.status = 'Pendente'`;
    sql = aplicarPeriodo(sql, params, 'pa.data_vencimento', periodo);
    sql += ' ORDER BY p.data_compra ASC, pa.numero_parcela ASC';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  async excluir(id) {
    await db.query('DELETE FROM cartoes WHERE id = ?', [id]);
    return true;
  }
};

module.exports = CartaoModel;
