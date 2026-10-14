/* =========================================================
   PÁGINA DE TAREFAS (KANBAN)  -  Front-end

   Colunas (os mesmos status do modelo Tarefa, em
   gerenciamento/models.py):

     PENDENTE   -> "A fazer"
     PROGRESSO  -> "Fazendo"
     CONCLUIDO  -> "Concluído"

   Cada tarefa tem: titulo, data_limite e status.

   Por enquanto as tarefas ficam salvas no próprio
   navegador (localStorage). Quando o back-end das tarefas
   estiver pronto, é só trocar o que está dentro de
   carregarTarefas() e salvarTarefas() por chamadas fetch.
   ========================================================= */


const COLUNAS = ["PENDENTE", "PROGRESSO", "CONCLUIDO"];

const CHAVE_DO_NAVEGADOR = "studyplan-tarefas-" + idUsuario;


let tarefas = [];

let tarefaEmEdicao = null;  // null = criando | id = editando

let cliqueComecouNoFundoTarefa = false;


/* =========================
   SALVAR E CARREGAR
========================= */

function carregarTarefas() {

    try {
        tarefas = JSON.parse(localStorage.getItem(CHAVE_DO_NAVEGADOR)) || [];
    }
    catch (erro) {
        tarefas = [];
    }

}


function salvarTarefas() {

    try {
        localStorage.setItem(CHAVE_DO_NAVEGADOR, JSON.stringify(tarefas));
    }
    catch (erro) {
        console.error("Não foi possível salvar as tarefas no navegador.", erro);
    }

}


/* =========================
   DATAS
========================= */

function hojeEmTexto() {

    const hoje = new Date();

    return hoje.getFullYear() + "-" +
        String(hoje.getMonth() + 1).padStart(2, "0") + "-" +
        String(hoje.getDate()).padStart(2, "0");

}


function diasAte(dataEmTexto) {

    const alvo = new Date(dataEmTexto + "T00:00:00");

    const hoje = new Date(hojeEmTexto() + "T00:00:00");

    return Math.round((alvo - hoje) / 86400000);

}


function formatarData(dataEmTexto) {

    const partes = dataEmTexto.split("-"); // [ano, mes, dia]

    return partes[2] + "/" + partes[1];

}


/* Texto e cor da etiqueta de data de cada cartão */

function etiquetaDaData(tarefa) {

    const data = formatarData(tarefa.data_limite);

    const dias = diasAte(tarefa.data_limite);


    if (tarefa.status === "CONCLUIDO") {
        return { texto: "Concluída", classe: "concluida", icone: "circle-check" };
    }

    if (dias < 0) {
        return { texto: "Atrasada · " + data, classe: "atrasada", icone: "alarm-clock" };
    }

    if (dias === 0) {
        return { texto: "Entrega hoje", classe: "hoje", icone: "calendar" };
    }

    if (dias === 1) {
        return { texto: "Amanhã · " + data, classe: "hoje", icone: "calendar" };
    }

    return { texto: "Até " + data, classe: "", icone: "calendar" };

}


/* =========================
   AUXILIARES
========================= */

function criarElemento(tag, classe, texto) {

    const elemento = document.createElement(tag);

    if (classe) {
        elemento.className = classe;
    }

    if (texto !== undefined) {
        elemento.textContent = texto;
    }

    return elemento;

}


function criarBotao(classe, conteudoHtml, descricao) {

    const botao = criarElemento("button", classe);

    botao.type = "button";

    botao.innerHTML = conteudoHtml;

    if (descricao) {
        botao.title = descricao;
        botao.setAttribute("aria-label", descricao);
    }

    return botao;

}


function atualizarIcones() {

    if (window.lucide) {
        lucide.createIcons();
    }

}


/* =========================
   DESENHAR O QUADRO
========================= */

function desenharQuadro() {

    COLUNAS.forEach(status => {

        const lista = document.getElementById("lista-" + status);

        const daColuna = tarefas

            .filter(tarefa => tarefa.status === status)

            .sort((a, b) => a.data_limite.localeCompare(b.data_limite));


        lista.innerHTML = "";

        document.getElementById("contador-" + status).textContent = daColuna.length;


        if (daColuna.length === 0) {
            lista.appendChild(criarColunaVazia(status));
            return;
        }


        daColuna.forEach(tarefa => {
            lista.appendChild(criarCartao(tarefa));
        });

    });


    desenharProgresso();

    atualizarIcones();

}


