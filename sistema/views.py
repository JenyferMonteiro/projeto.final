from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Curso, Disciplina
from .serializers import CursoSerializer


class CursoListView(APIView):

    def get(self, request):
        cursos = Curso.objects.all().order_by('nome')

        serializer = CursoSerializer(
            cursos,
            many=True
        )

        return Response(serializer.data)


class CursoDisciplinasView(APIView):
    """Disciplinas técnicas do curso, com o ano de cada uma."""

    def get(self, request, curso_id):

        try:
            curso = Curso.objects.get(id=curso_id)
        except Curso.DoesNotExist:
            return Response(
                {'erro': 'Curso não encontrado.'},
                status=status.HTTP_404_NOT_FOUND
            )

        disciplinas = curso.disciplinas.all()

        # "serie" continua opcional
        serie_id = request.GET.get('serie')
        if serie_id:
            disciplinas = disciplinas.filter(serie_id=serie_id)

        dados = disciplinas.order_by('serie__ano', 'nome').values(
            'id', 'nome', 'serie__ano'
        )

        return Response([
            {
                'id': d['id'],
                'nome': d['nome'],
                'ano': d['serie__ano'],
            }
            for d in dados
        ])


class FormacaoGeralView(APIView):
    """Disciplinas de Formação Geral: não são técnicas e não são de um aluno."""

    def get(self, request):
        disciplinas = Disciplina.objects.filter(
            aluno__isnull=True,
            disciplinatecnico__isnull=True
        ).order_by('nome')

        return Response([
            {'id': d.id, 'nome': d.nome}
            for d in disciplinas
        ])