from django.db import models

class Curso(models.Model):
    nome = models.CharField(max_length=100)

    disciplinas = models.ManyToManyField(
        'Disciplina',
        related_name='cursos',
        blank=True
    )

    def __str__(self):
        return self.nome


class Serie(models.Model):
    curso = models.ForeignKey(
        Curso,
        on_delete=models.CASCADE,
        related_name='series',
        null=True,
        blank=True
    )

    ano = models.PositiveSmallIntegerField(
        choices=[
            (1, '1º Ano'),
            (2, '2º Ano'),
            (3, '3º Ano'),
        ]
    )

    def __str__(self):
        if self.curso:
            return f"{self.curso.nome} - {self.get_ano_display()}"

        return self.get_ano_display()


class Disciplina(models.Model):
    nome = models.CharField(max_length=100)
    aluno = models.ForeignKey(
        'usuario.Aluno',
        on_delete=models.CASCADE,
        related_name='disciplinas',
        null=True,
        blank=True
    )

    serie = models.ForeignKey(
        'Serie',
        on_delete=models.CASCADE,
        related_name='disciplinas',
        null=True,
        blank=True
    )

    def __str__(self):
        return self.nome


class DisciplinaTecnico(Disciplina):
    curso = models.ForeignKey(
        Curso,
        on_delete=models.CASCADE,
        related_name='disciplinas_tecnicas'
    )

    def __str__(self):
        return self.nome


class Atividade(models.Model):

    BIMESTRES = [
        ('1', 'Primeiro'),
        ('2', 'Segundo'),
        ('3', 'Terceiro'),
        ('4', 'Quarto'),
    ]

    aluno = models.ForeignKey(
        'usuario.Aluno',
        on_delete=models.CASCADE,
        related_name='atividades',
        null=True,
        blank=True
    )

    disciplina = models.ForeignKey(
        Disciplina,
        on_delete=models.CASCADE,
        related_name='atividades'
    )

    nome = models.CharField(max_length=100)

    valor = models.FloatField()

    bimestre = models.CharField(
        max_length=1,
        choices=BIMESTRES
    )

    def __str__(self):
        return self.nome
