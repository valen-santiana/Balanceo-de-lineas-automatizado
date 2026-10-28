# =============================================================================
#  COMSOAL HÍBRIDO – Balanceo de Líneas de Producción
#  (Computer Method of Sequencing Operations for Assembly Lines, Arcus 1966)
#
#  Modos de selección:
#    'random' -> COMSOAL puro (todas las tareas factibles con igual probabilidad)
#    'lot'    -> Longest Operation Time: probabilidad ∝ tiempo de la tarea
#    'rpw'    -> Ranked Positional Weight (Helgeson-Birnie):
#                probabilidad ∝ peso posicional (tiempo propio + sucesoras)
#
#  + Modelo exacto de PROGRAMACIÓN LINEAL ENTERA (SALBP-1) para validar
#    el resultado de COMSOAL (scipy.optimize.milp, solver HiGHS).
#
#  Caso de estudio: confección de una camiseta básica (tiempos en segundos).
#  Ejecutar sin instalar nada: https://colab.research.google.com
# =============================================================================
import random
import copy
import math

UNIDAD = 's'   # unidad de los tiempos (se redefine en la celda de datos)


# -----------------------------------------------------------------------------
# 1. PESO POSICIONAL (para el modo RPW)
# -----------------------------------------------------------------------------
def calcular_sucesores(tasks):
    """Devuelve, para cada tarea, el conjunto de TODAS sus sucesoras
    (directas e indirectas) recorriendo el diagrama de precedencias."""
    directos = {t: [] for t in tasks}
    for t, info in tasks.items():
        for p in info['preds']:
            directos[p].append(t)

    def todas(t, visit=None):
        visit = set() if visit is None else visit
        for s in directos[t]:
            if s not in visit:
                visit.add(s)
                todas(s, visit)
        return visit

    return {t: todas(t) for t in tasks}


def calcular_pesos_posicionales(tasks):
    """PW_i = t_i + Σ t_j  (j ∈ sucesoras de i)."""
    suc = calcular_sucesores(tasks)
    return {t: tasks[t]['time'] + sum(tasks[s]['time'] for s in suc[t])
            for t in tasks}


# -----------------------------------------------------------------------------
# 2. REGLA DE SELECCIÓN (núcleo híbrido heurístico-estocástico)
# -----------------------------------------------------------------------------
def seleccionar_tarea(fitting_tasks, tasks, modo, pesos_pos, sesgo=1):
    if modo == 'random':
        return random.choice(fitting_tasks)
    if modo == 'lot':
        pesos = [tasks[t]['time'] for t in fitting_tasks]
    elif modo == 'rpw':
        pesos = [pesos_pos[t] for t in fitting_tasks]
    else:
        raise ValueError("modo debe ser 'random', 'lot' o 'rpw'")
    # Ruleta: P(i) = w_i^k / Σ w_j^k   (k = sesgo)
    #   k = 1 -> probabilidad proporcional al peso
    #   k > 1 -> más "determinista" (se acerca a elegir siempre el de mayor peso)
    pesos = [w ** sesgo for w in pesos]
    return random.choices(fitting_tasks, weights=pesos, k=1)[0]


