// =====================================================================
// MODEL: Parcelamentos / Obrigações Parceladas (v2)
// Suporta: Cartão de Crédito, Empréstimo, Financiamento, Consórcio,
//          Boleto Parcelado, Acordo de Dívida, Outro
// Compatibilidade total com parcelamentos existentes (tipo Cartão).
// =====================================================================
const db = require('../config/database');

// Calcula o valor_total a partir do valor_parcela quando não é informado
// (empréstimo, consórcio, etc. informam valor_parcela diretamente)
function calcularValorTotal(dados) {
  if (dados.valor_total) return Number(dados.valor_total);
  return Number((Number(dados.valor_parcela) * Number(dados.qtd_parcelas)).toFixed(2));
}

// Ajusta a última parcela para eliminar diferença de arredondamento de centavos
function gerarValoresParcelas(valorTotal, valorParcela, qtd) {
  const vp = Number(valorParcela);
  const valores = [];
  let soma = 0;
  for (let i = 1; i <= qtd; i++) {
    let valor = i === qtd ? Number((valorTotal - soma).toFixed(2)) : vp;
    if (i < qtd) soma += vp;
    valores.push(Number(valor.toFixed(2)));
  }
  return valores;
}

// Calcula datas de vencimento mensais a partir de uma data-base
// Para Cartão de Crédito: base = data_compra, 1ª parcela = base + 1 mês
// Para os demais: base = data_primeiro_vencimento, 1ª parcela = base (mês 0)
function calcularDatasVencimento(dataBase, qtd, deslocamentoInicial = 1) {
  const datas = [];
  for (let i = 0; i < qtd; i++) {
    const d = new Date(dataBase);
    d.setMonth(d.getMonth() + deslocamentoInicial + i);
    datas.push(d.toISOString().slice(0, 10));
  }
  return datas;
}

