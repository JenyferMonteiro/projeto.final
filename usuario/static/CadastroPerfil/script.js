const form1 = document.getElementById("form-step-1");
const form2 = document.getElementById("form-step-2");
const form3 = document.getElementById("form-step-3");

const areaDisciplinas = document.getElementById("area-disciplinas");
const listaDisciplinas = document.getElementById("lista-disciplinas");
const listaFormacaoGeral = document.getElementById("lista-formacao-geral");
const botaoSelecionarTodas = document.getElementById("btn-selecionar-todas");
const botaoSelecionarTodasGeral = document.getElementById("btn-selecionar-todas-geral");
const mensagemDisciplinas = document.getElementById("mensagem-disciplinas");

// Mensagem da etapa 3 (criada aqui, sem mexer no HTML)
const mensagemFormacaoGeral = document.createElement("p");
mensagemFormacaoGeral.className = "mensagem-disciplinas";
mensagemFormacaoGeral.hidden = true;
listaFormacaoGeral.insertAdjacentElement("afterend", mensagemFormacaoGeral);

/* ---------- Estado ---------- */

// Disciplinas técnicas do curso (uma única requisição por curso)
let promessaCurso = null;
let cursoDaPromessa = null;

// Formação Geral (uma única requisição, vale para todos os cursos)
let promessaGeral = null;

// Técnicas marcadas, por ano: Map(ano -> Set(ids))
const selecoesPorAno = new Map();
let anoRenderizado = null;

// Formação Geral marcada
let formacaoGeralSelecionadas = new Set();

/* ---------- Utilidades ---------- */

function mostrarEtapa(etapa) {
    [form1, form2, form3].forEach(form => form.classList.remove("active"));
    [null, form1, form2, form3][etapa].classList.add("active");
}

function getCursoSelecionado() {
    return document.querySelector('input[name="curso"]:checked')?.value;
}

function getSerieSelecionada() {
    const valor = document.querySelector('input[name="serie"]:checked')?.value;
    return valor ? Number(valor) : null;
}

function getCookie(nome) {
    const cookies = document.cookie ? document.cookie.split(";") : [];

    for (const cookie of cookies) {
        const item = cookie.trim();

        if (item.startsWith(nome + "=")) {
            return decodeURIComponent(item.substring(nome.length + 1));
        }
    }

    return "";
}

function buscarJson(url, mensagemErro) {
    return fetch(url).then(resposta => {
        if (!resposta.ok) throw new Error(mensagemErro);
        return resposta.json();
    });
}

// Disciplinas técnicas do curso, buscadas UMA vez
function carregarCurso(cursoId) {
    if (promessaCurso && cursoDaPromessa === cursoId) return promessaCurso;

    cursoDaPromessa = cursoId;

    const promessa = buscarJson(
        `/api/cursos/${cursoId}/disciplinas/`,
        "Não foi possível carregar as disciplinas."
    );

    promessaCurso = promessa;

    promessa.catch(() => {
        if (promessaCurso === promessa) promessaCurso = null;
    });

    return promessa;
}

// Disciplinas de Formação Geral, buscadas UMA vez
function carregarGeral() {
    if (promessaGeral) return promessaGeral;

    const promessa = buscarJson(
        "/api/formacao-geral/disciplinas/",
        "Não foi possível carregar a Formação Geral."
    );

    promessaGeral = promessa;

    promessa.catch(() => {
        if (promessaGeral === promessa) promessaGeral = null;
    });

    return promessa;
}

/* ---------- Componentes comuns ---------- */

function criarOpcao(disciplina, destino, selecionada, aoMudar) {
    const label = document.createElement("label");
    label.className = "course-balloon";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = disciplina.id;
    input.checked = selecionada;
    input.addEventListener("change", aoMudar);

    const texto = document.createElement("span");
    texto.className = "balloon-content";
    texto.textContent = disciplina.nome;

    label.append(input, texto);
    destino.appendChild(label);
}

function atualizarTextoBotao(lista, botao) {
    const caixas = lista.querySelectorAll('input[type="checkbox"]');

    const todasMarcadas = caixas.length > 0 &&
        Array.from(caixas).every(input => input.checked);

    botao.textContent = todasMarcadas ? "Desmarcar todas" : "Selecionar todas";
}

function alternarTodas(lista) {
    const caixas = lista.querySelectorAll('input[type="checkbox"]');

    if (!caixas.length) return;

    const marcar = Array.from(caixas).some(input => !input.checked);

    caixas.forEach(input => {
        input.checked = marcar;
    });
}

