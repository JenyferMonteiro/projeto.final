/* =========================================================
   CRUD DE NOTAS  -  Página "Minhas notas"

   CLICAR (ou tocar) em uma nota da tabela abre a janela
   com as atividades daquele bimestre. Nela o aluno pode:

     C - Criar   uma atividade (nome + nota)
     R - Ler     as atividades já lançadas
     U - Editar  uma atividade (botão do lápis)
     D - Excluir uma atividade (botão da lixeira)

   SEGURAR a nota por meio segundo abre a janela de
   sub-atividades (arquivo JanelaSubAtividades.js).

   As URLs (urlListarAtividades, urlCriarAtividade,
   urlEditarAtividade e urlExcluirAtividade) são criadas
   no PaginaHome.html, do mesmo jeito que as do menu.js.
   ========================================================= */


/* Quanto vale cada bimestre no CEFET (total = 100) */

const VALOR_DOS_BIMESTRES = {
    "1": 20,
    "2": 30,
    "3": 20,
    "4": 30
};

const MEDIA = 0.6;

const TEMPO_PARA_SEGURAR = 550; // em milissegundos


let celulaAberta = null;        // célula da tabela que abriu a janela

let atividadesDoBimestre = [];  // lista que veio do servidor

let idEmEdicao = null;          // null = criando | número = editando

let cliqueComecouNoFundoNotas = false;


/* =========================
   AUXILIARES
========================= */

function formatarNota(numero) {

    numero = Number(numero) || 0;

    if (numero === 0) {
        return "0";
    }

    return numero.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2
    });

}


function lerNota(texto) {

    // "15,5" -> 15.5
    return Number(texto.trim().replace(",", ".")) || 0;

}


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


function criarBotaoIcone(icone, descricao, classe) {

    const botao = criarElemento("button", classe);

    botao.type = "button";

    botao.title = descricao;

    botao.setAttribute("aria-label", descricao);

    botao.innerHTML = '<i data-lucide="' + icone + '"></i>';

    return botao;

}


function atualizarIcones() {

    if (window.lucide) {
        lucide.createIcons();
    }

}


function usandoMouse() {

    // No celular não damos foco automático no campo,
    // senão o teclado sobe sozinho e cobre a janela.
    return window.matchMedia("(hover: hover)").matches;

}


function enviarParaServidor(url, dados) {

    const formData = new FormData();

    for (const campo in dados) {
        formData.append(campo, dados[campo]);
    }

    formData.append(
        "csrfmiddlewaretoken",
        document.querySelector("[name=csrfmiddlewaretoken]").value
    );

    return fetch(url, {
        method: "POST",
        body: formData
    })

    .then(resposta => {

        return resposta.json()

            .catch(() => ({}))

            .then(json => {

                if (!resposta.ok || json.erro) {
                    throw new Error(
                        json.erro || "Não foi possível falar com o servidor."
                    );
                }

                return json;

            });

    });

}


/* =========================
   ABRIR E FECHAR A JANELA
========================= */

function abrirJanelaNotas(celula) {

    celulaAberta = celula;

    document.getElementById("janela-notas-subtitulo").textContent =
        celula.dataset.nome + " · " + celula.dataset.bimestre + "º bimestre";

    limparFormulario();

    const notaDaCelula = lerNota(celula.textContent);

    desenharResumo(notaDaCelula, notaDaCelula > 0);

    const lista = document.getElementById("lista-atividades");

    lista.innerHTML = "";

    lista.appendChild(
        criarElemento("p", "lista-carregando", "Carregando atividades...")
    );

    cliqueComecouNoFundoNotas = false;

    document.getElementById("janela-notas-fundo").classList.add("aberta");

    document.body.style.overflow = "hidden";

    buscarAtividades();

    if (usandoMouse()) {
        document.getElementById("nota-nome").focus();
    }

}


function fecharJanelaNotas() {

    document.getElementById("janela-notas-fundo").classList.remove("aberta");

    document.body.style.overflow = "";

    if (celulaAberta && usandoMouse()) {
        celulaAberta.focus();
    }

}


/* Fecha ao clicar no fundo escuro (só se o clique começou nele) */

