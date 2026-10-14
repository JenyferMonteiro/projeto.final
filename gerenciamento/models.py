from django.db import models

class Tarefa(models.Model):
    STATUS = [
        ('PENDENTE', 'Pendente'),
        ('PROGRESSO', 'Em progresso'),
        ('CONCLUIDO', 'Concluído'),
    ]
    
    aluno = models.ForeignKey('usuario.Aluno', on_delete=models.CASCADE, related_name='tarefas')
    titulo = models.CharField(max_length=100)
    data_limite = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS)