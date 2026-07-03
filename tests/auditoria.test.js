const test = require('node:test');
const assert = require('node:assert/strict');
const { gerarDetalhesAlteracao, gerarDetalhesCadastro, gerarDetalhesExclusao, gerarDetalhesExclusaoLote } = require('../utils/auditoria');

test('gera detalhes de alteração com campos modificados', () => {
  const detalhes = gerarDetalhesAlteracao(
    { descricao: 'Enel', valor: 95, categoria: 'Mercado' },
    { descricao: 'Enel', valor: 57, categoria: 'Energia' },
    { entidade: 'despesa', entidadeLabel: 'Despesa' }
  );

  assert.equal(detalhes.tipo, 'alteracao');
  assert.equal(detalhes.entidade, 'despesa');
  assert.equal(detalhes.mudancas.length, 2);
  assert.deepEqual(detalhes.mudancas.map(item => item.campo), ['Valor', 'Categoria']);
});

test('gera detalhes de cadastro com campos principais', () => {
  const detalhes = gerarDetalhesCadastro('despesa', { descricao: 'Supermercado', valor: 120, categoria: 'Mercado' }, { entidadeLabel: 'Despesa' });

  assert.equal(detalhes.tipo, 'cadastro');
  assert.equal(detalhes.entidade, 'despesa');
  assert.equal(detalhes.campos[0].campo, 'Valor');
  assert.match(detalhes.campos[0].valor, /R\$\s*120,00/);
});

test('gera detalhes de exclusão com motivo padrão', () => {
  const detalhes = gerarDetalhesExclusao('despesa', { descricao: 'Enel', valor: 57, categoria: 'Energia' }, { entidadeLabel: 'Despesa' });

  assert.equal(detalhes.tipo, 'exclusao');
  assert.equal(detalhes.motivo, 'Registro removido');
  assert.equal(detalhes.campos[0].campo, 'Valor');
});

test('gera detalhes de exclusão em lote com um campo por registro', () => {
  const detalhes = gerarDetalhesExclusaoLote('despesa', [
    { descricao: 'Enel', valor: 57 },
    { descricao: 'Água', valor: 80 }
  ], { entidadeLabel: 'Despesas' });

  assert.equal(detalhes.tipo, 'exclusao');
  assert.equal(detalhes.motivo, 'Registros removidos em lote');
  assert.equal(detalhes.campos.length, 2);
  assert.deepEqual(detalhes.campos.map(item => item.valor), ['Enel', 'Água']);
});
