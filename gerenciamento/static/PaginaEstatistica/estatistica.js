/**
 * StudyPlan - Script de Interatividade da Tela de Estatísticas em Sanfona (Accordion)
 * Focado 100% no acompanhamento individual da nota do aluno por matéria
 */

document.addEventListener("DOMContentLoaded", () => {
    const graficosInstancias = {};
    const dadosTodasDisciplinas = window.dadosDisciplinas || [];

    if (!dadosTodasDisciplinas || dadosTodasDisciplinas.length === 0) {
        console.warn("Nenhum dado de disciplina encontrado.");
        return;
    }

    // =========================================================================
    // FUNÇÃO PARA RENDERIZAR O GRÁFICO DE UMA DISCIPLINA ESPECÍFICA (APENAS NOTA)
    // =========================================================================
    function inicializarGraficoDisciplina(discId) {
        if (graficosInstancias[discId]) {
            return; // Já foi renderizado
        }

        const canvasElement = document.getElementById(`grafico-${discId}`);
        if (!canvasElement) return;

        const dados = dadosTodasDisciplinas.find(d => String(d.disciplina_id) === String(discId));
        if (!dados) return;

        const ctx = canvasElement.getContext("2d");

        // Notas reais do aluno por bimestre (1º a 4º)
        const notas = dados.notas_bimestres || [0, 0, 0, 0];

        const dadosGrafico = {
            labels: ["1º Bim", "2º Bim", "3º Bim", "4º Bim"],
            datasets: [
                {
                    label: "Nota do Aluno",
                    data: notas,
                    borderColor: "#1d63ff",
                    backgroundColor: "rgba(29, 99, 255, 0.08)",
                    borderWidth: 3,
                    tension: 0.35,
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    pointBackgroundColor: "#1d63ff",
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2.5,
                    fill: true,
                    order: 1
                }
            ]
        };

        const configuracoes = {
            type: "line",
            data: dadosGrafico,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index",
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: "#ffffff",
                        titleColor: "#0f172a",
                        bodyColor: "#1e293b",
                        borderColor: "#e2e8f0",
                        borderWidth: 1.5,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { weight: "700", size: 14 },
                        bodyFont: { size: 13 },
                        callbacks: {
                            title: function(items) {
                                return items[0].label;
                            },
                            label: function(context) {
                                const val = context.parsed.y;
                                if (val === null || val === undefined) return null;
                                return `Nota : ${val.toFixed(1)} pts`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 30,
                        ticks: {
                            stepSize: 8,
                            values: [0, 8, 16, 30],
                            color: "#64748b",
                            font: { size: 12 }
                        },
                        grid: {
                            color: "#f1f5f9",
                            borderDash: [4, 4],
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: "#64748b",
                            font: { size: 13, weight: "600" }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        };

        graficosInstancias[discId] = new Chart(ctx, configuracoes);
    }

    // =========================================================================
    // INTERATIVIDADE DA SANFONA (ACCORDION TOGGLE)
    // =========================================================================
    const headers = document.querySelectorAll(".accordion-header");
    headers.forEach(header => {
        header.addEventListener("click", () => {
            const discId = header.getAttribute("data-id");
            const itemPai = document.getElementById(`accordion-item-${discId}`);

            if (itemPai) {
                const estaAberto = itemPai.classList.contains("aberto");

                if (estaAberto) {
                    itemPai.classList.remove("aberto");
                } else {
                    itemPai.classList.add("aberto");
                    setTimeout(() => {
                        inicializarGraficoDisciplina(discId);
                    }, 50);
                }
            }
        });
    });

    // Renderizar o primeiro item aberto inicialmente
    const itensAbertos = document.querySelectorAll(".accordion-disciplina-item.aberto");
    itensAbertos.forEach(item => {
        const discId = item.id.replace("accordion-item-", "");
        if (discId) {
            inicializarGraficoDisciplina(discId);
        }
    });
});