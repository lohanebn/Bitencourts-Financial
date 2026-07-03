const UsuarioModel = require('../models/usuarioModel');
const { compararSenha, gerarToken, gerarSessionId, hashSenha, hashToken, gerarSenhaTemporaria } = require('../utils/auth');
const { registrarAcao } = require('../utils/auditoria');

const AuthController = {
  async login(req, res) {
    try {
      const { usuario, senha } = req.body || {};
      if (!usuario || !senha) {
        return res.status(400).json({ sucesso: false, mensagem: 'Usuário e senha são obrigatórios.' });
      }

      const usuarioDb = await UsuarioModel.buscarPorUsuario(usuario);
      if (!usuarioDb || !usuarioDb.ativo) {
        return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
      }

      const senhaValida = await compararSenha(senha, usuarioDb.senha_hash);
      if (!senhaValida) {
        return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
      }

      if (usuarioDb.primeiro_acesso) {
        return res.json({
          sucesso: true,
          mensagem: 'Troque sua senha para continuar.',
          obrigarTrocaSenha: true,
          dados: {
            id: usuarioDb.id,
            nome: usuarioDb.nome,
            usuario: usuarioDb.usuario,
            perfil: usuarioDb.perfil
          }
        });
      }

      const sessionId = gerarSessionId();
      const expiraEm = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const token = gerarToken({ sid: sessionId, sub: usuarioDb.id, perfil: usuarioDb.perfil });

      await UsuarioModel.criarSessao({
        usuarioId: usuarioDb.id,
        sessionId,
        tokenHash: hashToken(token),
        expiraEm
      });

      await UsuarioModel.atualizarUltimoLogin(usuarioDb.id);
      await registrarAcao({ auth:{ usuarioId: usuarioDb.id }, usuario:{ nome: usuarioDb.nome } }, 'Login', 'Login realizado com sucesso.');

      return res.json({
        sucesso: true,
        mensagem: 'Login realizado com sucesso.',
        dados: {
          token,
          usuario: {
            id: usuarioDb.id,
            nome: usuarioDb.nome,
            usuario: usuarioDb.usuario,
            perfil: usuarioDb.perfil
          }
        }
      });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao autenticar.', erro: err.message });
    }
  },

  async me(req, res) {
    try {
      return res.json({ sucesso: true, dados: req.usuario });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar perfil.', erro: err.message });
    }
  },

  async logout(req, res) {
    try {
      if (req.auth?.sessionId) {
        await UsuarioModel.revogarSessao(req.auth.sessionId);
      }
      await registrarAcao(req, 'Logout', 'Logout realizado.');
      return res.json({ sucesso: true, mensagem: 'Logout realizado com sucesso.' });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao encerrar sessão.', erro: err.message });
    }
  },

  async trocarSenhaPrimeiraVez(req, res) {
    try {
      const { usuario, senhaAtual, novaSenha } = req.body || {};
      if (!usuario || !senhaAtual || !novaSenha) {
        return res.status(400).json({ sucesso: false, mensagem: 'Usuário, senha atual e nova senha são obrigatórios.' });
      }

      const usuarioDb = await UsuarioModel.buscarPorUsuario(usuario);
      if (!usuarioDb) {
        return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
      }

      const senhaValida = await compararSenha(senhaAtual, usuarioDb.senha_hash);
      if (!senhaValida) {
        return res.status(401).json({ sucesso: false, mensagem: 'Senha atual inválida.' });
      }

      const senhaHash = await require('../utils/auth').hashSenha(novaSenha);
      await UsuarioModel.atualizarSenha(usuarioDb.id, senhaHash);
      await UsuarioModel.marcarPrimeiroAcessoConcluido(usuarioDb.id);
      await registrarAcao({ auth:{ usuarioId: usuarioDb.id }, usuario:{ nome: usuarioDb.nome } }, 'Alteração de senha', 'Senha alterada no primeiro acesso.');

      return res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso. Faça login novamente.' });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao redefinir senha.', erro: err.message });
    }
  },

  async alterarSenha(req, res) {
    try {
      const { senhaAtual, novaSenha } = req.body || {};
      if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ sucesso: false, mensagem: 'Senha atual e nova senha são obrigatórias.' });
      }

      const usuarioDb = await UsuarioModel.buscarPorId(req.auth.usuarioId);
      const senhaValida = await compararSenha(senhaAtual, usuarioDb.senha_hash);
      if (!senhaValida) {
        return res.status(401).json({ sucesso: false, mensagem: 'Senha atual inválida.' });
      }

      const senhaHash = await require('../utils/auth').hashSenha(novaSenha);
      await UsuarioModel.atualizarSenha(req.auth.usuarioId, senhaHash);
      await UsuarioModel.marcarPrimeiroAcessoConcluido(req.auth.usuarioId);
      await registrarAcao(req, 'Alteração de senha', 'Senha alterada pelo usuário.');

      return res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso.' });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao alterar senha.', erro: err.message });
    }
  }
};

module.exports = AuthController;
