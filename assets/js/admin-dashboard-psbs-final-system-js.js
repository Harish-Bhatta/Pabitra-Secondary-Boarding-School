(function () {
    // Pause decorative infinite animations while the tab is hidden (saves battery/CPU).
    var root = document.documentElement;
    function sync() { root.classList.toggle('psbs-idle', document.hidden); }
    document.addEventListener('visibilitychange', sync, { passive: true });
    sync();
    // Keep aria-selected / aria-current in step with the visual active state.
    function syncAria() {
        document.querySelectorAll('.doc-filter').forEach(function (b) {
            b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
        });
        document.querySelectorAll('.sidebar-links a[data-section]').forEach(function (a) {
            if (a.classList.contains('active')) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
    }
    var filters = document.getElementById('docFilters');
    if (filters) filters.addEventListener('click', function () { requestAnimationFrame(syncAria); });
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.sidebar-links a')) requestAnimationFrame(syncAria);
    }, { passive: true });
    syncAria();
    // Keep the first document clear of the floating search card, whatever its height.
    var tb = document.getElementById('docToolbar');
    if (tb) {
        var setPad = function () {
            var h = tb.offsetHeight;
            if (h > 0) root.style.setProperty('--doc-toolbar-pad', (h - 16) + 'px');
        };
        setPad();
        if (window.ResizeObserver) new ResizeObserver(setPad).observe(tb);
        window.addEventListener('resize', setPad, { passive: true });
    }
})();
