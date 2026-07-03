// =====================================================================
// CONTROLLER: Dashboard
// =====================================================================
const db = require('../config/database');
const UsuarioModel = require('../models/usuarioModel');
const ReceitaModel = require('../models/receitaModel');
const DespesaModel = require('../models/despesaModel');
const ParcelamentoModel = require('../models/parcelamentoModel');

// Calcula o semáforo financeiro: Verde / Amarelo / Vermelho
function calcularSemaforo(receita, saldo) {
  if (saldo < 0) return 'vermelho';
  if (receita > 0 && (saldo / receita) > 0.2) return 'verde';
  return 'amarelo';
}

const DashboardController = {
  async resumo(req, res) {
    try {
      await DespesaModel.atualizarStatusAtrasados();

      const hoje = new Date();
      const mes = req.query.mes ? Number(req.query.mes) : hoje.getMonth() + 1;
      const ano = req.query.ano ? Number(req.query.ano) : hoje.getFullYear();

      // Cards principais
      const receitaTotal = await ReceitaModel.totalPorPeriodo(mes, ano);
      const despesaTotal = await DespesaModel.totalPorPeriodo(mes, ano);
      const parcelasTotal = await ParcelamentoModel.totalParcelasPorPeriodo(mes, ano);
      const saldoPrevisto = receitaTotal - despesaTotal - parcelasTotal;
      const parcelamentosFuturos = await ParcelamentoModel.totalParcelamentosFuturos();

      // Resumo por pessoa
      const usuarios = await UsuarioModel.listarTodos();
      const resumoPorPessoa = [];
      for (const usuario of usuarios) {
        const receita = await ReceitaModel.totalPorPeriodo(mes, ano, usuario.id);
        const despesa = await DespesaModel.totalPorPeriodo(mes, ano, usuario.id);
        resumoPorPessoa.push({
          pessoa: usuario.nome,
          cor: usuario.cor,
          receita,
          despesa,
          saldo: receita - despesa
        });
      }

      // Próximas contas (pendentes/atrasadas)
      const proximasContas = await DespesaModel.proximasContas(10);

      // Parcelamentos ativos (resumo)
      const parcelamentosAtivos = await ParcelamentoModel.parcelasAtivasResumo();

      // Gráfico: despesas por categoria no mês
      const despesasPorCategoria = await DespesaModel.porCategoriaNoMes(mes, ano);

      const semaforo = calcularSemaforo(receitaTotal, saldoPrevisto);

      res.json({
        sucesso: true,
        dados: {
          mes,
          ano,
          cards: {
            receitaTotal,
            despesaTotal,
            saldoPrevisto,
            parcelamentosFuturos
          },
          semaforo,
          resumoPorPessoa,
          proximasContas,
          parcelamentosAtivos,
          despesasPorCategoria
        }
      });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar dashboard.', erro: err.message });
    }
  }
};

module.exports = DashboardController;
