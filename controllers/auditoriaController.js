const AuditoriaModel = require('../models/auditoriaModel');
const { normalizarPeriodo } = require('../utils/periodo');

const AuditoriaController = {
  async listar(req, res) {
    try {
      const periodo = normalizarPeriodo(req.query);
      const limite = Math.min(100, Number(req.query.limite) || 20);
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const tipo_acao = req.query.tipo_acao || null;
      const usuario_id = req.query.usuario_id || null;
      const dados = await AuditoriaModel.listar({ limite, offset, periodo, tipo_acao, usuario_id });
      res.json({ sucesso: true, dados, paginacao: { limite, offset, temMais: dados.length === limite } });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar auditoria.', erro: err.message });
    }
  }
};

module.exports = AuditoriaController;
