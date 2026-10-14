from django.urls import path

from . import views

urlpatterns = [
    path("perguntar/", views.perguntar, name="suporte_perguntar"),
]
