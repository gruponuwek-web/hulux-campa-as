# HULUX · Portal de Seguimiento de Campañas

Portal de marketing para HULUX Telecomunicaciones, desarrollado con SBOS (Selling Blocks Operating System) por **Grupo Nuwek**.

## Estructura del proyecto

```
hulux-marketing/
├── index.html    → Estructura HTML (pantallas y modales)
├── styles.css    → Estilos y variables de diseño
├── app.js        → Lógica de negocio y conexión con Google Sheets
└── README.md
```

## Funcionalidades

- **Campañas** — Alta, edición y eliminación de campañas (Meta Ads / TikTok)
- **Reporte semanal** — Captura de contactos FB/IG, soporte, leads y cierres por municipio con MRR
- **Dashboard KPIs** — Consolidado mensual con filtro por mes (flechas + dropdown), desglose por campaña y gráficas de municipios con barras combinadas leads/cierres

## Municipios cubiertos

Ajacuba · Santiago de Anaya · Tetepango · San Salvador · Progreso de Obregón · Mixquiahuala · Francisco I. Madero · Atitalaquia · El Arenal · Actopan · Huichapan

## Base de datos

Google Sheets conectado vía Apps Script (patrón URLSearchParams sin CORS).  
Estructura: hojas `Campanas`, `Reportes`, `Municipios`, `Dashboard`.

## Deploy

Publicado en **GitHub Pages** desde la rama `main`.  
URL: `https://<usuario>.github.io/<repositorio>/`

---
*Grupo Nuwek · Selling Blocks Operating System · 2025*
