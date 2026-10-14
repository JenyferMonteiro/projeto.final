/* =========================================================
   CHAT DA IA DE SUPORTE  -  Comportamento
   Arquivo: static/PaginaDuvidas/ChatIA.js

   Precisa destas constantes, definidas no HTML da página:
       urlPerguntarIA   endereço da view que responde
       csrfTokenIA      token CSRF do Django
       imagemRaposaIA   endereço da imagem da raposa
   ========================================================= */

(function () {

    const botaoAbrir = document.getElementById("ia-abrir");

    const janela = document.getElementById("ia-janela");

    if (!botaoAbrir || !janela) {
        return;
    }


    const botaoFechar = document.getElementById("ia-fechar");

    const mensagens = document.getElementById("ia-mensagens");

    const campo = document.getElementById("ia-pergunta");

    const botaoEnviar = document.getElementById("ia-enviar");


    let aguardando = false;


    // ---------- Abrir e fechar ----------

    function abrir() {

        janela.classList.add("aberta");

        janela.setAttribute("aria-hidden", "false");

        botaoAbrir.classList.add("oculto");

        botaoAbrir.setAttribute("aria-expanded", "true");

        setTimeout(() => campo.focus(), 220);

    }


    function fechar() {

        janela.classList.remove("aberta");

        janela.setAttribute("aria-hidden", "true");

        botaoAbrir.classList.remove("oculto");

        botaoAbrir.setAttribute("aria-expanded", "false");

        botaoAbrir.focus();

    }


    botaoAbrir.addEventListener("click", abrir);

    botaoFechar.addEventListener("click", fechar);

    document.addEventListener("keydown", (evento) => {

        if (evento.key === "Escape" && janela.classList.contains("aberta")) {
            fechar();
        }

    });


    // ---------- Mensagens ----------

    function criarAvatar() {

        const avatar = document.createElement("div");

        avatar.className = "ia-mensagem-avatar";

        const imagem = document.createElement("img");

        imagem.src = imagemRaposaIA;

        imagem.alt = "";

        avatar.appendChild(imagem);

        return avatar;

    }


    function montarMensagem(quem, balao) {

        const mensagem = document.createElement("div");

        mensagem.className = "ia-mensagem " + (quem === "aluno" ? "do-aluno" : "da-ia");

        if (quem !== "aluno") {
            mensagem.appendChild(criarAvatar());
        }

        const corpo = document.createElement("div");

        corpo.className = "ia-mensagem-corpo";

        const nome = document.createElement("div");

        nome.className = "ia-mensagem-nome";

        nome.textContent = quem === "aluno" ? "Você" : "StudyPlan IA";

        corpo.appendChild(nome);

        corpo.appendChild(balao);

        mensagem.appendChild(corpo);

        return mensagem;

    }


    function rolarParaOFim() {

        mensagens.scrollTop = mensagens.scrollHeight;

    }


    // O texto entra como texto puro (textContent): nada vindo da IA
    // ou do aluno é interpretado como HTML.
    function adicionarMensagem(texto, quem, comErro) {

        const balao = document.createElement("div");

        balao.className = "ia-balao" + (comErro ? " erro" : "");

        balao.textContent = texto;

        mensagens.appendChild(montarMensagem(quem, balao));

        rolarParaOFim();

    }


    function adicionarCarregamento() {

        const balao = document.createElement("div");

        balao.className = "ia-balao carregando";

        balao.setAttribute("aria-label", "A IA está escrevendo");

        for (let i = 0; i < 3; i++) {

            const bolinha = document.createElement("span");

            bolinha.className = "ia-bolinha";

            balao.appendChild(bolinha);

        }

        const mensagem = montarMensagem("ia", balao);

        mensagem.id = "ia-carregando";

        mensagens.appendChild(mensagem);

        rolarParaOFim();

    }


    function removerCarregamento() {

        const carregando = document.getElementById("ia-carregando");

        if (carregando) {
            carregando.remove();
        }

    }


    // ---------- Enviar pergunta ----------

    async function enviarPergunta() {

        const pergunta = campo.value.trim();

        if (!pergunta || aguardando) {
            return;
        }


        aguardando = true;

        botaoEnviar.disabled = true;

        adicionarMensagem(pergunta, "aluno", false);

        campo.value = "";

        campo.style.height = "auto";

        adicionarCarregamento();


        const controle = new AbortController();

        const limite = setTimeout(() => controle.abort(), 60000);


        try {

            const resposta = await fetch(urlPerguntarIA, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfTokenIA
                },

                body: JSON.stringify({ pergunta: pergunta }),

                signal: controle.signal

            });


            const dados = await resposta.json().catch(() => ({}));

            removerCarregamento();


            if (!resposta.ok || dados.erro) {

                adicionarMensagem(
                    dados.erro || "Ocorreu um erro ao consultar a IA. Tente novamente.",
                    "ia",
                    true
                );

            } else {

                adicionarMensagem(dados.resposta || "Não consegui gerar uma resposta.", "ia", false);

            }

        } catch (erro) {

            removerCarregamento();

            adicionarMensagem(
                erro.name === "AbortError"
                    ? "A resposta demorou demais. Tente novamente."
                    : "Não consegui falar com a IA. Verifique sua conexão e tente de novo.",
                "ia",
                true
            );

        } finally {

            clearTimeout(limite);

            aguardando = false;

            botaoEnviar.disabled = false;

            campo.focus();

        }

    }


    botaoEnviar.addEventListener("click", enviarPergunta);

    // Enter envia; Shift + Enter quebra a linha
    campo.addEventListener("keydown", (evento) => {

        if (evento.key === "Enter" && !evento.shiftKey) {

            evento.preventDefault();

            enviarPergunta();

        }

    });

    // O campo cresce conforme o texto
    campo.addEventListener("input", () => {

        campo.style.height = "auto";

        campo.style.height = Math.min(campo.scrollHeight, 120) + "px";

    });


    // Ícones (Lucide)
    if (window.lucide) {
        window.lucide.createIcons();
    }

})();
