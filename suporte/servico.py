"""
Serviço da IA de suporte do StudyPlan.

Lê os PDFs da pasta `suporte/documentos/`, monta um índice de busca
(TF-IDF + FAISS, igual ao script_pdf.py original) e usa um agente Agno
(modelo da Groq) para responder com base nos trechos encontrados.

As bibliotecas pesadas (numpy, faiss, PyPDF2, agno) só são importadas
quando a primeira pergunta chega. Assim, se alguma não estiver instalada,
o resto do site continua funcionando normalmente.
"""

import hashlib
import logging
import re
import threading
import unicodedata
from pathlib import Path

logger = logging.getLogger(__name__)


PASTA_APP = Path(__file__).resolve().parent

# Coloque os PDFs aqui (a pasta "pdf" do projeto original).
PASTA_PDFS = PASTA_APP / "documentos"

TAMANHO_CHUNK = 700   # caracteres por trecho (o original usava 500)
SOBREPOSICAO = 150    # caracteres repetidos entre trechos vizinhos, para não cortar frases ao meio
TOP_K = 5             # trechos enviados para a IA em cada pergunta

MODELO = "openai/gpt-oss-20b"

INSTRUCOES = (
    "Responda apenas com base nos PDFs fornecidos. "
    "Escreva a resposta em português do Brasil, em texto corrido, direto e "
    "objetivo, sem usar tabelas. Use no máximo um ou dois parágrafos curtos, "
    "e cite o nome do documento de onde tirou a informação. "
    "Se a resposta não estiver nos trechos fornecidos, diga que não encontrou "
    "essa informação nos documentos e oriente o aluno a procurar a secretaria "
    "ou a coordenação do campus."
)


class ErroSuporte(Exception):
    """Erro com mensagem própria para mostrar ao aluno."""


# ---------------------------------------------------------------------------
# Nomes dos documentos (aparecem na resposta da IA)
# ---------------------------------------------------------------------------

_NOMES = [
    (("guia_estudante",), "Guia do Estudante EPTNM – Varginha 2025"),
    (("deliberacao",), "Deliberação nº 1/2022 – DEPT"),
    (("normativa",), "Instrução Normativa CEPT/CEPE/CEFET-MG nº 2/2025"),
    (("estagio", "estgio"), "Regulamento de Estágio Supervisionado – EPTNM"),
    (("disciplinar",), "Regime Disciplinar do Corpo Discente"),
    (("oriuentacoes", "orientacoes"), "Orientações para apresentação de atestado médico"),
]


def _sem_acento(texto):
    base = unicodedata.normalize("NFD", texto)
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


def nome_amigavel(arquivo):
    """Troca o nome do arquivo por um nome legível para o aluno."""
    puro = _sem_acento(arquivo).lower()

    for chaves, nome in _NOMES:
        if any(chave in puro for chave in chaves):
            return nome

    # Nome genérico: tira a extensão, o "(1)" e troca _ e - por espaço
    nome = re.sub(r"\.pdf$", "", arquivo, flags=re.I)
    nome = re.sub(r"\(\d+\)", "", nome)
    return re.sub(r"[_\-]+", " ", nome).strip()


# ---------------------------------------------------------------------------
# Leitura dos PDFs e índice de busca
# ---------------------------------------------------------------------------

def _tokenizar(texto):
    return re.findall(r"\w+", texto.lower())


def _ler_pdfs(pasta):
    """Devolve {nome do documento: texto}. Ignora PDFs repetidos e sem texto."""
    import PyPDF2

    pasta = Path(pasta)

    if not pasta.is_dir():
        raise ErroSuporte(
            "A IA de suporte ainda não está configurada (pasta de documentos não encontrada)."
        )

    documentos = {}
    vistos = set()

    for caminho in sorted(pasta.glob("*.pdf")):

        conteudo = caminho.read_bytes()
        impressao = hashlib.md5(conteudo).hexdigest()

        if impressao in vistos:
            logger.info("PDF repetido ignorado: %s", caminho.name)
            continue

        vistos.add(impressao)

        try:
            leitor = PyPDF2.PdfReader(str(caminho))
            texto = " ".join((pagina.extract_text() or "") for pagina in leitor.pages)
        except Exception:
            logger.exception("Não consegui ler o PDF %s", caminho.name)
            continue

        if not texto.strip():
            # PDF escaneado (só imagem): sem OCR não há texto para consultar.
            logger.warning("O PDF %s não tem texto e não será usado pela IA.", caminho.name)
            continue

        # Junta as quebras de linha do PDF: sem isso, os trechos cortam frases
        # no meio e a busca deixa de achar regras como "frequência de 75%".
        documentos[nome_amigavel(caminho.name)] = re.sub(r"\s+", " ", texto).strip()

    return documentos


