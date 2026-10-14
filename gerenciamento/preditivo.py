import pandas as pd
import numpy as np
from django.db.models import Sum
from sistema.models import Atividade, Disciplina, Curso, Serie
from usuario.models import Aluno


# Configurações padrão do CEFET-MG / Ensino Técnico
MAX_PONTOS_BIMESTRES = {
    '1': 20.0,
    '2': 30.0,
    '3': 20.0,
    '4': 30.0,
}

MEDIAS_ESPERADAS = {
    '1': 12.0,  # 60% de 20
    '2': 18.0,  # 60% de 30
    '3': 12.0,  # 60% de 20
    '4': 18.0,  # 60% de 30
}

MEDIA_BIM_IMPAR = 12.0
MEDIA_BIM_PAR = 18.0
META_APROVACAO = 60.0
MAX_PONTOS_ANO = 100.0


class SistemaPreditivo:
    """
    Sistema Preditivo e Analítico baseado em Pandas para notas e desempenho de alunos.
    Implementa agregação de notas por bimestre, médias pares/ímpares, projeções lineares
    e metas preditivas para aprovação (meta 60 pontos).
    """

    @classmethod
    def obter_dataframe_atividades(cls, aluno=None, disciplina=None):
        """
        Gera um DataFrame Pandas com todas as atividades cadastradas.
        """
        queryset = Atividade.objects.all()
        if aluno:
            queryset = queryset.filter(aluno=aluno)
        if disciplina:
            queryset = queryset.filter(disciplina=disciplina)

        dados = list(queryset.values(
            'id',
            'aluno_id',
            'aluno__username',
            'disciplina_id',
            'disciplina__nome',
            'bimestre',
            'valor',
            'nome'
        ))

        if not dados:
            return pd.DataFrame(columns=[
                'id', 'aluno_id', 'aluno__username',
                'disciplina_id', 'disciplina__nome',
                'bimestre', 'valor', 'nome'
            ])

        df = pd.DataFrame(dados)
        df['valor'] = pd.to_numeric(df['valor'], errors='coerce').fillna(0.0)
        df['bimestre'] = df['bimestre'].astype(str)
        return df

    @classmethod
    def analisar_disciplina_aluno(cls, aluno, disciplina):
        """
        Analisa o desempenho preditivo de um aluno em uma disciplina específica com Pandas.
        """
        df = cls.obter_dataframe_atividades(aluno=aluno, disciplina=disciplina)

        # Mapa com as notas por bimestre
        notas_bimestres = {'1': 0.0, '2': 0.0, '3': 0.0, '4': 0.0}
        bimestres_com_dados = set()

        if not df.empty:
            agrupado = df.groupby('bimestre')['valor'].sum().to_dict()
            for bim, val in agrupado.items():
                if str(bim) in notas_bimestres:
                    notas_bimestres[str(bim)] = float(round(val, 2))
                    if val > 0:
                        bimestres_com_dados.add(str(bim))

        # Se o aluno não tiver atividades cadastradas para esta disciplina no banco,
        # ou se for a exibição inicial de exemplo (ex.: Matemática no modelo de exemplo),
        # podemos fornecer os dados do exemplo caso não haja nenhuma atividade.
        # Se o aluno não tiver atividades cadastradas para esta disciplina no banco,
        # fornecemos um modelo analítico estruturado para exibição no painel.
        usando_exemplo = False
        if not bimestres_com_dados:
            nome_lower = disciplina.nome.lower()
            if 'matem' in nome_lower:
                notas_bimestres = {'1': 15.0, '2': 20.0, '3': 13.0, '4': 25.0}
            elif 'portug' in nome_lower or 'redaç' in nome_lower:
                notas_bimestres = {'1': 14.0, '2': 22.0, '3': 15.0, '4': 24.0}
            elif 'fís' in nome_lower or 'fis' in nome_lower:
                notas_bimestres = {'1': 11.0, '2': 16.0, '3': 10.0, '4': 18.0}
            elif 'quí' in nome_lower or 'qui' in nome_lower:
                notas_bimestres = {'1': 16.0, '2': 21.0, '3': 14.0, '4': 26.0}
            elif 'hist' in nome_lower or 'filo' in nome_lower:
                notas_bimestres = {'1': 13.0, '2': 19.0, '3': 12.0, '4': 20.0}
            else:
                notas_bimestres = {'1': 13.5, '2': 18.5, '3': 12.5, '4': 21.0}
            bimestres_com_dados = {'1', '2', '3', '4'}
            usando_exemplo = True

        total_atual = sum(notas_bimestres.values())
        falta_para_60 = max(META_APROVACAO - total_atual, 0.0)

        # Médias de bimestres ímpares (1 e 3) e pares (2 e 4)
        notas_impares = [notas_bimestres['1'], notas_bimestres['3']]
        notas_pares = [notas_bimestres['2'], notas_bimestres['4']]
        media_real_impar = float(np.mean(notas_impares)) if notas_impares else MEDIA_BIM_IMPAR
        media_real_par = float(np.mean(notas_pares)) if notas_pares else MEDIA_BIM_PAR

        # Cálculo Preditivo com Pandas / NumPy para bimestres pendentes
        bimestres_pendentes = [b for b in ['1', '2', '3', '4'] if b not in bimestres_com_dados]
        bimestres_concluidos = [b for b in ['1', '2', '3', '4'] if b in bimestres_com_dados]

        projecao_notas = dict(notas_bimestres)
        metas_necessarias = {}

        if bimestres_concluidos:
            pontos_concluidos = sum(notas_bimestres[b] for b in bimestres_concluidos)
            max_concluidos = sum(MAX_PONTOS_BIMESTRES[b] for b in bimestres_concluidos)
            taxa_aproveitamento = (pontos_concluidos / max_concluidos) if max_concluidos > 0 else 0.6
        else:
            taxa_aproveitamento = 0.6

        # Estimar notas futuras com base na tendência
        for bim in bimestres_pendentes:
            proj = taxa_aproveitamento * MAX_PONTOS_BIMESTRES[bim]
            projecao_notas[bim] = round(proj, 1)

        total_projetado = sum(projecao_notas.values())

        # Distribuir pontos restantes necessários para aprovação (meta 60)
        max_pendentes = sum(MAX_PONTOS_BIMESTRES[b] for b in bimestres_pendentes)
        for bim in bimestres_pendentes:
            if max_pendentes > 0 and falta_para_60 > 0:
                meta_bim = falta_para_60 * (MAX_PONTOS_BIMESTRES[bim] / max_pendentes)
                metas_necessarias[bim] = min(round(meta_bim, 1), MAX_PONTOS_BIMESTRES[bim])
            else:
                metas_necessarias[bim] = 0.0

        # Montagem dos cartões de bimestres
        cards_bimestres = []
        for i, bim in enumerate(['1', '2', '3', '4'], start=1):
            nota = notas_bimestres[bim]
            max_pts = MAX_PONTOS_BIMESTRES[bim]
            media_ref = MEDIAS_ESPERADAS[bim]
            status = 'acima' if nota >= media_ref else 'abaixo'
            is_predicao = bim in bimestres_pendentes and not usando_exemplo

            cards_bimestres.append({
                'numero': i,
                'titulo': f'{i}º Bimestre',
                'nota': nota,
                'nota_formatada': f'{nota:.1f}',
                'max_pontos': int(max_pts),
                'media_referencia': media_ref,
                'status': status,
                'tipo': 'Ímpar' if i % 2 != 0 else 'Par',
                'is_predicao': is_predicao,
                'projecao': projecao_notas[bim],
                'meta_necessaria': metas_necessarias.get(bim, None),
            })

        # Diagnóstico Preditivo
        if total_atual >= META_APROVACAO:
            diagnostico = "Aprovado! Você já atingiu os 60 pontos necessários para aprovação."
            status_geral = "aprovado"
        elif total_projetado >= META_APROVACAO:
            diagnostico = f"Bom ritmo! Pela tendência atual, sua nota projetada é {total_projetado:.1f} pontos (Meta: 60)."
            status_geral = "ritmo_bom"
        else:
            diagnostico = f"Atenção necessária: faltam {falta_para_60:.1f} pontos para aprovação. Consulte as metas sugeridas."
            status_geral = "em_risco"

        return {
            'disciplina_id': disciplina.id,
            'disciplina_nome': disciplina.nome,
            'icone_svg': cls.obter_icone_svg_disciplina(disciplina.nome),
            'notas_bimestres': [notas_bimestres['1'], notas_bimestres['2'], notas_bimestres['3'], notas_bimestres['4']],
            'projecao_bimestres': [projecao_notas['1'], projecao_notas['2'], projecao_notas['3'], projecao_notas['4']],
            'total_atual': round(total_atual, 1),
            'meta_aprovacao': META_APROVACAO,
            'falta_para_60': round(falta_para_60, 1),
            'total_projetado': round(total_projetado, 1),
            'media_bim_impar': MEDIA_BIM_IMPAR,
            'media_bim_par': MEDIA_BIM_PAR,
            'media_real_impar': round(media_real_impar, 1),
            'media_real_par': round(media_real_par, 1),
            'cards_bimestres': cards_bimestres,
            'diagnostico': diagnostico,
            'status_geral': status_geral,
            'taxa_aproveitamento_pct': round(taxa_aproveitamento * 100, 1),
            'usando_exemplo': usando_exemplo,
        }

    @classmethod
    def obter_icone_svg_disciplina(cls, nome):
        n = nome.lower()
        if 'matem' in n:
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="12" x2="15" y2="12"></line><line x1="12" y1="9" x2="12" y2="15"></line></svg>'
        if any(k in n for k in ['acionamento', 'elétr', 'eletr', 'circuito']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>'
        if any(k in n for k in ['móve', 'mouve', 'mobile']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>'
        if 'web' in n:
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><circle cx="6" cy="6" r="1"></circle><circle cx="9" cy="6" r="1"></circle></svg>'
        if 'arte' in n:
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.7-.71 1.7-1.63 0-.44-.18-.85-.46-1.16-.27-.31-.44-.73-.44-1.21 0-.92.71-1.7 1.63-1.7H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z"></path><circle cx="6.5" cy="11.5" r="1.5"></circle><circle cx="9.5" cy="7.5" r="1.5"></circle><circle cx="14.5" cy="7.5" r="1.5"></circle><circle cx="17.5" cy="11.5" r="1.5"></circle></svg>'
        if any(k in n for k in ['autom', 'robót', 'robot']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="15" x2="23" y2="15"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="15" x2="4" y2="15"></line></svg>'
        if 'banco' in n or 'dado' in n:
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>'
        if any(k in n for k in ['program', 'linguagem', 'desenvolv', 'código', 'algorit']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>'
        if 'rede' in n:
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>'
        if any(k in n for k in ['desenho', 'projeto', 'arquit']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>'
        if any(k in n for k in ['estrutura', 'solo', 'edifica', 'constru', 'material']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>'
        if 'hidráu' in n or 'fluido' in n:
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>'
        if any(k in n for k in ['mecân', 'máquina', 'usina', 'solda', 'metro']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'
        if 'biol' in n:
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.4 19 2c1 2 2 4.18 2 8 0 5.5-4.7 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>'
        if 'quím' in n or 'quim' in n:
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55A2 2 0 0 0 6.512 23h10.976a2 2 0 0 0 1.792-2.45L14.21 10.423A2 2 0 0 1 14 9.527V2"></path><line x1="8.5" y1="2" x2="15.5" y2="2"></line></svg>'
        if 'fís' in n or 'fis' in n:
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><circle cx="12" cy="12" r="2"></circle><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>'
        if any(k in n for k in ['portug', 'lingua', 'inglê', 'redaç', 'literat']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>'
        if any(k in n for k in ['histó', 'filos', 'socio', 'geogr']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
        if any(k in n for k in ['informá', 'computa', 'hardware']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>'
        if any(k in n for k in ['engenhar', 'software', 'qualid', 'seguran']):
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>'

        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="22" height="22" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>'

    @classmethod
    def obter_estatisticas_completas_aluno(cls, aluno):
        """
        Retorna as estatísticas preditivas para todas as disciplinas escolhidas pelo aluno.
        """
        disciplinas = list(aluno.disciplinas_escolhidas.all().order_by('nome'))
        existentes_ids = {d.id for d in disciplinas}

        # Garantir que tenhamos uma lista variada de matérias para preencher o sanfona
        if len(disciplinas) < 5:
            outras = []
            if aluno.curso:
                outras = list(Disciplina.objects.filter(cursos=aluno.curso).exclude(id__in=existentes_ids).order_by('nome'))
            if not outras:
                outras = list(Disciplina.objects.all().exclude(id__in=existentes_ids).order_by('nome'))
            
            for d in outras:
                if d.id not in existentes_ids and len(disciplinas) < 6:
                    disciplinas.append(d)
                    existentes_ids.add(d.id)

        # Priorizar Matemática no topo
        matematica = Disciplina.objects.filter(nome__icontains='matem').first()
        if matematica and matematica in disciplinas:
            disciplinas = [d for d in disciplinas if d.id != matematica.id]
            disciplinas.insert(0, matematica)

        resultado_disciplinas = []
        for disc in disciplinas:
            analise = cls.analisar_disciplina_aluno(aluno, disc)
            resultado_disciplinas.append(analise)

        return resultado_disciplinas

    @classmethod
    def obter_painel_admin(cls):
        """
        Calcula com Pandas indicadores globais de todos os alunos para a visão administrativa / coordenação.
        """
        alunos = Aluno.objects.all().order_by('username')
        df_atividades = cls.obter_dataframe_atividades()

        total_alunos = alunos.count()
        total_atividades = df_atividades.shape[0]

        alunos_resumo = []
        aprovados_count = 0
        em_risco_count = 0

        for a in alunos:
            # Total de pontos somados por aluno
            if not df_atividades.empty and a.id in df_atividades['aluno_id'].values:
                sub_df = df_atividades[df_atividades['aluno_id'] == a.id]
                total_pts = float(sub_df['valor'].sum())
            else:
                total_pts = 0.0

            status = 'Aprovado' if total_pts >= META_APROVACAO else ('Em Risco' if total_pts < 30 else 'Em Andamento')
            if total_pts >= META_APROVACAO:
                aprovados_count += 1
            elif total_pts < 30 and sub_df.shape[0] if not df_atividades.empty and a.id in df_atividades['aluno_id'].values else 0 > 0:
                em_risco_count += 1

            alunos_resumo.append({
                'id': a.id,
                'nome': a.username,
                'email': a.email,
                'curso': a.curso.nome if a.curso else 'Não informado',
                'total_pontos': round(total_pts, 1),
                'status': status,
            })

        return {
            'total_alunos': total_alunos,
            'total_atividades': total_atividades,
            'aprovados_count': aprovados_count,
            'em_risco_count': em_risco_count,
            'alunos_resumo': alunos_resumo,
        }