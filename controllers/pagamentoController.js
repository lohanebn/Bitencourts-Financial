const PagamentoModel = require('../models/pagamentoModel');
const { normalizarPeriodo } = require('../utils/periodo');
const { registrarAcao } = require('../utils/auditoria');

module.exports = {
  async listar(req, res) {
    try {
      const periodo = normalizarPeriodo(req.query);
      res.json({ sucesso: true, dados: {
        pendentes: await PagamentoModel.listarPendentes(periodo, req.query.origem || null),
        historico:  await PagamentoModel.listarHistorico(periodo)
      }});
    } catch (err) { res.status(500).json({ sucesso:false, mensagem:'Erro ao listar pagamentos.', erro:err.message }); }
  },

  async listarHistorico(req, res) {
    try {
      const periodo = normalizarPeriodo(req.query);
      const historico = await PagamentoModel.listarHistorico(periodo);
      res.json({ sucesso: true, dados: historico });
    } catch (err) { res.status(500).json({ sucesso:false, mensagem:'Erro ao listar histórico.', erro:err.message }); }
  },

  async registrar(req, res) {
    try {
      const { origem_tipo, origem_id, valor_pago, data_pagamento } = req.body;
      if (!origem_tipo || !origem_id || !valor_pago || !data_pagamento)
        return res.status(400).json({ sucesso:false, mensagem:'Preencha os campos obrigatórios.' });
      const dados = await PagamentoModel.registrar(req.body);
      await registrarAcao(req, 'Registro de pagamento', `Pagamento registrado: ${dados.origem_tipo} #${dados.origem_id} valor ${dados.valor_pago}`);
      res.status(201).json({ sucesso:true, dados, mensagem:'Pagamento registrado e saldos atualizados.' });
    } catch (err) { res.status(400).json({ sucesso:false, mensagem:'Erro ao registrar pagamento.', erro:err.message }); }
  },

  async pagarFatura(req, res) {
    try {
      const { cartao_id, data_vencimento, data_pagamento } = req.body;
      if (!cartao_id || !data_vencimento || !data_pagamento)
        return res.status(400).json({ sucesso:false, mensagem:'cartao_id, data_vencimento e data_pagamento são obrigatórios.' });
      const dados = await PagamentoModel.pagarCartaoFatura(req.body);
      await registrarAcao(req, 'Pagamento de fatura', `Fatura de cartão paga: cartão ${req.body.cartao_id}, valor ${req.body.valor_pago}`);
      res.status(201).json({ sucesso:true, dados, mensagem:'Fatura paga com sucesso.' });
    } catch (err) { res.status(400).json({ sucesso:false, mensagem:'Erro ao pagar fatura.', erro:err.message }); }
  },

  async estornar(req, res) {
    try {
      const dados = await PagamentoModel.estornar(req.params.id);
      await registrarAcao(req, 'Estorno de pagamento', `Pagamento estornado: ${req.params.id}`);
      res.json({ sucesso:true, dados, mensagem:'Baixa estornada com sucesso.' });
    } catch (err) { res.status(400).json({ sucesso:false, mensagem:'Erro ao estornar baixa.', erro:err.message }); }
  }
};