# -----------------------------------------------------------------------------
# 3. ALGORITMO COMSOAL
# -----------------------------------------------------------------------------
def comsoal(tasks, cycle_time, iterations=1000, modo='random', semilla=None,
            parada_anticipada=True, sesgo=1):
    if semilla is not None:
        random.seed(semilla)

    # Validación: ninguna tarea puede exceder el tiempo de ciclo
    for t, info in tasks.items():
        if info['time'] > cycle_time:
            raise ValueError(f"La tarea {t} ({info['time']}) excede el tiempo de ciclo.")

    pesos_pos = calcular_pesos_posicionales(tasks) if modo == 'rpw' else None
    m_min = math.ceil(sum(t['time'] for t in tasks.values()) / cycle_time)

    best_solution = None
    min_stations = float('inf')
    iter_mejor = None          # iteración en la que se halló la mejor solución
    iter_ejecutadas = 0
    historial = []             # n.º de estaciones de cada iteración

    for it in range(1, iterations + 1):
        iter_ejecutadas = it
        unassigned_tasks = list(tasks.keys())
        assigned_tasks = set()
        stations = []
        current_station = []
        current_time = 0

        while unassigned_tasks:
            # Lista A: tareas con todos sus predecesores asignados
            available_tasks = [t for t in unassigned_tasks
                               if all(p in assigned_tasks for p in tasks[t]['preds'])]
            # Lista B: de la Lista A, las que caben en el tiempo restante
            fitting_tasks = [t for t in available_tasks
                             if tasks[t]['time'] <= cycle_time - current_time]

            if not fitting_tasks:
                stations.append(current_station)
                current_station, current_time = [], 0
            else:
                chosen = seleccionar_tarea(fitting_tasks, tasks, modo, pesos_pos, sesgo)
                current_station.append(chosen)
                assigned_tasks.add(chosen)
                unassigned_tasks.remove(chosen)
                current_time += tasks[chosen]['time']

        if current_station:
            stations.append(current_station)
        historial.append(len(stations))

        if len(stations) < min_stations:
            min_stations = len(stations)
            best_solution = copy.deepcopy(stations)
            iter_mejor = it

        # Parada anticipada: ya se alcanzó el mínimo teórico
        if parada_anticipada and min_stations == m_min:
            break

    return {
        'estaciones': best_solution,
        'modo': modo,
        'sesgo': sesgo,
        'iteraciones_solicitadas': iterations,
        'iteraciones_ejecutadas': iter_ejecutadas,
        'iteracion_mejor': iter_mejor,
        'm_min_teorico': m_min,
        'pesos_pos': pesos_pos,
        'historial': historial,
    }


# -----------------------------------------------------------------------------
# 4. MÉTRICAS Y REPORTE
# -----------------------------------------------------------------------------
def calcular_metricas(tasks, cycle_time, estaciones):
    suma_t = sum(t['time'] for t in tasks.values())
    n = len(estaciones)
    eficiencia = suma_t / (n * cycle_time) * 100        # E = Σt / (n·C)
    tiempo_muerto = n * cycle_time - suma_t             # TM = n·C − Σt
    return suma_t, n, eficiencia, tiempo_muerto


def imprimir_reporte(res, tasks, cycle_time):
    est = res['estaciones']
    suma_t, n, ef, tm = calcular_metricas(tasks, cycle_time, est)
    nombres = {'random': 'Aleatorio puro', 'lot': 'LOT (Longest Operation Time)',
               'rpw': 'RPW (Ranked Positional Weight)'}

    print("=" * 62)
    print(f" COMSOAL HÍBRIDO  |  Modo: {nombres[res['modo']]}")
    print("=" * 62)
    print(f" Tiempo de ciclo (C)          : {cycle_time} {UNIDAD}")
    if res['modo'] != 'random':
        print(f" Sesgo (exponente k)          : {res['sesgo']}")
    print(f" Iteraciones solicitadas      : {res['iteraciones_solicitadas']}")
    print(f" Iteraciones ejecutadas       : {res['iteraciones_ejecutadas']}")
    print(f" Mejor solución en iteración  : {res['iteracion_mejor']}")
    if res['pesos_pos']:
        orden = sorted(res['pesos_pos'].items(), key=lambda x: -x[1])
        print(" Pesos posicionales (PW)      : " +
              ", ".join(f"T{t}={w}" for t, w in orden))
    print("-" * 62)
    print(f" {'Estación':<10}{'Tareas':<22}{'Tiempo':>8}{'Ocio':>8}{'Uso %':>9}")
    print("-" * 62)
    for i, s in enumerate(est, 1):
        t_est = sum(tasks[t]['time'] for t in s)
        print(f" {i:<10}{str(s):<22}{t_est:>8}{cycle_time - t_est:>8}"
              f"{t_est / cycle_time * 100:>8.1f}%")
    print("-" * 62)
    print(f" Suma de tiempos (Σt)         : {suma_t} {UNIDAD}")
    print(f" N.º mínimo teórico (⌈Σt/C⌉)  : {res['m_min_teorico']}")
    print(f" Estaciones obtenidas (n)     : {n}")
    print(f" Eficiencia global E=Σt/(n·C) : {ef:.2f} %")
    print(f" Tiempo muerto total n·C−Σt   : {tm} {UNIDAD}")
    print(f" Retraso de balance (100−E)   : {100 - ef:.2f} %")
    if all('desc' in v for v in tasks.values()):
        print("-" * 62)
        print(" Detalle de operaciones por estación:")
        for i, s in enumerate(est, 1):
            print(f"  Estación {i}: " + "; ".join(f"T{t} {tasks[t]['desc']}" for t in s))
    print("=" * 62 + "\n")


