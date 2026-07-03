const bcrypt = require('bcrypt');
const db = require('./database');

async function colunaExiste(tabela, coluna) {
  const [r]=await db.query(`SELECT COUNT(*) total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,[tabela,coluna]);
  return Number(r[0].total)>0;
}
async function adicionar(tabela,coluna,definicao) {
  if(!await colunaExiste(tabela,coluna)) await db.query(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
}

async function migrar() {
  await db.query(`CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cor VARCHAR(20) DEFAULT '#0d6efd',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  await adicionar('usuarios','usuario','VARCHAR(100) NULL AFTER nome');
  await adicionar('usuarios','senha_hash','VARCHAR(255) NULL AFTER usuario');
  await adicionar('usuarios','perfil',"ENUM('ADMIN','USUARIO') NOT NULL DEFAULT 'USUARIO' AFTER senha_hash");
  await adicionar('usuarios','ativo','TINYINT(1) NOT NULL DEFAULT 1 AFTER perfil');
  await adicionar('usuarios','primeiro_acesso','TINYINT(1) NOT NULL DEFAULT 1 AFTER ativo');
  await adicionar('usuarios','ultimo_login','TIMESTAMP NULL AFTER primeiro_acesso');
  await adicionar('usuarios','atualizado_em','TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER criado_em');

  await db.query(`CREATE TABLE IF NOT EXISTS sessoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expira_em TIMESTAMP NOT NULL,
    ultimo_acesso_em TIMESTAMP NULL,
    revogada_em TIMESTAMP NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sessoes_usuario(usuario_id),
    INDEX idx_sessoes_expira(expira_em),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB`);

  await db.query(`UPDATE usuarios SET usuario = LOWER(REPLACE(TRIM(nome), ' ', '')) WHERE usuario IS NULL OR TRIM(usuario) = ''`);
  await db.query(`UPDATE usuarios SET perfil = 'ADMIN' WHERE perfil IS NULL AND id = 1`);
  await db.query(`UPDATE usuarios SET ativo = 1 WHERE ativo IS NULL`);
  await db.query(`UPDATE usuarios SET primeiro_acesso = 0 WHERE primeiro_acesso IS NULL`);

  await db.query(`DELETE u1 FROM usuarios u1
    JOIN usuarios u2 ON u1.usuario IS NOT NULL AND TRIM(u1.usuario) <> '' AND u1.usuario = u2.usuario AND u1.id < u2.id`);
  const [indice] = await db.query(`SELECT COUNT(*) total FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND INDEX_NAME = 'uk_usuarios_usuario'`);
  if (Number(indice[0].total) === 0) {
    await db.query(`ALTER TABLE usuarios ADD UNIQUE INDEX uk_usuarios_usuario (usuario)`);
  }

  const hashAdmin = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10);
  await db.query(`INSERT INTO usuarios (nome, usuario, senha_hash, perfil, ativo, primeiro_acesso, cor)
    VALUES ('Administrador', 'admin', ?, 'ADMIN', 1, 0, '#4A7FE8')
    ON DUPLICATE KEY UPDATE senha_hash = VALUES(senha_hash), perfil = VALUES(perfil), ativo = VALUES(ativo), primeiro_acesso = VALUES(primeiro_acesso), cor = VALUES(cor)`, [hashAdmin]);

  await adicionar('despesas','eh_recorrente','TINYINT(1) NOT NULL DEFAULT 0 AFTER tipo');
  await adicionar('despesas','dia_vencimento','TINYINT NULL AFTER eh_recorrente');
  await adicionar('despesas','periodicidade',"ENUM('Mensal','Bimestral','Trimestral','Semestral','Anual') NULL AFTER dia_vencimento");
  await adicionar('despesas','duracao_tipo',"ENUM('Indeterminada','Quantidade') NULL AFTER periodicidade");
  await adicionar('despesas','qtd_ocorrencias','SMALLINT NULL AFTER duracao_tipo');
  await adicionar('despesas','despesa_origem_id','INT NULL AFTER qtd_ocorrencias');
  await db.query('ALTER TABLE despesas MODIFY usuario_id INT NULL');
  await adicionar('despesas','rateada','TINYINT(1) NOT NULL DEFAULT 0 AFTER usuario_id');
  await adicionar('despesas','valor_pago','DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER valor');
  if(await colunaExiste('despesas','data_pagamento')) await db.query('ALTER TABLE despesas DROP COLUMN data_pagamento');

  await adicionar('parcelamentos','tipo_obrigacao',"ENUM('Cartão de Crédito','Empréstimo','Financiamento','Consórcio','Boleto Parcelado','Acordo de Dívida','Outro') NOT NULL DEFAULT 'Cartão de Crédito' AFTER cartao_id");
  await adicionar('parcelamentos','responsavel_texto','VARCHAR(150) NULL AFTER tipo_obrigacao');
  await adicionar('parcelamentos','categoria',"VARCHAR(100) NOT NULL DEFAULT 'Cartão' AFTER descricao_compra");
  await adicionar('parcelamentos','data_primeiro_vencimento','DATE NULL AFTER data_compra');
  await db.query('ALTER TABLE parcelamentos MODIFY cartao_id INT NULL');
  await adicionar('parcelas','usuario_id','INT NULL AFTER parcelamento_id');
  await adicionar('parcelas','valor_pago','DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER valor');
  await adicionar('parcelas','data_pagamento','DATE NULL AFTER data_vencimento');
  await db.query('UPDATE parcelas pa JOIN parcelamentos p ON p.id=pa.parcelamento_id SET pa.usuario_id=p.usuario_id WHERE pa.usuario_id IS NULL');

  await db.query(`CREATE TABLE IF NOT EXISTS despesa_rateios (
    id INT AUTO_INCREMENT PRIMARY KEY, despesa_id INT NOT NULL, usuario_id INT NOT NULL,
    percentual DECIMAL(5,2) NOT NULL DEFAULT 50, valor DECIMAL(12,2) NOT NULL,
    UNIQUE KEY uk_rateio_despesa_usuario(despesa_id,usuario_id),
    FOREIGN KEY(despesa_id) REFERENCES despesas(id) ON DELETE CASCADE,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE) ENGINE=InnoDB`);
  await db.query(`CREATE TABLE IF NOT EXISTS pagamentos (
    id INT AUTO_INCREMENT PRIMARY KEY, origem_tipo ENUM('Despesa','Parcela') NOT NULL, origem_id INT NOT NULL,
    valor_devido DECIMAL(12,2) NOT NULL, valor_pago DECIMAL(12,2) NOT NULL, credito_gerado DECIMAL(12,2) NOT NULL DEFAULT 0,
    data_pagamento DATE NOT NULL, observacao TEXT NULL, criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pagamentos_origem(origem_tipo,origem_id), INDEX idx_pagamentos_data(data_pagamento)) ENGINE=InnoDB`);
  await adicionar('pagamentos','descricao','VARCHAR(150) NULL AFTER origem_id');
  await adicionar('pagamentos','origem','VARCHAR(100) NULL AFTER descricao');
  await adicionar('pagamentos','responsavel','VARCHAR(100) NULL AFTER origem');

  await db.query(`CREATE TABLE IF NOT EXISTS auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    usuario_nome VARCHAR(120) NULL,
    tipo_acao VARCHAR(60) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    detalhes TEXT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_auditoria_usuario(usuario_id),
    INDEX idx_auditoria_tipo(tipo_acao),
    INDEX idx_auditoria_data(criado_em),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB`);

  // v7: converter categoria de despesas de ENUM para VARCHAR (permite categorias personalizadas)
  const [tipoCat]=await db.query(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='despesas' AND COLUMN_NAME='categoria'`
  );
  if(tipoCat[0]?.DATA_TYPE==='enum'){
    await db.query(`ALTER TABLE despesas MODIFY COLUMN categoria VARCHAR(100) NOT NULL DEFAULT 'Outros'`);
  }

  // v6: suporte a cartão "Casal" (rateado 50/50)
  // Precisa remover a FK antes de tornar a coluna nullable, depois re-adiciona
  const [colCartao]=await db.query(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cartoes' AND COLUMN_NAME='usuario_id'`
  );
  if(colCartao[0]?.IS_NULLABLE==='NO'){
    try{ await db.query('ALTER TABLE cartoes DROP FOREIGN KEY fk_cartoes_usuario'); }catch(e){}
    await db.query('ALTER TABLE cartoes MODIFY COLUMN usuario_id INT NULL');
    try{
      await db.query(`ALTER TABLE cartoes ADD CONSTRAINT fk_cartoes_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE`);
    }catch(e){}
  }
  await adicionar('cartoes','rateado','TINYINT(1) NOT NULL DEFAULT 0 AFTER usuario_id');

  // v8: atualizar cores dos usuários — Lohane=amarelo, Letícia=laranja
  await db.query(`UPDATE usuarios SET cor='#F5C518' WHERE nome LIKE '%Lohane%' AND cor != '#F5C518'`);
  await db.query(`UPDATE usuarios SET cor='#F97316' WHERE nome LIKE '%Letícia%' AND cor != '#F97316'`);

  // v9: suporte a parcelamento "Casal" (rateado 50/50 entre os dois usuários)
  await db.query('ALTER TABLE parcelamentos MODIFY usuario_id INT NULL');
  await adicionar('parcelamentos','rateado','TINYINT(1) NOT NULL DEFAULT 0 AFTER usuario_id');
}

module.exports=migrar;
