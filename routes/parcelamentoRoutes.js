// =====================================================================
// ROTAS: Parcelamentos
// =====================================================================
const express = require('express');
const router = express.Router();
const ParcelamentoController = require('../controllers/parcelamentoController');

router.get('/', ParcelamentoController.listar);
router.get('/:id', ParcelamentoController.buscar);
router.post('/', ParcelamentoController.criar);
router.patch('/:id/lancamento', ParcelamentoController.editarLancamento);
router.put('/:id', ParcelamentoController.atualizar);
router.delete('/:id', ParcelamentoController.excluir);
router.patch('/parcelas/:parcelaId', ParcelamentoController.marcarParcela);

module.exports = router;
