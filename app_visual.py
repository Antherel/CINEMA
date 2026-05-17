from __future__ import annotations

import os
import re
import time
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv
from google import genai
from google.genai import errors, types


RUTA_BASE = Path(__file__).resolve().parent
RUTA_PROYECTOS = RUTA_BASE / "proyectos"
MODELO_IMAGEN = "gemini-2.5-flash-image"


def normalizar_nombre(texto: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", texto).strip("_")


def normalizar_nombre_archivo(texto: str) -> str:
    limpio = re.sub(r"[^a-z0-9]+", "_", texto.lower()).strip("_")
    return f"{limpio or 'imagen_generada'}.jpg"


def cargar_api_key() -> str:
    try:
        if "GEMINI_API_KEY" in st.secrets:
            api_key = str(st.secrets["GEMINI_API_KEY"]).strip()
            if api_key:
                return api_key
    except Exception:
        pass

    nombre_env = os.getenv("ENV_FILE", ".env").strip() or ".env"
    ruta_env = RUTA_BASE / nombre_env
    load_dotenv(dotenv_path=ruta_env if ruta_env.exists() else None)

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "No se encontro GEMINI_API_KEY ni GOOGLE_API_KEY. "
            "Configura tu .env antes de ejecutar."
        )

    if "TU_API_KEY" in api_key.upper() or api_key.upper() in {
        "YOUR_API_KEY_HERE",
        "API_KEY",
    }:
        raise RuntimeError("La API key actual parece ser un placeholder.")

    return api_key


def abrir_carpeta(path: Path) -> None:
    if os.name == "nt":
        os.startfile(path)  # type: ignore[attr-defined]
    else:
        raise RuntimeError("Abrir carpeta automaticamente solo esta configurado para Windows.")


def generar_prompts_fallback(prompt_general: str, prompt_escena: str) -> list[str]:
    partes_base = []
    if prompt_general.strip():
        partes_base.append(prompt_general.strip())

    prompt_1 = "\n".join(
        partes_base
        + [
            f"Specific scene/action: {prompt_escena}.",
            "Output image only.",
        ]
    )

    prompt_2 = "\n".join(
        partes_base
        + [
            "Use the reference image as the same character identity.",
            f"Create a clear, full-body illustration of the character {prompt_escena}.",
            "Pure white background, no crowd, no stage, no text, no props unless essential.",
            "Output image only.",
        ]
    )

    prompt_3 = "\n".join(
        partes_base
        + [
            "Use the reference image as the same character identity.",
            f"Depict the character performing the action '{prompt_escena}' in a simple standing pose.",
            "Keep the scene minimal and isolated, with a pure white background.",
            "Do not add audience, scenery, stage, text, or extra characters.",
            "Output image only.",
        ]
    )

    return [prompt_1, prompt_2, prompt_3]


