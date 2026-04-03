# pre-commit + zscan

Instala [pre-commit](https://pre-commit.com/) y copia el fragmento de `sample.pre-commit-config.yaml` a `.pre-commit-config.yaml` en la raíz del repo que quieras escanear.

Ajusta `entry` si `zscan` no está en el `PATH` (ruta absoluta a `node …/dist/cli.js` o a `./zscan` del proyecto zscan).

El hook falla cuando hay CVE en OSV (mismo criterio que `zscan scan` con código de salida 1).
