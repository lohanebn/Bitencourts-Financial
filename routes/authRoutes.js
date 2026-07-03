const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const autenticar = require('../middleware/auth');

router.post('/login', AuthController.login);
router.post('/trocar-senha', AuthController.trocarSenhaPrimeiraVez);
router.get('/me', autenticar, AuthController.me);
router.post('/logout', autenticar, AuthController.logout);
router.put('/senha', autenticar, AuthController.alterarSenha);

module.exports = router;
