const db = require('../config/database');
const UsuarioModel = require('../models/usuarioModel');
const ReceitaModel = require('../models/receitaModel');
const ParcelamentoModel = require('../models/parcelamentoModel');
const DespesaModel = require('../models/despesaModel');
const { normalizarPeriodo, aplicarPeriodo } = require('../utils/periodo');

// Soma o valor total (cheio), independente do status — usada para "Despesas do Mês"
// e para o Saldo Previsto, que representam planejamento e não podem variar com baixas.
async function somaTotalPeriodo(tabela, coluna, periodo) {
  const params = [];
  let sql = `SELECT COALESCE(SUM(valor),0) total FROM ${tabela} WHERE 1=1`;
  sql = aplicarPeriodo(sql, params, coluna, periodo);
  const [rows] = await db.query(sql, params);
  return Number(rows[0].total);
}

// Soma o valor já pago (valor_pago) — usada para os indicadores "Pago" e para o
// Saldo Disponível, que é o único indicador que deve variar conforme as baixas.
async function somaPagoPeriodo(tabela, coluna, periodo) {
  const params = [];
  let sql = `SELECT COALESCE(SUM(valor_pago),0) total FROM ${tabela} WHERE 1=1`;
  sql = aplicarPeriodo(sql, params, coluna, periodo);
  const [rows] = await db.query(sql, params);
  return Number(rows[0].total);
}

// Soma receitas já efetivamente recebidas (data de recebimento até hoje) dentro do período.
async function receitasRecebidasPeriodo(periodo) {
  const params = [];
  let sql = `SELECT COALESCE(SUM(valor),0) total FROM receitas WHERE data_recebimento <= CURDATE()`;
  sql = aplicarPeriodo(sql, params, 'data_recebimento', periodo);
  const [rows] = await db.query(sql, params);
  return Number(rows[0].total);
}

