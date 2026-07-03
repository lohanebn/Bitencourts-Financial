// =====================================================================
// CONTROLLER: Despesas
// =====================================================================
const DespesaModel = require('../models/despesaModel');

const DespesaController = {
  async listar(req, res) {
    try {
      await DespesaModel.atualizarStatusAtrasados();
      const { usuario_id, categoria, tipo, status, mes, ano, origem, data_inicio, data_fim } = req.query;
      const despesas = await DespesaModel.listar({ usuario_id, categoria, tipo, status, mes, ano, origem, data_inicio, data_fim });
      res.json({ sucesso: true, dados: despesas });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar despesas.', erro: err.message });
    }
  },

  async buscar(req, res) {
    try {
      const despesa = await DespesaModel.buscarPorId(req.params.id);
      if (!despesa) return res.status(404).json({ sucesso: false, mensagem: 'Despesa não encontrada.' });
      res.json({ sucesso: true, dados: despesa });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar despesa.', erro: err.message });
    }
  },

  async criar(req, res) {
    try {
      const dados = {
        ...req.body,
        descricao: String(req.body.descricao || '').trim(),
        categoria: String(req.body.categoria || '').trim(),
        tipo: String(req.body.tipo || '').trim(),
        status: String(req.body.status || 'Pendente').trim()
      };
      const { usuario_id, descricao, categoria, tipo, valor, status, data_vencimento, eh_recorrente, dia_vencimento, periodicidade, duracao_tipo, qtd_ocorrencias } = dados;
      const valorNumerico = Number(valor);

      if (!descricao || !categoria || !['Fixa', 'Variável'].includes(tipo) || !Number.isFinite(valorNumerico) || valorNumerico <= 0 || !['Pendente','Pago','Atrasado'].includes(status)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Preencha descrição, categoria, tipo, valor maior que zero e status válidos.' });
      }
      if (!usuario_id && !dados.rateada) {
        return res.status(400).json({ sucesso: false, mensagem: 'Informe a pessoa responsável pela despesa variável.' });
      }

      if (tipo === 'Fixa' && eh_recorrente) {
        // Despesa fixa recorrente: exige dia do vencimento e periodicidade,
        // e, se a duração for por quantidade, exige a quantidade de ocorrências.
        if (!dia_vencimento || !periodicidade || !duracao_tipo) {
          return res.status(400).json({ sucesso: false, mensagem: 'Para despesas recorrentes, informe dia do vencimento, periodicidade e duração.' });
        }
        if (duracao_tipo === 'Quantidade' && !qtd_ocorrencias) {
          return res.status(400).json({ sucesso: false, mensagem: 'Informe a quantidade de ocorrências para a duração selecionada.' });
        }
      } else if (!data_vencimento) {
        return res.status(400).json({ sucesso: false, mensagem: 'Informe a data de vencimento.' });
      }

      dados.usuario_id = dados.rateada ? null : usuario_id;
      const despesa = await DespesaModel.criar(dados);
      const mensagem = eh_recorrente
        ? 'Despesa fixa recorrente cadastrada. As próximas ocorrências foram geradas automaticamente.'
        : 'Despesa cadastrada com sucesso.';
      res.status(201).json({ sucesso: true, dados: despesa, mensagem });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao cadastrar despesa.', erro: err.message });
    }
  },

  async atualizar(req, res) {
    try {
      const existente = await DespesaModel.buscarPorId(req.params.id);
      if (!existente) return res.status(404).json({ sucesso: false, mensagem: 'Despesa não encontrada.' });
      const despesa = await DespesaModel.atualizar(req.params.id, req.body);
      res.json({ sucesso: true, dados: despesa, mensagem: 'Despesa atualizada com sucesso.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar despesa.', erro: err.message });
    }
  },

  async excluir(req, res) {
    try {
      const existente = await DespesaModel.buscarPorId(req.params.id);
      if (!existente) return res.status(404).json({ sucesso: false, mensagem: 'Despesa não encontrada.' });
      await DespesaModel.excluir(req.params.id);
      res.json({ sucesso: true, mensagem: 'Despesa excluída com sucesso.' });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao excluir despesa.', erro: err.message });
    }
  },

  async excluirEmLote(req,res) {
    try {
      const ids=Array.isArray(req.body.ids)?req.body.ids:[];
      if(!ids.length) return res.status(400).json({sucesso:false,mensagem:'Selecione ao menos uma despesa.'});
      const quantidade=await DespesaModel.excluirEmLote(ids);
      res.json({sucesso:true,dados:{quantidade},mensagem:`${quantidade} despesa(s) excluída(s).`});
    } catch(err){res.status(500).json({sucesso:false,mensagem:'Erro ao excluir despesas.',erro:err.message});}
  }
};

module.exports = DespesaController;
