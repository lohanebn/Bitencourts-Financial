function normalizarPeriodo(query = {}) {
  const hoje = new Date();
  const tipo = query.periodo || (query.mes && query.ano ? 'mes' : 'mes');
  let inicio;
  let fim;

  if (tipo === 'todo') return { tipo, inicio: null, fim: null };
  if (tipo === 'personalizado') {
    inicio = query.data_inicio || null;
    fim = query.data_fim || null;
  } else if (tipo === 'ano') {
    const ano = Number(query.ano) || hoje.getFullYear();
    inicio = `${ano}-01-01`;
    fim = `${ano}-12-31`;
  } else {
    const ano = Number(query.ano) || hoje.getFullYear();
    const mes = Number(query.mes) || hoje.getMonth() + 1;
    inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    fim = new Date(ano, mes, 0).toISOString().slice(0, 10);
  }
  return { tipo, inicio, fim };
}

function aplicarPeriodo(sql, params, coluna, periodo) {
  if (periodo.inicio) { sql += ` AND ${coluna} >= ?`; params.push(periodo.inicio); }
  if (periodo.fim) { sql += ` AND ${coluna} <= ?`; params.push(periodo.fim); }
  return sql;
}

module.exports = { normalizarPeriodo, aplicarPeriodo };