# -----------------------------------------------------------------------------
# 5. GRÁFICOS (diagrama de precedencias + carga por estación)
# -----------------------------------------------------------------------------
def graficar(res, tasks, cycle_time):
    try:
        import matplotlib.pyplot as plt
        import networkx as nx
    except ImportError:
        print("(Instala matplotlib y networkx para ver los gráficos)")
        return

    est = res['estaciones']
    estacion_de = {t: i for i, s in enumerate(est) for t in s}
    colores = plt.cm.Pastel1.colors

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 5.5),
                                   gridspec_kw={'width_ratios': [1.6, 1]})

    # --- Diagrama de precedencias coloreado por estación ---
    G = nx.DiGraph()
    for t, info in tasks.items():
        G.add_node(t)
        for p in info['preds']:
            G.add_edge(p, t)
    # Columnas "lo más tarde posible": cada tarea se dibuja justo antes de su
    # sucesora, así las flechas son cortas y no cruzan sobre otras tareas
    resto = {}
    for t in reversed(list(nx.topological_sort(G))):
        resto[t] = max([resto[s] + 1 for s in G.successors(t)], default=0)
    L = max(resto.values())
    nivel = {t: L - r for t, r in resto.items()}
    por_nivel = {}
    for t in sorted(nivel, key=lambda t: (nivel[t], -calcular_pesos_posicionales(tasks)[t])):
        por_nivel.setdefault(nivel[t], []).append(t)
    pos = {t: (l, -k + (len(ts) - 1) / 2)
           for l, ts in por_nivel.items() for k, t in enumerate(ts)}

    nx.draw_networkx_edges(G, pos, ax=ax1, arrows=True, arrowsize=15,
                           node_size=1100, edge_color='#888')
    nx.draw_networkx_nodes(G, pos, ax=ax1, node_size=1100, edgecolors='#444',
                           node_color=[colores[estacion_de[t] % 9] for t in G])
    nx.draw_networkx_labels(G, pos, ax=ax1, font_size=9,
                            labels={t: f"T{t}\n{tasks[t]['time']}" for t in G})
    for i in range(len(est)):
        ax1.scatter([], [], color=colores[i % 9], s=150, edgecolors='#444',
                    label=f"Estación {i + 1}")
    ax1.legend(loc='lower right', fontsize=8)
    ax1.set_title("Diagrama de precedencias (color = estación)")
    ax1.axis('off')

    # --- Carga apilada por estación vs. tiempo de ciclo ---
    for i, s in enumerate(est):
        base = 0
        for t in s:
            d = tasks[t]['time']
            ax2.bar(i + 1, d, bottom=base, color=colores[i % 9], edgecolor='#444')
            ax2.text(i + 1, base + d / 2, f"T{t}", ha='center', va='center', fontsize=8)
            base += d
    ax2.axhline(cycle_time, color='red', ls='--', label=f"Tiempo de ciclo = {cycle_time}")
    _, _, ef, tm = calcular_metricas(tasks, cycle_time, est)
    ax2.set_title(f"Carga por estación  |  E = {ef:.1f} %  |  TM = {tm} {UNIDAD}")
    ax2.set_xlabel("Estación")
    ax2.set_ylabel(f"Tiempo ({UNIDAD})")
    ax2.set_xticks(range(1, len(est) + 1))
    ax2.legend(fontsize=8)

    plt.suptitle(f"COMSOAL – modo '{res['modo']}'", fontweight='bold')
    plt.tight_layout()
    plt.show()


