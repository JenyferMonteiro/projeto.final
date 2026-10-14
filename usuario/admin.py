from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Aluno

admin.site.register(Aluno, UserAdmin)