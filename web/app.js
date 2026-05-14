// etch — browser client.
// Connects to /ws, parses JSON events, routes to the UI.
// Unknown event types fall through to the scroll area as raw JSON.

(() => {
    const scroll      = document.getElementById('scroll');
    const input       = document.getElementById('input');
    const form        = document.getElementById('input-form');
    const hudName     = document.getElementById('hud-name');
    const hudDepth    = document.getElementById('hud-depth');
    const hudStamina  = document.getElementById('hud-stamina');
    const hudDeepest  = document.getElementById('hud-deepest');
    const hudBand     = document.getElementById('hud-band');

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws`);

    // ---- output ----

    function append(text, cls) {
        const div = document.createElement('div');
        div.className = `line ${cls || 'system'}`;
        div.textContent = text;
        scroll.appendChild(div);
        scroll.scrollTop = scroll.scrollHeight;
    }

    function updateHud(ev) {
        hudName.textContent    = ev.name;
        hudDepth.textContent   = ev.depth;
        hudStamina.textContent = `${ev.stamina}/${ev.max_stamina}`;
        hudDeepest.textContent = ev.deepest_depth;
        hudBand.textContent    = ev.band;
    }

    function route(ev) {
        switch (ev.type) {
            case 'system':  return append(ev.text, 'system');
            case 'private': return append(ev.text, 'private');
            case 'said':    return append(`[${ev.from_name}]: ${ev.text}`, 'said');
            case 'shouted': return append(`[${ev.from_name} shouts]: ${ev.text}`, 'shouted');
            case 'hud':     return updateHud(ev);
            default:        return append(JSON.stringify(ev), 'raw');
        }
    }

    // ---- ws plumbing ----

    ws.addEventListener('open',  () => append('connected.', 'private'));
    ws.addEventListener('close', () => append('disconnected.', 'danger'));
    ws.addEventListener('error', () => append('connection error.', 'danger'));

    ws.addEventListener('message', (e) => {
        // Server sends one JSON event per line. A single WS frame may carry several.
        for (const line of e.data.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                route(JSON.parse(trimmed));
            } catch (_) {
                append(trimmed, 'raw');
            }
        }
    });

    // ---- input ----

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value;
        input.value = '';
        if (text.length === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(text);
    });

    // keep focus on the input through other interactions
    document.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input, [contenteditable]')) return;
        input.focus();
    });
})();