def _dividir_texto(texto, tamanho=TAMANHO_CHUNK, sobreposicao=SOBREPOSICAO):
    passo = max(tamanho - sobreposicao, 1)

    return [texto[i:i + tamanho] for i in range(0, len(texto), passo)]


class Motor:
    """Índice de busca (TF-IDF + FAISS) sobre os trechos dos PDFs."""

    def __init__(self, pasta=PASTA_PDFS):
        import faiss
        import numpy as np

        documentos = _ler_pdfs(pasta)

        self.chunks_info = []
        for nome, texto in documentos.items():
            for chunk in _dividir_texto(texto):
                if chunk.strip():
                    self.chunks_info.append((nome, chunk))

        self.indice = None
        self.vocabulario = None

        if not self.chunks_info:
            return

        chunks = [texto for _, texto in self.chunks_info]

        docs_tokens = [_tokenizar(c) for c in chunks]

        vocabulario = {}
        for tokens in docs_tokens:
            for termo in set(tokens):
                if termo not in vocabulario:
                    vocabulario[termo] = len(vocabulario)

        n_docs = len(chunks)
        n_termos = len(vocabulario)

        tf = np.zeros((n_docs, n_termos), dtype="float32")
        for i, tokens in enumerate(docs_tokens):
            for termo in tokens:
                tf[i, vocabulario[termo]] += 1

        df = (tf > 0).sum(axis=0)
        idf = np.log((n_docs + 1) / (df + 1)) + 1
        tfidf = tf * idf

        normas = np.linalg.norm(tfidf, axis=1, keepdims=True)
        normas[normas == 0] = 1
        tfidf = tfidf / normas

        indice = faiss.IndexFlatIP(n_termos)
        indice.add(tfidf)

        self.indice = indice
        self.vocabulario = vocabulario

    def buscar(self, pergunta, top_k=TOP_K):
        """Devolve os top_k trechos [(documento, texto)] mais parecidos com a pergunta."""
        import numpy as np

        if self.indice is None:
            return []

        vetor = np.zeros((1, len(self.vocabulario)), dtype="float32")
        for termo in _tokenizar(pergunta):
            if termo in self.vocabulario:
                vetor[0, self.vocabulario[termo]] += 1

        norma = np.linalg.norm(vetor)
        if norma > 0:
            vetor = vetor / norma

        _, posicoes = self.indice.search(vetor, min(top_k, len(self.chunks_info)))

        return [self.chunks_info[i] for i in posicoes[0] if i != -1]


_motor = None
_trava = threading.Lock()


def obter_motor():
    """Cria o índice na primeira pergunta e reaproveita nas seguintes."""
    global _motor

    if _motor is None:
        with _trava:
            if _motor is None:
                _motor = Motor()

    return _motor


# ---------------------------------------------------------------------------
# Agente (Agno + Groq)
# ---------------------------------------------------------------------------

def _carregar_env():
    """Lê o arquivo .env (chave GROQ_API_KEY) da pasta do projeto."""
    from dotenv import load_dotenv

    load_dotenv()                                   # a partir da pasta atual
    load_dotenv(PASTA_APP.parent / ".env")          # ao lado do manage.py


def criar_agente():
    """Um agente novo por pergunta: não compartilha estado entre usuários."""
    from agno.agent import Agent
    from agno.models.groq import Groq

    _carregar_env()

    return Agent(
        model=Groq(
            id=MODELO,
            temperature=0.2,
            retries=2,
            delay_between_retries=2,
            exponential_backoff=True,
        ),
        instructions=INSTRUCOES,
    )


def montar_contexto(relevantes):
    contexto = ""

    for nome, texto in relevantes:
        contexto += f"\n--- {nome} ---\n{texto}"

    return contexto


def responder(pergunta):
    """Recebe a pergunta do aluno e devolve o texto da resposta."""
    motor = obter_motor()

    relevantes = motor.buscar(pergunta)

    contexto = montar_contexto(relevantes)

    if not contexto:
        return "Não encontrei nenhum conteúdo nos documentos para responder essa pergunta."

    agente = criar_agente()

    resposta = agente.run(
        f"""
Com base exclusivamente nos seguintes textos dos PDFs:

{contexto}

Pergunta: {pergunta}
"""
    )

    return str(resposta.content or "").strip()
