# NUTRIMETRÍA

Suite profesional de 32 herramientas Excel para nutrición, con su documentación
comercial y técnica. Este repositorio contiene el frontend público, la
documentación pública y el backend que entrega los archivos de producto.

## Modelo

Híbrido:

| Qué | Acceso |
|---|---|
| Catálogo, fichas NMX, portadas, metodología, fuentes, limitaciones | Público |
| Los 32 portafolios en PDF | Público (material documental) |
| Portafolio Maestro (PDF), Catálogo Comercial (PDF), Informe de Cierre (MD) | Público |
| Los 32 libros Excel completos | Tras compra |
| Los 32 portafolios editables (DOCX) | Tras compra |
| Índice maestro, matrices y auditoría (XLSX) | Interno |

## Estructura

```
/
├── *.dc.html                      Frontend (Design Components)
├── nutrimetria-inventory.js       FUENTE DE DATOS ÚNICA de los 32 productos
├── store.js                       Cliente de la API
├── support.js                     Runtime de los Design Components
├── assets/
│   ├── img/covers/                32 portadas de marca + recursos
│   └── free/                      2 recursos gratuitos (.xlsx)
├── public/documentation/
│   ├── portfolios/                32 portafolios PDF (públicos)
│   └── master/                    Maestro PDF, Catálogo PDF, Informe MD
├── backend/
│   ├── src/                       API Express (auth, cart, orders, payments, downloads)
│   ├── db/
│   │   ├── schema.sql             Esquema PostgreSQL
│   │   ├── seed.sql               GENERADO — no editar a mano
│   │   ├── generate-seed.js       Genera seed.sql desde el inventario
│   │   └── asset-map.json         Mapa NMX ↔ Excel ↔ PDF ↔ DOCX
│   └── secure-files/              NUNCA servir como estático
│       ├── excel/                 32 libros Excel
│       ├── portfolios-docx/       32 portafolios DOCX
│       ├── master/                Maestro DOCX
│       └── audit/                 Índice, matrices, auditoría
└── .github/workflows/
    └── deploy-pages.yml           Publica solo el frontend público
```

## Fuente de datos única

`nutrimetria-inventory.js` es el único lugar donde viven los datos de los 32
productos. `Catalog.dc.html`, `Nmx.dc.html`, `Docs.dc.html` y los destacados de
`Home.dc.html` derivan todo de ahí. `backend/db/seed.sql` también:

```bash
cd backend
npm run seed:generate   # regenera seed.sql desde el inventario
npm run migrate         # aplica schema.sql + seed.sql
```

Para cambiar un precio, un nombre o una descripción se edita el inventario y se
regenera el seed. Nunca se editan los dos por separado.

## Integridad de los archivos

Los 32 XLSX se inspeccionaron en modo solo lectura para documentarlos.
`EXCEL_MODIFICADOS = 0`: sin cambios en fórmulas, hojas ni datos.

Los archivos se renombraron a su código NMX (`NMX-01.xlsx`,
`NMX-14-INTEGRADO.xlsx`) porque los nombres originales contienen paréntesis y
comas que rompen rutas web. El nombre original de cada archivo queda registrado
en `backend/db/asset-map.json` para trazabilidad. El contenido es idéntico.

## Reglas de producto

- **NMX-14-INTEGRADO** (libro operativo, 12 hojas) y **NMX-14-MINSAL-UDD**
  (arquitectura documental/modular, 31 hojas) son productos distintos.
- **NMX-28-PACK** (guía/HUB de 5 archivos separados) y **NMX-28-INTEGRADO**
  (suite integrada, 63 hojas) son productos distintos.
- **NMX-P1** y **NMX-28-PACK** son guías de paquete, no calculadoras.
- No hay capturas de las hojas internas:
  `CAPTURA_NO_GENERADA_POR_LIMITACIÓN_DEL_ENTORNO`. Las portadas son
  identificación de marca.
- Distribución autorizada por el titular. La autorización es comercial y **no**
  constituye validación científica ni clínica. Se conserva en todos los
  productos: **exactitud matemática ≠ validación clínica**.

## Seguridad

- `backend/secure-files/` no debe montarse como estático en ningún host. La
  única salida es `GET /api/downloads/:orderItemId`, que valida dueño, pago y
  cupo antes de servir el archivo.
- El workflow de Pages copia solo la raíz, `assets/` y `public/`, y falla el
  build si detecta un `.xlsx` de producto o la carpeta `backend/` en el
  artefacto.
- Los secretos van en variables de entorno del host, nunca en el repositorio.
  Ver `backend/.env.example`.

## Despliegue

Frontend en GitHub Pages (workflow incluido). Backend aparte, en un host que
corra Node y PostgreSQL. Tras desplegar el backend, actualizar `API_BASE` en
`store.js` con su URL pública.
