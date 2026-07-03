// =====================================================================
// ROTAS: Receitas
// =====================================================================
const express = require('express');
const router = express.Router();
const ReceitaController = require('../controllers/receitaController');

router.get('/', ReceitaController.listar);
router.get('/:id', ReceitaController.buscar);
router.post('/', ReceitaController.criar);
router.put('/:id', ReceitaController.atualizar);
router.delete('/:id', ReceitaController.excluir);

module.exports = router;
