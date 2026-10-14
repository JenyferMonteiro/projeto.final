/* =========================================================
   DÚVIDAS (PERGUNTAS FREQUENTES)  -  Comportamento
   Arquivo: static/PaginaDuvidas/PaginaDuvidas.js

   Clicar na pergunta abre / fecha a resposta.
   Para abrir uma de cada vez, troque no HTML:
       <div class="faq-lista" data-um-por-vez="true">
   ========================================================= */

(function () {

    const lista = document.querySelector(".faq-lista");

    if (!lista) {
        return;
    }


    const umPorVez = lista.dataset.umPorVez === "true";

    const itens = Array.from(lista.querySelectorAll(".faq-item"));


    function definir(item, aberto) {

        const botao = item.querySelector(".faq-pergunta");

        item.classList.toggle("aberto", aberto);

        botao.setAttribute("aria-expanded", aberto ? "true" : "false");

    }


    // Liga cada pergunta à sua resposta (os ids são criados aqui,
    // então no HTML basta copiar e colar um bloco)
    itens.forEach((item, indice) => {

        const botao = item.querySelector(".faq-pergunta");

        const resposta = item.querySelector(".faq-resposta");

        botao.id = `faq-pergunta-${indice + 1}`;

        resposta.id = `faq-resposta-${indice + 1}`;

        botao.setAttribute("aria-controls", resposta.id);

        resposta.setAttribute("role", "region");

        resposta.setAttribute("aria-labelledby", botao.id);

        definir(item, item.classList.contains("aberto"));

    });


    lista.addEventListener("click", (evento) => {

        const botao = evento.target.closest(".faq-pergunta");

        if (!botao) {
            return;
        }


        const item = botao.closest(".faq-item");

        const vaiAbrir = !item.classList.contains("aberto");


        if (umPorVez && vaiAbrir) {

            itens.forEach((outro) => {

                if (outro !== item) {
                    definir(outro, false);
                }

            });

        }


        definir(item, vaiAbrir);

    });


    // Ícones (Lucide)
    if (window.lucide) {
        window.lucide.createIcons();
    }

})();