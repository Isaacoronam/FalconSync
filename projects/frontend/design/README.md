# Maestros de identidad

Esta carpeta conserva los archivos originales aportados por el responsable del proyecto. No se
publican en el build de Angular; el generador `scripts/generate-brand-assets.mjs` produce los
derivados optimizados en `src/assets/`.

| Archivo | Uso | Origen |
|---|---|---|
| `falconsync-logo-source.png` | Logo circular completo | Aportado por el responsable del proyecto |
| `chivito-sheet.png` | Hoja de personaje de Chivito | Aportado por el responsable del proyecto |
| `fondo-medanos-source.png` | Paisaje de Médanos de Coro | Aportado por el responsable del proyecto |

Regenerar:

```bash
npm --prefix projects/frontend run brand:assets
```

Pendiente: registrar autoría, licencia y autorización de publicación de las tres imágenes antes
de una difusión abierta. El detalle de la integración está en
[`../../docs/IDENTIDAD.md`](../../docs/IDENTIDAD.md).
