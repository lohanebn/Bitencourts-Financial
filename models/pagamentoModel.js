const db = require('../config/database');
const { aplicarPeriodo } = require('../utils/periodo');

const PagamentoModel = {
  async buscarPorId(id) {
    const [rows] = await db.query('SELECT * FROM pagamentos WHERE id = ?', [id]);
    return rows[0];
  },

  async listarPendentes(periodo, origem = null) {
    const isAll = !origem || origem === 'Todas';
    const tiposNCC = ['Empréstimo','Financiamento','Consórcio','Boleto Parcelado','Acordo de Dívida','Outro'];
    let despesasArr = [], pnccArr = [], pccArr = [];

    // Despesas pendentes
    if (isAll || origem === 'Despesas') {
      const pD = [];
      let sqlD = `SELECT 'Despesa' origem_tipo, d.id origem_id, d.descricao,
        d.categoria tipo, d.data_vencimento, d.valor, d.valor_pago,
        GREATEST(d.valor-d.valor_pago,0) saldo_pendente, u.nome usuario_nome
        FROM despesas d LEFT JOIN usuarios u ON u.id=d.usuario_id
        WHERE d.status IN ('Pendente','Atrasado') AND d.valor>d.valor_pago`;
      sqlD = aplicarPeriodo(sqlD, pD, 'd.data_vencimento', periodo);
      const [despesas] = await db.query(sqlD, pD);
      despesasArr = despesas;
    }

    // Parcelas não-CC — individuais
    if (isAll || tiposNCC.includes(origem)) {
      const pNCC = [];
      let sqlNCC = `SELECT 'Parcela' origem_tipo, pa.id origem_id, p.descricao_compra descricao,
        p.tipo_obrigacao tipo, pa.data_vencimento, pa.valor, pa.valor_pago,
        GREATEST(pa.valor-pa.valor_pago,0) saldo_pendente, u.nome usuario_nome,
        pa.numero_parcela, pa.total_parcelas
        FROM parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id
        LEFT JOIN usuarios u ON u.id=pa.usuario_id
        WHERE pa.status='Pendente' AND pa.valor>pa.valor_pago AND p.tipo_obrigacao!='Cartão de Crédito'`;
      if (!isAll && origem) { sqlNCC += ' AND p.tipo_obrigacao=?'; pNCC.push(origem); }
      sqlNCC = aplicarPeriodo(sqlNCC, pNCC, 'pa.data_vencimento', periodo);
      const [pncc] = await db.query(sqlNCC, pNCC);
      pnccArr = pncc;
    }

    // Parcelas CC — agrupadas por cartão + mês/ano usando dia_vencimento do cartão
    if (isAll || origem === 'Cartão de Crédito') {
      const pCC = [];
      let sqlCC = `SELECT 'CartaoFatura' origem_tipo, p.cartao_id origem_id,
        CONCAT('Cartão ', MAX(COALESCE(c.nome_cartao,''))) descricao,
        'Cartão de Crédito' tipo,
        DATE(CONCAT(YEAR(MIN(pa.data_vencimento)),'-',LPAD(MONTH(MIN(pa.data_vencimento)),2,'0'),'-',LPAD(MAX(c.dia_vencimento),2,'0'))) data_vencimento,
        SUM(pa.valor) valor, SUM(pa.valor_pago) valor_pago,
        GREATEST(SUM(pa.valor)-SUM(pa.valor_pago),0) saldo_pendente,
        MAX(CASE WHEN c.rateado=1 OR p.rateado=1 THEN 'Casal' ELSE COALESCE(u.nome,'') END) usuario_nome,
        NULL numero_parcela, NULL total_parcelas
        FROM parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id
        LEFT JOIN usuarios u ON u.id=pa.usuario_id
        LEFT JOIN cartoes c ON c.id=p.cartao_id
        WHERE pa.status='Pendente' AND pa.valor>pa.valor_pago AND p.tipo_obrigacao='Cartão de Crédito'`;
      sqlCC = aplicarPeriodo(sqlCC, pCC, 'pa.data_vencimento', periodo);
      sqlCC += ' GROUP BY p.cartao_id, YEAR(pa.data_vencimento), MONTH(pa.data_vencimento)';
      const [pcc] = await db.query(sqlCC, pCC);
      pccArr = pcc;
    }

    return [...despesasArr, ...pnccArr, ...pccArr]
      .sort((a,b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)));
  },

  async listarHistorico(periodo, origem = null) {
    const params=[];
    // Junta com parcelas/parcelamentos só para conseguir filtrar por tipo_obrigacao (Empréstimo,
    // Financiamento, Consórcio...) — a coluna pagamentos.origem guarda a categoria escolhida pelo
    // usuário, não o tipo da obrigação, então não dá pra filtrar direto por ela.
    let sql=`SELECT pg.id,pg.data_pagamento,pg.descricao,pg.origem,pg.valor_pago,pg.responsavel,pg.origem_tipo,pg.origem_id
      FROM pagamentos pg
      LEFT JOIN parcelas pa ON pg.origem_tipo='Parcela' AND pa.id=pg.origem_id
      LEFT JOIN parcelamentos p ON p.id=pa.parcelamento_id
      WHERE 1=1`;
    if (origem === 'Despesas') {
      sql += ' AND pg.origem_tipo=\'Despesa\'';
    } else if (origem === 'Cartão de Crédito') {
      sql += ' AND pg.origem_tipo=\'CartaoFatura\'';
    } else if (origem) {
      sql += ' AND pg.origem_tipo=\'Parcela\' AND p.tipo_obrigacao=?';
      params.push(origem);
    }
    sql=aplicarPeriodo(sql,params,'pg.data_pagamento',periodo);
    sql+=' ORDER BY pg.data_pagamento DESC,pg.id DESC';
    const [rows]=await db.query(sql,params);
    return rows;
  },

  // Registra pagamento de fatura de cartão (agrupa todas as parcelas pendentes do cartão no período
  // numa ÚNICA linha de baixa — cada compra continua sendo quitada individualmente por baixo dos panos,
  // mas o histórico mostra "Fatura {cartão}" em vez de uma linha por compra).
  async pagarCartaoFatura({ cartao_id, data_vencimento, valor_pago, data_pagamento, observacao }) {
    if (!cartao_id || !data_vencimento) throw new Error('cartao_id e data_vencimento são obrigatórios.');
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [parcelas] = await conn.query(
        `SELECT pa.*, p.descricao_compra, p.tipo_obrigacao, c.nome_cartao,
          CASE WHEN c.rateado=1 THEN 'Casal' ELSE COALESCE(u.nome,'') END responsavel
         FROM parcelas pa
         JOIN parcelamentos p ON p.id=pa.parcelamento_id
         LEFT JOIN cartoes c ON c.id=p.cartao_id
         LEFT JOIN usuarios u ON u.id=pa.usuario_id
         WHERE p.cartao_id=? AND YEAR(pa.data_vencimento)=YEAR(?) AND MONTH(pa.data_vencimento)=MONTH(?) AND pa.status='Pendente'
         FOR UPDATE`,
        [cartao_id, data_vencimento, data_vencimento]
      );
      if (!parcelas.length) throw new Error('Nenhuma parcela pendente para esta fatura.');
      for (const pa of parcelas) {
        await conn.query(
          "UPDATE parcelas SET valor_pago=valor, status='Pago', data_pagamento=? WHERE id=?",
          [data_pagamento, pa.id]
        );
      }
      const total = parcelas.reduce((s,p)=>s+Number(p.valor),0);
      const responsaveis = [...new Set(parcelas.map(p=>p.responsavel))];
      const responsavel = responsaveis.length===1 ? responsaveis[0] : 'Casal';
      await conn.query(
        `INSERT INTO pagamentos (origem_tipo,origem_id,descricao,origem,responsavel,valor_devido,valor_pago,credito_gerado,data_pagamento,observacao,itens_relacionados)
         VALUES ('CartaoFatura',?,?,'Cartão de Crédito',?,?,?,0,?,?,?)`,
        [cartao_id, `Fatura ${parcelas[0].nome_cartao||''}`.trim(), responsavel, total, total, data_pagamento, observacao||null, JSON.stringify(parcelas.map(p=>p.id))]
      );
      await conn.commit();
      return { total_pago: total, qtd_parcelas: parcelas.length };
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
  },

  async registrar({ origem_tipo, origem_id, valor_pago, data_pagamento, observacao }) {
    const valorInformado = Number(valor_pago);
    if (!(valorInformado > 0)) throw new Error('O valor pago deve ser maior que zero.');
    const tabela = origem_tipo === 'Despesa' ? 'despesas' : 'parcelas';
    if (!['Despesa','Parcela'].includes(origem_tipo)) throw new Error('Origem de pagamento inválida.');
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(`SELECT * FROM ${tabela} WHERE id=? FOR UPDATE`, [origem_id]);
      if (!rows[0]) throw new Error('Obrigação não encontrada.');
      const item = rows[0];
      let descricaoPagamento, origemPagamento, responsavelPagamento;
      if(origem_tipo==='Despesa') {
        const [meta]=await conn.query(`SELECT d.descricao,d.categoria,CASE WHEN d.rateada=1 THEN 'Casal' ELSE u.nome END responsavel
          FROM despesas d LEFT JOIN usuarios u ON u.id=d.usuario_id WHERE d.id=?`,[origem_id]);
        descricaoPagamento=meta[0].descricao;origemPagamento=meta[0].categoria;responsavelPagamento=meta[0].responsavel;
      } else {
        const [meta]=await conn.query(`SELECT p.descricao_compra descricao,COALESCE(p.categoria,p.tipo_obrigacao) origem,
          CASE WHEN c.rateado=1 THEN 'Casal' ELSE COALESCE(u.nome,'') END responsavel
          FROM parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id
          LEFT JOIN cartoes c ON c.id=p.cartao_id
          LEFT JOIN usuarios u ON u.id=pa.usuario_id WHERE pa.id=?`,[origem_id]);
        descricaoPagamento=meta[0].descricao;origemPagamento=meta[0].origem;responsavelPagamento=meta[0].responsavel;
      }
      const saldo = Math.max(Number(item.valor) - Number(item.valor_pago || 0), 0);
      let disponivel = valorInformado;
      const aplicado = Math.min(disponivel, saldo);
      disponivel = Number((disponivel - aplicado).toFixed(2));
      const novoPago = Number(item.valor_pago || 0) + aplicado;
      const parcial = aplicado < saldo;
      if (parcial && origem_tipo === 'Parcela') {
        const restante = Number((saldo-aplicado).toFixed(2));
        const [prox] = await conn.query(`SELECT id FROM parcelas WHERE parcelamento_id=? AND numero_parcela>? ORDER BY numero_parcela LIMIT 1 FOR UPDATE`,[item.parcelamento_id,item.numero_parcela]);
        if (prox[0]) await conn.query('UPDATE parcelas SET valor=valor+? WHERE id=?',[restante,prox[0].id]);
        else await conn.query(`INSERT INTO parcelas(parcelamento_id,usuario_id,numero_parcela,total_parcelas,valor,valor_pago,data_vencimento,status)
          VALUES(?,?,?,?,?,0,DATE_ADD(?,INTERVAL 1 MONTH),'Pendente')`,[item.parcelamento_id,item.usuario_id,Number(item.numero_parcela)+1,Number(item.total_parcelas)+1,restante,item.data_vencimento]);
        await conn.query('UPDATE parcelas SET valor=?,valor_pago=?,status=\'Pago\',data_pagamento=? WHERE id=?',[novoPago,novoPago,data_pagamento,origem_id]);
      } else if (parcial && origem_tipo === 'Despesa') {
        const restante = Number((saldo-aplicado).toFixed(2));
        const novaData = new Date(`${item.data_vencimento}T12:00:00`); novaData.setMonth(novaData.getMonth()+1);
        const [complemento] = await conn.query(`INSERT INTO despesas(usuario_id,rateada,descricao,categoria,tipo,eh_recorrente,dia_vencimento,periodicidade,duracao_tipo,qtd_ocorrencias,despesa_origem_id,valor,valor_pago,data_vencimento,status,observacao)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,?,'Pendente',?)`,[item.usuario_id,item.rateada,item.descricao+' - Complemento',item.categoria,item.tipo,item.eh_recorrente,item.dia_vencimento,item.periodicidade,item.duracao_tipo,item.qtd_ocorrencias,item.despesa_origem_id||item.id,restante,novaData.toISOString().slice(0,10),item.observacao]);
        if(item.rateada) await conn.query(`INSERT INTO despesa_rateios(despesa_id,usuario_id,percentual,valor)
          SELECT ?,usuario_id,percentual,ROUND(?*percentual/100,2) FROM despesa_rateios WHERE despesa_id=?`,[complemento.insertId,restante,item.id]);
        await conn.query("UPDATE despesas SET valor=?,valor_pago=?,status='Pago' WHERE id=?",[novoPago,novoPago,origem_id]);
      } else if (origem_tipo === 'Despesa') {
        await conn.query("UPDATE despesas SET valor_pago=?, status='Pago' WHERE id=?",[novoPago,origem_id]);
      } else {
        await conn.query("UPDATE parcelas SET valor_pago=?, status='Pago', data_pagamento=? WHERE id=?",[novoPago,data_pagamento,origem_id]);
      }
      if (disponivel > 0 && origem_tipo === 'Parcela') {
        const [proximas] = await conn.query(`SELECT id, valor, valor_pago FROM parcelas
          WHERE parcelamento_id=? AND numero_parcela>? AND status='Pendente' ORDER BY numero_parcela FOR UPDATE`,
          [item.parcelamento_id, item.numero_parcela]);
        for (const proxima of proximas) {
          if (disponivel <= 0) break;
          const saldoProxima = Number(proxima.valor) - Number(proxima.valor_pago || 0);
          const abatimento = Math.min(disponivel, saldoProxima);
          const pagoProxima = Number(proxima.valor_pago || 0) + abatimento;
          disponivel = Number((disponivel - abatimento).toFixed(2));
          await conn.query('UPDATE parcelas SET valor_pago=?, status=?, data_pagamento=? WHERE id=?',
            [pagoProxima, pagoProxima >= Number(proxima.valor) ? 'Pago' : 'Pendente', pagoProxima >= Number(proxima.valor) ? data_pagamento : null, proxima.id]);
        }
      }
      if (disponivel > 0 && origem_tipo === 'Despesa') {
        const raiz=item.despesa_origem_id||item.id;
        const [proximas]=await conn.query(`SELECT id,valor,valor_pago FROM despesas WHERE id<>? AND status IN ('Pendente','Atrasado')
          AND (despesa_origem_id=? OR id=?) ORDER BY data_vencimento FOR UPDATE`,[item.id,raiz,raiz]);
        for(const proxima of proximas){if(disponivel<=0)break;const s=Number(proxima.valor)-Number(proxima.valor_pago||0);const a=Math.min(disponivel,s);const pago=Number(proxima.valor_pago||0)+a;disponivel=Number((disponivel-a).toFixed(2));await conn.query("UPDATE despesas SET valor_pago=?,status=? WHERE id=?",[pago,pago>=Number(proxima.valor)?'Pago':'Pendente',proxima.id]);}
      }
      await conn.query(`INSERT INTO pagamentos (origem_tipo,origem_id,descricao,origem,responsavel,valor_devido,valor_pago,credito_gerado,data_pagamento,observacao)
        VALUES (?,?,?,?,?,?,?,?,?,?)`, [origem_tipo, origem_id, descricaoPagamento, origemPagamento, responsavelPagamento, saldo, valorInformado, disponivel, data_pagamento, observacao || null]);
      await conn.commit();
      return { saldo_anterior: saldo, valor_pago: valorInformado, saldo_pendente: Math.max(saldo-aplicado,0), credito: disponivel };
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
  },

  // Estorna uma baixa: remove o registro e restaura o(s) lançamento(s) para Pendente
  async estornar(id) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM pagamentos WHERE id=?', [id]);
      if (!rows[0]) throw new Error('Pagamento não encontrado.');
      const pag = rows[0];

      // Baixa de fatura de cartão: uma única linha representa várias parcelas quitadas juntas
      // (sempre em cheio, nunca parcial), então reverter é devolver cada uma para Pendente.
      if (pag.origem_tipo === 'CartaoFatura') {
        const parcelaIds = JSON.parse(pag.itens_relacionados || '[]');
        for (const parcelaId of parcelaIds) {
          await conn.query(
            "UPDATE parcelas SET valor_pago=0, status='Pendente', data_pagamento=NULL WHERE id=?",
            [parcelaId]
          );
        }
        await conn.query('DELETE FROM pagamentos WHERE id=?', [id]);
        await conn.commit();
        return { mensagem: 'Baixa estornada com sucesso.' };
      }

      const tabela = pag.origem_tipo === 'Despesa' ? 'despesas' : 'parcelas';
      const [itemRows] = await conn.query(`SELECT * FROM ${tabela} WHERE id=? FOR UPDATE`, [pag.origem_id]);
      if (itemRows[0]) {
        const item = itemRows[0];
        const novoPago = Math.max(Number(item.valor_pago) - Number(pag.valor_pago), 0);
        const novoStatus = novoPago > 0 && novoPago >= Number(item.valor) ? 'Pago' : 'Pendente';
        if (tabela === 'despesas') {
          await conn.query('UPDATE despesas SET valor_pago=?, status=? WHERE id=?', [novoPago, novoStatus, pag.origem_id]);
        } else {
          await conn.query(
            'UPDATE parcelas SET valor_pago=?, status=?, data_pagamento=? WHERE id=?',
            [novoPago, novoStatus, novoStatus === 'Pago' ? item.data_pagamento : null, pag.origem_id]
          );
        }
      }
      await conn.query('DELETE FROM pagamentos WHERE id=?', [id]);
      await conn.commit();
      return { mensagem: 'Baixa estornada com sucesso.' };
    } catch (err) { await conn.rollback(); throw err; }
    finally { conn.release(); }
  }
};

module.exports = PagamentoModel;