function criarColunaVazia(status) {

    const textos = {
        PENDENTE: ["clipboard-list", "Nada por aqui. Toque em + para criar uma tarefa."],
        PROGRESSO: ["hourglass", "Quando começar uma tarefa, ela aparece aqui."],
        CONCLUIDO: ["party-popper", "As tarefas terminadas vêm para cá."]
    };

    const vazio = criarElemento("div", "coluna-vazia");

    vazio.innerHTML = '<i data-lucide="' + textos[status][0] + '"></i>';

    vazio.appendChild(criarElemento("span", "", textos[status][1]));

    return vazio;

}


function criarCartao(tarefa) {

    const cartao = criarElemento("article", "cartao");


    // Título + editar/excluir
    const topo = criarElemento("div", "cartao-topo");

    topo.appendChild(criarElemento("h4", "cartao-titulo", tarefa.titulo));

    const acoes = criarElemento("div", "cartao-acoes");

    const botaoEditar = criarBotao(
        "botao-icone",
        '<i data-lucide="pencil"></i>',
        "Editar tarefa"
    );

    botaoEditar.addEventListener("click", () => abrirModalTarefa(tarefa.status, tarefa));

    const botaoExcluir = criarBotao(
        "botao-icone excluir",
        '<i data-lucide="trash-2"></i>',
        "Excluir tarefa"
    );

    botaoExcluir.addEventListener("click", () => pedirConfirmacao(botaoExcluir, tarefa.id));

    acoes.appendChild(botaoEditar);

    acoes.appendChild(botaoExcluir);

    topo.appendChild(acoes);

    cartao.appendChild(topo);


    // Etiqueta da data
    const etiqueta = etiquetaDaData(tarefa);

    const data = criarElemento("span", "cartao-data " + etiqueta.classe);

    data.innerHTML = '<i data-lucide="' + etiqueta.icone + '"></i>';

    data.appendChild(document.createTextNode(etiqueta.texto));

    cartao.appendChild(data);


    // Botões para mover entre as colunas
    const mover = criarElemento("div", "cartao-mover");

    if (tarefa.status === "PENDENTE") {

        const comecar = criarBotao(
            "botao-mover avancar",
            'Começar <i data-lucide="arrow-right"></i>'
        );

        comecar.addEventListener("click", () => moverTarefa(tarefa.id, 1));

        mover.appendChild(comecar);

    }

    if (tarefa.status === "PROGRESSO") {

        const voltar = criarBotao(
            "botao-mover voltar",
            '<i data-lucide="arrow-left"></i> Voltar'
        );

        voltar.addEventListener("click", () => moverTarefa(tarefa.id, -1));

        const concluir = criarBotao(
            "botao-mover avancar",
            'Concluir <i data-lucide="check"></i>'
        );

        concluir.addEventListener("click", () => moverTarefa(tarefa.id, 1));

        mover.appendChild(voltar);

        mover.appendChild(concluir);

    }

    if (tarefa.status === "CONCLUIDO") {

        const reabrir = criarBotao(
            "botao-mover voltar",
            '<i data-lucide="rotate-ccw"></i> Reabrir'
        );

        reabrir.addEventListener("click", () => moverTarefa(tarefa.id, -1));

        mover.appendChild(reabrir);

    }

    cartao.appendChild(mover);


    return cartao;

}


function desenharProgresso() {

    const total = tarefas.length;

    const concluidas = tarefas.filter(tarefa => tarefa.status === "CONCLUIDO").length;

    const porcentagem = total > 0 ? Math.round(concluidas / total * 100) : 0;


    document.getElementById("progresso-numero").textContent =
        concluidas + " de " + total;

    document.getElementById("progresso-porcentagem").textContent = porcentagem + "%";

    document.getElementById("progresso-preenchido").style.width = porcentagem + "%";

}


/* =========================
   MOVER E EXCLUIR
========================= */

