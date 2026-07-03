// =====================================================================
// MODEL: Despesas
// =====================================================================
const db = require('../config/database');

// Quantidade de meses adicionados por ocorrência, de acordo com a periodicidade
const MESES_POR_PERIODICIDADE = {
  Mensal: 1,
  Bimestral: 2,
  Trimestral: 3,
  Semestral: 6,
  Anual: 12
};

// Para periodicidade indeterminada, gera um horizonte fixo de ocorrências futuras
// (a próxima leva é gerada conforme o tempo passa, sem necessidade de ação manual)
const HORIZONTE_OCORRENCIAS_INDETERMINADA = 12;

// Calcula a data de vencimento de uma ocorrência a partir de uma data-base, do dia
// do vencimento desejado e de quantos "passos" de periodicidade já se passaram
function calcularDataOcorrencia(dataBase, diaVencimento, mesesPorPeriodo, numeroPasso) {
  const data = new Date(dataBase);
  data.setDate(1); // evita problemas de overflow de mês (ex: 31 de fevereiro)
  data.setMonth(data.getMonth() + (mesesPorPeriodo * numeroPasso));
  const ultimoDiaDoMes = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  data.setDate(Math.min(diaVencimento, ultimoDiaDoMes));
  return data.toISOString().slice(0, 10);
}

