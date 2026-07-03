const AuditoriaModel = require('../models/auditoriaModel');
const { normalizarPeriodo } = require('../utils/periodo');

const AuditoriaController = {
  async listar(req, res) {
    try {
      const periodo = normalizarPeriodo(req.query);
      const limite = Math.min(100, Number(req.query.limite) || 20);
      const dados = await AuditoriaModel.listar({ limite, periodo });
      res.json({ sucesso: true, dados });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar auditoria.', erro: err.message });
    }
  }
};

module.exports = AuditoriaController;
