// INVENTARIO CENTRAL NUTRIMETRÍA — fuente de datos única de los 32 productos.
// Todos los campos provienen de INDICE_PORTAFOLIOS_NUTRIMETRIA_32.xlsx y del
// Informe de Cierre (2026-08-13). No se añade información no respaldada por
// esos documentos. Los precios son la única capa comercial añadida.
(function (global) {
  const PHASES = [
    { n: 1, name: 'Fase 1 · Motores', count: 6 },
    { n: 2, name: 'Fase 2 · Bases y Bibliotecas', count: 3 },
    { n: 3, name: 'Fase 3 · Evaluación y Registro', count: 7 },
    { n: 4, name: 'Fase 4 · Dietas y Planificación', count: 5 },
    { n: 5, name: 'Fase 5 · Clínica', count: 5 },
    { n: 6, name: 'Fase 6 · Pediatría', count: 2 },
    { n: 7, name: 'Fase 7 · Antropometría', count: 2 },
    { n: 8, name: 'Fase 8 · Complementarios y Guía', count: 2 }
  ];

  // Informe de Cierre — Portafolios NUTRIMETRÍA (32 productos), 2026-08-13.
  const REPORT = {
    date: '2026-08-13',
    project: 'Documentación comercial de la suite NUTRIMETRÍA',
    source: 'Inspección de solo lectura de 32 libros Excel reales (sin modificación)',
    metrics: [
      { k: 'ARCHIVOS_EXCEL_ANALIZADOS', v: '32 / 32' },
      { k: 'PRODUCTOS_IDENTIFICADOS', v: '32 / 32' },
      { k: 'FASES_CUBIERTAS', v: '8 / 8' },
      { k: 'PORTAFOLIOS_DOCX', v: '32 / 32' },
      { k: 'PORTAFOLIOS_PDF', v: '32 / 32' },
      { k: 'PORTAFOLIO_MAESTRO_DOCX', v: 'SÍ' },
      { k: 'PORTAFOLIO_MAESTRO_PDF', v: 'SÍ (47 págs.)' },
      { k: 'CATALOGO_COMERCIAL_PDF', v: 'SÍ (17 págs.)' },
      { k: 'INDICE_MAESTRO_XLSX', v: 'SÍ' },
      { k: 'MATRIZ_TRAZABILIDAD_XLSX', v: 'SÍ (160 filas = 5 afirmaciones × 32)' },
      { k: 'MATRIZ_CONTENIDO_XLSX', v: 'SÍ' },
      { k: 'AUDITORIA_PORTAFOLIO_VS_EXCEL_XLSX', v: 'SÍ' },
      { k: 'EXCEL_MODIFICADOS', v: '0 (solo lectura garantizada)', highlight: true },
      { k: 'PORTAFOLIOS_BLOQUEADOS', v: '0' },
      { k: 'PORTAFOLIOS_COMPLETOS', v: '32' },
      { k: 'PORTAFOLIOS_COMPLETOS_CON_RESTRICCION', v: '0' }
    ],
    authorization: 'El titular declaró contar con autorización de distribución. En consecuencia, se retiraron las restricciones de licencia/distribución (base de composición INTA 2018 y estados de «bloqueo» por composición incorporada), que ahora figuran como distribución autorizada por el titular. Los 32 portafolios quedan en estado PORTAFOLIO_COMPLETO (0 con restricción, 0 bloqueados).',
    integrity: 'La autorización comercial no genera evidencia científica. Por ello no se declaró ninguna validación que los archivos no respalden: se retiró el callout específico sobre la afirmación «428/428» de NMX-28-INTEGRADO y sobre la resolución de los patrones MINSAL 2018 de NMX-14-MINSAL/UDD, sin afirmar en su lugar validación alguna. Se conserva en todos los productos la postura general «exactitud matemática ≠ validación clínica» y las advertencias de uso profesional.',
    readOnly: 'Los 32 XLSX se abrieron en modo solo lectura; EXCEL_MODIFICADOS = 0. Casos de ejemplo ficticios.',
    captureNotice: 'CAPTURA_NO_GENERADA_POR_LIMITACIÓN_DEL_ENTORNO'
  };

  const NOT_CONFIRMED = 'NO_CONFIRMADO';
  const DOC_STATE = 'PRE_P19 (estado documental declarado en el nombre del archivo)';

  const PRODUCTS = [
    {
      id: 'nmx01', sku: 'NMX-01', order: 1, phase: 1, kind: 'motor', price: 7990,
      name: 'Calculadora Energética (Necesidades Energéticas)',
      category: 'Motor de cálculo energético', version: NOT_CONFIRMED,
      population: 'Personas adultas; incluye bases metabólicas para adulto, adulto mayor y usuarios de silla de ruedas (BASE_MET_ADULT_2024, OLDER_2024, WHEELCHAIR_2024).',
      objective: 'Estimar necesidades energéticas y el Nivel de Actividad Física (PAL) de forma trazable, con auditoría de operaciones y evidencia bibliográfica anclada por nivel de verificación.',
      inputs: ['Datos personales', 'Actividad física'],
      results: ['Requerimiento energético', 'Nivel de Actividad Física (PAL)', 'Trazabilidad de evidencia'],
      methodology: ['ECUACIÓN: Estimación de requerimiento energético', 'CRITERIO: Clasificación PAL (NMX-PAL-2026-08-v1)'],
      sources: 'Equipo Nutrimetría',
      limitations: 'Exactitud matemática distinta de validación clínica. Los resultados dependen de la calidad de los datos antropométricos y de la clasificación de actividad. La estimación de PAL usa un catálogo propio.',
      excel: 'NMX-01_Necesidades_Energeticas_DEFINITIVO_2026.xlsx'
    },
    {
      id: 'nmx09', sku: 'NMX-09', order: 2, phase: 1, kind: 'motor', price: 6990,
      name: 'Calculadora de Percentiles OMS',
      category: 'Motor de percentiles de crecimiento', version: NOT_CONFIRMED,
      population: 'Población pediátrica 0–60 meses (peso para la edad), según WHO Child Growth Standards.',
      objective: 'Calcular percentiles y puntuaciones Z de crecimiento infantil mediante el método LMS de la OMS, con trazabilidad de los coeficientes oficiales.',
      inputs: ['Datos personales'],
      results: ['Percentil peso/edad', 'Puntuación Z'],
      methodology: ['ECUACIÓN: Método LMS (Z = ((valor/M)^L − 1)/(L·S))'],
      sources: 'OMS',
      limitations: 'La versión analizada cubre el indicador peso para la edad (0–60 meses). La exactitud depende de una medición antropométrica correcta. Exactitud matemática ≠ validación clínica.',
      excel: 'NMX-09_Calculadora_de_Percentiles_OMS_18CA_CORREGIDO_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx10', sku: 'NMX-10', order: 3, phase: 1, kind: 'motor', price: 6990,
      name: 'Motor de Requerimiento Energético, MET y Efecto Térmico',
      category: 'Motor de gasto energético', version: 'v1.0.1',
      population: 'Personas adultas (≥18 años) en condición estable. No aplica a población pediátrica ni a situaciones descompensadas (AVISO DE ALCANCE en INICIO).',
      objective: 'Calcular requerimiento energético usando ecuaciones publicadas (incluida Mifflin–St Jeor), con incorporación de MET y efecto térmico de los alimentos, y registro diario.',
      inputs: ['Datos personales', 'Actividad física'],
      results: ['Requerimiento energético', 'Componentes (TMB, MET, TEF)'],
      methodology: ['ECUACIÓN: Mifflin–St Jeor', 'CRITERIO: MET y efecto térmico de los alimentos'],
      sources: 'Mifflin MD, St Jeor ST et al.',
      limitations: 'Aplica a adultos (≥18 a) en condición estable. La estimación de MET y TEF es orientativa. Exactitud matemática ≠ validación clínica. Requiere datos antropométricos fiables.',
      excel: 'NMX-10_Requerimiento_Energetico_Harris_REPARADO_v1_0_1(3)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx12', sku: 'NMX-12', order: 4, phase: 1, kind: 'motor', price: 6990,
      name: 'Calculadora de Grasa y Composición Corporal',
      category: 'Motor de composición corporal', version: NOT_CONFIRMED,
      population: 'Adultos, con anclaje de clasificación regional a Chile (INTA U. de Chile y MINSAL, OMS como referencia adoptada por MINSAL).',
      objective: 'Estimar porcentaje de grasa y componentes de composición corporal, con clasificación anclada a criterios chilenos y trazabilidad de ecuaciones.',
      inputs: ['Datos personales', 'Antropometría'],
      results: ['% grasa corporal', 'Clasificación'],
      methodology: ['ECUACIÓN: Estimación de composición corporal', 'CRITERIO: Clasificación anclada a INTA/MINSAL/OMS'],
      sources: 'INTA, Universidad de Chile / MINSAL',
      limitations: 'Clasificación anclada a Chile. La estimación depende de la técnica de medición. Exactitud matemática ≠ validación clínica. No es diagnóstico.',
      excel: 'NMX-12_Calculadora_Grasa_Composicion_Corporal_18CA_CORREGIDO_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx16', sku: 'NMX-16', order: 5, phase: 1, kind: 'motor', price: 6990,
      name: 'Calculadora de Somatotipo y Somatocarta (Heath–Carter)',
      category: 'Motor de somatotipo', version: NOT_CONFIRMED,
      population: 'Adultos evaluados con método antropométrico de Heath–Carter.',
      objective: 'Calcular los tres componentes del somatotipo (endo-meso-ectomorfia) y ubicar el punto en la somatocarta, con trazabilidad del método.',
      inputs: ['Antropometría'],
      results: ['Somatotipo', 'Somatocarta'],
      methodology: ['ECUACIÓN: Heath–Carter'],
      sources: 'Carter JEL',
      limitations: 'Requiere medidas antropométricas tomadas con técnica correcta. Exactitud matemática ≠ validación clínica. Las ecuaciones de pliegues no son intercambiables.',
      excel: 'NMX-16_INICIO aprobado(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx36', sku: 'NMX-36', order: 6, phase: 1, kind: 'motor', price: 6990,
      name: 'Calculadora Especializada de Plicometría',
      category: 'Motor de pliegues cutáneos', version: NOT_CONFIRMED,
      population: 'Adultos evaluados por pliegues cutáneos (según ecuación seleccionada y su población de derivación).',
      objective: 'Estimar densidad corporal y porcentaje de grasa a partir de pliegues cutáneos, con trazabilidad de cada ecuación y su población.',
      inputs: ['Antropometría'],
      results: ['Densidad corporal', '% grasa'],
      methodology: ['ECUACIÓN: Ecuaciones de pliegues (p. ej. Jackson–Pollock)'],
      sources: 'Autores de ecuaciones de pliegues',
      limitations: 'Las ecuaciones de pliegues no son intercambiables; el resultado depende de elegir la ecuación adecuada a la población y de la técnica de medición. Exactitud matemática ≠ validación clínica.',
      excel: 'NMX-36_INICIO aprobado(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx15', sku: 'NMX-15', order: 7, phase: 2, kind: 'biblioteca', price: 5990,
      name: 'Biblioteca Profesional de Fórmulas',
      category: 'Biblioteca de referencia transversal', version: 'v1.0',
      population: 'Transversal a la colección (energía, crecimiento, composición, somatotipo, fiabilidad, renal, deporte, conducta). No es un motor clínico.',
      objective: 'Reunir y auditar las fórmulas de la suite con sus referencias primarias y nivel de verificación, como biblioteca de consulta.',
      inputs: ['Otros'],
      results: ['Ecuaciones por dominio', 'Bibliografía y licencias'],
      methodology: ['REGLA DE IMPLEMENTACIÓN: Las obras clásicas se citan sólo por su ecuación (hecho no protegible)'],
      sources: 'Mifflin, Roza–Shizgal (Harris–Benedict rev.), otros; INTA 2018',
      limitations: 'Es una biblioteca de referencia, no un motor de cálculo ni un instrumento clínico. La base de composición INTA 2018 cuenta con autorización de distribución del titular. No sustituye asesoría jurídica.',
      excel: 'NMX-15_Biblioteca_Formulas_v1_0(3)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx21', sku: 'NMX-21', order: 8, phase: 2, kind: 'biblioteca', price: 7990,
      name: 'Distribución Alimentaria (INTA 2018)',
      category: 'Base alimentaria y distribución', version: NOT_CONFIRMED,
      population: 'Chile; requerimientos por población. Base de 618 alimentos por 100 g de porción comestible (INTA 2018).',
      objective: 'Traducir un plan alimentario a aportes y adecuación usando la Tabla de Composición de Alimentos Chilenos (INTA 2018), con requerimientos por población.',
      inputs: ['Alimentación', 'Selecciones / listas desplegables'],
      results: ['Aportes nutricionales', 'Adecuación'],
      methodology: ['CRITERIO: Hidratos de carbono DISPONIBLES (no totales)', 'REGLA DE IMPLEMENTACIÓN: Cálculo por 100 g de porción comestible'],
      sources: 'INTA, Universidad de Chile',
      limitations: 'La base INTA 2018 se usa como fuente de composición; su distribución está autorizada por el titular. Datos ausentes se muestran como ND. Resultados dependen de la exactitud del plan ingresado.',
      excel: 'NMX-21_Distribucion_Alimentaria_INTA2018_REPARADO_XLFN_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx43', sku: 'NMX-43', order: 9, phase: 2, kind: 'biblioteca', price: 7990,
      name: 'Biblioteca UDD y Banco Clínico-Formativo (Bases de la Nutrición I y II)',
      category: 'Biblioteca de nutrientes y banco de casos', version: 'v1.2.0',
      population: 'Formativa; 23 micronutrientes y 69 casos educativos (básico/intermedio/avanzado por micronutriente).',
      objective: 'Servir de biblioteca de nutrientes (energía, macros, IG/CG, agua/fibra, biomarcadores, interacciones) y banco de 69 casos clínico-formativos por micronutriente.',
      inputs: ['Selecciones / listas desplegables'],
      results: ['Fichas de nutrientes (23)', 'Banco de 69 casos', 'Ranking por alimento'],
      methodology: ['CRITERIO: 23 micronutrientes; 69 casos (3 niveles × 23)', 'REGLA DE IMPLEMENTACIÓN: Fuentes alimentarias por gramaje sobre base INTA'],
      sources: 'INTA (composición) / DRI / literatura de nutrientes',
      limitations: 'Los 69 casos son educativos; no representan diagnóstico, prescripción ni tratamiento. Las bases se apoyan en composición INTA y literatura de nutrientes con distintos niveles de verificación. Uso formativo.',
      excel: 'NMX-43_BIBLIOTECA_UDD_v1_2_0_CASOS_69(3)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx13', sku: 'NMX-13', order: 10, phase: 3, kind: 'registro', price: 5990,
      name: 'Recordatorio de 24 Horas (con catálogo PAL, NMX-01)',
      category: 'Evaluación dietética', version: 'v2.0.3',
      population: 'Uso educativo; base de composición INTA 2018 (618 alimentos por 100 g).',
      objective: 'Registrar la ingesta de 24 horas, calcular aportes con base INTA 2018 y revisar adecuación, con catálogo de PAL conectado a NMX-01.',
      inputs: ['Alimentación', 'Datos personales'],
      results: ['Aportes de la ingesta', 'Adecuación'],
      methodology: ['CRITERIO: Recordatorio de 24 horas', 'REGLA DE IMPLEMENTACIÓN: Base INTA 2018 (618 alimentos, HC disponibles)'],
      sources: 'INTA, Universidad de Chile; Nutrimetría / NMX-01',
      limitations: 'El recordatorio de 24 h depende de la memoria del sujeto y de la estimación de porciones. La base INTA es de distribución autorizada. Exactitud matemática ≠ validación clínica.',
      excel: 'NMX-13_Recordatorio_24_Horas_con_catalogo_PAL_NMX01_v2_0_3(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx17', sku: 'NMX-17', order: 11, phase: 3, kind: 'registro', price: 5990,
      name: 'Recordatorio de 24 Horas Conectado a Equivalentes',
      category: 'Evaluación dietética con equivalentes', version: NOT_CONFIRMED,
      population: 'Uso educativo; base INTA 2018.',
      objective: 'Registrar la ingesta de 24 h, evaluar adecuación (INTA 2018) y comparar consumo vs prescripción en equivalentes, con auditoría de la traducción.',
      inputs: ['Alimentación'],
      results: ['Adecuación de nutrientes', 'Consumo vs prescripción (equivalentes)'],
      methodology: ['CRITERIO: Recordatorio de 24 h + equivalentes', 'REGLA DE IMPLEMENTACIÓN: Auditoría de traducción a equivalentes'],
      sources: 'INTA, Universidad de Chile',
      limitations: 'Depende del recuerdo del sujeto y de la prescripción en equivalentes usada como referencia. Base INTA de distribución autorizada. Exactitud matemática ≠ validación clínica.',
      excel: 'NMX-17_Recordatorio_24h_Equivalentes_aprobado(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx22', sku: 'NMX-22', order: 12, phase: 3, kind: 'clinica', price: 6990,
      name: 'Registro Nutricional para Enfermedad Renal',
      category: 'Registro dietético renal', version: NOT_CONFIRMED,
      population: 'Enfoque renal; base INTA 2018 con cobertura crítica para uso renal.',
      objective: 'Registrar la ingesta con enfoque renal y evaluar cobertura y reportes, con trazabilidad y matriz renal específicas.',
      inputs: ['Alimentación', 'Clínica'],
      results: ['Reporte de cobertura', 'Matriz renal'],
      methodology: ['CRITERIO: Registro con enfoque renal y cobertura crítica'],
      sources: 'INTA, Universidad de Chile',
      limitations: 'Enfoque renal de apoyo; la interpretación clínica corresponde al profesional. La cobertura depende de la base INTA. No sustituye guías clínicas ni el juicio del equipo tratante.',
      excel: 'NMX-22_KDOQI_KDIGO(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx24', sku: 'NMX-24', order: 13, phase: 3, kind: 'registro', price: 4990,
      name: 'Seguimiento Mensual de Hábitos (Habit Tracker)',
      category: 'Registro conductual', version: NOT_CONFIRMED,
      population: 'Uso educativo; base de evidencia Lally y cols. (2010).',
      objective: 'Seguir hábitos a lo largo de un mes, analizar adherencia y patrones, con un tablero visual y evidencia sobre formación de hábitos.',
      inputs: ['Datos personales', 'Otros'],
      results: ['Adherencia', 'Patrones y tablero'],
      methodology: ['CRITERIO: Formación de hábitos (mediana 66 días; rango 18–254)'],
      sources: 'Lally P, van Jaarsveld CHM, Potts HWW, Wardle J',
      limitations: 'Un mes de registro no basta para consolidar un hábito (mediana de 66 días). Es un registro conductual educativo, no una intervención clínica. Depende de la constancia del registro.',
      excel: 'NMX-24_Habit_Tracker_Mensual_(5)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx29', sku: 'NMX-29', order: 14, phase: 3, kind: 'clinica', price: 6990,
      name: 'Recordatorio de 24 Horas Renal',
      category: 'Evaluación dietética renal', version: NOT_CONFIRMED,
      population: 'Enfoque renal; base INTA 2018 con cobertura crítica para uso renal.',
      objective: 'Aplicar el recordatorio de 24 h por pasos múltiples con enfoque renal, evaluando cobertura de nutrientes críticos con trazabilidad y matriz renal.',
      inputs: ['Alimentación', 'Clínica'],
      results: ['Reporte de cobertura', 'Matriz renal'],
      methodology: ['CRITERIO: Recordatorio 24 h de pasos múltiples, enfoque renal'],
      sources: 'INTA, Universidad de Chile',
      limitations: 'Depende del recuerdo del sujeto y del enfoque renal aplicado. La interpretación clínica corresponde al profesional. Base INTA de distribución autorizada.',
      excel: 'NMX-29_KDOQI_KDIGO(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx35', sku: 'NMX-35', order: 15, phase: 3, kind: 'registro', price: 4990,
      name: 'Diario Dietético y Conductual',
      category: 'Registro dietético-conductual', version: NOT_CONFIRMED,
      population: 'Uso educativo; base INTA 2018.',
      objective: 'Registrar un diario dietético y conductual, calcular aportes y detectar patrones de consumo y conducta.',
      inputs: ['Alimentación', 'Otros'],
      results: ['Aportes del diario', 'Patrones'],
      methodology: ['CRITERIO: Diario dietético y conductual'],
      sources: 'INTA, Universidad de Chile',
      limitations: 'Depende de la constancia y sinceridad del registro. Los patrones son orientadores educativos. Base INTA de distribución autorizada.',
      excel: 'NMX-35_Diario_Dietetico_Conductual_aprobado(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx41', sku: 'NMX-41', order: 16, phase: 3, kind: 'registro', price: 5990,
      name: 'Software Acompañante para Plicómetro',
      category: 'Control de calidad de medición antropométrica', version: 'v1.0',
      population: 'Evaluadores antropométricos; acompaña a cualquier plicómetro profesional.',
      objective: 'Controlar la calidad de la medición con plicómetro: calibración, técnica, error técnico de medición (ETM) y decisión de si un cambio es real.',
      inputs: ['Antropometría', 'Otros'],
      results: ['Error técnico de medición', 'Cambio real vs error'],
      methodology: ['ECUACIÓN: Error técnico de medición (ETM)', 'CRITERIO: Protocolo de medición ISAK'],
      sources: 'ISAK',
      limitations: 'Describe el procedimiento pero no reemplaza la formación práctica supervisada, única vía para alcanzar los criterios de error. El ETM depende de mediciones repetidas correctas.',
      excel: 'NMX-41_Software_Acompanante_Plicometro_v1_0(4)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx02', sku: 'NMX-02', order: 17, phase: 4, kind: 'planificacion', price: 5990,
      name: 'Tabla Dietosintética Semanal',
      category: 'Planificación dietética', version: NOT_CONFIRMED,
      population: 'Uso educativo; sistema de equivalentes chileno (UDD 2021).',
      objective: 'Traducir una prescripción numérica (energía y macros) en una estructura alimentaria semanal por equivalentes y repartirla en los tiempos de comida.',
      inputs: ['Alimentación', 'Selecciones / listas desplegables'],
      results: ['Equivalentes por grupo/día', 'Reparto por tiempos de comida'],
      methodology: ['REGLA DE IMPLEMENTACIÓN: Sistema de equivalentes chileno (UDD 2021)'],
      sources: 'UDD 2021 (sistema chileno de equivalentes)',
      limitations: 'Traduce una prescripción; no la calcula ni la valida clínicamente. Depende de la calidad de la prescripción de entrada y del sistema de equivalentes usado.',
      excel: 'NMX-02_Tabla_Dietosintetica_Semanal_SISTEMA_CHILENO_UDD2021(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx07', sku: 'NMX-07', order: 18, phase: 4, kind: 'planificacion', price: 7990,
      name: 'Gestor de Creación de Dietas',
      category: 'Constructor de dietas', version: 'v2.0.1',
      population: 'Uso educativo; base INTA 2018 y sistema de porciones/equivalentes (UDD 2021).',
      objective: 'Construir dietas completas gestionando porciones, un constructor de comidas y un menú, calculando aportes con base INTA 2018.',
      inputs: ['Alimentación', 'Selecciones / listas desplegables'],
      results: ['Menú construido', 'Aportes del menú'],
      methodology: ['REGLA DE IMPLEMENTACIÓN: Porciones/equivalentes (UDD 2021) + base INTA 2018'],
      sources: 'INTA, Universidad de Chile; UDD 2021',
      limitations: 'Construye dietas educativas; no valida clínicamente ni prescribe. Los aportes dependen de la base INTA y de la exactitud de las porciones. Base INTA de distribución autorizada.',
      excel: 'NMX-07_Gestor_Creacion_Dietas_UDD2021_v2_0_1_POST_QA_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx11', sku: 'NMX-11', order: 19, phase: 4, kind: 'planificacion', price: 6990,
      name: 'Planificador Integrado de Entrenamiento y Nutrición',
      category: 'Planificación deportiva', version: NOT_CONFIRMED,
      population: "Deportistas; marco 'combustible para el trabajo requerido' (Impey 2018; Jeukendrup 2017).",
      objective: 'Planificar el combustible (carbohidratos) por día ajustado a la demanda de entrenamiento, incluyendo el timing antes/durante/después.',
      inputs: ['Actividad física', 'Datos personales'],
      results: ['Combustible por día', 'Plan de timing'],
      methodology: ['CRITERIO: Combustible para el trabajo requerido (Impey 2018)'],
      sources: 'Impey SG et al.; Jeukendrup',
      limitations: 'Es un marco de planificación educativo; no es prescripción individual. Depende de una estimación realista de la demanda de cada sesión.',
      excel: 'NMX-11_Planificador_Integrado_18CA_CORREGIDO_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx25', sku: 'NMX-25', order: 20, phase: 4, kind: 'planificacion', price: 5990,
      name: 'Constructor de Platillos (Equivalentes Autorizados)',
      category: 'Constructor de recetas', version: NOT_CONFIRMED,
      population: 'Uso educativo; sistema chileno de equivalentes (UDD 2021) y base INTA.',
      objective: 'Construir platillos y recetas a partir de equivalentes autorizados, calculando sus aportes.',
      inputs: ['Alimentación', 'Selecciones / listas desplegables'],
      results: ['Platillo construido', 'Aportes del platillo'],
      methodology: ['REGLA DE IMPLEMENTACIÓN: Equivalentes autorizados (sistema chileno UDD 2021)'],
      sources: 'INTA, Universidad de Chile; UDD 2021',
      limitations: 'Construye platillos educativos; los aportes dependen de la base y de las porciones. Base INTA de distribución autorizada.',
      excel: 'NMX-25_Constructor_Platillos_SISTEMA_CHILENO_UDD2021(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx33', sku: 'NMX-33', order: 21, phase: 4, kind: 'planificacion', price: 5990,
      name: 'Planificador de Entrenamiento Semanal',
      category: 'Planificación de carga de entrenamiento', version: NOT_CONFIRMED,
      population: 'Deportistas; método de carga por esfuerzo percibido (Foster 2001; monotonía/strain, Foster 1998).',
      objective: 'Planificar la semana de entrenamiento cuantificando carga, monotonía y strain por esfuerzo percibido, con zonas de intensidad y progresión.',
      inputs: ['Actividad física', 'Datos personales'],
      results: ['Carga semanal', 'Monotonía / strain'],
      methodology: ['ECUACIÓN: Carga = duración × RPE (Foster 2001)', 'ECUACIÓN: Monotonía y strain (Foster 1998)'],
      sources: 'Foster C et al.; Foster C',
      limitations: 'Cuantifica carga interna a partir del RPE percibido; su validez depende de una escala aplicada correctamente. Es una herramienta de planificación educativa.',
      excel: 'NMX-33_Planificador_Entrenamiento_Semanal_(4)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx03', sku: 'NMX-03', order: 22, phase: 5, kind: 'clinica', price: 7990,
      name: 'Historia Clínica Nutricional Completa (Integración UDD)',
      category: 'Historia clínica nutricional', version: NOT_CONFIRMED,
      population: 'Adulto y adulto mayor; incluye estimación peso/talla, amputaciones y situaciones especiales.',
      objective: 'Registrar una historia clínica nutricional completa (antecedentes, antropometría, bioquímica, clínica, alimentación, actividad, fármacos) hasta diagnóstico, objetivos, intervención y seguimiento.',
      inputs: ['Datos personales', 'Antropometría', 'Bioquímica', 'Clínica', 'Alimentación', 'Actividad física', 'Laboratorio'],
      results: ['Evaluación integral', 'Diagnóstico y plan'],
      methodology: ['CRITERIO: Criterios clínicos adulto/adulto mayor (incl. estimación peso/talla)'],
      sources: 'OMS y fuentes primarias',
      limitations: 'Estado declarado como candidato a publicación (RC): requiere protocolo final. Los casos precargados son ficticios y deben reemplazarse. La interpretación clínica es profesional. Use códigos, no datos identificables.',
      excel: 'NMX-03_INTEGRACION_UDD(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx06', sku: 'NMX-06', order: 23, phase: 5, kind: 'clinica', price: 5990,
      name: 'Registro y Seguimiento de Composición Corporal',
      category: 'Seguimiento de composición corporal', version: 'v1.0.1',
      population: 'Adultos; multi-método (antropometría, perímetros, pliegues, BIA y otros).',
      objective: 'Registrar y comparar en el tiempo mediciones de composición corporal por distintos métodos, cuidando la comparabilidad método/dispositivo/protocolo.',
      inputs: ['Antropometría', 'Clínica', 'Datos personales'],
      results: ['Tendencia de composición', 'Reporte de seguimiento'],
      methodology: ['REGLA DE IMPLEMENTACIÓN: Comparar tendencias con mismo método/dispositivo/protocolo', 'CRITERIO: IMC y antropometría (WHO TRS 854)'],
      sources: 'OMS',
      limitations: 'Los métodos y dispositivos de composición corporal no son intercambiables. La calidad del seguimiento depende de mantener constantes el método, el dispositivo y el protocolo.',
      excel: 'NMX-06_QA_REAL_CORREGIDO_v1_0_1_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx08', sku: 'NMX-08', order: 24, phase: 5, kind: 'clinica', price: 6990,
      name: 'Historia Clínica de Nutrición Deportiva',
      category: 'Historia clínica deportiva', version: 'v1.0',
      population: 'Deportistas; modelo de disponibilidad energética y deficiencia energética relativa en el deporte (RED-S).',
      objective: 'Registrar la historia clínica del deportista (carga, composición, hidratación, suplementos, tamizaje) y calcular la disponibilidad energética hacia un diagnóstico y plan.',
      inputs: ['Datos personales', 'Actividad física', 'Antropometría', 'Clínica'],
      results: ['Disponibilidad energética (EA)', 'Tasa de sudoración'],
      methodology: ['ECUACIÓN: Disponibilidad energética (EA)'],
      sources: 'Literatura RED-S / disponibilidad energética',
      limitations: 'El umbral de 30 kcal/kg MLG/día es orientador, derivado de estudios en mujeres deportistas; no es un corte diagnóstico individual. La EA depende de una estimación fiable de ingesta, gasto y masa libre de grasa.',
      excel: 'NMX-08_Historia_Clinica_Nutricion_Deportiva_v1_0_REDISENO_NMX22(3)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx20', sku: 'NMX-20', order: 25, phase: 5, kind: 'clinica', price: 7990,
      name: 'Formulario Integral de Evaluación (Adulto, Persona Mayor, Hospital, Deporte, TEM, Frisancho)',
      category: 'Evaluación antropométrica integral', version: 'v3.0.1',
      population: 'Adulto, persona mayor, hospitalizado y deporte; arquitectura de referencia Frisancho; incluye TEM.',
      objective: 'Registrar, calcular, clasificar (orientadora) y trazar académicamente evaluaciones antropométricas integrando recordatorio, composición, somatotipo y referencias.',
      inputs: ['Datos personales', 'Alimentación', 'Antropometría'],
      results: ['Síntesis integrada', 'Composición y somatotipo', 'Clasificación orientadora'],
      methodology: ['ECUACIÓN: Heath–Carter (somatotipo) y densidad/grasa', 'REGLA DE IMPLEMENTACIÓN: Referencia Frisancho y TEM'],
      sources: 'Frisancho; INTA, Universidad de Chile',
      limitations: "'100% académico' significa requisitos implementados/probados dentro del alcance, no validación clínica universal. No realiza diagnóstico. La interpretación final corresponde al profesional o docente.",
      excel: 'NMX-20_QA_REAL_CORREGIDO_v3_0_1_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx42', sku: 'NMX-42', order: 26, phase: 5, kind: 'clinica', price: 6990,
      name: 'Explorador Renal de Alimentos y Equivalentes',
      category: 'Explorador dietético renal', version: NOT_CONFIRMED,
      population: 'Contexto renal; base INTA 2018 clasificada; distribución autorizada, sujeto a revisión clínica.',
      objective: 'Explorar y filtrar alimentos por criterios renales y proponer sustituciones/intercambios en equivalentes, dentro de un marco de distribución autorizada y revisión clínica.',
      inputs: ['Clínica', 'Selecciones / listas desplegables'],
      results: ['Alimentos filtrados', 'Sustituciones/intercambios'],
      methodology: ['CRITERIO: Clasificación renal de alimentos', 'REGLA DE IMPLEMENTACIÓN: Reconstrucción del grupo 2.10 (verduras) marcada'],
      sources: 'INTA, Universidad de Chile',
      limitations: 'Distribución autorizada por el titular; sujeto a revisión clínica. Herramienta de apoyo; la interpretación clínica es profesional.',
      excel: 'NMX-42_KDOQI_KDIGO(2)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx14i', sku: 'NMX-14-INTEGRADO', order: 27, phase: 6, kind: 'clinica', price: 7990,
      name: 'Evaluación Nutricional Pediátrica Integral',
      category: 'Evaluación antropométrica pediátrica', version: 'v2.0.1',
      population: '0 a 19 años (0–228 meses); cada indicador con su propio rango de edad/talla.',
      objective: 'Evaluar el estado nutricional infantil/adolescente con antropometría OMS (LMS/DE) y patrones MINSAL 2018, integrando cálculo, curvas y seguimiento en un único libro operativo.',
      inputs: ['Datos personales', 'Antropometría'],
      results: ['Indicadores antropométricos', 'Curvas de crecimiento'],
      methodology: ['ECUACIÓN: Método LMS/DE (Z = ((valor/M)^L − 1)/(L·S))', 'CRITERIO: Patrones MINSAL 2018 (nacimiento a 19 años)'],
      sources: 'OMS; MINSAL',
      limitations: 'Exactitud matemática ≠ validación clínica; no es diagnóstico médico automático. Cada indicador tiene su rango de edad/talla. Requiere mediciones antropométricas correctas.',
      note: 'Libro operativo de 12 hojas. Producto distinto de NMX-14-MINSAL-UDD.',
      excel: 'NMX-14_Evaluacion_Nutricional_Pediatrica_v2_0_1_QA_CORREGIDO_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx14m', sku: 'NMX-14-MINSAL-UDD', order: 28, phase: 6, kind: 'clinica', price: 7990,
      name: 'Evaluación Pediátrica OMS/MINSAL + UDD (Fuentes Resueltas)',
      category: 'Arquitectura documental pediátrica', version: 'v3.1.18',
      population: '0–228 meses (0–19 años) según tabla aplicable; NT MINSAL N.º 218 (0–9 años) y patrones MINSAL 2018.',
      objective: 'Evaluar el estado nutricional pediátrico con trazabilidad de fuentes primarias resueltas y módulos para situaciones especiales (prematuridad, síndrome de Down, parálisis cerebral, perímetro cefálico).',
      inputs: ['Datos personales', 'Antropometría', 'Clínica'],
      results: ['Interpretación pediátrica', 'Informe y gráfico'],
      methodology: ['CRITERIO: NT MINSAL N.º 218 (2.ª ed. 2021) — 0–9 años', 'CRITERIO: Patrones MINSAL 2018 (0–19 años)', 'REGLA DE IMPLEMENTACIÓN: OMS/MINSAL prioritarios; UDD como fuente secundaria'],
      sources: 'MINSAL; OMS / MINSAL 2018; Manual UDD',
      limitations: 'Cada tabla tiene su rango; la NT 218 cubre 0–9 años. Requiere interpretación profesional. Exactitud ≠ validación clínica.',
      note: 'Arquitectura documental/modular de 31 hojas. Producto distinto de NMX-14-INTEGRADO.',
      excel: 'NMX-14_MINSAL_UDD_v3_1_18CA_CORREGIDO_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx28p', sku: 'NMX-28-PACK', order: 29, phase: 7, kind: 'guia', price: 4990,
      name: 'Guía del Pack de Antropometría (HUB)',
      category: 'Guía/mapa de paquete (documentación)', version: 'v1.0',
      population: 'Adultos; documenta cinco archivos INDEPENDIENTES (NMX-41, 36, 12, 16, 34), traspaso de datos MANUAL.',
      objective: 'Documentar y orientar el uso de los cinco componentes de antropometría como archivos separados, con su catálogo, flujo, conexiones y licencias — sin integración automática.',
      inputs: ['Otros'],
      results: ['Mapa del pack', 'Condiciones de distribución'],
      methodology: ['DECISIÓN DE INGENIERÍA: Cinco archivos independientes, traspaso MANUAL de datos', 'REGLA DE IMPLEMENTACIÓN: Distribución LIBRE (ningún componente incorpora INTA)'],
      sources: 'ISAK / autores de ecuaciones',
      limitations: 'No es un motor de cálculo: es documentación. El traspaso de datos entre los cinco archivos es manual, sin vínculos ni integración automática. Alcance adulto.',
      note: 'Guía/HUB de 5 archivos separados. Producto distinto de NMX-28-INTEGRADO.',
      excel: 'NMX-28_Pack_Antropometria_v1_0(4)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx28i', sku: 'NMX-28-INTEGRADO', order: 30, phase: 7, kind: 'motor', price: 7990,
      name: 'Pack Antropometría Integrado (un solo archivo)',
      category: 'Suite antropométrica integrada', version: 'v2.1',
      population: 'Solo adultos (≥18 a), sin extrapolación; usar códigos, sin datos identificables.',
      objective: 'Reunir en un único archivo autónomo los módulos de antropometría (NMX-41, 36, 12, 16 y 34 educativo) con mediciones, seguimiento, curvas y auditoría de integración.',
      inputs: ['Antropometría', 'Datos personales'],
      results: ['Composición y somatotipo', 'Seguimiento antropométrico', 'Auditoría de integración'],
      methodology: ['ECUACIÓN: Pliegues (JP/DW/Faulkner), Siri/Brožek, Heath–Carter, ETM', 'DECISIÓN DE INGENIERÍA: Integración modular en un archivo (M-prefijos)'],
      sources: 'ISAK; Jackson–Pollock, Durnin–Womersley, Faulkner, Siri, Brožek',
      limitations: 'Alcance solo adultos, sin extrapolación. Las ecuaciones de pliegues no son intercambiables. Usar códigos, sin datos identificables.',
      note: 'Suite integrada de 63 hojas. Producto distinto de NMX-28-PACK.',
      excel: 'NMX-28_Integrado_v2_1_UDD_18CA_CORREGIDO_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmx34', sku: 'NMX-34', order: 31, phase: 8, kind: 'guia', price: 4990,
      name: 'Indicador Educativo de Edad Metabólica',
      category: 'Indicador educativo / comunicación', version: NOT_CONFIRMED,
      population: 'Adultos; indicador EDUCATIVO y de comunicación, NO diagnóstico.',
      objective: "Explicar de forma transparente cómo se obtiene la 'edad metabólica', su sensibilidad y —sobre todo— qué significa y qué NO significa, dejando claro que carece de validación.",
      inputs: ['Datos personales', 'Antropometría'],
      results: ['Edad metabólica (educativa)', 'Sensibilidad del indicador'],
      methodology: ['ECUACIÓN: Katch-McArdle (sin edad) y Mifflin-St Jeor (con edad)', 'DECISIÓN DE INGENIERÍA: Presentar el indicador con sus límites explícitos'],
      sources: 'Katch-McArdle / Mifflin-St Jeor',
      limitations: "La 'edad metabólica' no tiene definición consensuada, método de referencia ni ecuaciones normativas revisadas por pares. Es un recurso de comunicación, no un instrumento diagnóstico ni de seguimiento.",
      excel: 'NMX-34_Indicador_Educativo_Edad_Metabolica(4)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    },
    {
      id: 'nmxp1', sku: 'NMX-P1', order: 32, phase: 8, kind: 'guia', price: 4990,
      name: 'Guía del Paquete (Siete Herramientas)',
      category: 'Guía/mapa de paquete (documentación)', version: 'v1.0',
      population: 'Atención nutricional ambulatoria de personas adultas en condición estable; NO pediatría, embarazo, lactancia ni patología aguda sin supervisión.',
      objective: 'Documentar el paquete de siete herramientas (NMX-03, 13, 20, 02, 07, 25, 24): qué son, en qué orden usarlas, qué dato pasa a cuál, qué se puede distribuir y su alcance común.',
      inputs: ['Otros'],
      results: ['Mapa del paquete', 'Alcance y condiciones'],
      methodology: ['DECISIÓN DE INGENIERÍA: Guía/mapa del paquete (no calculadora)', 'REGLA DE IMPLEMENTACIÓN: Alcance común: adultos estables ambulatorios'],
      sources: 'Nutrimetría (componentes)',
      limitations: 'Es documentación, no cálculo. Distribución autorizada por el titular (cinco herramientas incorporan base de composición). Ninguna herramienta del paquete está validada clínicamente. Alcance adulto ambulatorio.',
      note: 'Documentado como guía de paquete (mapa/manual), no como calculadora.',
      excel: 'NMX-P1_Guia_del_Paquete_v1_0__1_(3)_COMERCIAL_PRE_P19_REPARADO_PRE_P19.xlsx'
    }
  ];

  const KIND_LABEL = {
    motor: 'Motor de cálculo',
    biblioteca: 'Biblioteca / base',
    registro: 'Registro y evaluación',
    planificacion: 'Planificación',
    clinica: 'Clínica',
    guia: 'Guía / documentación'
  };

  // Documentación maestra. tech = documentación técnica, comm = comercial.
  const DOCUMENTS = [
    { id: 'maestro', name: 'Portafolio Maestro NUTRIMETRÍA 32', track: 'comm', type: 'Portafolio', formats: ['PDF', 'DOCX'], pages: '47 págs.', desc: 'Visión consolidada de la suite: qué es Nutrimetría, los 32 productos, su organización por fases y la relación entre herramientas.', href: 'public/documentation/master/PORTAFOLIO_MAESTRO_NUTRIMETRIA_32.pdf', access: 'PDF público' },
    { id: 'catalogo', name: 'Catálogo Comercial NUTRIMETRÍA 32', track: 'comm', type: 'Catálogo', formats: ['PDF'], pages: '17 págs.', desc: 'Presentación comercial de los 32 productos, orientada a difusión y venta.', href: 'public/documentation/master/CATALOGO_COMERCIAL_NUTRIMETRIA_32.pdf', access: 'Público' },
    { id: 'informe', name: 'Informe de Cierre — Portafolios NUTRIMETRÍA (32 productos)', track: 'tech', type: 'Informe', formats: ['MD'], pages: '2026-08-13', desc: 'Cierre de la fase documental: métricas finales, distribución por fase, autorización de distribución y notas de integridad.', href: 'public/documentation/master/Informe_Cierre_Portafolios_32.md', access: 'Público' },
    { id: 'indice', name: 'Índice Maestro de Portafolios', track: 'tech', type: 'Índice', formats: ['XLSX'], pages: '32 filas', desc: 'Índice de los 32 productos con nombre, fase, categoría, población, objetivo, entradas, resultados, metodología, fuentes y limitaciones.', href: '', access: 'Interno' },
    { id: 'trazabilidad', name: 'Matriz de Trazabilidad', track: 'tech', type: 'Matriz', formats: ['XLSX'], pages: '160 filas', desc: 'Cinco afirmaciones verificadas por cada uno de los 32 productos.', href: '', access: 'Interno' },
    { id: 'contenido', name: 'Matriz de Contenido NMX', track: 'tech', type: 'Matriz', formats: ['XLSX'], pages: '32 productos', desc: 'Contenido declarado de cada libro, para contrastar lo documentado con lo implementado.', href: '', access: 'Interno' },
    { id: 'auditoria', name: 'Auditoría Portafolio vs Excel', track: 'tech', type: 'Auditoría', formats: ['XLSX'], pages: '32 productos', desc: 'Contraste entre lo que declara cada portafolio y lo que contiene el Excel correspondiente.', href: '', access: 'Interno' }
  ];

  const byId = {};
  PRODUCTS.forEach((p) => {
    p.phaseName = (PHASES.find((f) => f.n === p.phase) || {}).name || '';
    p.kindLabel = KIND_LABEL[p.kind] || p.kind;
    p.priceLabel = p.price ? '$' + p.price.toLocaleString('es-CL') + ' CLP' : '—';
    p.cover = 'assets/img/covers/' + p.id + '.png';
    // Portafolio PDF: PUBLICO (material documental). Ruta servible desde el frontend.
    p.portfolioPdf = 'public/documentation/portfolios/' + p.sku + '.pdf';
    // Excel y DOCX: PROTEGIDOS. Solo nombre canonico; la ruta real vive en el
    // backend y se resuelve via GET /api/downloads/:orderItemId tras la compra.
    p.excelFile = p.sku + '.xlsx';
    p.portfolioDocxFile = p.sku + '.docx';
    p.docState = DOC_STATE;
    p.portfolioState = 'PORTAFOLIO_COMPLETO';
    p.href = 'Nmx.dc.html?id=' + p.id;
    byId[p.id] = p;
  });

  global.NMXInventory = {
    products: PRODUCTS, phases: PHASES, documents: DOCUMENTS, report: REPORT,
    kindLabels: KIND_LABEL, byId: byId,
    get: (id) => byId[id] || null,
    byPhase: (n) => PRODUCTS.filter((p) => p.phase === n)
  };
})(typeof window !== 'undefined' ? window : globalThis);
