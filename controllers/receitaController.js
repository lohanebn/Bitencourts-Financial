// =====================================================================
// CONTROLLER: Receitas
// =====================================================================
const ReceitaModel = require('../models/receitaModel');
const { registrarAcao } = require('../utils/auditoria');

const ReceitaController = {
  async listar(req, res) {
    try {
      const { usuario_id, categoria, mes, ano, data_inicio, data_fim } = req.query;
      const receitas = await ReceitaModel.listar({ usuario_id, categoria, mes, ano, data_inicio, data_fim });
      res.json({ sucesso: true, dados: receitas });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar receitas.', erro: err.message });
    }
  },

  async buscar(req, res) {
    try {
      const receita = await ReceitaModel.buscarPorId(req.params.id);
      if (!receita) return res.status(404).json({ sucesso: false, mensagem: 'Receita não encontrada.' });
      res.json({ sucesso: true, dados: receita });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar receita.', erro: err.message });
    }
  },

  async criar(req, res) {
    try {
      const { usuario_id, descricao, categoria, valor, data_recebimento } = req.body;
      if (!usuario_id || !descricao || !valor || !data_recebimento) {
        return res.status(400).json({ sucesso: false, mensagem: 'Campos obrigatórios não preenchidos.' });
      }
      const receita = await ReceitaModel.criar(req.body);
      await registrarAcao(req, 'Cadastro de receita', `Receita cadastrada: ${req.body.descricao || 'sem descrição'}`);
      res.status(201).json({ sucesso: true, dados: receita, mensagem: 'Receita cadastrada com sucesso.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao cadastrar receita.', erro: err.message });
    }
  },

  async atualizar(req, res) {
    try {
      const existente = await ReceitaModel.buscarPorId(req.params.id);
      if (!existente) return res.status(404).json({ sucesso: false, mensagem: 'Receita não encontrada.' });
      const receita = await ReceitaModel.atualizar(req.params.id, req.body);
      await registrarAcao(req, 'Atualização de receita', `Receita atualizada: ${receita.descricao}`);
      res.json({ sucesso: true, dados: receita, mensagem: 'Receita atualizada com sucesso.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar receita.', erro: err.message });
    }
  },

  async excluir(req, res) {
    try {
      const existente = await ReceitaModel.buscarPorId(req.params.id);
      if (!existente) return res.status(404).json({ sucesso: false, mensagem: 'Receita não encontrada.' });
      await ReceitaModel.excluir(req.params.id);
      await registrarAcao(req, 'Exclusão de receita', `Receita excluída: ${existente.descricao}`);
      res.json({ sucesso: true, mensagem: 'Receita excluída com sucesso.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao excluir receita.', erro: err.message });
    }
  }
};

module.exports = ReceitaController;
