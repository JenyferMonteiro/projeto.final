from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash

from .models import Aluno
from sistema.models import Curso, Serie, Disciplina


def cadastro(request):
    if request.method == 'POST':
        nome = request.POST.get('nome')
        email = request.POST.get('email')
        senha = request.POST.get('senha')
        curso_id = request.POST.get('curso')
        serie_id = request.POST.get('serie')
        disciplinas_ids = request.POST.getlist('disciplinas')

        if Aluno.objects.filter(email=email).exists():
            return render(request, 'CadastroPerfil.html', {
                'erro': 'Este e-mail já está cadastrado.',
                'cursos': Curso.objects.all()
            })

        aluno = Aluno.objects.create_user(
            username=nome,
            email=email,
            password=senha
        )

        aluno.curso_id = curso_id
        aluno.save()

        disciplinas = Disciplina.objects.filter(
            id__in=disciplinas_ids
        )

        aluno.disciplinas_escolhidas.set(disciplinas)

        return redirect('login')

    return render(request, 'CadastroPerfil.html', {
        'cursos': Curso.objects.all()
    })


def filtrar_disciplinas(request):
    curso_id = request.GET.get('curso')
    ano = request.GET.get('serie')

    if not curso_id or not ano:
        return JsonResponse([], safe=False)

    try:
        serie = Serie.objects.get(
            curso_id=curso_id,
            ano=ano
        )
    except Serie.DoesNotExist:
        return JsonResponse([], safe=False)

    disciplinas = Disciplina.objects.filter(
        serie=serie,
        cursos__id=curso_id
    ).distinct()

    return JsonResponse([
        {
            'id': d.id,
            'nome': d.nome
        }
        for d in disciplinas
    ], safe=False)


def filtrar_formacao_geral(request):
    disciplinas = Disciplina.objects.filter(
        serie__isnull=True
    ).order_by('nome')

    return JsonResponse([
        {
            'id': d.id,
            'nome': d.nome
        }
        for d in disciplinas
    ], safe=False)