const DespesaModel = {
  async listar(filtros = {}) {
    let sql = `
      SELECT d.*, COALESCE(u.nome, 'Casal') AS usuario_nome, COALESCE(u.cor, '#4A7FE8') AS usuario_cor
      FROM despesas d
      LEFT JOIN usuarios u ON u.id = d.usuario_id
      WHERE 1=1
    `;
    const params = [];

    if (filtros.usuario_id) {
      sql += ' AND (d.usuario_id = ? OR EXISTS (SELECT 1 FROM despesa_rateios dr WHERE dr.despesa_id=d.id AND dr.usuario_id=?))';
      params.push(filtros.usuario_id, filtros.usuario_id);
    }
    if (filtros.categoria) {
      sql += ' AND d.categoria = ?';
      params.push(filtros.categoria);
    }
    if (filtros.tipo) {
      sql += ' AND d.tipo = ?';
      params.push(filtros.tipo);
    }
    if (filtros.status) {
      sql += ' AND d.status = ?';
      params.push(filtros.status);
    }
    if (filtros.mes && filtros.ano) {
      sql += ' AND MONTH(d.data_vencimento) = ? AND YEAR(d.data_vencimento) = ?';
      params.push(filtros.mes, filtros.ano);
    }
    if (filtros.data_inicio) { sql += ' AND d.data_vencimento >= ?'; params.push(filtros.data_inicio); }
    if (filtros.data_fim) { sql += ' AND d.data_vencimento <= ?'; params.push(filtros.data_fim); }
    // Filtro de origem: "Fixa recorrente" (gerada por regra de periodicidade) vs "Avulsa"
    if (filtros.origem === 'Avulsas') {
      sql += ' AND d.eh_recorrente = 0';
    } else if (filtros.origem === 'Fixas') {
      sql += ' AND d.eh_recorrente = 1';
    }

    sql += ' ORDER BY d.data_vencimento ASC';

    const [rows] = await db.query(sql, params);
    return rows;
  },

  async buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM despesas WHERE id = ?', [id]);
    return rows[0];
  },

  async criar(dados) {
    const {
      usuario_id, descricao, categoria, tipo, valor, data_vencimento, status, observacao,
      eh_recorrente, dia_vencimento, periodicidade, duracao_tipo, qtd_ocorrencias, rateada, rateios
    } = dados;

    // Comportamento original: despesa avulsa/fixa simples com uma única data de vencimento.
    // Continua funcionando exatamente como antes quando eh_recorrente não é enviado.
    if (!eh_recorrente) {
      const conn = await db.getConnection();
      let result;
      try {
        await conn.beginTransaction();
        [result] = await conn.query(
          `INSERT INTO despesas (usuario_id, rateada, descricao, categoria, tipo, valor, data_vencimento, status, observacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rateada ? null : usuario_id, rateada ? 1 : 0, descricao, categoria, tipo, valor, data_vencimento, status || 'Pendente', observacao || null]
        );
        if (rateada) await this.salvarRateios(conn, result.insertId, valor, rateios);
        await conn.commit();
      } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
      return this.buscarPorId(result.insertId);
    }

    // Novo comportamento: despesa fixa recorrente, com geração automática de ocorrências futuras.
    return this.criarRecorrente({
      usuario_id, descricao, categoria, valor, status, observacao, rateada, rateios,
      dia_vencimento, periodicidade, duracao_tipo, qtd_ocorrencias
    });
  },

  // Cria uma despesa fixa recorrente: grava o lançamento "modelo" (primeira ocorrência)
  // e gera automaticamente as próximas ocorrências futuras vinculadas a ele.
  async criarRecorrente(dados) {
    const { usuario_id, descricao, categoria, valor, status = 'Pendente', observacao, dia_vencimento, periodicidade, duracao_tipo, qtd_ocorrencias, rateada, rateios } = dados;
    const mesesPorPeriodo = MESES_POR_PERIODICIDADE[periodicidade] || 1;
    const hoje = new Date();

    const totalOcorrencias = duracao_tipo === 'Quantidade' && qtd_ocorrencias
      ? Number(qtd_ocorrencias)
      : HORIZONTE_OCORRENCIAS_INDETERMINADA;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Primeira ocorrência (o "modelo" da série, referenciado pelas demais)
      const primeiraData = calcularDataOcorrencia(hoje, dia_vencimento, mesesPorPeriodo, 0);
      const [resultModelo] = await conn.query(
        `INSERT INTO despesas
           (usuario_id, rateada, descricao, categoria, tipo, eh_recorrente, dia_vencimento, periodicidade, duracao_tipo, qtd_ocorrencias, valor, data_vencimento, status, observacao)
         VALUES (?, ?, ?, ?, 'Fixa', 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [rateada ? null : usuario_id, rateada ? 1 : 0, descricao, categoria, dia_vencimento, periodicidade, duracao_tipo, qtd_ocorrencias || null, valor, primeiraData, status, observacao || null]
      );
      const idModelo = resultModelo.insertId;
      if (rateada) await this.salvarRateios(conn, idModelo, valor, rateios);

      // Demais ocorrências futuras, vinculadas ao modelo via despesa_origem_id
      const linhasOcorrencias = [];
      for (let passo = 1; passo < totalOcorrencias; passo++) {
        const dataOcorrencia = calcularDataOcorrencia(hoje, dia_vencimento, mesesPorPeriodo, passo);
        linhasOcorrencias.push([
          rateada ? null : usuario_id, rateada ? 1 : 0, descricao, categoria, 'Fixa', 1, dia_vencimento, periodicidade, duracao_tipo, qtd_ocorrencias || null,
          valor, dataOcorrencia, status, observacao || null, idModelo
        ]);
      }

      if (linhasOcorrencias.length) {
        await conn.query(
          `INSERT INTO despesas
             (usuario_id, rateada, descricao, categoria, tipo, eh_recorrente, dia_vencimento, periodicidade, duracao_tipo, qtd_ocorrencias, valor, data_vencimento, status, observacao, despesa_origem_id)
           VALUES ?`,
          [linhasOcorrencias]
        );
        const [filhas] = await conn.query('SELECT id FROM despesas WHERE despesa_origem_id=?', [idModelo]);
        if (rateada) for (const filha of filhas) await this.salvarRateios(conn, filha.id, valor, rateios);
      }

      await conn.commit();
      return this.buscarPorId(idModelo);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async salvarRateios(conn, despesaId, valorTotal, rateios) {
    let divisoes = Array.isArray(rateios) ? rateios : [];
    if (!divisoes.length) {
      const [usuarios] = await conn.query('SELECT id FROM usuarios ORDER BY id LIMIT 2');
      divisoes = usuarios.map(u => ({ usuario_id:u.id, percentual:50 }));
    }
    const linhas = divisoes.map((r, i) => {
      const percentual = Number(r.percentual);
      const valor = i === divisoes.length - 1
        ? Number((Number(valorTotal) - divisoes.slice(0, -1).reduce((s,x) => s + Number(valorTotal)*Number(x.percentual)/100, 0)).toFixed(2))
        : Number((Number(valorTotal)*percentual/100).toFixed(2));
      return [despesaId, r.usuario_id, percentual, valor];
    });
    if (linhas.length) await conn.query('INSERT INTO despesa_rateios (despesa_id, usuario_id, percentual, valor) VALUES ?', [linhas]);
  },

  async atualizar(id, dados) {
    const atual = await this.buscarPorId(id);
    const { usuario_id, descricao, categoria, tipo, valor, data_vencimento, status, observacao, rateada, rateios } = { ...atual, ...dados };
    const conn=await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`UPDATE despesas SET usuario_id=?,rateada=?,descricao=?,categoria=?,tipo=?,valor=?,data_vencimento=?,status=?,observacao=? WHERE id=?`,
        [rateada?null:usuario_id,rateada?1:0,descricao,categoria,tipo,valor,data_vencimento||atual.data_vencimento,status,observacao||null,id]);
      await conn.query('DELETE FROM despesa_rateios WHERE despesa_id=?',[id]);
      if(rateada) await this.salvarRateios(conn,id,valor,rateios);
      await conn.commit();
    } catch(err){await conn.rollback();throw err;} finally{conn.release();}
    return this.buscarPorId(id);
  },

  async excluir(id) {
    await db.query('DELETE FROM despesas WHERE id = ?', [id]);
    return true;
  },

  async excluirEmLote(ids) {
    const lista = [...new Set(ids.map(Number).filter(Number.isInteger))];
    if (!lista.length) return 0;
    const [result] = await db.query(`DELETE FROM despesas WHERE id IN (${lista.map(()=>'?').join(',')})`, lista);
    return result.affectedRows;
  },

  // Atualiza automaticamente despesas pendentes vencidas para "Atrasado"
  async atualizarStatusAtrasados() {
    await db.query(
      `UPDATE despesas SET status = 'Atrasado'
       WHERE status = 'Pendente' AND data_vencimento < CURDATE()`
    );
  },

  async totalPorPeriodo(mes, ano, usuario_id = null) {
    let sql = `
      SELECT COALESCE(SUM(valor),0) AS total
      FROM despesas
      WHERE MONTH(data_vencimento) = ? AND YEAR(data_vencimento) = ?
    `;
    const params = [mes, ano];
    if (usuario_id) {
      sql += ' AND usuario_id = ?';
      params.push(usuario_id);
    }
    const [rows] = await db.query(sql, params);
    return Number(rows[0].total);
  },

  async totalFixasPorPeriodo(mes, ano) {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(valor),0) AS total FROM despesas
       WHERE tipo = 'Fixa' AND MONTH(data_vencimento) = ? AND YEAR(data_vencimento) = ?`,
      [mes, ano]
    );
    return Number(rows[0].total);
  },

  // Média mensal de despesas fixas dos últimos N meses (base para projeção)
  async mediaFixasMensal(meses = 3) {
    const [rows] = await db.query(
      `SELECT COALESCE(AVG(total_mes),0) AS media FROM (
         SELECT SUM(valor) AS total_mes
         FROM despesas
         WHERE tipo = 'Fixa' AND data_vencimento >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
         GROUP BY YEAR(data_vencimento), MONTH(data_vencimento)
       ) AS sub`,
      [meses]
    );
    return Number(rows[0].media);
  },

  // Média mensal de TODAS as despesas dos últimos N meses (fixa + variável — base real para projeção)
  async mediaTotalMensal(meses = 3) {
    const [rows] = await db.query(
      `SELECT COALESCE(AVG(total_mes),0) AS media FROM (
         SELECT SUM(valor) AS total_mes
         FROM despesas
         WHERE data_vencimento >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
         GROUP BY YEAR(data_vencimento), MONTH(data_vencimento)
       ) AS sub`,
      [meses]
    );
    return Number(rows[0].media);
  },

  async porCategoriaNoMes(mes, ano) {
    const [rows] = await db.query(
      `SELECT categoria, COALESCE(SUM(valor),0) AS total
       FROM despesas
       WHERE MONTH(data_vencimento) = ? AND YEAR(data_vencimento) = ?
       GROUP BY categoria
       ORDER BY total DESC`,
      [mes, ano]
    );
    return rows;
  },

  async proximasContas(limite = 10) {
    const [rows] = await db.query(
      `SELECT d.*, u.nome AS usuario_nome, u.cor AS usuario_cor
       FROM despesas d
       LEFT JOIN usuarios u ON u.id = d.usuario_id
       WHERE d.status IN ('Pendente','Atrasado')
       ORDER BY d.data_vencimento ASC
       LIMIT ?`,
      [limite]
    );
    return rows;
  }
};

module.exports = DespesaModel;
