const AuditoriaModel = require('../models/auditoriaModel');

function extrairUsuarioNome(req) {
  return req?.usuario?.nome || req?.usuario_nome || null;
}

function extrairUsuarioId(req) {
  return req?.auth?.usuarioId || req?.usuario_id || req?.usuario?.id || null;
}

function humanizarCampo(campo) {
  const mapa = {
    descricao: 'Descrição',
    nome: 'Nome',
    nome_cartao: 'Nome do cartão',
    banco: 'Banco',
    dia_fechamento: 'Dia de fechamento',
    dia_vencimento: 'Dia de vencimento',
    valor: 'Valor',
    valor_total: 'Valor total',
    valor_parcela: 'Valor da parcela',
    valor_pago: 'Valor pago',
    valor_devido: 'Valor devido',
    categoria: 'Categoria',
    tipo: 'Tipo',
    tipo_obrigacao: 'Tipo de obrigação',
    status: 'Status',
    data_vencimento: 'Vencimento',
    data_recebimento: 'Data de recebimento',
    data_compra: 'Data da compra',
    data_pagamento: 'Data do pagamento',
    data_primeiro_vencimento: 'Primeiro vencimento',
    perfil: 'Perfil',
    ativo: 'Status',
    usuario_id: 'Responsável',
    usuario: 'Usuário',
    qtd_parcelas: 'Quantidade de parcelas',
    observacao: 'Observação',
    responsavel: 'Responsável',
    responsavel_texto: 'Responsável',
    senha: 'Senha',
    senha_hash: 'Senha hash'
  };

  if (mapa[campo]) return mapa[campo];
  return String(campo)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatarValorCampo(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';

  if (typeof valor === 'number') {
    if (/(valor|total|saldo|parcela|pago|devido|restante|custo|preco)/i.test(campo)) {
      return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    return valor.toLocaleString('pt-BR');
  }

  const texto = String(valor).trim();
  if (!texto) return '—';

  if (/(valor|total|saldo|parcela|pago|devido|restante|custo|preco)/i.test(campo)) {
    // Valores decimais vindos do banco chegam como string no formato SQL ("95.00"),
    // mas valores digitados em formulários podem vir no formato pt-BR ("1.234,56").
    let numero = Number(texto);
    if (Number.isNaN(numero) && texto.includes(',')) {
      numero = Number(texto.replace(/\./g, '').replace(',', '.'));
    }
    if (!Number.isNaN(numero)) {
      return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
  }

  if (/(data|venc|pagament|cri|em)/i.test(campo)) {
    const data = texto.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      const [ano, mes, dia] = data.split('-');
      return `${dia}/${mes}/${ano}`;
    }
  }

  return texto;
}

function montarResumoRegistro(registro, entidadeLabel) {
  const base = registro || {};
  const chaves = ['descricao', 'nome_cartao', 'nome', 'descricao_compra', 'tipo_obrigacao', 'usuario', 'categoria'];
  const principal = chaves.find((campo) => base[campo] !== null && base[campo] !== undefined && base[campo] !== '');
  if (!principal) return { titulo: entidadeLabel || 'Registro', valor: 'Registro afetado' };
  return { titulo: entidadeLabel || 'Registro', valor: formatarValorCampo(principal, base[principal]) };
}

function montarCamposResumo(registro, entidadeLabel) {
  const base = registro || {};
  const campos = [];
  const chavesPrioridade = ['valor', 'valor_total', 'valor_parcela', 'valor_pago', 'descricao', 'nome_cartao', 'nome', 'descricao_compra', 'categoria', 'data_vencimento', 'data_recebimento', 'status', 'perfil', 'ativo'];
  for (const campo of chavesPrioridade) {
    if (base[campo] !== null && base[campo] !== undefined && base[campo] !== '') {
      campos.push({ campo: humanizarCampo(campo), valor: formatarValorCampo(campo, base[campo]) });
    }
  }
  if (!campos.length) {
    Object.entries(base).slice(0, 4).forEach(([campo, valor]) => {
      campos.push({ campo: humanizarCampo(campo), valor: formatarValorCampo(campo, valor) });
    });
  }
  return campos.slice(0, 6);
}

function gerarDetalhesAlteracao(antes = {}, depois = {}, { entidade = 'registro', entidadeLabel = 'Registro', titulo = 'Atualizou um registro' } = {}) {
  const campos = new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]);
  const mudancas = [];

  for (const campo of campos) {
    if (['id', 'created_at', 'updated_at', 'criado_em', 'atualizado_em', 'senha', 'senha_hash', 'senhaHash', 'token', 'token_hash'].includes(campo)) {
      continue;
    }
    if (JSON.stringify(antes?.[campo]) === JSON.stringify(depois?.[campo])) {
      continue;
    }
    mudancas.push({
      campo: humanizarCampo(campo),
      de: formatarValorCampo(campo, antes?.[campo]),
      para: formatarValorCampo(campo, depois?.[campo])
    });
  }

  return {
    tipo: 'alteracao',
    entidade,
    entidadeLabel,
    titulo,
    mudancas,
    resumo: mudancas.length ? `${mudancas.slice(0, 2).map((item) => item.campo).join(', ')} ${mudancas.length > 2 ? 'e mais' : ''}` : 'Campos alterados',
    registro: montarResumoRegistro(depois || antes, entidadeLabel)
  };
}