def login(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        senha = request.POST.get('senha')

        usuario = authenticate(
            request,
            username=email,
            password=senha
        )

        if usuario is not None and usuario.is_active:
            auth_login(request, usuario)
            return redirect('home')

        return render(request, 'LoginPerfil.html', {
            'erro': 'E-mail ou senha incorretos.'
        })

    return render(request, 'LoginPerfil.html')


@login_required
def home(request):
    from django.db.models import Sum
    from sistema.models import Atividade

    disciplinas = request.user.disciplinas_escolhidas.all().order_by('nome')
    tabela = []

    for disciplina in disciplinas:
        bims = []

        for bimestre in ['1', '2', '3', '4']:
            total_bimestre = Atividade.objects.filter(
                aluno=request.user,
                disciplina=disciplina,
                bimestre=bimestre
            ).aggregate(total=Sum('valor'))['total'] or 0

            bims.append(total_bimestre)

        total = sum(bims)
        falta = max(60 - total, 0)

        tabela.append({
            'id': disciplina.id,
            'nome': disciplina.nome,
            'bim1': bims[0],
            'bim2': bims[1],
            'bim3': bims[2],
            'bim4': bims[3],
            'total': total,
            'falta': falta,
        })

    return render(
        request,
        'PaginaHome.html',
        {'tabela': tabela}
    )


@login_required
def perfil(request):
    cursos = Curso.objects.all().order_by('nome')

    return render(
        request,
        'EdicaoPerfil.html',
        {
            'cursos': cursos
        }
    )

@login_required
@login_required
def atualizar_perfil(request):

    if request.method != 'POST':
        return JsonResponse(
            {'erro': 'Método inválido.'},
            status=405
        )

    aluno = request.user

    nome = request.POST.get('nome', '').strip()
    email = request.POST.get('email', '').strip()
    curso_id = request.POST.get('curso')
    senha = request.POST.get('senha', '').strip()

    if not nome:
        return JsonResponse(
            {'erro': 'O nome não pode ficar vazio.'},
            status=400
        )

    if not email:
        return JsonResponse(
            {'erro': 'O e-mail não pode ficar vazio.'},
            status=400
        )

    outro_aluno = Aluno.objects.filter(
        email=email
    ).exclude(
        id=aluno.id
    ).first()

    if outro_aluno:
        return JsonResponse(
            {'erro': 'Este e-mail já está cadastrado.'},
            status=400
        )

    aluno.username = nome
    aluno.email = email

    if curso_id:
        try:
            curso = Curso.objects.get(id=curso_id)
            aluno.curso = curso
        except Curso.DoesNotExist:
            return JsonResponse(
                {'erro': 'Curso não encontrado.'},
                status=400
            )

    if senha:
        aluno.set_password(senha)

    aluno.save()

    if senha:
        update_session_auth_hash(request, aluno)

    return JsonResponse({
        'ok': True,
        'nome': aluno.username,
        'email': aluno.email,
        'curso': aluno.curso.nome if aluno.curso else 'Não informado'
    })

@login_required
def tarefas(request):
    return render(request, 'PaginaTarefas.html')


@login_required
def duvidas(request):
    return render(request, 'Duvidas.html')


@login_required
def estatisticas(request):
    return render(request, 'PaginaEstatistica.html')


@login_required
def manual(request):
    return render(request, 'Manual.html')


@login_required
def criar_atividade(request):
    from django.db.models import Sum
    from sistema.models import Atividade

    if request.method != 'POST':
        return JsonResponse(
            {'erro': 'Método inválido.'},
            status=405
        )

    disciplina_id = request.POST.get('disciplina')
    nome = request.POST.get('nome', '').strip()
    valor = request.POST.get('valor')
    bimestre = request.POST.get('bimestre')

    if not disciplina_id or not nome or not valor or not bimestre:
        return JsonResponse(
            {'erro': 'Preencha todos os campos.'},
            status=400
        )

    if bimestre not in ['1', '2', '3', '4']:
        return JsonResponse(
            {'erro': 'Bimestre inválido.'},
            status=400
        )

    try:
        valor = float(valor)
    except ValueError:
        return JsonResponse(
            {'erro': 'O valor precisa ser um número.'},
            status=400
        )

    if valor < 0:
        return JsonResponse(
            {'erro': 'O valor não pode ser negativo.'},
            status=400
        )

    try:
        disciplina = request.user.disciplinas_escolhidas.get(
            id=disciplina_id
        )
    except Exception:
        return JsonResponse(
            {'erro': 'Disciplina não encontrada.'},
            status=404
        )

    Atividade.objects.create(
        aluno=request.user,
        disciplina=disciplina,
        nome=nome,
        valor=valor,
        bimestre=bimestre
    )

    atividades = Atividade.objects.filter(
        aluno=request.user,
        disciplina=disciplina,
        bimestre=bimestre
    ).order_by('id')

    return JsonResponse({
        'ok': True,
        'atividades': [
            {
                'id': a.id,
                'nome': a.nome,
                'valor': a.valor
            }
            for a in atividades
        ],
        'total_bimestre': atividades.aggregate(
            total=Sum('valor')
        )['total'] or 0
    })


@login_required
def listar_atividades(request):
    from django.db.models import Sum
    from sistema.models import Atividade

    disciplina_id = request.GET.get('disciplina')
    bimestre = request.GET.get('bimestre')

    if not disciplina_id or bimestre not in ['1', '2', '3', '4']:
        return JsonResponse(
            {'erro': 'Dados inválidos.'},
            status=400
        )

    try:
        disciplina = request.user.disciplinas_escolhidas.get(
            id=disciplina_id
        )
    except Exception:
        return JsonResponse(
            {'erro': 'Disciplina não encontrada.'},
            status=404
        )

    atividades = Atividade.objects.filter(
        aluno=request.user,
        disciplina=disciplina,
        bimestre=bimestre
    ).order_by('id')

    return JsonResponse({
        'atividades': [
            {
                'id': a.id,
                'nome': a.nome,
                'valor': a.valor
            }
            for a in atividades
        ],
        'total_bimestre': atividades.aggregate(
            total=Sum('valor')
        )['total'] or 0
    })


def resposta_do_bimestre(aluno, disciplina, bimestre):
    from django.db.models import Sum
    from sistema.models import Atividade

    atividades = Atividade.objects.filter(
        aluno=aluno,
        disciplina=disciplina,
        bimestre=bimestre
    ).order_by('id')

    return JsonResponse({
        'ok': True,
        'atividades': [
            {
                'id': a.id,
                'nome': a.nome,
                'valor': a.valor
            }
            for a in atividades
        ],
        'total_bimestre': atividades.aggregate(
            total=Sum('valor')
        )['total'] or 0
    })


@login_required
def editar_atividade(request):
    from sistema.models import Atividade

    if request.method != 'POST':
        return JsonResponse(
            {'erro': 'Método inválido.'},
            status=405
        )

    atividade_id = request.POST.get('atividade')
    nome = request.POST.get('nome', '').strip()
    valor = request.POST.get('valor')

    if not atividade_id or not nome or not valor:
        return JsonResponse(
            {'erro': 'Preencha todos os campos.'},
            status=400
        )

    try:
        valor = float(valor)
    except ValueError:
        return JsonResponse(
            {'erro': 'O valor precisa ser um número.'},
            status=400
        )

    if valor < 0:
        return JsonResponse(
            {'erro': 'O valor não pode ser negativo.'},
            status=400
        )

    try:
        atividade = Atividade.objects.get(
            id=atividade_id,
            aluno=request.user
        )
    except (Atividade.DoesNotExist, ValueError):
        return JsonResponse(
            {'erro': 'Atividade não encontrada.'},
            status=404
        )

    atividade.nome = nome
    atividade.valor = valor
    atividade.save()

    return resposta_do_bimestre(
        request.user,
        atividade.disciplina,
        atividade.bimestre
    )


@login_required
def excluir_atividade(request):
    from sistema.models import Atividade

    if request.method != 'POST':
        return JsonResponse(
            {'erro': 'Método inválido.'},
            status=405
        )

    atividade_id = request.POST.get('atividade')

    try:
        atividade = Atividade.objects.get(
            id=atividade_id,
            aluno=request.user
        )
    except (Atividade.DoesNotExist, ValueError):
        return JsonResponse(
            {'erro': 'Atividade não encontrada.'},
            status=404
        )

    disciplina = atividade.disciplina
    bimestre = atividade.bimestre

    atividade.delete()

    return resposta_do_bimestre(
        request.user,
        disciplina,
        bimestre
    )

@login_required
def listar_subatividades(request):
    from sistema.models import SubAtividade

    atividade_id = request.GET.get('atividade')

    if not atividade_id:
        return JsonResponse(
            {'erro': 'Atividade não informada.'},
            status=400
        )

    try:
        atividade = request.user.atividades.get(
            id=atividade_id
        )
    except Exception:
        return JsonResponse(
            {'erro': 'Atividade não encontrada.'},
            status=404
        )

    subatividades = SubAtividade.objects.filter(
        atividade=atividade
    ).order_by('id')

    return JsonResponse({
        'subatividades': [
            {
                'id': sub.id,
                'nome': sub.nome,
                'valor': sub.valor,
                'nota': sub.nota
            }
            for sub in subatividades
        ]
    })


@login_required
def criar_subatividade(request):
    from sistema.models import SubAtividade, Atividade

    if request.method != 'POST':
        return JsonResponse(
            {'erro': 'Método inválido.'},
            status=405
        )

    atividade_id = request.POST.get('atividade')
    nome = request.POST.get('nome', '').strip()
    valor = request.POST.get('valor')
    nota = request.POST.get('nota')

    if not atividade_id or not nome or not valor or nota is None:
        return JsonResponse(
            {'erro': 'Preencha todos os campos.'},
            status=400
        )

    try:
        valor = float(valor)
        nota = float(nota)
    except ValueError:
        return JsonResponse(
            {'erro': 'Valor ou nota inválidos.'},
            status=400
        )

    if valor <= 0:
        return JsonResponse(
            {'erro': 'O valor precisa ser maior que 0.'},
            status=400
        )

    if nota < 0 or nota > valor:
        return JsonResponse(
            {'erro': 'A nota precisa estar entre 0 e o valor da atividade.'},
            status=400
        )

    try:
        atividade = request.user.atividades.get(
            id=atividade_id
        )
    except Exception:
        return JsonResponse(
            {'erro': 'Atividade não encontrada.'},
            status=404
        )

    total_distribuido = sum(
        sub.valor
        for sub in atividade.subatividades.all()
    )

    if total_distribuido + valor > atividade.valor + 0.001:
        return JsonResponse(
            {
                'erro':
                    'A soma das sub-atividades não pode ultrapassar '
                    'o valor da atividade.'
            },
            status=400
        )

    sub = SubAtividade.objects.create(
        atividade=atividade,
        nome=nome,
        valor=valor,
        nota=nota
    )

    return JsonResponse({
        'ok': True,
        'subatividade': {
            'id': sub.id,
            'nome': sub.nome,
            'valor': sub.valor,
            'nota': sub.nota
        }
    })