def render() -> None:
    st.set_page_config(page_title="Generador Visual de Lotes", layout="wide")
    st.title("Generador Visual de Lotes de Imagenes")
    st.caption("Flujo visual para crear proyectos, subir referencia y generar imagenes en lote.")

    if "proyecto_creado" not in st.session_state:
        st.session_state.proyecto_creado = False

    col_a, col_b = st.columns([1, 1])

    with col_a:
        st.subheader("1) Crear proyecto")
        proyecto_input = st.text_input("Nombre del proyecto", value="cartas_medievales")
        proyecto_normalizado = normalizar_nombre(proyecto_input)

        if not proyecto_normalizado:
            st.warning("Escribe un nombre de proyecto valido.")
            return

        ruta_proyecto = RUTA_PROYECTOS / proyecto_normalizado
        ruta_referencia = ruta_proyecto / "referencia.jpg"
        ruta_salida = ruta_proyecto / "assets_produccion"

        if st.button("Crear proyecto", use_container_width=True):
            ruta_proyecto.mkdir(parents=True, exist_ok=True)
            ruta_salida.mkdir(parents=True, exist_ok=True)
            st.session_state.proyecto_creado = True
            st.success(f"Proyecto listo en: {ruta_proyecto}")

        st.subheader("2) Prompt general")
        prompt_general = st.text_area(
            "Prompt general de creacion",
            value="",
            placeholder="Describe aqui el estilo general, por ejemplo: clean 2D line art, fondo blanco, sin sombras...",
            height=120,
        )

    with col_b:
        st.subheader("3) Subir imagen de referencia")
        archivo_referencia = st.file_uploader(
            "Selecciona una imagen", type=["jpg", "jpeg", "png", "webp"]
        )

        if archivo_referencia is not None:
            ruta_proyecto.mkdir(parents=True, exist_ok=True)
            ruta_salida.mkdir(parents=True, exist_ok=True)
            ruta_referencia.write_bytes(archivo_referencia.read())
            st.image(str(ruta_referencia), caption="Referencia cargada", width=320)
            st.success("Referencia guardada como referencia.jpg")

        st.subheader("4) Numero de imagenes y prompt especifico")
        total_imagenes = st.number_input(
            "Numero de imagenes a crear",
            min_value=1,
            max_value=20,
            value=3,
            step=1,
        )

        prompts_especificos: list[str] = []
        for i in range(int(total_imagenes)):
            p = st.text_input(
                f"Prompt especifico #{i + 1}",
                value="",
                placeholder=f"Describe la escena {i + 1}...",
                key=f"prompt_especifico_{i}",
            )
            prompts_especificos.append(p.strip())

    st.divider()
    st.subheader("5) y 6) Ver resultados y ejecutar")
    col_c, col_d = st.columns([1, 2])

    with col_c:
        if st.button("Abrir carpeta de resultados", use_container_width=True):
            try:
                ruta_salida.mkdir(parents=True, exist_ok=True)
                abrir_carpeta(ruta_salida)
                st.info(f"Abriendo: {ruta_salida}")
            except Exception as error:
                st.error(f"No se pudo abrir la carpeta: {error}")

    with col_d:
        ejecutar = st.button("Ejecutar generacion", type="primary", use_container_width=True)

    if not ejecutar:
        return

    try:
        api_key = cargar_api_key()
    except Exception as error:
        st.error(str(error))
        return

    if not ruta_referencia.exists():
        st.error("No existe referencia.jpg. Sube una imagen de referencia antes de ejecutar.")
        return

    prompts_validos = [p for p in prompts_especificos if p]
    if not prompts_validos:
        st.error("Define al menos un prompt especifico.")
        return

    ruta_salida.mkdir(parents=True, exist_ok=True)
    referencia_bytes = ruta_referencia.read_bytes()
    referencia_part = types.Part.from_bytes(data=referencia_bytes, mime_type="image/jpeg")

    barra = st.progress(0)
    estado = st.empty()
    log = st.empty()
    lineas_log: list[str] = []

    with genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=90_000),
    ) as client:
        for idx, prompt_escena in enumerate(prompts_validos, start=1):
            estado.info(f"Generando {idx}/{len(prompts_validos)}: {prompt_escena}")

            try:
                respuesta = client.models.generate_content(
                    model=MODELO_IMAGEN,
                    contents=[prompt_1, referencia_part],
                    config=types.GenerateContentConfig(response_modalities=["IMAGE"], temperature=0.4),
                )

                partes = [p for p in respuesta.parts or [] if getattr(p, "inline_data", None)]
                if not partes:
                    for candidato in respuesta.candidates or []:
                        contenido = getattr(candidato, "content", None)
                        for parte in getattr(contenido, "parts", []) or []:
                            if getattr(parte, "inline_data", None):
                                partes.append(parte)

                if not partes:
                    finish_reason = ""
                    if respuesta.candidates:
                        finish_reason = str(respuesta.candidates[0].finish_reason or "")

                    if "IMAGE_OTHER" in finish_reason:
                        for intento_extra, prompt_extra in enumerate((prompt_2, prompt_3), start=2):
                            respuesta = client.models.generate_content(
                                model=MODELO_IMAGEN,
                                contents=[prompt_extra, referencia_part],
                                config=types.GenerateContentConfig(
                                    response_modalities=["IMAGE"],
                                    temperature=0.2,
                                ),
                            )

                            partes = [
                                p for p in respuesta.parts or [] if getattr(p, "inline_data", None)
                            ]
                            if not partes:
                                for candidato in respuesta.candidates or []:
                                    contenido = getattr(candidato, "content", None)
                                    for parte in getattr(contenido, "parts", []) or []:
                                        if getattr(parte, "inline_data", None):
                                            partes.append(parte)

                            if partes:
                                nombre = normalizar_nombre_archivo(f"{idx:02d}_{prompt_escena}")
                                destino = ruta_salida / nombre
                                partes[0].as_image().save(destino)
                                lineas_log.append(f"[{idx}] OK -> {destino.name}")
                                break

                            detalle_fallo = describir_fallo_generacion(respuesta)
                            lineas_log.append(
                                f"[{idx}] Sin imagen para '{prompt_escena}' en intento {intento_extra}. detalle={detalle_fallo}"
                            )
                    else:
                        lineas_log.append(
                            f"[{idx}] Sin imagen para '{prompt_escena}'. finish_reason={finish_reason or 'N/A'}"
                        )
                else:
                    nombre = normalizar_nombre_archivo(f"{idx:02d}_{prompt_escena}")
                    destino = ruta_salida / nombre
                    partes[0].as_image().save(destino)
                    lineas_log.append(f"[{idx}] OK -> {destino.name}")

            except errors.APIError as error:
                lineas_log.append(f"[{idx}] APIError {error.code}: {error.message}")
                if error.code == 403:
                    lineas_log.append(
                        "La API Gemini parece deshabilitada para el proyecto. Habilitala en Google Cloud Console."
                    )
                    log.code("\n".join(lineas_log))
                    break
            except Exception as error:
                lineas_log.append(f"[{idx}] Error inesperado: {error}")

            barra.progress(idx / len(prompts_validos))
            log.code("\n".join(lineas_log))
            time.sleep(4)

    estado.success("Proceso finalizado.")


if __name__ == "__main__":
    render()