/* ---------- Etapa 2: disciplinas técnicas ---------- */

function salvarSelecoesAtuais() {
    if (anoRenderizado === null) return;

    const marcadas = Array.from(
        listaDisciplinas.querySelectorAll('input[type="checkbox"]:checked')
    ).map(input => input.value);

    selecoesPorAno.set(anoRenderizado, new Set(marcadas));
}

function atualizarAreaDisciplinas() {
    const temSerie = getSerieSelecionada() !== null;

    areaDisciplinas.hidden = !temSerie;

    if (!temSerie) {
        listaDisciplinas.replaceChildren();
        anoRenderizado = null;
        botaoSelecionarTodas.textContent = "Selecionar todas";
    }
}

async function carregarDisciplinas() {
    // guarda o que estava marcado no ano que estava na tela
    salvarSelecoesAtuais();

    const cursoId = getCursoSelecionado();
    const ano = getSerieSelecionada();

    atualizarAreaDisciplinas();

    if (!cursoId || ano === null) return;

    mensagemDisciplinas.textContent = "Carregando disciplinas...";
    mensagemDisciplinas.hidden = false;

    let todas;

    try {
        todas = await carregarCurso(cursoId);
    } catch (erro) {
        if (getCursoSelecionado() !== cursoId) return;

        listaDisciplinas.replaceChildren();
        anoRenderizado = null;
        mensagemDisciplinas.textContent =
            "Erro ao carregar as disciplinas. Verifique a conexão com o servidor.";
        console.error(erro);
        return;
    }

    // o usuário pode ter trocado de curso ou de ano enquanto carregava
    if (getCursoSelecionado() !== cursoId || getSerieSelecionada() !== ano) return;

    const doAno = todas.filter(d => Number(d.ano) === ano);

    // Primeiro ano escolhido vem todo marcado; os demais, desmarcados
    if (!selecoesPorAno.has(ano)) {
        const primeiro = selecoesPorAno.size === 0;

        selecoesPorAno.set(
            ano,
            primeiro ? new Set(doAno.map(d => String(d.id))) : new Set()
        );
    }

    const marcadas = selecoesPorAno.get(ano);

    listaDisciplinas.replaceChildren();

    doAno.forEach(disciplina => {
        criarOpcao(
            disciplina,
            listaDisciplinas,
            marcadas.has(String(disciplina.id)),
            () => {
                salvarSelecoesAtuais();
                atualizarTextoBotao(listaDisciplinas, botaoSelecionarTodas);
            }
        );
    });

    anoRenderizado = ano;

    if (doAno.length === 0) {
        mensagemDisciplinas.textContent =
            "Nenhuma disciplina cadastrada para esta série.";
        mensagemDisciplinas.hidden = false;
    } else {
        mensagemDisciplinas.hidden = true;
    }

    atualizarTextoBotao(listaDisciplinas, botaoSelecionarTodas);
}

/* ---------- Etapa 3: Formação Geral ---------- */

function salvarSelecoesGeral() {
    // só atualiza se a lista já foi desenhada, para não perder a seleção
    if (!listaFormacaoGeral.querySelector('input[type="checkbox"]')) return;

    formacaoGeralSelecionadas = new Set(
        Array.from(
            listaFormacaoGeral.querySelectorAll('input[type="checkbox"]:checked')
        ).map(input => input.value)
    );
}

async function carregarFormacaoGeral() {
    mensagemFormacaoGeral.textContent = "Carregando disciplinas...";
    mensagemFormacaoGeral.hidden = false;
    listaFormacaoGeral.replaceChildren();

    let disciplinas;

    try {
        disciplinas = await carregarGeral();
    } catch (erro) {
        mensagemFormacaoGeral.textContent =
            "Erro ao carregar a Formação Geral. Verifique a conexão com o servidor.";
        console.error(erro);
        return;
    }

    listaFormacaoGeral.replaceChildren();

    disciplinas.forEach(disciplina => {
        criarOpcao(
            disciplina,
            listaFormacaoGeral,
            formacaoGeralSelecionadas.has(String(disciplina.id)),
            () => {
                salvarSelecoesGeral();
                atualizarTextoBotao(listaFormacaoGeral, botaoSelecionarTodasGeral);
            }
        );
    });

    if (disciplinas.length === 0) {
        mensagemFormacaoGeral.textContent =
            "Nenhuma disciplina de Formação Geral cadastrada.";
        mensagemFormacaoGeral.hidden = false;
    } else {
        mensagemFormacaoGeral.hidden = true;
    }

    atualizarTextoBotao(listaFormacaoGeral, botaoSelecionarTodasGeral);
}

