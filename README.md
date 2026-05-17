# VIDEOCLIP - Generacion de assets en lote con Gemini

Proyecto Python para generar imagenes en lote con `google-genai` usando una imagen de referencia (`referencia.jpg`) y una lista de acciones.

## 1) Configuracion rapida

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Crea un archivo `.env` en la raiz del proyecto:

```env
GEMINI_API_KEY=tu_api_key_aqui
# Opcional: proyecto por defecto
# LOTE_PROYECTO=cartas_medievales
```

## 2) Estructura de carpetas

Puedes usar un solo lote en raiz o multiples subproyectos.

### Modo raiz (sin subproyecto)

```text
VIDEOCLIP/
  referencia.jpg
  assets_produccion/
  generador_lote.py
```

### Modo subproyectos (recomendado)

```text
VIDEOCLIP/
  proyectos/
    cartas_medievales/
      referencia.jpg
      assets_produccion/
    robots_scifi/
      referencia.jpg
      assets_produccion/
```

## 3) Ejecucion

### Ejecutar en modo raiz

```powershell
python .\generador_lote.py
```

### Ejecutar un subproyecto

```powershell
python .\generador_lote.py --proyecto cartas_medievales
```

Si usas `LOTE_PROYECTO` en `.env`, puedes ejecutar sin `--proyecto`.

## 4) Notas importantes

- El script aplica `time.sleep(4)` por iteracion para reducir errores `HTTP 429`.
- Si una accion falla por API o seguridad, se registra el error y el lote continua.
- `.env` ya esta excluido en `.gitignore`. No subas tu API key a Git.

## 5) Entorno visual (UI)

Tambien puedes usar la interfaz visual en lugar del script por consola.

Ejecuta:

```powershell
streamlit run .\app_visual.py
```

La UI te permite:

- Crear un proyecto.
- Ajustar el prompt general.
- Subir imagen de referencia.
- Definir numero de imagenes y prompt especifico por cada una.
- Abrir carpeta de resultados.
- Ejecutar la generacion.

### Uso online

Si publicas la app en Streamlit Cloud u otro hosting, no uses `.env` para la clave.
Configura `GEMINI_API_KEY` en los secrets del deploy.

Ejemplo para `.streamlit/secrets.toml`:

```toml
GEMINI_API_KEY = "tu_api_key_real"
```

En local seguira funcionando `.env`, pero en online la app prioriza `st.secrets`.

### Uso local en navegador

Si lo quieres usar solo en tu equipo, ejecuta la UI localmente y se abrira en tu navegador:

```powershell
streamlit run .\app_visual.py
```

No necesitas publicarlo en internet para usarlo desde el browser.
