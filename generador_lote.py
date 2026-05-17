from __future__ import annotations

import argparse
import mimetypes
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types


RUTA_BASE = Path(__file__).resolve().parent
RUTA_PROYECTOS = RUTA_BASE / "proyectos"
MODELO_IMAGEN = "gemini-2.5-flash-image"
TIMEOUT_SEGUNDOS = 90
MAX_ACCIONES_EJECUCION = 3

lista_acciones = [
    "atacando con espada",
    "pose neutral de frente",
    "pose de derrota",
    "lanzando un hechizo",
    "defendiendo con escudo",
]


def normalizar_nombre_archivo(texto: str) -> str:
    texto_limpio = re.sub(r"[^a-z0-9]+", "_", texto.lower()).strip("_")
    return f"{texto_limpio or 'imagen_generada'}.jpg"


def cargar_api_key() -> str:
    nombre_env = os.getenv("ENV_FILE", ".env").strip() or ".env"
    ruta_env = RUTA_BASE / nombre_env

    if ruta_env.exists():
        load_dotenv(dotenv_path=ruta_env)
    else:
        load_dotenv()

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "No se encontro GEMINI_API_KEY ni GOOGLE_API_KEY en variables de entorno. "
            "Crea .env con GEMINI_API_KEY=tu_clave o define ENV_FILE con otro archivo .env."
        )

    marcador_invalido = {
        "TU_API_KEY_AQUI",
        "YOUR_API_KEY_HERE",
        "API_KEY",
    }
    if api_key.strip().upper() in marcador_invalido or "TU_API_KEY" in api_key.upper():
        raise RuntimeError(
            "La API key en .env parece ser un placeholder (ej: TU_API_KEY_AQUI). "
            "Reemplazala por una clave real creada en Google AI Studio."
        )

    return api_key


def obtener_mime_type(ruta_imagen: Path) -> str:
    mime_type, _ = mimetypes.guess_type(ruta_imagen.name)
    return mime_type or "image/jpeg"


def extraer_partes_imagen(respuesta: types.GenerateContentResponse) -> list[types.Part]:
    partes_detectadas: list[types.Part] = []

    # Camino 1: propiedad de conveniencia del SDK.
    for parte in respuesta.parts or []:
        if getattr(parte, "inline_data", None):
            partes_detectadas.append(parte)

    # Camino 2: algunos modelos devuelven imagen en candidates[].content.parts.
    for candidato in respuesta.candidates or []:
        contenido = getattr(candidato, "content", None)
        for parte in getattr(contenido, "parts", []) or []:
            if getattr(parte, "inline_data", None):
                partes_detectadas.append(parte)

    return partes_detectadas


def describir_fallo_generacion(respuesta: types.GenerateContentResponse) -> str:
    detalles: list[str] = []

    if respuesta.prompt_feedback and respuesta.prompt_feedback.block_reason:
        detalles.append(f"block_reason={respuesta.prompt_feedback.block_reason}")
        if respuesta.prompt_feedback.block_reason_message:
            detalles.append(
                f"block_reason_message={respuesta.prompt_feedback.block_reason_message}"
            )

    for indice, candidato in enumerate(respuesta.candidates or []):
        if candidato.finish_reason:
            detalles.append(f"candidate_{indice}_finish_reason={candidato.finish_reason}")
        if candidato.finish_message:
            detalles.append(f"candidate_{indice}_finish_message={candidato.finish_message}")

    if respuesta.text:
        texto = respuesta.text.strip().replace("\n", " ")
        if texto:
            detalles.append(f"texto={texto[:180]}")

    return " | ".join(detalles) if detalles else "Sin detalles de diagnostico en la respuesta."


def generar_prompt(accion: str) -> str:
    return (
        f"Mismo personaje de la imagen de referencia, {accion}. "
        "Mantener rasgos principales y vestimenta. "
        "Fondo blanco puro, sin sombras, estilo ilustracion 2D clean line art."
    )


def generar_prompts_fallback(accion: str) -> list[str]:
    return [
        generar_prompt(accion),
        (
            "Use the attached image as character reference. "
            f"Generate a full-body 2D clean line art pose: {accion}. "
            "Preserve key visual traits and outfit from the reference. "
            "Pure white background, no shadows. Output image only."
        ),
    ]


