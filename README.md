# Balanceo COMSOAL

Aplicación web para resolver problemas de **balanceo de líneas de producción** (SALBP-1) con el método **COMSOAL híbrido**, heurísticas clásicas y un **óptimo exacto por programación lineal entera**. Compara todos los métodos, recomienda el mejor y exporta los resultados a Excel.

Funciona completamente en el navegador: no necesita servidor, instalación ni Python.

> Proyecto académico de la asignatura **Diseño de Sistemas de Producción** · Escuela Politécnica Nacional · Facultad de Ciencias Administrativas · Ingeniería de la Producción · Valentina Santiana · período 2026-B.

## Funciones

| Sección | Qué hace |
|---|---|
| **1. Datos** | Tabla editable de tareas (código, descripción, tiempo, predecesoras), pegado directo desde Excel, importación de `.xlsx`/`.csv` y plantilla descargable. Calcula el peso posicional de cada tarea al escribir. |
| **Tiempo de ciclo** | Tres formas: dado directamente; **por demanda** (C = tiempo disponible / demanda, con horas, turnos y pausas); o **por número de estaciones** (C mín = máx(t máx, Σt / n)). |
| **Métodos** | COMSOAL aleatorio · COMSOAL + LOT · COMSOAL + RPW (cada uno con sesgo k suave y fuerte) · RPW determinista (Helgeson-Birnie) · Mayor tiempo (LCR) · Kilbridge-Wester · Más sucesoras · **Óptimo exacto** (ramificación y acotamiento sobre el modelo de PL entera). |
| **2. Resultados** | Método recomendado, tabla comparativa (estaciones, eficiencia, tiempo muerto, índice de suavidad, % de iteraciones óptimas, tiempo de cálculo), asignación por estación, gráfico de carga y distribución de soluciones de COMSOAL. |
| **Indicadores** (seleccionables) | Eficiencia y retraso de balance · tiempo muerto · índice de suavidad · capacidad (u/h y u/día) · tasa R, tiempo de flujo T e **inventario en proceso I = R × T** · costo de mano de obra por unidad. |
| **Modelo PLE** | Formulación SALBP-1 y descarga del modelo en formato `.lp` (LINGO, CPLEX, Gurobi, GLPK, HiGHS). |
| **3. Diagramas** | Diagrama de precedencias coloreado por estación para cualquier método y diagrama de carga. Descarga en SVG. |
| **4. Cursograma** | Cursograma analítico con el formato de la plantilla de clase: encabezado (objeto y nivel del análisis, proceso, localización, aprobó, tipo operario/material/equipo, método actual/propuesto, operadores, comentarios, hoja, producto/código, elaborado por, fecha, revisión), resumen de actividades con columnas **Actual, Propuesto y Economía** más distancia y tiempo total, y tabla con N.º, descripción, cantidad, distancia, tipo, símbolo, tiempo, observaciones, responsable y mejora propuesta. Se genera desde las tareas; cada actividad se clasifica con un clic y se pueden agregar transportes, esperas y almacenamientos. Incluye diagrama de flujo con símbolos ASME, descarga SVG, impresión o PDF horizontal y hoja de Excel con fórmulas. |
| **5. Producto y plano** | Visor de **planos DXF de AutoCAD** (acercar, alejar, mover) e imágenes, que cada usuario sube según su producto. Lista de materiales con las columnas *Pertenece a* y *Se usa en tarea*, a partir de las cuales la app dibuja sola el **árbol de estructura del producto** y la **gráfica de ensamble** (descarga SVG e impresión o PDF; la lista completa sale en el Excel). Notas del producto. |
| **Datos del proyecto** | Institución, facultad, carrera, asignatura, autor, docente y período editables (sección Producto y plano). Aparecen en el pie de página, el cursograma impreso y el Excel. |
| **Exportar** | Libro de **Excel con formato** (encabezado institucional, tablas con filtros, colores por estación, barras de datos, números formateados) con resumen, tareas, comparación, una hoja por método, modelo PLE, lista de materiales y cursograma. Guardar y abrir el proyecto completo en `.json`. |

## Privacidad y uso compartido

- Cada persona usa la app en su propio navegador; no hay servidor ni base de datos, así que nadie ve los datos de otra persona.
- Los datos se guardan solo en la pestaña abierta: sobreviven a una recarga y se borran al cerrarla. Para conservar un proyecto usa **Guardar** (archivo `.json`) y luego **Abrir**.
- **Nuevo** deja la app en blanco (con la opción de conservar los datos de institución y autoría). Si se intenta cerrar la pestaña con cambios sin guardar, el navegador avisa.

## Criterio para elegir el mejor método

1. Menor número de estaciones.
2. Si empatan, menor índice de suavidad (cargas más parejas).
3. Si siguen empatados, el método que llega al resultado con más facilidad (mayor % de iteraciones óptimas en COMSOAL, o el método determinista).

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `balanceo-comsoal`) y sube todo el contenido de esta carpeta.
   - Desde la web: **Add file → Upload files**, arrastra los archivos y pulsa **Commit changes**.
   - Desde la terminal:
     ```bash
     git init
     git add .
     git commit -m "Balanceo COMSOAL"
     git branch -M main
     git remote add origin https://github.com/TU_USUARIO/balanceo-comsoal.git
     git push -u origin main
     ```
2. En el repositorio entra a **Settings → Pages**.
3. En **Source** elige **Deploy from a branch**, rama **main**, carpeta **/ (root)** y pulsa **Save**.
4. En uno o dos minutos la app queda publicada en `https://TU_USUARIO.github.io/balanceo-comsoal/`.

También puedes abrir `index.html` con doble clic para usarla sin internet. La exportación a Excel necesita internet, porque carga las librerías SheetJS y ExcelJS desde cdnjs.

## Estructura

```
index.html                 La aplicación completa (lo que publica GitHub Pages)
src/                       Código fuente separado
  core.js                  Algoritmos: COMSOAL, heurísticas, óptimo exacto, indicadores, modelo .lp
  dxf.js                   Visor de planos DXF
  app.js                   Interfaz
  index.src.html           Estructura y estilos
tools/build.py             Une src/ en index.html  (python tools/build.py)
ejemplos/                  Plano de ingeniería de la camiseta (DXF y PDF)
python/                    Versión original en Python / Google Colab
```

Si modificas algo dentro de `src/`, ejecuta `python tools/build.py` desde la raíz del repositorio para regenerar `index.html`.

## Referencias

- Arcus, A. L. (1966). COMSOAL: A computer method of sequencing operations for assembly lines. *International Journal of Production Research*, 4(4), 259–277.
- Helgeson, W. B., y Birnie, D. P. (1961). Assembly line balancing using the ranked positional weight technique. *Journal of Industrial Engineering*, 12(6), 394–398.
- Kilbridge, M. D., y Wester, L. (1961). A heuristic method of assembly line balancing. *Journal of Industrial Engineering*, 12(4), 292–298.
- Scholl, A. (1999). *Balancing and Sequencing of Assembly Lines* (2.ª ed.). Physica-Verlag.

## Licencia

MIT. Consulta el archivo `LICENSE`.