function gerarDetalhesCadastro(entidade = 'registro', dados = {}, { entidadeLabel = 'Registro', titulo } = {}) {
  return {
    tipo: 'cadastro',
    entidade,
    entidadeLabel,
    titulo: titulo || `Cadastrou um ${entidadeLabel.toLowerCase()}`,
    campos: montarCamposResumo(dados, entidadeLabel),
    registro: montarResumoRegistro(dados, entidadeLabel)
  };
}

function gerarDetalhesExclusao(entidade = 'registro', registro = {}, { entidadeLabel = 'Registro', titulo, motivo = 'Registro removido' } = {}) {
  return {
    tipo: 'exclusao',
    entidade,
    entidadeLabel,
    titulo: titulo || `Excluiu ${entidadeLabel.toLowerCase()}`,
    campos: montarCamposResumo(registro, entidadeLabel),
    motivo,
    registro: montarResumoRegistro(registro, entidadeLabel)
  };
}

function gerarDetalhesExclusaoLote(entidade = 'registro', registros = [], { entidadeLabel = 'Registros', titulo, motivo = 'Registros removidos em lote' } = {}) {
  const campos = registros.map((registro, indice) => {
    const resumo = montarResumoRegistro(registro, entidadeLabel);
    return { campo: `Item ${indice + 1}`, valor: resumo.valor };
  });
  return {
    tipo: 'exclusao',
    entidade,
    entidadeLabel,
    titulo: titulo || `Excluiu ${registros.length} ${entidadeLabel.toLowerCase()}(s)`,
    campos,
    motivo,
    registro: { titulo: entidadeLabel, valor: `${registros.length} registro(s)` }
  };
}

function serializarDetalhes(detalhes) {
  if (!detalhes) return null;
  if (typeof detalhes === 'string') return detalhes;
  return JSON.stringify(detalhes);
}

function parsearDetalhes(detalhes) {
  if (!detalhes) return null;
  if (typeof detalhes === 'object') return detalhes;
  if (typeof detalhes === 'string') {
    try {
      return JSON.parse(detalhes);
    } catch (err) {
      return null;
    }
  }
  return null;
}

async function registrarAcao(req, tipoAcao, descricao, detalhes = null) {
  try {
    const usuarioId = extrairUsuarioId(req);
    const usuarioNome = extrairUsuarioNome(req);
    await AuditoriaModel.registrar({
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      tipo_acao: tipoAcao,
      descricao,
      detalhes: serializarDetalhes(detalhes)
    });
  } catch (err) {
    console.error('Falha ao registrar auditoria:', err.message);
  }
}

module.exports = {
  registrarAcao,
  gerarDetalhesAlteracao,
  gerarDetalhesCadastro,
  gerarDetalhesExclusao,
  gerarDetalhesExclusaoLote,
  parsearDetalhes
};
