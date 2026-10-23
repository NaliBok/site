# Minicraft+ в браузере

Оригинальный `minicraft.jar` (Minicraft+ 2.3.0-dev2) запускается в браузере через [CheerpJ](https://cheerpj.com) (Java в WebAssembly). Код игры не менялся.

- `index.html` — страница-обёртка
- `minicraft.jar` — игра (~9 МБ)
- Сервер не нужен: сайт целиком статический (GitHub Pages).

Локальная проверка: `python3 -m http.server 8000` и открыть http://localhost:8000

Minicraft+ распространяется под открытой лицензией, исходный код: https://github.com/MinicraftPlus/minicraft-plus-revived
