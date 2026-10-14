/* =========================================================
   MENU (cabeçalho + menu lateral)
   Arquivo: static/PaginaHome/menu.js
   O estilo do menu fica no PaginaHome.css.
   ========================================================= */

(function () {

    document.addEventListener("DOMContentLoaded", () => {

        const estruturaGeral = `
            <header>

                <button
                    id="botao-menu"
                    class="but-menu"
                    type="button"
                    aria-expanded="false"
                    aria-controls="menu-lateral"
                >
                    <i data-lucide="menu"></i>
                </button>

                <div class="texto">
                    <span class="marca">Study<span class="marca-destaque">Plan</span></span>
                </div>

            </header>


            <div id="menu-lateral" class="Menu">

                <nav class="menu-nav" aria-label="Páginas do sistema">

                    <a href="${urlHome}" class="menu-link">
                        <i data-lucide="table"></i>
                        <span>Minhas notas</span>
                    </a>

                    <a href="${urlTarefas}" class="menu-link">
                        <i data-lucide="calendar"></i>
                        <span>Tarefas</span>
                    </a>

                    <a href="${urlDuvidas}" class="menu-link">
                        <i data-lucide="circle-help"></i>
                        <span>Dúvidas</span>
                    </a>

                    <a href="${urlEstatisticas}" class="menu-link">
                        <i data-lucide="chart-line"></i>
                        <span>Estatísticas</span>
                    </a>

                    <a href="${urlManual}" class="menu-link">
                        <i data-lucide="book-open"></i>
                        <span>Manual</span>
                    </a>

                </nav>


                <div id="menu-usuario" class="menu-usuario">

                    <div id="menu-usuario-painel" class="menu-usuario-painel">

                        <div class="menu-usuario-painel-interno">

                            <a href="${urlPerfil}" class="menu-link">
                                <i data-lucide="user"></i>
                                <span>Meu Perfil</span>
                            </a>

                        </div>

                    </div>

                    <button
                        id="botao-usuario"
                        class="menu-usuario-botao"
                        type="button"
                        aria-expanded="false"
                        aria-controls="menu-usuario-painel"
                    >

                        <span class="menu-usuario-avatar">
                            <i data-lucide="user"></i>
                        </span>

                        <span class="menu-usuario-texto">
                            <strong>Olá, ${nomeUsuario}</strong>
                            <small>Curso: ${cursoUsuario}</small>
                        </span>

                        <i data-lucide="chevron-up" class="menu-usuario-seta"></i>

                    </button>

                </div>

            </div>
        `;


        document.body.insertAdjacentHTML(
            "afterbegin",
            estruturaGeral
        );


        /* ---------- Abrir e fechar o menu ---------- */

        const botao = document.getElementById("botao-menu");

        const menu = document.getElementById("menu-lateral");


        function definirMenu(aberto) {

            menu.classList.toggle("aberto", aberto);

            botao.setAttribute("aria-expanded", aberto ? "true" : "false");

        }


        botao.addEventListener("click", () => {

            definirMenu(!menu.classList.contains("aberto"));

        });


        document.addEventListener("keydown", (evento) => {

            if (evento.key === "Escape" && menu.classList.contains("aberto")) {

                definirMenu(false);

                botao.focus();

            }

        });


        /* ---------- "Olá, apelido" expande o Meu Perfil ---------- */

        const caixaUsuario = document.getElementById("menu-usuario");

        const botaoUsuario = document.getElementById("botao-usuario");


        function definirUsuario(aberto) {

            caixaUsuario.classList.toggle("aberto", aberto);

            botaoUsuario.setAttribute("aria-expanded", aberto ? "true" : "false");

        }


        botaoUsuario.addEventListener("click", () => {

            definirUsuario(!caixaUsuario.classList.contains("aberto"));

        });


        /* ---------- Destaca a página atual ---------- */

        const paginaAtual = window.location.pathname;

        const linksMenu = document.querySelectorAll(".menu-link");


        linksMenu.forEach(link => {

            const endereco = new URL(
                link.href,
                window.location.origin
            ).pathname;


            if (paginaAtual === endereco) {

                link.classList.add("link-ativo");

                // Se for o Meu Perfil, o painel já abre e o botão fica em destaque
                if (caixaUsuario.contains(link)) {

                    caixaUsuario.classList.add("tem-ativo");

                    definirUsuario(true);

                }

            }

        });


        /* ---------- Ícones (Lucide) ---------- */

        function criarIcones() {

            if (window.lucide) {

                window.lucide.createIcons();

            }

        }


        if (window.lucide) {

            criarIcones();

        } else {

            // A página não carregou o Lucide: carrega aqui para os ícones aparecerem
            const lucideScript = document.createElement("script");

            lucideScript.src = "https://unpkg.com/lucide@latest";

            lucideScript.onload = criarIcones;

            document.head.appendChild(lucideScript);

        }

    });

})();