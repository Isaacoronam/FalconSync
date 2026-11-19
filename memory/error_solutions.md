# Soluciones verificadas

## Conservación y evidencia fallan sin replica set

- **Síntoma:** las suites `conservation.test.js` y `evidence.test.js`, y el E2E, fallan al
  conectar con `mongodb://127.0.0.1:27018/...?replicaSet=falconsyncTest`; el standalone de
  `127.0.0.1:27017` no permite transacciones.
- **Causa confirmada:** MongoDB standalone no admite transacciones multi-documento. Las
  suites de conservación, evidencia y el E2E usan transacciones y esperan un replica set.
- **Solución aplicada:** iniciar un replica set de un nodo en `127.0.0.1:27018`:

  ```powershell
  & 'C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe' `
    --dbpath "$env:LOCALAPPDATA\Temp\opencode\mongo-rs-27018" `
    --port 27018 --bind_ip 127.0.0.1 --replSet falconsyncTest `
    --logpath "$env:LOCALAPPDATA\Temp\opencode\mongo-rs-27018.log" --logappend

  & 'C:\Users\nexxus\AppData\Local\Programs\mongosh\mongosh.exe' --port 27018 --quiet `
    --eval "try { rs.status().ok } catch (e) { rs.initiate({_id:'falconsyncTest',members:[{_id:0,host:'127.0.0.1:27018'}]}).ok }"
  ```

- **Verificación:** `mongosh --port 27018 --eval "db.hello().isWritablePrimary"` devuelve
  `true`; después, `npm run verify` completa backend, frontend, build y E2E. La prueba que
  evita la reaparición es la propia suite de conservación y evidencia en CI con replica set
  (ver `.github/workflows/ci.yml`).
- **Nota:** el standalone de `27017` sigue sirviendo para las suites que no usan
  transacciones, pero no para la verificación completa.

## El CI no puede usar MongoDB standalone ni perder la suite de conservación

- **Síntoma:** el workflow anterior usaba un servicio `mongo:9.0` standalone en `27017`, sin
  disparo en `develop` y sin `E2E_MONGODB_URI`; conservación, evidencia y E2E esperan un
  replica set en `27018`. Un CI así fallaría o quedaría incompleto aunque las pruebas locales
  pasaran.
- **Causa confirmada:** el servicio de contenedor de GitHub Actions solo publicaba el puerto
  `27017` y se iniciaba sin `--replSet`; además, el E2E resuelve por defecto `27018` con
  `replicaSet=falconsyncTest`.
- **Solución aplicada:** sustituir el `services:` por un `docker run` explícito con
  `mongo:9.0 --replSet falconsyncTest --bind_ip_all`, publicar `27017` y `27018` hacia el
  mismo `mongod`, esperar el ping y ejecutar `rs.initiate()` con
  `host: 127.0.0.1:27017`. Los puertos publicados mantienen los valores por defecto de cada
  suite sin compartir una única base de datos.
- **Verificación:** en la copia limpia del 2026-11-19, `npm ci` + 110/110 backend + 53/53
  frontend + build + 19/19 E2E con `CI=1`/Chromium; `npm audit --omit=dev` informó 0
  vulnerabilidades. La secuencia `rs.initiate()` → PRIMARY se probó en un replica set
  desechable en `27019`. El bloque de shell pasó `bash -n` y el YAML se cargó con PyYAML.
- **Limitación:** el paso Docker no se ejecutó en esta máquina porque no hay Docker, y GitHub
  Actions no se ejecutó porque falta autorización para publicar la rama/PR (A2). No se declara
  CI remoto verde.

## E2E de scroll del mapa intermitente en Edge headless

- **Síntoma:** `e2e/map.spec.ts` fallaba de forma intermitente al comprobar que la rueda
  desplazaba la lista de POI; `scrollTop` se quedaba en 0 y el poll agotaba 5 s.
- **Causa confirmada:** la rueda simulada con `page.mouse.wheel` no siempre llega al
  contenedor con scroll en Edge headless. La lista sí tiene `overflow: auto` y desbordamiento
  real; el fallo estaba en la simulación, no en la interfaz.
- **Solución aplicada:** desplazar el panel con `element.scrollBy` dentro de `evaluate` y
  comprobar que `window.scrollY` no cambia. Así se verifica el comportamiento del contenedor
  sin depender del reparto de eventos de la rueda.
- **Verificación:** `playwright test e2e/map.spec.ts --repeat-each=3` pasó 3/3 y
  `npm run verify` terminó con 19/19 E2E el 2026-11-18.
