// =====================================================================
// CONTROLLER: Usuários
// =====================================================================
const UsuarioModel = require('../models/usuarioModel');
const { hashSenha, gerarSenhaTemporaria } = require('../utils/auth');
const { registrarAcao, gerarDetalhesAlteracao, gerarDetalhesCadastro, gerarDetalhesExclusao } = require('../utils/auditoria');

const UsuarioController = {
  async listar(req, res) {
    try {
      const usuarios = await UsuarioModel.listarTodos();
      res.json({ sucesso: true, dados: usuarios });
    } catch (err) {
      res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar usuários.', erro: err.message });
    }
  },

  async criar(req, res) {
    try {
      const { nome, usuario, perfil = 'USUARIO', ativo = true, senha } = req.body || {};
      if (!nome || !usuario) {
        return res.status(400).json({ sucesso: false, mensagem: 'Nome e usuário são obrigatórios.' });
      }

      const existe = await UsuarioModel.buscarPorUsuario(usuario);
      if (existe) {
        return res.status(409).json({ sucesso: false, mensagem: 'Usuário já cadastrado.' });
      }

      const senhaTemporaria = senha || gerarSenhaTemporaria();
      const usuarioCriado = await UsuarioModel.criar({
        nome,
        usuario,
        senhaHash: await hashSenha(senhaTemporaria),
        perfil,
        ativo: ativo === true || ativo === 'true' ? 1 : 0,
        primeiroAcesso: true
      });
      await registrarAcao(req, 'Cadastro de usuário', 'Cadastrou um novo usuário', gerarDetalhesCadastro('usuario', usuarioCriado, { entidadeLabel: 'Usuário' }));
      return res.status(201).json({
        sucesso: true,
        mensagem: 'Usuário criado com sucesso.',
        dados: usuarioCriado,
        senhaTemporaria
      });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar usuário.', erro: err.message });
    }
  },

  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const dados = { ...req.body };
      delete dados.id;
      delete dados.senha_hash;
      if (dados.senha) {
        dados.senha_hash = await hashSenha(dados.senha);
        delete dados.senha;
      }
      const existente = await UsuarioModel.buscarPorId(id);
      await UsuarioModel.atualizar(id, dados);
      const atualizado = await UsuarioModel.buscarPorId(id);
      await registrarAcao(req, 'Atualização de usuário', 'Atualizou um usuário', gerarDetalhesAlteracao(existente, atualizado, { entidade: 'usuario', entidadeLabel: 'Usuário', titulo: 'Atualizou um usuário' }));
      return res.json({ sucesso: true, mensagem: 'Usuário atualizado com sucesso.' });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar usuário.', erro: err.message });
    }
  },

  async bloquear(req, res) {
    try {
      const { id } = req.params;
      const { ativo } = req.body || {};
      const novoAtivo = ativo === true || ativo === 'true' ? 1 : 0;
      const existente = await UsuarioModel.buscarPorId(id);
      await UsuarioModel.atualizar(id, { ativo: novoAtivo });
      await registrarAcao(req, 'Atualização de usuário', 'Atualizou um usuário', gerarDetalhesAlteracao({ ativo: existente?.ativo }, { ativo: novoAtivo }, { entidade: 'usuario', entidadeLabel: 'Usuário', titulo: 'Atualizou um usuário' }));
      return res.json({ sucesso: true, mensagem: 'Status do usuário atualizado.' });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao alterar status do usuário.', erro: err.message });
    }
  },

  async remover(req, res) {
    try {
      const existente = await UsuarioModel.buscarPorId(req.params.id);
      await UsuarioModel.excluir(req.params.id);
      await registrarAcao(req, 'Remoção de usuário', 'Removeu um usuário', gerarDetalhesExclusao('usuario', existente || { id: req.params.id }, { entidadeLabel: 'Usuário', titulo: 'Removeu um usuário' }));
      return res.json({ sucesso: true, mensagem: 'Usuário removido com sucesso.' });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao remover usuário.', erro: err.message });
    }
  },

  async resetarSenha(req, res) {
    try {
      const usuarioAlvo = await UsuarioModel.buscarPorId(req.params.id);
      const senhaTemporaria = gerarSenhaTemporaria();
      await UsuarioModel.atualizarSenha(req.params.id, await hashSenha(senhaTemporaria));
      await UsuarioModel.marcarPrimeiroAcesso(req.params.id);
      await registrarAcao(req, 'Redefinição de senha', `Senha redefinida para usuário ${req.params.id}`, gerarDetalhesCadastro('usuario', { nome: usuarioAlvo?.nome, usuario: usuarioAlvo?.usuario }, { entidadeLabel: 'Usuário', titulo: 'Redefiniu a senha do usuário' }));
      return res.json({ sucesso: true, mensagem: 'Senha redefinida com sucesso.', senhaTemporaria });
    } catch (err) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao redefinir senha.', erro: err.message });
    }
  }
};

module.exports = UsuarioController;
