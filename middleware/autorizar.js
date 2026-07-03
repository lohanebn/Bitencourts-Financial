function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.auth || !perfisPermitidos.includes(req.auth.perfil)) {
      return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado.' });
    }
    next();
  };
}

module.exports = autorizar;