const ParcelamentoModel = {

  async listar() {
    // LEFT JOIN cartoes: NULL para tipos sem cartão vinculado
    const [rows] = await db.query(`
      SELECT p.*,
             u.nome  AS usuario_nome,
             u.cor   AS usuario_cor,
             c.nome_cartao,
             c.banco,
             (SELECT COUNT(*)
                FROM parcelas
               WHERE parcelamento_id = p.id AND status = 'Pago')          AS parcelas_pagas,
             (SELECT COALESCE(SUM(valor),0)
                FROM parcelas
               WHERE parcelamento_id = p.id AND status = 'Pendente')      AS valor_restante
        FROM parcelamentos p
        INNER JOIN usuarios u ON u.id = p.usuario_id
        LEFT  JOIN cartoes  c ON c.id = p.cartao_id
       ORDER BY p.criado_em DESC
    `);
    return rows;
  },

  async buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM parcelamentos WHERE id = ?', [id]);
    return rows[0];
  },

  async buscarComParcelas(id) {
    const p = await this.buscarPorId(id);
    if (!p) return null;
    const [parcelas] = await db.query(
      'SELECT * FROM parcelas WHERE parcelamento_id = ? ORDER BY numero_parcela ASC',
      [id]
    );
    return { ...p, parcelas };
  },

  // ----------------------------------------------------------------
  // Cria a obrigação parcelada e gera automaticamente todas as parcelas
  // ----------------------------------------------------------------
  async criar(dados) {
    const {
      tipo_obrigacao = 'Cartão de Crédito',
      cartao_id,
      responsavel_texto,
      descricao_compra,
      categoria = 'Cartão',
      valor_total: vt,
      valor_parcela: vp,
      qtd_parcelas,
      data_compra,
      data_primeiro_vencimento
    } = dados;

    const isRateado = dados.rateado ? 1 : 0;
    const usuario_id = isRateado ? null : (dados.usuario_id || null);

    const qtd       = Number(qtd_parcelas);
    const valorTot  = calcularValorTotal(dados);
    const valorParc = vp ? Number(vp) : Number((valorTot / qtd).toFixed(2));

    let datas;
    if (tipo_obrigacao === 'Cartão de Crédito') {
      datas = calcularDatasVencimento(data_compra, qtd, 1);
    } else {
      datas = calcularDatasVencimento(data_primeiro_vencimento, qtd, 0);
    }

    const valores = gerarValoresParcelas(valorTot, valorParc, qtd);
    const dataRef = data_compra || data_primeiro_vencimento;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO parcelamentos
           (usuario_id, rateado, cartao_id, tipo_obrigacao, responsavel_texto, descricao_compra,
            categoria, valor_total, qtd_parcelas, valor_parcela, data_compra, data_primeiro_vencimento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuario_id,
          isRateado,
          cartao_id  || null,
          tipo_obrigacao,
          responsavel_texto || null,
          descricao_compra,
          categoria || 'Cartão',
          valorTot,
          qtd,
          valorParc,
          dataRef,
          data_primeiro_vencimento || null
        ]
      );
      const pId = result.insertId;

      const linhasParcelas = datas.map((data, i) => [
        pId, usuario_id, i + 1, qtd, valores[i], data, 'Pendente'
      ]);

      await conn.query(
        `INSERT INTO parcelas
           (parcelamento_id, usuario_id, numero_parcela, total_parcelas, valor, data_vencimento, status)
         VALUES ?`,
        [linhasParcelas]
      );

      await conn.commit();
      return this.buscarComParcelas(pId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async excluir(id) {
    await db.query('DELETE FROM parcelamentos WHERE id = ?', [id]);
    return true;
  },

  async atualizar(id, dados) {
    const atual = await this.buscarPorId(id);
    if (!atual) return null;
    const campos = { ...atual, ...dados };
    const valorTotal = calcularValorTotal(campos);
    const valorParcela = Number(campos.valor_parcela || (valorTotal / Number(campos.qtd_parcelas)).toFixed(2));
    await db.query(`UPDATE parcelamentos SET usuario_id=?,cartao_id=?,tipo_obrigacao=?,responsavel_texto=?,
      descricao_compra=?,categoria=?,valor_total=?,qtd_parcelas=?,valor_parcela=?,data_compra=?,data_primeiro_vencimento=? WHERE id=?`,
      [campos.usuario_id,campos.cartao_id||null,campos.tipo_obrigacao,campos.responsavel_texto||null,campos.descricao_compra,
       campos.categoria || 'Cartão',valorTotal,campos.qtd_parcelas,valorParcela,campos.data_compra,campos.data_primeiro_vencimento||null,id]);
    return this.buscarComParcelas(id);
  },

  async buscarParcelaPorId(id) {
    const [rows] = await db.query('SELECT * FROM parcelas WHERE id = ?', [id]);
    return rows[0];
  },

  async marcarParcelaPaga(parcelaId, status) {
    await db.query('UPDATE parcelas SET status = ? WHERE id = ?', [status, parcelaId]);
    const [rows] = await db.query('SELECT * FROM parcelas WHERE id = ?', [parcelaId]);
    return rows[0];
  },

  async totalParcelasPorPeriodo(mes, ano) {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(valor),0) AS total
         FROM parcelas
        WHERE MONTH(data_vencimento) = ? AND YEAR(data_vencimento) = ? AND status = 'Pendente'`,
      [mes, ano]
    );
    return Number(rows[0].total);
  },

  async totalParcelamentosFuturos() {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(valor),0) AS total
         FROM parcelas
        WHERE status = 'Pendente' AND data_vencimento >= CURDATE()`
    );
    return Number(rows[0].total);
  },

  async parcelasAtivasResumo() {
    const [rows] = await db.query(`
      SELECT p.id,
             p.descricao_compra,
             p.tipo_obrigacao,
             p.qtd_parcelas,
             p.valor_parcela,
             (SELECT COUNT(*)
                FROM parcelas
               WHERE parcelamento_id = p.id AND status = 'Pago')     AS parcela_atual,
             (SELECT COALESCE(SUM(valor),0)
                FROM parcelas
               WHERE parcelamento_id = p.id AND status = 'Pendente') AS valor_restante
        FROM parcelamentos p
       WHERE p.tipo_obrigacao != 'Cartão de Crédito'
      HAVING valor_restante > 0
       ORDER BY p.criado_em ASC
    `);
    return rows;
  },

  async editarLancamento(id, { descricao_compra, categoria, data_compra, parcela_id, valor_parcela }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM parcelamentos WHERE id=? FOR UPDATE', [id]);
      if (!rows[0]) throw new Error('Parcelamento não encontrado.');
      const atual = rows[0];
      await conn.query(
        'UPDATE parcelamentos SET descricao_compra=?, categoria=?, data_compra=? WHERE id=?',
        [descricao_compra || atual.descricao_compra, categoria || atual.categoria || 'Cartão', data_compra || atual.data_compra, id]
      );
      if (parcela_id && Number(valor_parcela) > 0) {
        await conn.query(
          "UPDATE parcelas SET valor=? WHERE id=? AND parcelamento_id=? AND status='Pendente'",
          [Number(valor_parcela), parcela_id, id]
        );
      }
      await conn.commit();
      return { ok: true };
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
  }
};

module.exports = ParcelamentoModel;