module.exports = { async resumo(req,res) {
  try {
    await DespesaModel.atualizarStatusAtrasados();
    const periodo=normalizarPeriodo(req.query);
    const receitaTotal=await ReceitaModel.totalPorIntervalo(periodo.inicio,periodo.fim);

    // Despesas do Mês: valor total previsto para o período, independente do status
    // (pago, pendente ou atrasado) — inclui despesas avulsas/fixas e parcelas
    // (empréstimos, financiamentos e cartão de crédito).
    const despesasMesTotal=await somaTotalPeriodo('despesas','data_vencimento',periodo);
    const parcelasMesTotal=await somaTotalPeriodo('parcelas','data_vencimento',periodo);
    const despesaTotal=despesasMesTotal+parcelasMesTotal;

    // Quanto desse total já foi pago / ainda está em aberto (indicadores auxiliares)
    const despesasPagoMes=await somaPagoPeriodo('despesas','data_vencimento',periodo);
    const parcelasPagoMes=await somaPagoPeriodo('parcelas','data_vencimento',periodo);
    const despesaPagoMes=despesasPagoMes+parcelasPagoMes;
    const despesaPendenteMes=Math.max(despesaTotal-despesaPagoMes,0);

    // Saldo Previsto = planejamento do mês. Usa o total previsto de despesas (acima),
    // então registrar ou desfazer uma baixa nunca altera este valor.
    const saldoPrevisto=receitaTotal-despesaTotal;

    // Saldo Disponível = fluxo de caixa real (o único indicador que varia com as baixas).
    const receitasRecebidas=await receitasRecebidasPeriodo(periodo);
    const saldoDisponivel=receitasRecebidas-despesaPagoMes;

    // Resumo por pessoa — inclui parcelas de cartões rateados (50/50)
    const usuarios=await UsuarioModel.listarTodos();
    const resumoPorPessoa=[];
    for (const u of usuarios) {
      const receita=await ReceitaModel.totalPorIntervalo(periodo.inicio,periodo.fim,u.id);

      // Despesas pessoais (com suporte a rateio)
      const pdp=[u.id,u.id];
      let sdp=`SELECT COALESCE(SUM(CASE WHEN d.rateada=1 THEN dr.valor ELSE d.valor END),0) total
        FROM despesas d LEFT JOIN despesa_rateios dr ON dr.despesa_id=d.id AND dr.usuario_id=?
        WHERE (d.usuario_id=? OR dr.usuario_id IS NOT NULL)`;
      sdp=aplicarPeriodo(sdp,pdp,'d.data_vencimento',periodo);
      const [rdp]=await db.query(sdp,pdp);
      const despesa=Number(rdp[0].total);

      // Parcelas: próprias (cartão não rateado) + metade dos cartões Casal
      const ppp=[u.id];
      let spp=`SELECT COALESCE(SUM(
        CASE WHEN c.rateado=1 OR p.rateado=1 THEN pa.valor/2 ELSE pa.valor END
      ),0) total
      FROM parcelas pa
      JOIN parcelamentos p ON p.id=pa.parcelamento_id
      LEFT JOIN cartoes c ON c.id=p.cartao_id
      WHERE (
        (pa.usuario_id=? AND (c.rateado IS NULL OR c.rateado=0) AND (p.rateado IS NULL OR p.rateado=0))
        OR c.rateado=1
        OR p.rateado=1
      )`;
      spp=aplicarPeriodo(spp,ppp,'pa.data_vencimento',periodo);
      const [rpp]=await db.query(spp,ppp);
      const parcelas_pessoa=Number(rpp[0].total);

      const total_despesa=despesa+parcelas_pessoa;
      resumoPorPessoa.push({pessoa:u.nome,cor:u.cor,receita,despesa:total_despesa,saldo:receita-total_despesa});
    }

    // Próximas contas — despesas pendentes
    const dp=[];
    let dsql=`SELECT d.id,d.descricao,d.categoria,d.data_vencimento,d.valor,COALESCE(u.nome,'Casal') usuario_nome,
      COALESCE(u.cor,'#4A7FE8') usuario_cor,'Despesa' tipo_obrigacao FROM despesas d LEFT JOIN usuarios u ON u.id=d.usuario_id
      WHERE d.status IN ('Pendente','Atrasado')`;
    if(periodo.tipo==='todo') dsql+=' AND d.data_vencimento>=CURDATE()'; else dsql=aplicarPeriodo(dsql,dp,'d.data_vencimento',periodo);
    const [despesas]=await db.query(dsql,dp);

    // Parcelas CC agrupadas por cartão + vencimento
    const pp_cc=[];
    let psql_cc=`SELECT MIN(pa.id) id,
      CONCAT('Cartão ', MAX(COALESCE(c.nome_cartao,''))) descricao,
      'Cartão de Crédito' categoria,
      DATE(CONCAT(YEAR(MIN(pa.data_vencimento)),'-',LPAD(MONTH(MIN(pa.data_vencimento)),2,'0'),'-',LPAD(MAX(c.dia_vencimento),2,'0'))) data_vencimento,
      SUM(pa.valor) valor,
      MAX(CASE WHEN c.rateado=1 OR p.rateado=1 THEN 'Casal' ELSE COALESCE(u.nome,'') END) usuario_nome,
      MAX(CASE WHEN c.rateado=1 OR p.rateado=1 THEN '#4A7FE8' ELSE COALESCE(u.cor,'#888') END) usuario_cor,
      'Cartão de Crédito' tipo_obrigacao
      FROM parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id
      LEFT JOIN usuarios u ON u.id=pa.usuario_id
      LEFT JOIN cartoes c ON c.id=p.cartao_id
      WHERE pa.status='Pendente' AND p.tipo_obrigacao='Cartão de Crédito'`;
    if(periodo.tipo==='todo') psql_cc+=' AND pa.data_vencimento>=CURDATE()';
    else psql_cc=aplicarPeriodo(psql_cc,pp_cc,'pa.data_vencimento',periodo);
    psql_cc+=' GROUP BY p.cartao_id, YEAR(pa.data_vencimento), MONTH(pa.data_vencimento)';
    const [parcelas_cc]=await db.query(psql_cc,pp_cc);

    // Parcelas não-CC individuais
    const pp_ncc=[];
    let psql_ncc=`SELECT pa.id, p.descricao_compra descricao, p.tipo_obrigacao categoria,
      pa.data_vencimento, pa.valor,
      COALESCE(u.nome,'') usuario_nome, COALESCE(u.cor,'#888') usuario_cor, p.tipo_obrigacao
      FROM parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id
      LEFT JOIN usuarios u ON u.id=pa.usuario_id
      WHERE pa.status='Pendente' AND p.tipo_obrigacao!='Cartão de Crédito'`;
    if(periodo.tipo==='todo') psql_ncc+=' AND pa.data_vencimento>=CURDATE()';
    else psql_ncc=aplicarPeriodo(psql_ncc,pp_ncc,'pa.data_vencimento',periodo);
    const [parcelas_ncc]=await db.query(psql_ncc,pp_ncc);

    // Despesas por categoria — considera apenas os valores em aberto e pendentes
    const cp=[];
    let csql=`SELECT categoria,SUM(total) total FROM (SELECT categoria,GREATEST(COALESCE(valor,0)-COALESCE(valor_pago,0),0) total FROM despesas WHERE status IN ('Pendente','Atrasado') AND 1=1`;
    csql=aplicarPeriodo(csql,cp,'data_vencimento',periodo);
    csql+=` UNION ALL SELECT CASE WHEN p.cartao_id IS NOT NULL THEN 'Cartão' ELSE p.tipo_obrigacao END categoria,GREATEST(COALESCE(pa.valor,0)-COALESCE(pa.valor_pago,0),0) total FROM parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id WHERE pa.status='Pendente' AND 1=1`;
    csql=aplicarPeriodo(csql,cp,'pa.data_vencimento',periodo);
    csql+=`) _cat GROUP BY categoria ORDER BY total DESC`;
    const [despesasPorCategoria]=await db.query(csql,cp);

    const ccp=[];
    let ccsql=`SELECT COALESCE(NULLIF(p.categoria,''),'Cartão') categoria,COALESCE(SUM(GREATEST(COALESCE(pa.valor,0)-COALESCE(pa.valor_pago,0),0)),0) total
      FROM parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id
      WHERE p.cartao_id IS NOT NULL AND pa.status='Pendente'`;
    ccsql=aplicarPeriodo(ccsql,ccp,'pa.data_vencimento',periodo);
    ccsql+=` GROUP BY categoria ORDER BY total DESC`;
    const [despesasCartaoPorCategoria]=await db.query(ccsql,ccp);

    const proximasContas=[...despesas,...parcelas_cc,...parcelas_ncc]
      .sort((a,b)=>String(a.data_vencimento).localeCompare(String(b.data_vencimento)));

    const comprometimentos={};
    for(const meses of [1,3,12]) {
      const [r]=await db.query(`SELECT
        (SELECT COALESCE(SUM(valor-valor_pago),0) FROM despesas WHERE status IN ('Pendente','Atrasado') AND data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL ? MONTH))+
        (SELECT COALESCE(SUM(valor-valor_pago),0) FROM parcelas WHERE status='Pendente' AND data_vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL ? MONTH)) total`,[meses,meses]);
      comprometimentos[meses]=Number(r[0].total);
    }

    // Centro de Alertas: vencidas (qualquer data no passado), vencem hoje e vencem nos
    // próximos 7 dias — sempre ignorando lançamentos já pagos. A prioridade é calculada
    // a partir da data final já unificada, então ordenar por data_vencimento já entrega
    // vencidas (mais antigas primeiro) → hoje → próximos 7 dias, nesta ordem.
    const [alertasRows]=await db.query(`
      SELECT *,
        CASE WHEN data_vencimento < CURDATE() THEN 'vencida'
             WHEN data_vencimento = CURDATE() THEN 'hoje'
             ELSE 'proximos7' END AS prioridade
      FROM (
        SELECT d.descricao descricao, d.data_vencimento data_vencimento, d.valor valor,
          d.categoria categoria, COALESCE(u.nome,'Casal') usuario_nome, COALESCE(u.cor,'#4A7FE8') usuario_cor
        FROM despesas d LEFT JOIN usuarios u ON u.id=d.usuario_id
        WHERE d.status IN ('Pendente','Atrasado')

        UNION ALL

        SELECT p.descricao_compra, pa.data_vencimento, pa.valor,
          COALESCE(NULLIF(p.categoria,''), p.tipo_obrigacao) categoria,
          COALESCE(u.nome,'') usuario_nome, COALESCE(u.cor,'#888') usuario_cor
        FROM parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id
        LEFT JOIN usuarios u ON u.id=pa.usuario_id
        WHERE pa.status='Pendente' AND p.tipo_obrigacao!='Cartão de Crédito'

        UNION ALL

        SELECT CONCAT('Fatura ', MAX(COALESCE(c.nome_cartao,''))) descricao,
          DATE(CONCAT(YEAR(MIN(pa.data_vencimento)),'-',LPAD(MONTH(MIN(pa.data_vencimento)),2,'0'),'-',LPAD(MAX(c.dia_vencimento),2,'0'))) data_vencimento,
          SUM(pa.valor) valor,
          'Cartão de Crédito' categoria,
          MAX(CASE WHEN c.rateado=1 OR p.rateado=1 THEN 'Casal' ELSE COALESCE(u.nome,'') END) usuario_nome,
          MAX(CASE WHEN c.rateado=1 OR p.rateado=1 THEN '#4A7FE8' ELSE COALESCE(u.cor,'#888') END) usuario_cor
        FROM parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id
        LEFT JOIN usuarios u ON u.id=pa.usuario_id
        LEFT JOIN cartoes c ON c.id=p.cartao_id
        WHERE pa.status='Pendente' AND p.tipo_obrigacao='Cartão de Crédito'
        GROUP BY p.cartao_id, YEAR(pa.data_vencimento), MONTH(pa.data_vencimento)
      ) base
      WHERE data_vencimento <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      ORDER BY data_vencimento ASC
    `);
    const resumoAlertas={
      vencidas: alertasRows.filter(a=>a.prioridade==='vencida').length,
      hoje: alertasRows.filter(a=>a.prioridade==='hoje').length,
      proximos7: alertasRows.filter(a=>a.prioridade==='proximos7').length
    };

    const [saldoRows]=await db.query(`SELECT
      (SELECT COALESCE(SUM(valor),0) FROM receitas WHERE data_recebimento<=CURDATE())-
      (SELECT COALESCE(SUM(valor_pago),0) FROM despesas)-
      (SELECT COALESCE(SUM(valor_pago),0) FROM parcelas) saldo`);
    const saldoAtual=Number(saldoRows[0].saldo);
    const semaforo=saldoPrevisto<0?'vermelho':(receitaTotal>0&&saldoPrevisto/receitaTotal>.2?'verde':'amarelo');

    res.json({sucesso:true,dados:{periodo,
      cards:{
        receitaTotal,
        despesaTotal,despesaPagoMes,despesaPendenteMes,
        saldoPrevisto,
        receitasRecebidas,despesasPagas:despesaPagoMes,saldoDisponivel,
        parcelamentosFuturos:await ParcelamentoModel.totalParcelamentosFuturos()
      },
      semaforo,resumoPorPessoa,proximasContas,
      parcelamentosAtivos:await ParcelamentoModel.parcelasAtivasResumo(),
      despesasPorCategoria,despesasCartaoPorCategoria,
      alertas:{itens:alertasRows,resumo:resumoAlertas},
      comprometimentos,
      previsaoCaixa:{saldoAtual,proximosCompromissos:comprometimentos[1],saldoProjetado:saldoAtual-comprometimentos[1]}
    }});
  } catch(err){res.status(500).json({sucesso:false,mensagem:'Erro ao carregar dashboard.',erro:err.message});}
}};
