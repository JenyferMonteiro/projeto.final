from django.urls import path
from .views import CursoListView, CursoDisciplinasView, FormacaoGeralView

urlpatterns = [
    path(
        'cursos/',
        CursoListView.as_view(),
        name='curso-list'
    ),

    path(
        'cursos/<int:curso_id>/disciplinas/',
        CursoDisciplinasView.as_view(),
        name='curso-disciplinas'
    ),

    path(
        'formacao-geral/disciplinas/',
        FormacaoGeralView.as_view(),
        name='formacao-geral-disciplinas'
    ),
]