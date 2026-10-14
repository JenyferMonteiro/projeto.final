from django.contrib import admin
from .models import Curso, Disciplina, DisciplinaTecnico, Atividade, Serie


@admin.register(Curso)
class CursoAdmin(admin.ModelAdmin):
    filter_horizontal = ('disciplinas',)


@admin.register(Disciplina)
class DisciplinaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'serie', 'aluno')
    list_filter = ('serie',)
    search_fields = ('nome',)


@admin.register(DisciplinaTecnico)
class DisciplinaTecnicoAdmin(admin.ModelAdmin):
    list_display = ('nome', 'curso', 'serie', 'aluno')
    list_filter = ('curso', 'serie')
    search_fields = ('nome',)


@admin.register(Serie)
class SerieAdmin(admin.ModelAdmin):
    list_display = ('curso', 'ano')
    list_filter = ('curso', 'ano')


@admin.register(Atividade)
class AtividadeAdmin(admin.ModelAdmin):
    list_display = ('nome', 'disciplina', 'valor', 'bimestre')
    list_filter = ('bimestre', 'disciplina')