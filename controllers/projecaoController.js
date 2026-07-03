// =====================================================================
// CONTROLLER: Projeção Financeira
// Tela mais importante do sistema - mostra os próximos 12 meses
// =====================================================================
const ReceitaModel = require('../models/receitaModel');
const DespesaModel = require('../models/despesaModel');
const ParcelamentoModel = require('../models/parcelamentoModel');

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function calcularSemaforo(receita, saldo) {
  if (saldo < 0) return 'vermelho';
  if (receita > 0 && (saldo / receita) > 0.2) return 'verde';
  return 'amarelo';
}

const ProjecaoController = {
  async projecao12Meses(req, res) {
    try {
      const hoje = new Date();

      // Receita média: base para meses sem lançamento real
      let receitaMedia = await ReceitaModel.mediaMensal(3);
      if (!receitaMedia) {
        receitaMedia = await ReceitaModel.totalPorPeriodo(hoje.getMonth() + 1, hoje.getFullYear());
      }

      // Despesa média: considera TODOS os tipos (fixa + variável), base para meses sem lançamento real
      let despesaMedia = await DespesaModel.mediaTotalMensal(3);
      if (!despesaMedia) {
        despesaMedia = await DespesaModel.totalPorPeriodo(hoje.getMonth() + 1, hoje.getFullYear());
      }

      const meses = [];

      // Começa do próximo mês — o mês corrente não tem contas a pagar na projeção
      for (let i = 1; i <= 12; i++) {
        const dataReferencia = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const mes = dataReferencia.getMonth() + 1;
        const ano = dataReferencia.getFullYear();

        // Parcelamentos: apenas parcelas pendentes cadastradas para o mês (dado real)
        const parcelas = await ParcelamentoModel.totalParcelasPorPeriodo(mes, ano);

        // Despesas: usa lançamentos reais do mês se existirem; senão usa média histórica
        let despesasFixas = await DespesaModel.totalPorPeriodo(mes, ano);
        if (!despesasFixas) despesasFixas = despesaMedia;

        // Receita: usa lançamentos reais do mês se existirem; senão usa média histórica
        let receita = await ReceitaModel.totalPorPeriodo(mes, ano);
        if (!receita) receita = receitaMedia;

        const totalComprometido = despesasFixas + parcelas;
        const saldoPrevisto = receita - totalComprometido;

        meses.push({
          mes,
          ano,
          nomeMes: NOMES_MESES[dataReferencia.getMonth()],
          receitaPrevista: Number(receita.toFixed(2)),
          despesasFixas: Number(despesasFixas.toFixed(2)),
          parcelamentos: Number(parcelas.toFixed(2)),
          totalComprometido: Number(totalComprometido.toFixed(2)),
          saldoPrevisto: Number(saldoPrevisto.toFixed(2)),
          semaforo: calcularSemaforo(receita, saldoPrevisto)
        });
      }

      res.json({ sucesso: true, dados: meses });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao calcular projeção financeira.', erro: err.message });
    }
  }
};

module.exports = ProjecaoController;
