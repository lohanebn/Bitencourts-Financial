// =====================================================================
// CONTROLLER: Parcelamentos / Obrigações Parceladas (v2)
// =====================================================================
const ParcelamentoModel = require('../models/parcelamentoModel');
const { registrarAcao } = require('../utils/auditoria');

// Campos obrigatórios por tipo de obrigação
const CAMPOS_OBRIGATORIOS = {
  'Cartão de Crédito': ['usuario_id', 'cartao_id', 'descricao_compra', 'valor_total', 'qtd_parcelas', 'data_compra'],
  'Empréstimo':        ['usuario_id', 'responsavel_texto', 'descricao_compra', 'qtd_parcelas', 'valor_parcela', 'data_primeiro_vencimento'],
  'Financiamento':     ['usuario_id', 'responsavel_texto', 'descricao_compra', 'qtd_parcelas', 'valor_parcela', 'data_primeiro_vencimento'],
  'Consórcio':         ['usuario_id', 'responsavel_texto', 'descricao_compra', 'valor_parcela', 'qtd_parcelas', 'data_primeiro_vencimento'],
  'Boleto Parcelado':  ['usuario_id', 'responsavel_texto', 'descricao_compra', 'valor_total', 'qtd_parcelas', 'data_primeiro_vencimento'],
  'Acordo de Dívida':  ['usuario_id', 'descricao_compra', 'qtd_parcelas', 'valor_parcela', 'data_primeiro_vencimento'],
  'Outro':             ['usuario_id', 'descricao_compra', 'qtd_parcelas', 'valor_parcela', 'data_primeiro_vencimento'],
};

const TIPOS_VALIDOS = Object.keys(CAMPOS_OBRIGATORIOS);

const ParcelamentoController = {

  async listar(req, res) {
    try {
      const parcelamentos = await ParcelamentoModel.listar();
      res.json({ sucesso: true, dados: parcelamentos });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar obrigações parceladas.', erro: err.message });
    }
  },

  async buscar(req, res) {
    try {
      const p = await ParcelamentoModel.buscarComParcelas(req.params.id);
      if (!p) return res.status(404).json({ sucesso: false, mensagem: 'Obrigação parcelada não encontrada.' });
      res.json({ sucesso: true, dados: p });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar obrigação parcelada.', erro: err.message });
    }
  },

  async criar(req, res) {
    try {
      const { tipo_obrigacao = 'Cartão de Crédito', qtd_parcelas } = req.body;

      if (!TIPOS_VALIDOS.includes(tipo_obrigacao)) {
        return res.status(400).json({ sucesso: false, mensagem: `Tipo de obrigação inválido: ${tipo_obrigacao}` });
      }

      // Valida campos obrigatórios conforme o tipo
      const obrigatorios = CAMPOS_OBRIGATORIOS[tipo_obrigacao];
      const isRateado = req.body.rateado == 1 || req.body.rateado === true;
      const faltando = obrigatorios.filter(campo => {
        if (campo === 'usuario_id' && isRateado) return false;
        return !req.body[campo];
      });
      if (faltando.length) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Campos obrigatórios não preenchidos para "${tipo_obrigacao}": ${faltando.join(', ')}.`
        });
      }

      if (Number(qtd_parcelas) <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Quantidade de parcelas deve ser maior que zero.' });
      }

      const parcelamento = await ParcelamentoModel.criar(req.body);
      await registrarAcao(req, 'Cadastro de parcelamento', `Obrigação parcelada cadastrada: ${parcelamento.descricao_compra || parcelamento.tipo_obrigacao}`);
      res.status(201).json({
        sucesso: true,
        dados: parcelamento,
        mensagem: `Obrigação parcelada cadastrada com sucesso. ${qtd_parcelas} parcelas geradas automaticamente.`
      });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao cadastrar obrigação parcelada.', erro: err.message });
    }
  },

  async excluir(req, res) {
    try {
      const existente = await ParcelamentoModel.buscarPorId(req.params.id);
      if (!existente) return res.status(404).json({ sucesso: false, mensagem: 'Obrigação parcelada não encontrada.' });
      await ParcelamentoModel.excluir(req.params.id);
      await registrarAcao(req, 'Exclusão de parcelamento', `Obrigação parcelada excluída: ${existente.descricao_compra || existente.tipo_obrigacao}`);
      res.json({ sucesso: true, mensagem: 'Obrigação parcelada e suas parcelas foram excluídas com sucesso.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao excluir obrigação parcelada.', erro: err.message });
    }
  },

  async atualizar(req,res) {
    try {
      const dados=await ParcelamentoModel.atualizar(req.params.id,req.body);
      if(!dados) return res.status(404).json({sucesso:false,mensagem:'Obrigação não encontrada.'});
      await registrarAcao(req, 'Atualização de parcelamento', `Obrigação parcelada atualizada: ${dados.descricao_compra || dados.tipo_obrigacao}`);
      res.json({sucesso:true,dados,mensagem:'Obrigação atualizada.'});
    } catch(err){res.status(500).json({sucesso:false,mensagem:'Erro ao atualizar obrigação.',erro:err.message});}
  },

  async editarLancamento(req, res) {
    try {
      const dados = await ParcelamentoModel.editarLancamento(req.params.id, req.body);
      res.json({ sucesso: true, dados, mensagem: 'Lançamento atualizado.' });
    } catch (err) {
      res.status(400).json({ sucesso: false, mensagem: 'Erro ao atualizar lançamento.', erro: err.message });
    }
  },

  async marcarParcela(req, res) {
    try {
      const { status } = req.body;
      if (!['Pago', 'Pendente'].includes(status)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Status inválido. Use "Pago" ou "Pendente".' });
      }
      const parcela = await ParcelamentoModel.marcarParcelaPaga(req.params.parcelaId, status);
      await registrarAcao(req, 'Atualização de parcela', `Parcela ${req.params.parcelaId} marcada como ${status}.`);
      res.json({ sucesso: true, dados: parcela, mensagem: 'Status da parcela atualizado.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar parcela.', erro: err.message });
    }
  }
};

module.exports = ParcelamentoController;
