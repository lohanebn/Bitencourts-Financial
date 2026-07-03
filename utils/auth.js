const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const JWT_SECRET = process.env.JWT_SECRET || 'bitencourts-financial-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const SESSION_TIMEOUT_MINUTES = Number(process.env.SESSION_TIMEOUT_MINUTES || 60);

async function hashSenha(senha) {
  return bcrypt.hash(senha, SALT_ROUNDS);
}

async function compararSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}

function gerarToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function gerarSenhaTemporaria() {
  return `Bf-${Math.random().toString(36).slice(-6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function gerarSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  hashSenha,
  compararSenha,
  gerarToken,
  verificarToken,
  gerarSenhaTemporaria,
  gerarSessionId,
  hashToken,
  SESSION_TIMEOUT_MINUTES,
  JWT_EXPIRES_IN
};
