const assert=require('assert');
const db=require('../config/database');
const migrar=require('../config/migrate');
const DespesaController=require('../controllers/despesaController');
const DespesaModel=require('../models/despesaModel');
const ParcelamentoModel=require('../models/parcelamentoModel');
const PagamentoModel=require('../models/pagamentoModel');
const Dashboard=require('../controllers/dashboardV3Controller');

async function criarDespesa(body){let status=200,resposta;await DespesaController.criar({body},{status(n){status=n;return this},json(v){resposta=v;return this}});assert.equal(status,201,resposta?.mensagem);return resposta.dados;}
async function dashboard(query){let resposta;await Dashboard.resumo({query},{status(){return this},json(v){resposta=v}});assert(resposta.sucesso);return resposta.dados;}

(async()=>{
  await migrar();
  const tag=`TESTE_CF_${Date.now()}`;
  const [usuarios]=await db.query('SELECT id,nome FROM usuarios ORDER BY id LIMIT 2');
  let [cartoes]=await db.query('SELECT id FROM cartoes ORDER BY id LIMIT 1');
  assert.equal(usuarios.length,2);
  let cartaoTemporario=null;
  if(!cartoes[0]){const [r]=await db.query('INSERT INTO cartoes(usuario_id,nome_cartao,banco,limite,dia_fechamento,dia_vencimento) VALUES(?,?,?,?,?,?)',[usuarios[0].id,`${tag}_CARTAO`,'Banco Teste',1000,10,17]);cartaoTemporario=r.insertId;cartoes=[{id:r.insertId}];}
  const hoje=new Date().toISOString().slice(0,10);
  const criadas=[];const parcelamentos=[];
  try {
    criadas.push(await criarDespesa({usuario_id:usuarios[0].id,rateada:false,descricao:`${tag}_FIXA_L`,categoria:'Moradia',tipo:'Fixa',valor:100,status:'Pendente',eh_recorrente:true,dia_vencimento:new Date().getDate(),periodicidade:'Mensal',duracao_tipo:'Quantidade',qtd_ocorrencias:1}));
    criadas.push(await criarDespesa({usuario_id:usuarios[1].id,rateada:false,descricao:`${tag}_VAR_LE`,categoria:'Saúde',tipo:'Variável',valor:80,status:'Pendente',data_vencimento:hoje}));
    criadas.push(await criarDespesa({usuario_id:null,rateada:true,descricao:`${tag}_FIXA_CASAL`,categoria:'Moradia',tipo:'Fixa',valor:725,status:'Pendente',eh_recorrente:true,dia_vencimento:new Date().getDate(),periodicidade:'Mensal',duracao_tipo:'Quantidade',qtd_ocorrencias:1}));
    criadas.push(await criarDespesa({usuario_id:null,rateada:true,descricao:`${tag}_VAR_CASAL`,categoria:'Mercado',tipo:'Variável',valor:200,status:'Pendente',data_vencimento:hoje}));
    const [casal]=await db.query('SELECT usuario_id,rateada FROM despesas WHERE id=?',[criadas[2].id]);assert.equal(casal[0].usuario_id,null);assert.equal(Number(casal[0].rateada),1);
    const [rateios]=await db.query('SELECT percentual,valor FROM despesa_rateios WHERE despesa_id=? ORDER BY usuario_id',[criadas[2].id]);assert.equal(rateios.length,2);assert(rateios.every(r=>Number(r.percentual)===50&&Number(r.valor)===362.5));

    const filtradas=await DespesaModel.listar({data_inicio:hoje,data_fim:hoje});assert(filtradas.some(d=>d.descricao===`${tag}_VAR_LE`));
    const lote1=await criarDespesa({usuario_id:usuarios[0].id,rateada:false,descricao:`${tag}_LOTE1`,categoria:'Outros',tipo:'Variável',valor:10,status:'Pendente',data_vencimento:hoje});
    const lote2=await criarDespesa({usuario_id:usuarios[1].id,rateada:false,descricao:`${tag}_LOTE2`,categoria:'Outros',tipo:'Variável',valor:10,status:'Pendente',data_vencimento:hoje});
    assert.equal(await DespesaModel.excluirEmLote([lote1.id,lote2.id]),2);

    const parcela=await ParcelamentoModel.criar({usuario_id:usuarios[0].id,tipo_obrigacao:'Cartão de Crédito',cartao_id:cartoes[0].id,descricao_compra:`${tag}_PARCELA`,valor_total:120,qtd_parcelas:2,data_compra:hoje});parcelamentos.push(parcela.id);
    const emprestimo=await ParcelamentoModel.criar({usuario_id:usuarios[1].id,tipo_obrigacao:'Empréstimo',responsavel_texto:'Banco Teste',descricao_compra:`${tag}_EMPRESTIMO`,valor_parcela:75,qtd_parcelas:2,data_primeiro_vencimento:hoje});parcelamentos.push(emprestimo.id);
    assert.equal(parcela.parcelas.length,2);assert.equal(emprestimo.parcelas.length,2);

    await PagamentoModel.registrar({origem_tipo:'Despesa',origem_id:criadas[1].id,valor_pago:80,data_pagamento:hoje});
    const historico=await PagamentoModel.listarHistorico({inicio:hoje,fim:hoje});assert(historico.some(p=>p.descricao===`${tag}_VAR_LE`&&Number(p.valor_pago)===80));
    const dash=await dashboard({periodo:'personalizado',data_inicio:hoje,data_fim:hoje});assert(dash.proximasContas.some(c=>c.descricao===`${tag}_EMPRESTIMO`));
    const vencimentoParcela=parcela.parcelas[0].data_vencimento;const dashParcela=await dashboard({periodo:'personalizado',data_inicio:vencimentoParcela,data_fim:vencimentoParcela});assert(dashParcela.proximasContas.some(c=>c.descricao.includes(`${tag}_PARCELA`)));
    const categoriaExtra=`${tag}_CATEGORIA_EXTRA`;
    const despesaPago=await criarDespesa({usuario_id:usuarios[0].id,rateada:false,descricao:`${tag}_PAGA`,categoria:categoriaExtra,tipo:'Variável',valor:186.54,status:'Pago',data_vencimento:hoje});
    await db.query('UPDATE despesas SET valor_pago=valor, status=? WHERE id=?',['Pago',despesaPago.id]);
    const dashCategoria=await dashboard({periodo:'personalizado',data_inicio:hoje,data_fim:hoje});
    assert(!dashCategoria.despesasPorCategoria.some(item=>item.categoria===categoriaExtra));
    console.log(JSON.stringify({sucesso:true,testes:['Despesa individual Lohane','Despesa individual Letícia','Despesa Casal 50/50','Despesa fixa','Despesa variável','Parcelamento/Cartão no Dashboard','Empréstimo no Dashboard','Registro e histórico de pagamento','Exclusão em lote','Filtros de período','Dashboard atualizado']}));
  } finally {
    await db.query('DELETE FROM pagamentos WHERE descricao LIKE ?',[`${tag}%`]);
    for(const id of parcelamentos) await db.query('DELETE FROM parcelamentos WHERE id=?',[id]);
    if(cartaoTemporario) await db.query('DELETE FROM cartoes WHERE id=?',[cartaoTemporario]);
    await db.query('DELETE FROM despesas WHERE descricao LIKE ?',[`${tag}%`]);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