# -----------------------------------------------------------------------------
# 6. MODELO DE PROGRAMACIÓN LINEAL ENTERA (SALBP-1)
#    min  Σ_k y_k
#    s.a. Σ_k x_ik = 1                       (cada tarea en una sola estación)
#         Σ_i t_i·x_ik ≤ C·y_k               (capacidad = tiempo de ciclo)
#         Σ_k k·x_ak ≤ Σ_k k·x_bk  ∀ a→b      (precedencias)
#         y_(k+1) ≤ y_k                      (estaciones en orden)
#         x_ik, y_k ∈ {0,1}
# -----------------------------------------------------------------------------
def programacion_lineal(tasks, cycle_time, K):
    """Resuelve el balanceo de forma exacta. K = máximo de estaciones permitido
    (se usa el resultado de COMSOAL como cota superior)."""
    import numpy as np
    from scipy.optimize import milp, LinearConstraint, Bounds

    T = list(tasks)
    nT = len(T)
    nx = nT * K
    nv = nx + K                                  # variables x_ik + y_k
    ix = lambda i, k: i * K + k                  # índice de x_ik
    iy = lambda k: nx + k                        # índice de y_k

    c = np.zeros(nv); c[nx:] = 1                 # función objetivo: Σ y_k
    A, lo, hi = [], [], []

    for i in range(nT):                          # asignación única
        a = np.zeros(nv); a[[ix(i, k) for k in range(K)]] = 1
        A.append(a); lo.append(1); hi.append(1)
    for k in range(K):                           # capacidad
        a = np.zeros(nv)
        for i, t in enumerate(T):
            a[ix(i, k)] = tasks[t]['time']
        a[iy(k)] = -cycle_time
        A.append(a); lo.append(-np.inf); hi.append(0)
    pos = {t: i for i, t in enumerate(T)}
    for b in T:                                  # precedencias
        for p in tasks[b]['preds']:
            a = np.zeros(nv)
            for k in range(K):
                a[ix(pos[p], k)] += k + 1
                a[ix(pos[b], k)] -= k + 1
            A.append(a); lo.append(-np.inf); hi.append(0)
    for k in range(K - 1):                       # orden de estaciones
        a = np.zeros(nv); a[iy(k + 1)] = 1; a[iy(k)] = -1
        A.append(a); lo.append(-np.inf); hi.append(0)

    res = milp(c, constraints=LinearConstraint(np.array(A), lo, hi),
               integrality=np.ones(nv), bounds=Bounds(0, 1),
               options={'time_limit': 60})
    if res.x is None:
        print("El modelo no encontró solución:", res.message)
        return None
    estaciones = []
    for k in range(K):
        st_k = [t for i, t in enumerate(T) if res.x[ix(i, k)] > 0.5]
        if st_k:
            estaciones.append(st_k)
    return {'estaciones': estaciones, 'optimo': res.status == 0,
            'n_variables': nv, 'n_restricciones': len(A)}


def imprimir_reporte_pl(res_pl, res_comsoal, tasks, cycle_time):
    est = res_pl['estaciones']
    suma_t, n, ef, tm = calcular_metricas(tasks, cycle_time, est)
    n_c = len(res_comsoal['estaciones'])
    print("=" * 62)
    print(" PROGRAMACIÓN LINEAL ENTERA (SALBP-1) – solución exacta")
    print("=" * 62)
    print(f" Variables / restricciones    : {res_pl['n_variables']} / {res_pl['n_restricciones']}")
    print(f" Estado                       : {'ÓPTIMO GARANTIZADO' if res_pl['optimo'] else 'mejor solución hallada'}")
    print("-" * 62)
    print(f" {'Estación':<10}{'Tareas':<22}{'Tiempo':>8}{'Ocio':>8}{'Uso %':>9}")
    print("-" * 62)
    for i, s_ in enumerate(est, 1):
        t_est = sum(tasks[t]['time'] for t in s_)
        print(f" {i:<10}{str(s_):<22}{t_est:>8}{cycle_time - t_est:>8}"
              f"{t_est / cycle_time * 100:>8.1f}%")
    print("-" * 62)
    print(f" Estaciones (PL)              : {n}")
    print(f" Eficiencia global            : {ef:.2f} %")
    print(f" Tiempo muerto total          : {tm} {UNIDAD}")
    print(f" Estaciones (COMSOAL)         : {n_c}")
    veredicto = ("COMSOAL alcanzó el óptimo" if n_c == n
                 else f"COMSOAL usó {n_c - n} estación(es) más que el óptimo")
    print(f" Verificación                 : {veredicto}")
    print("=" * 62 + "\n")


