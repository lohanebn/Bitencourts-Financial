// =====================================================================
// ROTAS: Usuários
// =====================================================================
const express = require('express');
const router = express.Router();
const UsuarioController = require('../controllers/usuarioController');
const autorizar = require('../middleware/autorizar');

router.get('/', UsuarioController.listar);
router.post('/', autorizar('ADMIN'), UsuarioController.criar);
router.put('/:id', autorizar('ADMIN'), UsuarioController.atualizar);
router.patch('/:id/bloquear', autorizar('ADMIN'), UsuarioController.bloquear);
router.delete('/:id', autorizar('ADMIN'), UsuarioController.remover);
router.post('/:id/resetar-senha', autorizar('ADMIN'), UsuarioController.resetarSenha);

module.exports = router;