function moverTarefa(id, direcao) {

    const tarefa = tarefas.find(item => item.id === id);

    const novaPosicao = COLUNAS.indexOf(tarefa.status) + direcao;

    if (novaPosicao < 0 || novaPosicao >= COLUNAS.length) {
        return;
    }

    tarefa.status = COLUNAS[novaPosicao];

    salvarTarefas();

    desenharQuadro();

}


function pedirConfirmacao(botao, id) {

    // Segundo toque: exclui
    if (botao.classList.contains("confirmando")) {

        tarefas = tarefas.filter(tarefa => tarefa.id !== id);

        salvarTarefas();

        desenharQuadro();

        return;

    }


    // Primeiro toque: vira "Excluir?" por 3 segundos
    botao.classList.add("confirmando");

    botao.textContent = "Excluir?";

    setTimeout(() => {

        if (document.body.contains(botao)) {

            botao.classList.remove("confirmando");

            botao.innerHTML = '<i data-lucide="trash-2"></i>';

            atualizarIcones();

        }

    }, 3000);

}


/* =========================
   MODAL: NOVA / EDITAR TAREFA
========================= */

function abrirModalTarefa(status, tarefa) {

    const formulario = document.getElementById("form-tarefa");

    formulario.reset();

    document.getElementById("modal-tarefa-aviso").textContent = "";


    if (tarefa) {

        tarefaEmEdicao = tarefa.id;

        document.getElementById("modal-tarefa-titulo").textContent = "Editar tarefa";

        document.getElementById("tarefa-titulo").value = tarefa.titulo;

        document.getElementById("tarefa-data").value = tarefa.data_limite;

    }

    else {

        tarefaEmEdicao = null;

        document.getElementById("modal-tarefa-titulo").textContent = "Nova tarefa";

        document.getElementById("tarefa-data").value = hojeEmTexto();

    }


    formulario.querySelector('input[name="status"][value="' + status + '"]').checked = true;

    cliqueComecouNoFundoTarefa = false;

    document.getElementById("modal-tarefa-fundo").classList.add("aberto");

    document.body.style.overflow = "hidden";


    // No celular não abrimos o teclado sozinho
    if (window.matchMedia("(hover: hover)").matches) {
        document.getElementById("tarefa-titulo").focus();
    }

}


function fecharModalTarefa() {

    document.getElementById("modal-tarefa-fundo").classList.remove("aberto");

    document.body.style.overflow = "";

}


document.getElementById("form-tarefa").addEventListener("submit", evento => {

    evento.preventDefault();


    const titulo = document.getElementById("tarefa-titulo").value.trim();

    const dataLimite = document.getElementById("tarefa-data").value;

    const status = document.querySelector('#form-tarefa input[name="status"]:checked').value;

    const aviso = document.getElementById("modal-tarefa-aviso");


    if (!titulo) {
        aviso.textContent = "Escreva o que precisa ser feito.";
        return;
    }

    if (!dataLimite) {
        aviso.textContent = "Escolha a data limite.";
        return;
    }


    if (tarefaEmEdicao === null) {

        tarefas.push({
            id: Date.now(),
            titulo: titulo,
            data_limite: dataLimite,
            status: status
        });

    }

    else {

        const tarefa = tarefas.find(item => item.id === tarefaEmEdicao);

        tarefa.titulo = titulo;

        tarefa.data_limite = dataLimite;

        tarefa.status = status;

    }


    salvarTarefas();

    desenharQuadro();

    fecharModalTarefa();

});


/* Fecha no fundo escuro (se o clique começou nele) e no Esc */

const fundoTarefa = document.getElementById("modal-tarefa-fundo");

fundoTarefa.addEventListener("pointerdown", evento => {

    cliqueComecouNoFundoTarefa = evento.target === fundoTarefa;

});

fundoTarefa.addEventListener("click", evento => {

    if (evento.target === fundoTarefa && cliqueComecouNoFundoTarefa) {
        fecharModalTarefa();
    }

});

document.addEventListener("keydown", evento => {

    if (evento.key === "Escape" && fundoTarefa.classList.contains("aberto")) {
        fecharModalTarefa();
    }

});


/* =========================
   INÍCIO
========================= */

carregarTarefas();

desenharQuadro();
