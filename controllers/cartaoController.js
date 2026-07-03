// =====================================================================
// CONTROLLER: Cartões
// =====================================================================
const CartaoModel = require('../models/cartaoModel');
const { normalizarPeriodo } = require('../utils/periodo');

const CartaoController = {
  async listar(req, res) {
    try {
      const periodo = normalizarPeriodo(req.query);
      const cartoes = await CartaoModel.listar(periodo);
      res.json({ sucesso: true, dados: cartoes });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar cartões.', erro: err.message });
    }
  },

  async buscar(req, res) {
    try {
      const cartao = await CartaoModel.buscarPorId(req.params.id);
      if (!cartao) return res.status(404).json({ sucesso: false, mensagem: 'Cartão não encontrado.' });
      res.json({ sucesso: true, dados: cartao });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar cartão.', erro: err.message });
    }
  },

  async criar(req, res) {
    try {
      const { nome_cartao, banco, dia_fechamento, dia_vencimento } = req.body;
      if (!nome_cartao || !banco || !dia_fechamento || !dia_vencimento) {
        return res.status(400).json({ sucesso: false, mensagem: 'Campos obrigatórios não preenchidos.' });
      }
      const cartao = await CartaoModel.criar(req.body);
      res.status(201).json({ sucesso: true, dados: cartao, mensagem: 'Cartão cadastrado com sucesso.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao cadastrar cartão.', erro: err.message });
    }
  },

  async atualizar(req, res) {
    try {
      const existente = await CartaoModel.buscarPorId(req.params.id);
      if (!existente) return res.status(404).json({ sucesso: false, mensagem: 'Cartão não encontrado.' });
      const cartao = await CartaoModel.atualizar(req.params.id, req.body);
      res.json({ sucesso: true, dados: cartao, mensagem: 'Cartão atualizado com sucesso.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar cartão.', erro: err.message });
    }
  },

  async listarFatura(req, res) {
    try {
      const periodo = normalizarPeriodo(req.query);
      const dados = await CartaoModel.listarFatura(req.params.id, periodo);
      res.json({ sucesso: true, dados });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar fatura.', erro: err.message });
    }
  },

  async excluir(req, res) {
    try {
      const existente = await CartaoModel.buscarPorId(req.params.id);
      if (!existente) return res.status(404).json({ sucesso: false, mensagem: 'Cartão não encontrado.' });
      await CartaoModel.excluir(req.params.id);
      res.json({ sucesso: true, mensagem: 'Cartão excluído com sucesso.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao excluir cartão.', erro: err.message });
    }
  }
};

module.exports = CartaoController;