# =============================================================================
# DATOS DEL EJERCICIO – CONFECCIÓN DE UNA CAMISETA BÁSICA (cuello redondo)
# 'time' = tiempo estándar en segundos | 'preds' = predecesoras inmediatas
# 'desc' = descripción de la operación (opcional)
# =============================================================================
UNIDAD = 's'
datos_tareas = {
    1:  {'time': 20, 'preds': [],       'desc': 'Cortar delantero y espalda'},
    2:  {'time': 14, 'preds': [],       'desc': 'Cortar mangas'},
    3:  {'time': 8,  'preds': [],       'desc': 'Cortar cuello (rib)'},
    4:  {'time': 12, 'preds': [1],      'desc': 'Pegar etiqueta en espalda'},
    5:  {'time': 25, 'preds': [4],      'desc': 'Unir hombros (overlock)'},
    6:  {'time': 10, 'preds': [3],      'desc': 'Cerrar cuello en anillo'},
    7:  {'time': 30, 'preds': [5, 6],   'desc': 'Pegar cuello al escote'},
    8:  {'time': 22, 'preds': [7],      'desc': 'Pespuntar cinta de refuerzo'},
    9:  {'time': 18, 'preds': [2],      'desc': 'Dobladillo de mangas'},
    10: {'time': 40, 'preds': [8, 9],   'desc': 'Pegar mangas (overlock)'},
    11: {'time': 45, 'preds': [10],     'desc': 'Cerrar costados y mangas'},
    12: {'time': 28, 'preds': [11],     'desc': 'Dobladillo de bajo'},
    13: {'time': 20, 'preds': [12],     'desc': 'Despitar (cortar hilos)'},
    14: {'time': 15, 'preds': [13],     'desc': 'Inspección de calidad'},
    15: {'time': 18, 'preds': [14],     'desc': 'Doblar y empacar'},
}

# Tiempo de ciclo a partir de la demanda:  C = tiempo disponible / demanda
TIEMPO_DISPONIBLE = 8 * 3600     # s por turno (8 h)
DEMANDA = 600                    # camisetas por turno
tiempo_ciclo = TIEMPO_DISPONIBLE // DEMANDA      # = 48 s por camiseta

# =============================================================================
# EJECUCIÓN
# =============================================================================
MODO = 'rpw'           # <-- cambia aquí: 'random', 'lot' o 'rpw'
ITERACIONES = 1000
SESGO = 1              # exponente de la ruleta (1 = proporcional; prueba 3 o 6)

resultado = comsoal(datos_tareas, tiempo_ciclo, iterations=ITERACIONES, modo=MODO,
                    sesgo=SESGO)
imprimir_reporte(resultado, datos_tareas, tiempo_ciclo)
graficar(resultado, datos_tareas, tiempo_ciclo)

# Validación con programación lineal entera (óptimo exacto)
resultado_pl = programacion_lineal(datos_tareas, tiempo_ciclo,
                                   K=len(resultado['estaciones']))
if resultado_pl:
    imprimir_reporte_pl(resultado_pl, resultado, datos_tareas, tiempo_ciclo)

# -----------------------------------------------------------------------------
# Comparación de modos: 1000 iteraciones SIN parada anticipada.
# % óptimas = proporción de iteraciones que ya generan el mínimo de estaciones
# (mide qué tanto la heurística "empuja" a COMSOAL hacia buenas soluciones).
# -----------------------------------------------------------------------------
print("COMPARACIÓN DE MODOS (1000 iteraciones, sin parada anticipada)")
print("-" * 62)
print(f" {'Modo':<8}{'k':>3}{'Mejor n':>9}{'Promedio n':>13}{'% iter. óptimas':>18}")
for m, k in [('random', 1), ('lot', 1), ('lot', 6), ('rpw', 1), ('rpw', 6)]:
    r = comsoal(datos_tareas, tiempo_ciclo, ITERACIONES, m, semilla=1,
                parada_anticipada=False, sesgo=k)
    h = r['historial']
    best = min(h)
    print(f" {m:<8}{k:>3}{best:>9}{sum(h) / len(h):>13.2f}"
          f"{h.count(best) / len(h) * 100:>17.1f}%")