const fundoNotas = document.getElementById("janela-notas-fundo");

fundoNotas.addEventListener("pointerdown", evento => {

    cliqueComecouNoFundoNotas = evento.target === fundoNotas;

});

fundoNotas.addEventListener("click", evento => {

    if (evento.target === fundoNotas && cliqueComecouNoFundoNotas) {
        fecharJanelaNotas();
    }

});


document.addEventListener("keydown", evento => {

    if (evento.key === "Escape" && fundoNotas.classList.contains("aberta")) {
        fecharJanelaNotas();
    }

});


/* =========================
   R - LER (buscar no servidor)
========================= */

function buscarAtividades() {

    const celula = celulaAberta;

    const url =
        urlListarAtividades +
        "?disciplina=" + encodeURIComponent(celula.dataset.disciplina) +
        "&bimestre=" + encodeURIComponent(celula.dataset.bimestre);

    fetch(url)

    .then(resposta => {

        if (!resposta.ok) {
            throw new Error("Erro HTTP: " + resposta.status);
        }

        return resposta.json();

    })

    .then(dados => {

        atualizarTudo(dados, celula);

    })

    .catch(erro => {

        console.error(erro);

        if (celula !== celulaAberta) {
            return;
        }

        const lista = document.getElementById("lista-atividades");

        lista.innerHTML = "";

        lista.appendChild(
            criarElemento("p", "lista-vazia", "Não foi possível carregar as atividades.")
        );

    });

}


/*
    Toda resposta do servidor traz a lista + o total do bimestre.
    "celula" é a nota que fez o pedido: se o aluno já abriu outra
    nota enquanto esperava, só a tabela é atualizada.
*/

function atualizarTudo(dados, celula) {

    const total = Number(dados.total_bimestre) || 0;

    atualizarTabela(celula, total);

    if (celula !== celulaAberta) {
        return;
    }

    atividadesDoBimestre = dados.atividades || [];

    desenharLista();

    desenharResumo(total, atividadesDoBimestre.length > 0);

}


/* =========================
   DESENHAR A JANELA
========================= */

function desenharResumo(total, temAtividades) {

    const maximo = VALOR_DOS_BIMESTRES[celulaAberta.dataset.bimestre];

    const media = maximo * MEDIA;

    const barra = document.getElementById("resumo-barra-preenchida");

    const situacao = document.getElementById("resumo-situacao");


    document.getElementById("resumo-total").textContent = formatarNota(total);

    document.getElementById("resumo-maximo").textContent = "/ " + maximo + " pts";

    document.getElementById("resumo-legenda").textContent =
        "Este bimestre vale " + maximo + " pontos. A média é " + formatarNota(media) + ".";


    barra.style.width = Math.min(total / maximo * 100, 100) + "%";


    if (!temAtividades) {

        situacao.textContent = "Sem notas ainda";

        situacao.className = "resumo-situacao vazio";

        barra.classList.remove("abaixo");

    }

    else if (total >= media) {

        situacao.textContent = "Na média";

        situacao.className = "resumo-situacao na-media";

        barra.classList.remove("abaixo");

    }

    else {

        situacao.textContent = "Faltam " + formatarNota(media - total) + " para a média";

        situacao.className = "resumo-situacao abaixo";

        barra.classList.add("abaixo");

    }

}


function desenharLista() {

    const lista = document.getElementById("lista-atividades");

    lista.innerHTML = "";


    if (atividadesDoBimestre.length === 0) {

        lista.appendChild(
            criarElemento("p", "lista-vazia", "Nenhuma atividade lançada neste bimestre ainda.")
        );

        return;

    }


    atividadesDoBimestre.forEach(atividade => {

        const item = criarElemento("div", "atividade-item");

        if (atividade.id === idEmEdicao) {
            item.classList.add("em-edicao");
        }


        item.appendChild(
            criarElemento("span", "atividade-nome", atividade.nome)
        );

        item.appendChild(
            criarElemento("span", "atividade-valor", formatarNota(atividade.valor) + " pts")
        );


        const botaoEditar = criarBotaoIcone(
            "pencil",
            "Editar " + atividade.nome,
            "botao-icone"
        );

        botaoEditar.addEventListener("click", () => comecarEdicao(atividade));


        const botaoExcluir = criarBotaoIcone(
            "trash-2",
            "Excluir " + atividade.nome,
            "botao-icone excluir"
        );

        botaoExcluir.addEventListener("click", () => pedirConfirmacao(botaoExcluir, atividade));


        item.appendChild(botaoEditar);

        item.appendChild(botaoExcluir);

        lista.appendChild(item);

    });


    atualizarIcones();

}