/* ---------- Navegação ---------- */

function getTecnicasSelecionadas() {
    return Array.from(selecoesPorAno.values())
        .flatMap(selecao => Array.from(selecao));
}

function goToStep2() {
    if (!form1.reportValidity()) return;

    if (!getCursoSelecionado()) {
        alert("Selecione seu curso.");
        return;
    }

    mostrarEtapa(2);
    atualizarAreaDisciplinas();
}

function goToStep1() {
    salvarSelecoesAtuais();
    mostrarEtapa(1);
}

function goToStep3() {
    salvarSelecoesAtuais();

    if (!getTecnicasSelecionadas().length) {
        alert("Selecione pelo menos uma disciplina.");
        return;
    }

    mostrarEtapa(3);
    carregarFormacaoGeral();
}

function goToStep2From3() {
    salvarSelecoesGeral();
    mostrarEtapa(2);
}

/* ---------- Envio ---------- */

async function finalizarCadastro() {
    salvarSelecoesAtuais();
    salvarSelecoesGeral();

    if (!form1.reportValidity()) {
        mostrarEtapa(1);
        return;
    }

    const curso = getCursoSelecionado();
    const serie = getSerieSelecionada();

    const tecnicas = getTecnicasSelecionadas();
    const gerais = Array.from(formacaoGeralSelecionadas);

    // Enviamos as duas listas juntas em "disciplinas" (e as gerais também separadas)
    const disciplinas = [...new Set([...tecnicas, ...gerais])];

    if (!curso || !serie || disciplinas.length === 0) {
        alert("Confira o curso, a série e as disciplinas selecionadas.");
        return;
    }

    // Anos que têm alguma disciplina técnica marcada
    const anos = Array.from(selecoesPorAno.entries())
        .filter(([, selecao]) => selecao.size > 0)
        .map(([ano]) => String(ano));

    const dados = {
        nome: document.getElementById("nome-usuario").value.trim(),
        email: document.getElementById("email-usuario").value.trim(),
        senha: document.getElementById("senha-usuario").value,
        curso: curso,
        serie: String(serie),
        series: anos,
        disciplinas: disciplinas,
        formacao_geral: gerais
    };

    const botao = document.getElementById("btn-finalizar");
    botao.disabled = true;

    try {
        const resposta = await fetch("/salvar-cadastro/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            body: JSON.stringify(dados)
        });

        const resultado = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(
                resultado.erro ||
                resultado.mensagem ||
                "Não foi possível finalizar o cadastro."
            );
        }

        if (resultado.redirect) {
            window.location.href = resultado.redirect;
        } else {
            alert(resultado.mensagem || "Cadastro realizado com sucesso!");
        }
    } catch (erro) {
        alert(erro.message);
        console.error(erro);
    } finally {
        botao.disabled = false;
    }
}

/* ---------- Eventos ---------- */
// "Próxima etapa", "Voltar" e "Próximo" já são tratados pelos
// onclick/onsubmit do HTML.

botaoSelecionarTodas.addEventListener("click", () => {
    alternarTodas(listaDisciplinas);
    salvarSelecoesAtuais();
    atualizarTextoBotao(listaDisciplinas, botaoSelecionarTodas);
});

botaoSelecionarTodasGeral.addEventListener("click", () => {
    alternarTodas(listaFormacaoGeral);
    salvarSelecoesGeral();
    atualizarTextoBotao(listaFormacaoGeral, botaoSelecionarTodasGeral);
});

document.querySelectorAll('input[name="serie"]').forEach(input => {
    input.addEventListener("change", carregarDisciplinas);
});

// Trocar de curso zera as técnicas (a Formação Geral é a mesma para todos)
document.querySelectorAll('input[name="curso"]').forEach(input => {
    input.addEventListener("change", () => {
        promessaCurso = null;
        cursoDaPromessa = null;

        selecoesPorAno.clear();
        anoRenderizado = null;

        listaDisciplinas.replaceChildren();

        document.querySelectorAll('input[name="serie"]').forEach(serie => {
            serie.checked = false;
        });

        atualizarAreaDisciplinas();
    });
});

form3.addEventListener("submit", event => {
    event.preventDefault();
    finalizarCadastro();
});

atualizarAreaDisciplinas();