def obtener_nombre_proyecto() -> str | None:
    parser = argparse.ArgumentParser(
        description=(
            "Genera assets en lote usando una referencia. "
            "Si se indica un proyecto, usa proyectos/<nombre>/referencia.jpg"
        )
    )
    parser.add_argument(
        "--proyecto",
        type=str,
        default=os.getenv("LOTE_PROYECTO", ""),
        help="Nombre de subproyecto dentro de la carpeta proyectos/",
    )
    args = parser.parse_args()

    nombre = (args.proyecto or "").strip()
    return nombre or None


def resolver_rutas(nombre_proyecto: str | None) -> tuple[Path, Path, Path]:
    if not nombre_proyecto:
        ruta_proyecto = RUTA_BASE
    else:
        nombre_limpio = re.sub(r"[^a-zA-Z0-9_\-]+", "_", nombre_proyecto).strip("_")
        if not nombre_limpio:
            raise ValueError("El nombre del proyecto no es valido.")
        ruta_proyecto = RUTA_PROYECTOS / nombre_limpio

    ruta_referencia = ruta_proyecto / "referencia.jpg"
    ruta_salida = ruta_proyecto / "assets_produccion"
    return ruta_proyecto, ruta_referencia, ruta_salida


def main() -> None:
    nombre_proyecto = obtener_nombre_proyecto()
    ruta_proyecto, ruta_referencia, ruta_salida = resolver_rutas(nombre_proyecto)

    if nombre_proyecto:
        ruta_proyecto.mkdir(parents=True, exist_ok=True)
        print(f"Proyecto activo: {ruta_proyecto}")

    api_key = cargar_api_key()

    if not ruta_referencia.exists():
        raise FileNotFoundError(
            "No se encontro la imagen de referencia en: "
            f"{ruta_referencia}"
        )

    ruta_salida.mkdir(parents=True, exist_ok=True)

    mime_type = obtener_mime_type(ruta_referencia)
    referencia_bytes = ruta_referencia.read_bytes()
    referencia_part = types.Part.from_bytes(data=referencia_bytes, mime_type=mime_type)

    with genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=TIMEOUT_SEGUNDOS * 1000),
    ) as client:
        for accion in lista_acciones[:MAX_ACCIONES_EJECUCION]:
            nombre_archivo = normalizar_nombre_archivo(accion)
            ruta_destino = ruta_salida / nombre_archivo
            prompts = generar_prompts_fallback(accion)

            try:
                imagen_guardada = False
                for intento, prompt in enumerate(prompts, start=1):
                    respuesta = client.models.generate_content(
                        model=MODELO_IMAGEN,
                        contents=[prompt, referencia_part],
                        config=types.GenerateContentConfig(
                            response_modalities=["IMAGE"],
                            temperature=0.4,
                        ),
                    )

                    if respuesta.prompt_feedback and respuesta.prompt_feedback.block_reason:
                        print(
                            "Bloqueado por seguridad para "
                            f"'{accion}' (intento {intento}): {respuesta.prompt_feedback.block_reason} "
                            f"{respuesta.prompt_feedback.block_reason_message or ''}".strip()
                        )
                        break

                    partes_imagen = extraer_partes_imagen(respuesta)
                    if partes_imagen:
                        partes_imagen[0].as_image().save(ruta_destino)
                        print(f"Imagen guardada en: {ruta_destino}")
                        imagen_guardada = True
                        break

                    detalle_fallo = describir_fallo_generacion(respuesta)
                    print(
                        f"No se genero imagen para '{accion}' en intento {intento}. "
                        f"Detalle: {detalle_fallo}"
                    )

                if not imagen_guardada:
                    print(f"Se agotaron los intentos para '{accion}'.")

            except errors.APIError as error:
                print(f"Error de API en '{accion}': {error.code} - {error.message}")
                if error.code == 403 and "generativelanguage.googleapis.com" in str(error.message):
                    print(
                        "Deteniendo lote: la API Gemini parece deshabilitada para este proyecto. "
                        "Habilitala en Google Cloud Console y espera unos minutos antes de reintentar."
                    )
                    break
            except KeyboardInterrupt:
                print("Ejecucion interrumpida por usuario. Se detiene el lote de forma controlada.")
                break
            except Exception as error:
                print(f"Error inesperado en '{accion}': {error}")
            finally:
                time.sleep(4)


if __name__ == "__main__":
    main()