/* Atualiza a célula, o total e o "quanto falta" sem recarregar a página */

function atualizarTabela(celula, totalDoBimestre) {

    if (lerNota(celula.textContent) === totalDoBimestre) {
        return;
    }


    celula.textContent = formatarNota(totalDoBimestre);

    celula.classList.remove("atualizada");

    void celula.offsetWidth; // reinicia a animação

    celula.classList.add("atualizada");


    const linha = celula.closest("tr");

    let totalDoAno = 0;

    linha.querySelectorAll(".celula-bimestre").forEach(celulaDaLinha => {
        totalDoAno += lerNota(celulaDaLinha.textContent);
    });


    linha.querySelector(".total").textContent = formatarNota(totalDoAno);

    linha.querySelector(".falta").textContent = formatarNota(Math.max(60 - totalDoAno, 0));

}


/* =========================
   FORMULÁRIO (criar / editar)
========================= */

function mostrarAviso(texto) {

    document.getElementById("form-notas-aviso").textContent = texto;

}


function limparFormulario() {

    idEmEdicao = null;

    document.getElementById("nota-nome").value = "";

    document.getElementById("nota-valor").value = "";

    const titulo = document.getElementById("form-notas-titulo");

    titulo.textContent = "Nova atividade";

    titulo.classList.remove("editando");

    document.getElementById("botao-salvar-nota").innerHTML =
        '<i data-lucide="plus"></i> Adicionar';

    document.getElementById("botao-cancelar-edicao").hidden = true;

    mostrarAviso("");

    atualizarIcones();

}


/* U - EDITAR: joga os dados da atividade no formulário */

function comecarEdicao(atividade) {

    idEmEdicao = atividade.id;

    document.getElementById("nota-nome").value = atividade.nome;

    document.getElementById("nota-valor").value = atividade.valor;

    const titulo = document.getElementById("form-notas-titulo");

    titulo.textContent = "Editando: " + atividade.nome;

    titulo.classList.add("editando");

    document.getElementById("botao-salvar-nota").innerHTML =
        '<i data-lucide="check"></i> Salvar alterações';

    document.getElementById("botao-cancelar-edicao").hidden = false;

    mostrarAviso("");

    desenharLista();

    document.getElementById("nota-nome").focus();

}


function cancelarEdicao() {

    limparFormulario();

    desenharLista();

}


/* C - CRIAR  e  U - SALVAR EDIÇÃO */

document.getElementById("form-notas").addEventListener("submit", evento => {

    evento.preventDefault();


    const nome = document.getElementById("nota-nome").value.trim();

    const textoValor = document.getElementById("nota-valor").value;

    const valor = Number(textoValor);

    const celula = celulaAberta;

    const bimestre = celula.dataset.bimestre;

    const maximo = VALOR_DOS_BIMESTRES[bimestre];


    if (!nome) {
        mostrarAviso("Dê um nome para a atividade.");
        return;
    }

    if (textoValor === "" || isNaN(valor) || valor < 0) {
        mostrarAviso("Digite uma nota válida (0 ou mais).");
        return;
    }


    // Soma das outras atividades (sem a que está sendo editada)
    let somaDasOutras = 0;

    atividadesDoBimestre.forEach(atividade => {
        if (atividade.id !== idEmEdicao) {
            somaDasOutras += Number(atividade.valor);
        }
    });

    if (somaDasOutras + valor > maximo + 0.001) {

        mostrarAviso(
            "Com essa nota o bimestre passaria de " + maximo + " pts. " +
            "Ainda cabem " + formatarNota(Math.max(maximo - somaDasOutras, 0)) + " pts."
        );

        return;

    }


    const botao = document.getElementById("botao-salvar-nota");

    botao.disabled = true;

    mostrarAviso("");


    let pedido;

    if (idEmEdicao === null) {

        pedido = enviarParaServidor(urlCriarAtividade, {
            disciplina: celula.dataset.disciplina,
            bimestre: bimestre,
            nome: nome,
            valor: valor
        });

    }

    else {

        pedido = enviarParaServidor(urlEditarAtividade, {
            atividade: idEmEdicao,
            nome: nome,
            valor: valor
        });

    }


    pedido

    .then(dados => {

        if (celula === celulaAberta) {
            limparFormulario();
        }

        atualizarTudo(dados, celula);

        if (celula === celulaAberta && usandoMouse()) {
            document.getElementById("nota-nome").focus();
        }

    })

    .catch(erro => {

        console.error(erro);

        mostrarAviso(erro.message);

    })

    .finally(() => {

        botao.disabled = false;

    });

});


