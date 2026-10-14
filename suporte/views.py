import json
import logging

from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from . import servico

logger = logging.getLogger(__name__)


TAMANHO_MAXIMO = 500       # caracteres por pergunta
LIMITE_POR_MINUTO = 10     # perguntas por aluno, para não gastar a cota da IA


def _passou_do_limite(usuario_id):
    chave = f"suporte-ia:{usuario_id}"

    cache.add(chave, 0, timeout=60)

    try:
        total = cache.incr(chave)
    except ValueError:
        cache.set(chave, 1, timeout=60)
        total = 1

    return total > LIMITE_POR_MINUTO


@require_POST
def perguntar(request):

    # Chamada feita pelo chat (fetch): responde em JSON, sem redirecionar
    if not request.user.is_authenticated:
        return JsonResponse(
            {"erro": "Faça login para usar o suporte."},
            status=401,
        )

    try:
        dados = json.loads(request.body or "{}")
    except ValueError:
        return JsonResponse({"erro": "Pedido inválido."}, status=400)

    if not isinstance(dados, dict):
        return JsonResponse({"erro": "Pedido inválido."}, status=400)

    pergunta = str(dados.get("pergunta", "")).strip()

    if not pergunta:
        return JsonResponse({"erro": "Digite uma pergunta."}, status=400)

    if len(pergunta) > TAMANHO_MAXIMO:
        return JsonResponse(
            {"erro": f"A pergunta pode ter no máximo {TAMANHO_MAXIMO} caracteres."},
            status=400,
        )

    if _passou_do_limite(request.user.id):
        return JsonResponse(
            {"erro": "Você fez muitas perguntas em pouco tempo. Aguarde um minuto e tente de novo."},
            status=429,
        )

    try:
        resposta = servico.responder(pergunta)

    except servico.ErroSuporte as erro:
        return JsonResponse({"erro": str(erro)}, status=503)

    except Exception:
        logger.exception("Erro ao consultar a IA de suporte")

        return JsonResponse(
            {"erro": "Ocorreu um erro ao consultar a IA. Tente novamente."},
            status=500,
        )

    return JsonResponse({"resposta": resposta})