/* =========================
   D - EXCLUIR (pede confirmação)
========================= */

function pedirConfirmacao(botao, atividade) {

    // Segundo toque: exclui de verdade
    if (botao.classList.contains("confirmando")) {
        excluirAtividade(atividade);
        return;
    }


    // Primeiro toque: o botão vira "Excluir?" por 3 segundos
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


function excluirAtividade(atividade) {

    const celula = celulaAberta;

    enviarParaServidor(urlExcluirAtividade, {
        atividade: atividade.id
    })

    .then(dados => {

        if (celula === celulaAberta && idEmEdicao === atividade.id) {
            limparFormulario();
        }

        atualizarTudo(dados, celula);

    })

    .catch(erro => {

        console.error(erro);

        mostrarAviso(erro.message);

    });

}


/* =========================
   ATALHO: janela de notas -> sub-atividades
========================= */

function irParaSubAtividades() {

    fecharJanelaNotas();

    if (typeof abrirJanelaSubAtividades === "function") {
        abrirJanelaSubAtividades(celulaAberta);
    }

}


/* =========================
   CLICAR x SEGURAR NA CÉLULA
========================= */

document.querySelectorAll(".celula-bimestre").forEach(celula => {

    let temporizador = null;

    let segurou = false;

    let inicioX = 0;

    let inicioY = 0;


    function cancelarSegurar() {

        clearTimeout(temporizador);

        celula.classList.remove("segurando");

    }


    celula.addEventListener("pointerdown", evento => {

        if (evento.button !== 0) {
            return; // só o botão principal do mouse ou o dedo
        }

        segurou = false;

        inicioX = evento.clientX;

        inicioY = evento.clientY;

        celula.classList.add("segurando");


        temporizador = setTimeout(() => {

            segurou = true;

            celula.classList.remove("segurando");

            if (navigator.vibrate) {
                navigator.vibrate(25); // tremidinha no celular
            }

            if (typeof abrirJanelaSubAtividades === "function") {
                abrirJanelaSubAtividades(celula);
            }

        }, TEMPO_PARA_SEGURAR);

    });


    // Soltou, saiu de cima ou começou a rolar a tela: cancela
    celula.addEventListener("pointerup", cancelarSegurar);

    celula.addEventListener("pointerleave", cancelarSegurar);

    celula.addEventListener("pointercancel", cancelarSegurar);

    celula.addEventListener("pointermove", evento => {

        const andouX = Math.abs(evento.clientX - inicioX);

        const andouY = Math.abs(evento.clientY - inicioY);

        if (andouX > 10 || andouY > 10) {
            cancelarSegurar();
        }

    });


    celula.addEventListener("click", () => {

        if (segurou) {
            segurou = false; // foi "segurar", não clique
            return;
        }

        abrirJanelaNotas(celula);

    });


    // Evita o menu do botão direito / do "segurar" no celular
    celula.addEventListener("contextmenu", evento => evento.preventDefault());


    // Teclado: Enter ou Espaço abre a janela de notas
    celula.addEventListener("keydown", evento => {

        if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            abrirJanelaNotas(celula);
        }

    });

});


atualizarIcones();
