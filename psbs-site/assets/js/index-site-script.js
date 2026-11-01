/* PSBS — site script. Sections run in the original order. */

/* ===== 1. School info (Supabase cache + placeholders) ===== */
/* =====================================================================
   SCHOOL INFO — every school detail comes from Supabase (school_info).
   The last known row is cached locally so repeat visits render instantly.
   ===================================================================== */
(function () {
    'use strict';
    var KEY = 'psbs_school_info_v1', root = document.documentElement, cur = null;
    var STOP = { of: 1, and: 1, the: 1, for: 1, in: 1, at: 1 };
    function str(v) { return v == null ? '' : String(v).trim(); }
    function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
    function derive(d) {
        var name = str(d.school_name), words = name.split(/\s+/).filter(Boolean);
        var l1 = name, l2 = '';
        if (words.length > 2) { l1 = words.slice(0, -2).join(' '); l2 = words.slice(-2).join(' '); }
        else if (words.length === 2) { l1 = words[0]; l2 = words[1]; }
        var acr = words.filter(function (w) { return !STOP[w.toLowerCase()]; }).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
        if (words.length < 2) acr = name.toUpperCase();
        var addr = str(d.address), parts = addr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        var city = parts.length > 1 ? parts[1] : (parts[0] || '');
        var locality = parts.length > 1 ? parts.slice(1).join(', ') : addr;
        var year = str(d.established_year);
        var st = num(d.students_count), te = num(d.teachers_count);
        return {
            school_name: name, name: name, motto: str(d.motto), address: addr, phone: str(d.phone), email: str(d.email),
            established_year: year, acronym: acr || name, short_name: words[0] || name, short_title: words[0] ? words[0] + ' School' : name,
            title_l1: l1, title_l2: l2, locality: locality, city: city,
            est_line: year ? 'Estd. ' + year + ' B.S.' : '',
            brand_sub: (year ? 'Est. ' + year + ' B.S.' : '') + (year && city ? ' · ' : '') + city,
            principal_name: str(d.principal_name), principal_message: str(d.principal_message),
            students_count: st ? st.toLocaleString('en-US') : '', teachers_count: te ? te.toLocaleString('en-US') : ''
        };
    }
    function hide(el, on) { el.classList.toggle('si-hide', !!on); }
    function apply(d) {
        var v = derive(d), i, el, k, list, val;
        list = document.querySelectorAll('[data-si-msg]');
        for (i = 0; i < list.length; i++) {
            el = list[i];
            if (!el.hasAttribute('data-si-orig')) el.setAttribute('data-si-orig', el.innerHTML);
            if (v.principal_message) el.textContent = v.principal_message;
            else el.innerHTML = el.getAttribute('data-si-orig');
        }
        list = document.querySelectorAll('[data-si]');
        for (i = 0; i < list.length; i++) {
            el = list[i]; k = el.getAttribute('data-si');
            val = v[k] == null ? '' : v[k];
            if (el.hasAttribute('data-si-fallback')) {
                if (!el.hasAttribute('data-si-orig')) el.setAttribute('data-si-orig', el.textContent);
                if (!val) val = el.getAttribute('data-si-orig');
            }
            el.textContent = val;
            el.setAttribute('data-si-done', '');
            if (el.hasAttribute('data-si-hide-empty')) hide(el, !el.textContent);
        }
        list = document.querySelectorAll('[data-si-href]');
        for (i = 0; i < list.length; i++) {
            el = list[i]; k = el.getAttribute('data-si-href'); var url = '';
            if (k === 'tel' && v.phone) url = 'tel:' + v.phone.replace(/[^\d+]/g, '');
            else if (k === 'mailto' && v.email) url = 'mailto:' + v.email;
            else if (k === 'map' && v.name) url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((v.name + ' ' + v.address).trim());
            if (url) { el.setAttribute('href', url); hide(el, false); } else { el.removeAttribute('href'); hide(el, el.hasAttribute('data-si-hide-empty')); }
        }
        list = document.querySelectorAll('[data-si-alt]');
        for (i = 0; i < list.length; i++) {
            el = list[i]; k = el.getAttribute('data-si-alt');
            if (k === 'principal') { if (!el.hasAttribute('data-si-orig')) el.setAttribute('data-si-orig', el.getAttribute('alt') || ''); el.setAttribute('alt', v.principal_name ? 'Principal ' + v.principal_name : el.getAttribute('data-si-orig')); continue; }
            el.setAttribute('alt', k === 'campus' ? v.name + ' campus view' : v.name + ' Logo');
        }
        list = document.querySelectorAll('[data-si-aria="est"]');
        for (i = 0; i < list.length; i++) list[i].setAttribute('aria-label', v.established_year ? 'Established in ' + v.established_year + ' B.S.' : 'Established');
        list = document.querySelectorAll('[data-si-group]');
        for (i = 0; i < list.length; i++) {
            var kids = list[i].matches('[data-si]') ? [list[i]] : list[i].querySelectorAll('[data-si]'), any = false;
            for (var j = 0; j < kids.length; j++) if (kids[j].textContent.trim()) any = true;
            hide(list[i], !any);
        }
        list = document.querySelectorAll('[data-si-wrap]');
        for (i = 0; i < list.length; i++) hide(list[i], !list[i].querySelector('[data-si-group]:not(.si-hide)'));
        if (v.name) {
            document.title = v.name;
            var desc = v.name + (v.motto ? ' — ' + v.motto : '') + '. Official portal with notices, documents and gallery.';
            var m = { 'meta[name="description"]': desc, 'meta[property="og:title"]': v.name, 'meta[property="og:description"]': desc, 'meta[property="og:image:alt"]': v.name, 'meta[name="twitter:title"]': v.name, 'meta[name="twitter:description"]': desc };
            for (var sel in m) { var t = document.querySelector(sel); if (t) t.setAttribute('content', m[sel]); }
        }
    }
    function reveal() { if (window.__psbsReveal) window.__psbsReveal(); }
    window.SchoolInfo = {
        set: function (d) {
            if (!d) return; cur = d;
            try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { }
            root.classList.remove('si-failed'); apply(d); reveal();
        },
        fail: function () { if (!cur) root.classList.add('si-failed'); reveal(); },
        get: function () { return cur; },
        name: function () { return cur ? str(cur.school_name) : ''; },
        address: function () { return cur ? str(cur.address) : ''; },
        acr: function () { return cur ? derive(cur).acronym : 'School'; }
    };
    try {
        var c = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (c && c.school_name) { cur = c; apply(c); reveal(); }
    } catch (e) { }
})();

/* ===== 2. Supabase client ===== */
const SUPABASE_URL = 'https://ikeexzsjsksyhdfflwqe.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZWV4enNqc2tzeWhkZmZsd3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNzM0MDAsImV4cCI6MjEwMDY0OTQwMH0.t4AWEhlEiSyxqdtSuDK_5gA6zRv-45UNpFm86WpViWY';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.db = supabaseClient;

/* ===== 3. Main application ===== */
// -------------------- CONFIG --------------------
const CONFIG = {
    APP_NAME: 'PSBS Portal',
    MAX_NAME_LENGTH: 50,
    TOAST_DURATION: 3200,
    SWIPE_THRESHOLD: 50,
    PANEL_SWIPE_THRESHOLD: 16,
    GALLERY_BATCH_SIZE: 4,
    THEME_KEY: 'psbs_theme',
    PROFILE_KEY: 'psbs_profile',
    THEME_PRESET_KEY: 'psbs_theme_preset',
    NOTICE_READ_IDS_KEY: 'psbs_notice_read_ids',
    NOTICE_BADGE_SEEN_KEY: 'psbs_notice_badge_seen',
    RIGHT_PANEL_TAB_KEY: 'psbs_right_panel_tab',
    LOGIN_BASE: './',
    LOGIN_STUDENT: 'student-login.html',
    LOGIN_TEACHER: 'teacher-login.html',
    LOGIN_ADMIN: 'admin-login.html',
    CALENDAR_PAGE: 'calendar.html',
};

// -------------------- HELPERS --------------------
const Helpers = {
    safeUrl: function (raw) {
        if (!raw) return '';
        try {
            const u = new URL(String(raw).trim(), window.location.href);
            return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
        } catch (e) { return ''; }
    },
    sanitize: function (input) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
        return String(input == null ? '' : input).replace(/[&<>"'/]/g, function (s) { return map[s] || s; });
    },
    initials: function (name) {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        let init = '';
        for (let i = 0; i < Math.min(parts.length, 2); i++) { init += parts[i].charAt(0).toUpperCase(); }
        return init || 'U';
    },
    colorFromName: function (name) {
        const colors = ['#f39c12', '#06b6d4', '#e85d75', '#4f46e5', '#e74c3c', '#e11d48', '#27ae9e', '#f1c40f'];
        let sum = 0;
        const str = String(name);
        for (let i = 0; i < str.length; i++) { sum += str.charCodeAt(i); }
        return colors[sum % colors.length];
    },
    debounce: function (func, wait) {
        let timeout;
        return function () {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function () { func.apply(context, args); }, wait);
        };
    },
    formatDate: function (dateStr) {
        try {
            const d = new Date(this.parseTs(dateStr));
            if (isNaN(d.getTime())) return dateStr || '';
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) { return dateStr || ''; }
    },
    // Date-only values ("2026-10-16", or midnight with no zone) are calendar days; zone-less timestamps are UTC.
    isDateOnly: function (v) {
        const s = String(v == null ? '' : v).trim();
        return /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}[T ]00:00(:00(\.0+)?)?$/.test(s);
    },
    parseTs: function (v) {
        if (v == null || v === '') return NaN;
        if (v instanceof Date) return v.getTime();
        let s = String(v).trim();
        if (this.isDateOnly(s)) { const p = s.slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); }
        if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}(:?\d{2})?)$/.test(s)) s = s.replace(' ', 'T') + 'Z';
        return new Date(s).getTime();
    },
    timeAgo: function (dateStr) {
        const then = this.parseTs(dateStr);
        if (isNaN(then)) return '';
        if (this.isDateOnly(dateStr)) {
            const t0 = new Date(); t0.setHours(0, 0, 0, 0);
            const days = Math.round((t0.getTime() - then) / 86400000);
            if (days <= 0) return 'Today';
            if (days === 1) return 'Yesterday';
            if (days < 7) return days + 'd ago';
            return new Date(then).toLocaleDateString();
        }
        const diff = Math.floor((Date.now() - then) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        return new Date(then).toLocaleDateString();
    },
    // "Published" time of a notice: the real created_at timestamp when available, else its date.
    noticeAgo: function (n) { return this.timeAgo(n && (n.created_at || n.date)); },
    formatBytes: function (bytes) {
        const n = Number(bytes);
        if (!n || n <= 0 || isNaN(n)) return '';
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0, val = n;
        while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
        return (val >= 10 ? Math.round(val) : val.toFixed(1)) + ' ' + units[i];
    },
    vibrate: function (ms) {
        try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) { }
    },
    clamp: function (v, min, max) { return Math.max(min, Math.min(max, v)); },
    toggleDark: function () {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem(CONFIG.THEME_KEY, isDark ? 'dark' : 'light');
        const btn = document.getElementById('headerThemeToggleBtn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) icon.className = isDark ? 'ri-sun-line' : 'ri-moon-line';
        }
        return isDark;
    },
    getTheme: function () { return localStorage.getItem(CONFIG.THEME_KEY) || 'light'; },
    applyTheme: function () {
        const btn = document.getElementById('headerThemeToggleBtn');
        const icon = btn ? btn.querySelector('i') : null;
        if (this.getTheme() === 'dark') {
            document.body.classList.add('dark');
            if (icon) icon.className = 'ri-sun-line';
            return true;
        }
        if (icon) icon.className = 'ri-moon-line';
        return false;
    },
    getThemePreset: function () { return localStorage.getItem(CONFIG.THEME_PRESET_KEY) || 'gold'; },
    setThemePreset: function (preset) {
        document.body.className = document.body.className.split(' ').filter(function (c) {
            return !c.startsWith('theme-');
        }).join(' ');
        if (preset && preset !== 'default') { document.body.classList.add('theme-' + preset); }
        localStorage.setItem(CONFIG.THEME_PRESET_KEY, preset);
        const meta = document.querySelector('meta[name="theme-color"]');
        const colorMap = {
            gold: '#f39c12', cyan: '#06b6d4', coral: '#e85d75', indigo: '#4f46e5',
            red: '#e74c3c', rose: '#e11d48', teal: '#27ae9e', yellow: '#f1c40f'
        };
        if (meta && colorMap[preset]) meta.setAttribute('content', colorMap[preset]);
        return preset;
    },
    sharePage: function () {
        if (navigator.share) {
            navigator.share({
                title: SchoolInfo.acr() + ' Portal',
                text: 'Check out ' + (SchoolInfo.name() || 'our school') + ' portal!',
                url: window.location.href
            }).catch(function () { });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href).then(function () {
                Toast.show('Link copied to clipboard! 📋', 'success');
            }).catch(function () {
                Toast.show('Share: ' + window.location.href, 'info');
            });
        } else {
            Toast.show('Share: ' + window.location.href, 'info');
        }
    },
    getSearchData: function () {
        return [
            { id: 'hero', title: 'Home', desc: 'Welcome to the school portal', icon: 'ri-home-5-line' },
            { id: 'about', title: 'About Us', desc: 'Learn more about our school', icon: 'ri-information-line' },
            { id: 'academics', title: 'Academics', desc: 'Our academic programs and curriculum', icon: 'ri-book-open-line' },
            { id: 'faculty', title: 'Faculty', desc: 'Meet our dedicated teachers', icon: 'ri-user-star-line' },
            { id: 'gallery', title: 'Gallery', desc: 'Campus life photos', icon: 'ri-image-line' },
            { id: 'contact', title: 'Contact', desc: 'Get in touch with us', icon: 'ri-phone-line' },
        ];
    },
    getGreeting: function () {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    },
    log: function (msg) { if ((function(){try{return localStorage.getItem('psbs_debug')==='1'}catch(e){return false}})()) console.log('[' + CONFIG.APP_NAME + '] ' + msg); },
};

// ===== RIPPLE =====
function attachRipple(el, e) {
    if (!el.classList.contains('ripple-host')) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = (e.clientX || (rect.left + rect.width / 2)) - rect.left - size / 2;
    const y = (e.clientY || (rect.top + rect.height / 2)) - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    el.appendChild(ripple);
    setTimeout(function () { ripple.remove(); }, 680);
}

document.addEventListener('pointerdown', function (e) {
    const host = e.target.closest('.ripple-host');
    if (host) attachRipple(host, e);
}, { passive: true });

// ===== TOAST =====
const Toast = {
    _timeout: null, _queue: [], _isShowing: false,
    show: function (message, type, duration) {
        type = type || 'success';
        duration = duration || CONFIG.TOAST_DURATION;
        this._queue.push({ message: message, type: type, duration: duration });
        if (!this._isShowing) this._processQueue();
    },
    _processQueue: function () {
        if (this._queue.length === 0) { this._isShowing = false; return; }
        this._isShowing = true;
        const item = this._queue.shift();
        this._display(item.message, item.type, item.duration);
    },
    _display: function (message, type, duration) {
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const toastEl = document.getElementById('toast');
        const msgEl = toastEl.querySelector('.toast-message');
        const iconEl = toastEl.querySelector('.toast-icon');
        const closeBtn = toastEl.querySelector('.toast-close');
        msgEl.textContent = message;
        toastEl.className = 'toast toast-' + type;
        if (iconEl) iconEl.textContent = icons[type] || icons.info;
        toastEl.classList.add('active');
        clearTimeout(this._timeout);
        closeBtn.onclick = function () { Toast.hide(); };
        this._timeout = setTimeout(function () {
            toastEl.classList.remove('active');
            setTimeout(function () { Toast._processQueue(); }, 300);
        }, duration);
    },
    hide: function () {
        const toastEl = document.getElementById('toast');
        toastEl.classList.remove('active');
        clearTimeout(this._timeout);
        setTimeout(function () { Toast._processQueue(); }, 300);
    },
    success: function (m) { this.show(m, 'success'); },
    error: function (m) { this.show(m, 'error'); },
    warning: function (m) { this.show(m, 'warning'); },
    info: function (m) { this.show(m, 'info'); }
};

// ===== STATE =====
const State = {
    isSidebarOpen: false, isNoticeOpen: false, isDocumentsOpen: false,
    isDropdownOpen: false, isNameModalOpen: false, isWelcomeOpen: false,
    isEditModalOpen: false, isSearchOpen: false, isThemePresetsOpen: false,
    panelOpen: false,
    touchStartX: 0, touchStartY: 0, touchCurrentX: 0, touchCurrentY: 0,
    isDragging: false, isDraggingSidebar: false, isDraggingRightPanel: false,
    verticalSwipeLock: false,
    touchInsideRightPanel: false,
    profile: null,
    openCount: 0,
    notices: [], faculty: [], documents: [],
    docSearchQuery: '', docFilter: 'all',
    schoolInfo: null,
};

const $ = function (s) { return document.querySelector(s); };
const $$ = function (s) { return document.querySelectorAll(s); };

const DOM = {
    nameModal: $('#nameModal'), nameForm: $('#nameForm'),
    userNameInput: $('#userNameInput'), nameError: $('#nameError'),
    welcomeCard: $('#welcomeCard'), welcomeAvatar: $('#welcomeAvatar'),
    welcomeTitle: $('#welcomeTitle'), welcomeMessage: $('#welcomeMessage'),
    welcomeCloseBtn: $('#welcomeCloseBtn'),
    editNameModal: $('#editNameModal'), editNameForm: $('#editNameForm'),
    editNameInput: $('#editNameInput'), editNameError: $('#editNameError'),
    editNameCloseBtn: $('#editNameCloseBtn'), editNameCancelBtn: $('#editNameCancelBtn'),
    editNameSaveBtn: $('#editNameSaveBtn'),
    searchOverlay: $('#searchOverlay'), searchInput: $('#searchInput'),
    searchResults: $('#searchResults'), searchClearBtn: $('#searchClearBtn'),
    header: $('.header'), menuBtn: $('.menu-btn'), noticeBtn: $('.notice-btn'),
    profileBtn: $('#headerProfileBtn'), noticeBadge: $('#noticeBadge'),
    sidebar: $('.sidebar'), sidebarOverlay: $('.sidebar-overlay'), sidebarClose: $('.sidebar-close'),
    rightPanel: $('#rightPanel'), rightPanelClose: $('#rightPanelClose'),
    rightPanelIcon: $('#rightPanelIcon'), rightPanelTitle: $('#rightPanelTitle'),
    rightPanelSubtitle: $('#rightPanelSubtitle'),
    panelSlider: $('#panelSlider'),
    panelViewport: document.querySelector('.panel-viewport'),
    noticeContainer: $('#noticeContainer'),
    documentsContainer: $('#documentsContainer'),
    docSearchInput: $('#docSearchInput'), docFilters: $('#docFilters'),
    docToolbar: $('#docToolbar'), docToolbarScroll: $('#docToolbarScroll'),
    noticeTabBadge: $('#noticeTabBadge'), docTabBadge: $('#docTabBadge'),
    profileDropdown: $('#profileDropdown'), ddAvatarWrap: $('#ddAvatarWrap'),
    ddAvatar: $('#ddAvatar'), ddName: $('#ddName'), ddRole: $('#ddRole'),
    ddEditNameIcon: $('#ddEditNameIcon'), ddLogoutBtn: $('#ddLogoutBtn'),
    ddCalendarBtn: $('#ddCalendarBtn'),
    ddAdminLogin: $('#ddAdminLogin'), ddShareBtn: $('#ddShareBtn'),
    avatarUploader: $('#avatarUploader'),
    contactForm: $('#contactForm'), contactName: $('#contactName'),
    contactEmail: $('#contactEmail'), contactMessage: $('#contactMessage'),
    footerYear: $('#footerYear'),
    facultyContainer: $('#facultyContainer'),
    heroMotto: $('#heroMotto'), heroContainer: $('#hero'),
    fabTop: $('#fabTop'),
    themePresetsModal: $('#themePresetsModal'), themePresetsGrid: $('#themePresetsGrid'),
    themePresetsCloseBtn: $('#themePresetsCloseBtn'), themePresetsApplyBtn: $('#themePresetsApplyBtn'),
    sidebarDocumentsBtn: $('#sidebarDocumentsBtn'),
    headerThemePresetsBtn: $('#headerThemePresetsBtn'),
    headerThemeToggleBtn: $('#headerThemeToggleBtn'),
    dragTrail: $('#dragTrail'),
    edgeHintRight: $('#edgeHintRight'),
    edgeHintLeft: $('#edgeHintLeft'),
};

// ============================================================
// TOUCH TRACKING
// ============================================================
(function setupTouchTracking() {
    let hideTimer = null;
    const showTouching = function () {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
        }, 700);
    };
    document.addEventListener('touchstart', showTouching, { passive: true });
    document.addEventListener('touchmove', showTouching, { passive: true });
    document.addEventListener('touchend', showTouching, { passive: true });
    document.addEventListener('scroll', function () {
        if (!('ontouchstart' in window)) return;
        showTouching();
    }, { passive: true, capture: true });
})();

// ============================================================
// DRAG TRAIL
// ============================================================
const DragTrail = {
    active: false,
    show: function (x, y) {
        const el = DOM.dragTrail;
        if (!el) return;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        if (!this.active) {
            el.classList.add('active');
            this.active = true;
        }
    },
    hide: function () {
        const el = DOM.dragTrail;
        if (!el) return;
        el.classList.remove('active');
        this.active = false;
    }
};

// ============================================================
// RIGHT PANEL
// ============================================================
const RightPanel = {
    current: null,
    _isOpen: false,

    getLast: function () {
        try {
            const v = localStorage.getItem(CONFIG.RIGHT_PANEL_TAB_KEY);
            return (v === 'documents') ? 'documents' : 'notice';
        } catch (e) { return 'notice'; }
    },
    setLast: function (which) {
        try { localStorage.setItem(CONFIG.RIGHT_PANEL_TAB_KEY, which); } catch (e) { }
    },

    setTab: function (which, animate) {
        which = (which === 'documents') ? 'documents' : 'notice';
        if (this.current === which) return;

        const slider = DOM.panelSlider;

        if (!animate) {
            slider.style.transition = 'none';
        }

        slider.style.transform = '';
        slider.setAttribute('data-active', which);
        DOM.rightPanel.setAttribute('data-active-tab', which);

        if (!animate) {
            /* restore the transition two frames later, no synchronous layout flush */
            requestAnimationFrame(function () { requestAnimationFrame(function () { slider.style.transition = ''; }); });
        }

        if (which === 'notice') {
            DOM.rightPanelIcon.innerHTML = '<i class="ri-notification-3-line"></i>';
            DOM.rightPanelTitle.textContent = 'Notice Board';
            DOM.rightPanelSubtitle.textContent = 'Stay updated';
        } else {
            DOM.rightPanelIcon.innerHTML = '<i class="ri-folder-open-line"></i>';
            const count = (State.documents || []).length;
            DOM.rightPanelSubtitle.textContent = count
                ? count + ' file' + (count === 1 ? '' : 's') + ' available'
                : 'Notes • PDFs • Slides';
            DOM.rightPanelTitle.textContent = 'Documents';
        }

        document.querySelectorAll('.panel-tab').forEach(function (btn) {
            const on = btn.getAttribute('data-panel-tab') === which;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });

        this.current = which;
        this.setLast(which);

        State.isNoticeOpen = (which === 'notice');
        State.isDocumentsOpen = (which === 'documents');

        if (which === 'notice') {
            setTimeout(function () { NoticeManager.markAllAsRead(); }, 700);
        } else if (DOM.docSearchInput) {
            DOM.docSearchInput.blur();
        }

        Helpers.vibrate(8);
    },

    open: function (which) {
        which = (which === 'documents') ? 'documents' : 'notice';

        if (State.isSidebarOpen) closeSidebar();
        if (State.isDropdownOpen) closeProfileDropdown();
        if (State.isEditModalOpen) closeEditNameModal();
        if (State.isSearchOpen) closeSearch();
        if (State.isThemePresetsOpen) closeThemePresets();
        closeAllDocMenus();

        const wasOpen = this._isOpen;

        DOM.rightPanel.classList.add('active');
        DOM.sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('right-panel-active');

        this._isOpen = true;

        this.setTab(which, wasOpen && this.current !== which);

        if (!wasOpen) State.openCount++;
        State.panelOpen = true;

        if (which === 'notice') setTimeout(function () { NoticeManager.markAllAsRead(); }, 700);
    },

    close: function () {
        const wasOpen = this._isOpen;

        DOM.rightPanel.classList.remove('active', 'dragging');
        DOM.sidebarOverlay.classList.remove('active');
        /* keep 'right-panel-active' (paused page animations) until the slide-out ends,
           so no page-wide style recalc lands in the middle of the closing animation */
        clearTimeout(RightPanel._cleanTimer);
        RightPanel._cleanTimer = setTimeout(function () {
            if (!RightPanel._isOpen) document.body.classList.remove('right-panel-active');
        }, 520);

        State.isNoticeOpen = false;
        State.isDocumentsOpen = false;
        State.panelOpen = false;
        this._isOpen = false;
        this.current = null;

        if (DOM.docSearchInput) DOM.docSearchInput.blur();
        closeAllDocMenus();

        if (!State.isSidebarOpen && !State.isDropdownOpen && !State.isEditModalOpen &&
            !State.isSearchOpen && !State.isThemePresetsOpen &&
            !State.isNameModalOpen && !State.isWelcomeOpen) {
            document.body.style.overflow = '';
        }

        if (wasOpen && State.openCount > 0) State.openCount--;
    }
};

// ===== BOTTOM PANEL TAB SWITCHER =====
document.querySelectorAll('.panel-tab').forEach(function (btn, i, arr) {
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const target = btn.getAttribute('data-panel-tab');
        if (target !== 'notice' && target !== 'documents') return;

        // Bottom-bar buttons are full panel switchers:
        // open the panel if closed, otherwise switch the visible pane.
        if (!RightPanel._isOpen) {
            RightPanel.open(target);
        } else if (RightPanel.current !== target) {
            RightPanel.setTab(target, true);
        }

        requestAnimationFrame(lockPanelViewport);
        setTimeout(lockPanelViewport, 360);
    });

    btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const step = e.key === 'ArrowLeft' ? -1 : 1;
            const next = arr[(i + step + arr.length) % arr.length];
            next.focus();
            next.click();
            e.preventDefault();
        }
    });
});

DOM.noticeBtn.addEventListener('click', function () {
    if (RightPanel._isOpen && RightPanel.current === 'notice') {
        RightPanel.close();
    } else {
        RightPanel.open('notice');
    }
});
DOM.rightPanelClose.addEventListener('click', function () { RightPanel.close(); });

DOM.sidebarDocumentsBtn.addEventListener('click', function () {
    closeSidebar();
    setTimeout(function () { RightPanel.open('documents'); }, 120);
});

// ============================================================
// PANEL VIEWPORT LOCK
// ============================================================
function lockPanelViewport() {
    const vp = DOM.panelViewport;
    if (!vp) return;
    if (vp.scrollLeft !== 0) vp.scrollLeft = 0;
    if (vp.scrollTop !== 0) vp.scrollTop = 0;
}
if (DOM.panelViewport) {
    DOM.panelViewport.addEventListener('scroll', lockPanelViewport, { passive: true });
}

// ============================================================
// PANEL SWIPE — finger-following physics
// ============================================================
(function setupPanelSwipe() {
    const el = DOM.rightPanel;
    const slider = DOM.panelSlider;
    if (!el || !slider) return;

    let sx = 0, sy = 0, dx = 0;
    let tracking = false, decided = false, horizontal = false;
    let panelDrag = false;   /* true while the whole panel follows the finger to close */
    let settleTimer = null;
    let _fillRaf = 0, _fillArgs = null;

    function basePercent(which) {
        return which === 'documents' ? '-50%' : '0%';
    }

    function clearSettle() {
        if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    }

    function resetSlider() {
        clearSettle();
        slider.style.transition = '';
        slider.style.transform = '';
        void slider.offsetWidth;
        slider.style.transition = '';
        lockPanelViewport();
        resetTabFill();
    }

    function tabBtn(which) {
        return document.querySelector('.panel-tab[data-panel-tab="' + which + '"]');
    }

    function resetTabFill() {
        el.classList.remove('tabs-dragging');
        var notice = tabBtn('notice'), docs = tabBtn('documents');
        if (notice) notice.style.removeProperty('--swipe-p');
        if (docs) docs.style.removeProperty('--swipe-p');
        document.querySelectorAll('.panel-tab').forEach(function (btn) {
            var on = btn.getAttribute('data-panel-tab') === (RightPanel.current || 'notice');
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }

    function updateTabFill(cur, dragDx, limit) {
        if (!limit) return;

        /* Finger-following interpolation: the outgoing tab fades from
           active -> inactive while the incoming tab rises from
           inactive -> active on every touchmove frame. */
        var progress = Helpers.clamp(Math.abs(dragDx) / limit, 0, 1);
        var toward = null;
        if (cur === 'notice' && dragDx < 0) toward = 'documents';
        if (cur === 'documents' && dragDx > 0) toward = 'notice';

        var notice = tabBtn('notice'), docs = tabBtn('documents');
        if (!notice || !docs) return;

        if (!toward) {
            notice.style.setProperty('--swipe-p', cur === 'notice' ? '1' : '0');
            docs.style.setProperty('--swipe-p', cur === 'documents' ? '1' : '0');
            return;
        }

        var curP = 1 - progress;
        var nextP = progress;
        notice.style.setProperty('--swipe-p', (cur === 'notice' ? curP : nextP).toFixed(4));
        docs.style.setProperty('--swipe-p', (cur === 'documents' ? curP : nextP).toFixed(4));

        /* ARIA follows the visual state only at the midpoint; the
           colors themselves remain truly finger-following. */
        var visualNext = progress >= 0.5 ? toward : cur;
        document.querySelectorAll('.panel-tab').forEach(function (btn) {
            var on = btn.getAttribute('data-panel-tab') === visualNext;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }

    /* Close-by-swipe: the whole card follows the finger.
       Kept deliberately light so it stays at 60fps: one compositor-only transform per
       animation frame, width cached at touch start, no layout reads while moving. */
    let panelW = 360, dragDist = 0, dragRaf = 0;
    function applyPanelDrag() {
        dragRaf = 0;
        const tx = dragDist < 0 ? 0 : (dragDist > panelW ? panelW : dragDist);
        const pr = 1 - tx / panelW;
        el.style.transform = 'translateX(' + tx.toFixed(1) + 'px) scale(' + (0.96 + 0.04 * pr).toFixed(4) + ')';
        if (DOM.sidebarOverlay) DOM.sidebarOverlay.style.opacity = (0.85 * pr).toFixed(3);
    }
    function dragPanel(distance) {
        if (!panelDrag) {
            panelDrag = true;
            el.style.setProperty('transition', 'none', 'important');
            if (DOM.sidebarOverlay) {
                DOM.sidebarOverlay.style.transition = 'none';
                DOM.sidebarOverlay.style.visibility = 'visible';
            }
        }
        dragDist = distance;
        if (!dragRaf) dragRaf = requestAnimationFrame(applyPanelDrag);
    }
    function clearPanelDrag() {
        if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
        panelDrag = false;
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
        if (DOM.sidebarOverlay) {
            DOM.sidebarOverlay.style.transition = '';
            DOM.sidebarOverlay.style.opacity = '';
            DOM.sidebarOverlay.style.visibility = '';
        }
    }

    el.addEventListener('touchstart', function (e) {
        if (!RightPanel._isOpen || e.touches.length !== 1) { tracking = false; return; }
        if (e.target.closest('input, textarea, .doc-menu, .doc-menu-btn, .doc-filter, .doc-search-wrap, .doc-toolbar-scroll, .panel-tab')) {
            tracking = false;
            return;
        }
        clearSettle();
        panelW = el.offsetWidth || 360;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        dx = 0;
        tracking = true;
        decided = false;
        horizontal = false;
        window.__swT0 = Date.now();
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
        if (!tracking) return;
        const t = e.touches[0];
        dx = t.clientX - sx;
        const dy = t.clientY - sy;

        if (!decided) {
            if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
            decided = true;
            horizontal = Math.abs(dx) > Math.abs(dy) * 0.85;
            if (horizontal) slider.style.transition = 'none';
        }
        if (!horizontal) return;

        e.preventDefault();

        const cur = RightPanel.current || 'notice';

        /* Notices pane + swipe right: the whole panel travels with the finger and can be closed */
        if (cur === 'notice' && dx > 0) {
            if (!panelDrag) slider.style.transform = 'translateX(calc(' + basePercent(cur) + ' + 0px))';
            dragPanel(dx);
            return;
        }
        if (panelDrag) clearPanelDrag();

        let d = dx * 1.35;
        if (cur === 'documents' && d < 0) d *= 0.3;   /* gentle rubber-band at the last pane */
        const limit = panelW;
        d = Helpers.clamp(d, -limit, limit);

        slider.style.transform = 'translateX(calc(' + basePercent(cur) + ' + ' + d.toFixed(1) + 'px))';
        /* tab fill updates once per frame; the heavy finger-trail glow is skipped here for smoothness */
        _fillArgs = [cur, dx, limit];
        if (!_fillRaf) _fillRaf = requestAnimationFrame(function () { _fillRaf = 0; if (_fillArgs) updateTabFill(_fillArgs[0], _fillArgs[1], _fillArgs[2]); });
    }, { passive: false });

    function finishDrag() {
        if (_fillRaf) { cancelAnimationFrame(_fillRaf); _fillRaf = 0; }
        tracking = false;
        decided = false;
        horizontal = false;
        dx = 0;
        DragTrail.hide();
    }

    el.addEventListener('touchend', function () {
        if (!tracking) return;
        const wasHorizontal = horizontal;
        const rawDx = dx;
        let totalDx = dx;
        if (Math.abs(totalDx) > 6 && (Date.now() - (window.__swT0 || 0)) < 350) totalDx *= 3; /* quick flick */
        finishDrag();

        if (panelDrag) {
            const flick = (Date.now() - (window.__swT0 || 0)) < 300 && rawDx > 30;
            const shouldClose = rawDx > panelW * 0.28 || flick;
            if (shouldClose) {
                if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
                panelDrag = false;
                el.style.transition = '';                 /* restore the CSS slide transition */
                if (DOM.sidebarOverlay) DOM.sidebarOverlay.style.transition = '';
                void el.offsetWidth;                      /* commit dragged position as start point */
                el.style.transform = '';                  /* ...then slide out from where the finger left it */
                el.style.opacity = '';
                if (DOM.sidebarOverlay) { DOM.sidebarOverlay.style.opacity = ''; DOM.sidebarOverlay.style.visibility = ''; }
                RightPanel.close();
                clearSettle();
                settleTimer = setTimeout(resetSlider, 480);
                return;
            }
            clearPanelDrag();
            resetSlider();
            return;
        }

        if (!wasHorizontal) return;

        const cur = RightPanel.current || 'notice';
        let target = null;

        if (totalDx < 0 && Math.abs(totalDx) >= CONFIG.PANEL_SWIPE_THRESHOLD && cur === 'notice') {
            target = 'documents';
        } else if (totalDx > 0 && totalDx >= CONFIG.PANEL_SWIPE_THRESHOLD && cur === 'documents') {
            target = 'notice';
        }

        if (target && target !== cur) {
            slider.style.transition = '';
            slider.style.transform = '';
            RightPanel.setTab(target, true);
            resetTabFill();
            lockPanelViewport();
            clearSettle();
            settleTimer = setTimeout(function () {
                slider.style.transition = '';
                slider.style.transform = '';
                lockPanelViewport();
                settleTimer = null;
            }, 500);
        } else {
            resetSlider();
        }
    }, { passive: true });

    el.addEventListener('touchcancel', function () {
        if (panelDrag) clearPanelDrag();
        if (!tracking) return;
        finishDrag();
        resetSlider();
    }, { passive: true });
})();

// ===== NOTICE MANAGER =====
const NoticeManager = {
    getReadIds: function () {
        try {
            const data = localStorage.getItem(CONFIG.NOTICE_READ_IDS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },
    saveReadIds: function (ids) { localStorage.setItem(CONFIG.NOTICE_READ_IDS_KEY, JSON.stringify(ids)); },
    getUnreadIds: function () {
        const readIds = this.getReadIds();
        const notices = State.notices || [];
        return notices.filter(function (n) { return !readIds.includes(String(n.id)); })
            .map(function (n) { return String(n.id); });
    },
    getUnreadCount: function () { return this.getUnreadIds().length; },
    /* The header badge is shown once per notice: ids announced in an earlier visit are remembered
       in localStorage and stay hidden; ids announced in this visit keep showing until it ends. */
    sessionBadgeIds: new Set(),
    getSeenIds: function () {
        try {
            const data = localStorage.getItem(CONFIG.NOTICE_BADGE_SEEN_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },
    getBadgeIds: function () {
        const readIds = this.getReadIds();
        const seen = this.getSeenIds();
        const fresh = [];
        (State.notices || []).forEach((n) => {
            const id = String(n.id);
            if (!readIds.includes(id) && !seen.includes(id) && !this.sessionBadgeIds.has(id)) fresh.push(id);
        });
        if (fresh.length) {
            fresh.forEach((id) => this.sessionBadgeIds.add(id));
            try { localStorage.setItem(CONFIG.NOTICE_BADGE_SEEN_KEY, JSON.stringify(seen.concat(fresh))); } catch (e) { /* storage unavailable */ }
        }
        return Array.from(this.sessionBadgeIds).filter((id) => !readIds.includes(id));
    },
    markAllAsRead: function () {
        const ids = (State.notices || []).map(function (n) { return String(n.id); });
        this.saveReadIds(ids);
        this.updateBadge();
        document.querySelectorAll('.update-card.notice-unread').forEach(function (el) {
            el.classList.remove('notice-unread');
        });
    },
    markNoticeAsRead: function (noticeId) {
        const id = String(noticeId);
        const readIds = this.getReadIds();
        if (!readIds.includes(id)) {
            readIds.push(id);
            this.saveReadIds(readIds);
            this.updateBadge();
            const card = document.querySelector('.update-card[data-notice-id="' + id + '"]');
            if (card) card.classList.remove('notice-unread');
        }
    },
    updateBadge: function () {
        const badge = DOM.noticeBadge;
        const tabBadge = DOM.noticeTabBadge;
        const count = this.getUnreadCount();
        const badgeCount = this.getBadgeIds().length;
        if (badge) {
            if (badgeCount > 0) {
                const label = badgeCount > 99 ? '99+' : String(badgeCount);
                const changed = badge.textContent !== label || badge.classList.contains('hidden-badge');
                badge.textContent = label;
                badge.classList.remove('hidden-badge');
                if (changed) {
                    badge.classList.remove('pop');
                    void badge.offsetWidth;
                    badge.classList.add('pop');
                    setTimeout(function () { badge.classList.remove('pop'); }, 600);
                }
            } else {
                badge.classList.add('hidden-badge');
            }
        }
        if (tabBadge) {
            if (count > 0) {
                tabBadge.textContent = count > 99 ? '99+' : count;
                tabBadge.classList.remove('hidden-badge');
            } else {
                tabBadge.classList.add('hidden-badge');
            }
        }
    }
};

function updateDocTabBadge() {
    const tabBadge = DOM.docTabBadge;
    if (!tabBadge) return;
    const count = (State.documents || []).length;
    if (count > 0) {
        tabBadge.textContent = count > 99 ? '99+' : count;
        tabBadge.classList.remove('hidden-badge');
    } else {
        tabBadge.classList.add('hidden-badge');
    }
}

// ===== SUPABASE DATA =====
async function fetchSchoolInfo() {
    try {
        const { data, error } = await window.db.from('school_info').select('*').eq('id', 1).maybeSingle();
        if (!error && data) {
            State.schoolInfo = data;
            SchoolInfo.set(data);
        } else { SchoolInfo.fail(); }
    } catch (e) { console.warn('school_info fetch failed', e); SchoolInfo.fail(); }
}

async function fetchNotices() {
    try {
        const { data, error } = await window.db.from('notices').select('*').order('date', { ascending: false });
        if (error) throw error;
        State.notices = (data || []).slice().sort(function (a, b) {
            const d = (Helpers.parseTs(b.date) || 0) - (Helpers.parseTs(a.date) || 0);
            return d || ((Helpers.parseTs(b.created_at) || 0) - (Helpers.parseTs(a.created_at) || 0));
        });
        renderNotices(State.notices);
        NoticeManager.updateBadge();
    } catch (e) {
        console.warn('Notices fetch error:', e);
        DOM.noticeContainer.innerHTML =
            '<div class="doc-empty"><span class="doc-empty-icon"><i class="ri-inbox-line" aria-hidden="true"></i></span><h4>Could not load notices</h4><p>Please check your connection and try again.</p></div>';
    }
}

function renderNotices(notices) {
    const container = DOM.noticeContainer;
    if (!notices || notices.length === 0) {
        container.innerHTML =
            '<div class="doc-empty"><span class="doc-empty-icon"><i class="ri-inbox-line" aria-hidden="true"></i></span><h4>No notices available</h4><p>Please check back later.</p></div>';
        return;
    }
    const readIds = NoticeManager.getReadIds();
    const allowedLabels = ['urgent', 'event', 'announcement', 'achievement', 'exam', 'holiday'];
    const labelMap = {
        urgent: '<i class="ri-alarm-warning-fill" aria-hidden="true"></i> URGENT',
        event: '<i class="ri-calendar-event-fill" aria-hidden="true"></i> EVENT',
        announcement: '<i class="ri-megaphone-fill" aria-hidden="true"></i> ANNOUNCEMENT',
        achievement: '<i class="ri-trophy-fill" aria-hidden="true"></i> ACHIEVEMENT',
        exam: '<i class="ri-edit-box-fill" aria-hidden="true"></i> EXAM',
        holiday: '<i class="ri-sun-fill" aria-hidden="true"></i> HOLIDAY'
    };
    let html = '';
    for (let i = 0; i < notices.length; i++) {
        const n = notices[i];
        const id = String(n.id);
        const isUnread = !readIds.includes(id);
        const rawLabel = String(n.label || '').toLowerCase().trim();
        const safeLabel = allowedLabels.indexOf(rawLabel) !== -1 ? rawLabel : 'announcement';
        const labelText = labelMap[safeLabel] || safeLabel.toUpperCase();
        html += '<div class="update-card ' + (isUnread ? 'notice-unread' : '') +
            '" data-notice-id="' + Helpers.sanitize(id) +
            '" style="animation-delay:' + Math.min(i * 50, 350) + 'ms">';
        html += '<span class="update-label ' + safeLabel + '">' + labelText + '</span>';
        html += '<h3>' + Helpers.sanitize(n.title) + '</h3>';
        html += '<p>' + Helpers.sanitize(n.description) + '</p>';
        const ago = Helpers.noticeAgo(n);
        const showAgo = /ago$|^just now$|^yesterday$/i.test(String(ago || '').trim());
        html += '<div class="update-date"><i class="ri-calendar-line" aria-hidden="true"></i> ' + Helpers.formatDate(n.date) + (showAgo ? ' • ' + ago : '') + '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
    container.querySelectorAll('.update-card').forEach(function (card) {
        card.addEventListener('click', function () {
            const id = this.getAttribute('data-notice-id');
            if (id) NoticeManager.markNoticeAsRead(id);
        });
    });
}

async function fetchFaculty() {
    try {
        const { data, error } = await window.db.from('faculty').select('*').order('order', { ascending: true });
        if (error) throw error;
        State.faculty = data || [];
        renderFaculty(State.faculty);
    } catch (e) {
        console.warn('Faculty fetch error:', e);
        DOM.facultyContainer.innerHTML =
            '<p style="text-align:center;color:var(--text-light);grid-column:1/-1;">Unable to load faculty list right now.</p>';
    }
}

function renderFaculty(data) {
    const container = DOM.facultyContainer;
    if (!data || data.length === 0) {
        container.innerHTML =
            '<p style="text-align:center;color:var(--text-light);grid-column:1/-1;">No faculty members yet.</p>';
        return;
    }
    let html = '';
    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        html += '<div class="faculty-card" style="animation: fadeUp 0.5s ' + (i * 50) + 'ms both cubic-bezier(0.16,1,0.3,1);">';
        html += '<div class="faculty-avatar">' + (d.emoji || '👨‍🏫') + '</div>';
        html += '<h4>' + Helpers.sanitize(d.name) + '</h4>';
        html += '<p>' + Helpers.sanitize(d.subject) + '</p>';
        html += '<span class="faculty-subject">' + (d.subject ? String(d.subject).split(' ').pop() : '') + '</span>';
        html += '</div>';
    }
    container.innerHTML = html;
}

// ============================================================
// DOCUMENTS
// ============================================================
const FILE_TYPES = {
    pdf: { cls: 'pdf', label: 'PDF' },
    doc: { cls: 'doc', label: 'DOC' }, docx: { cls: 'doc', label: 'DOC' },
    ppt: { cls: 'ppt', label: 'PPT' }, pptx: { cls: 'ppt', label: 'PPT' },
    txt: { cls: 'other', label: 'TXT' },
    zip: { cls: 'zip', label: 'ZIP' }, rar: { cls: 'zip', label: 'RAR' },
    png: { cls: 'img', label: 'IMG' }, jpg: { cls: 'img', label: 'IMG' },
    jpeg: { cls: 'img', label: 'IMG' }, webp: { cls: 'img', label: 'IMG' }
};

function getDocExtension(doc) {
    let ext = String(doc.file_type || '').toLowerCase().replace(/^\./, '').trim();
    if (!ext && doc.file_url) {
        const clean = String(doc.file_url).split('?')[0];
        const parts = clean.split('.');
        if (parts.length > 1) ext = parts.pop().toLowerCase();
    }
    return ext;
}

function getDocTypeInfo(ext) {
    const key = ext === 'docx' ? 'doc' : ext === 'pptx' ? 'ppt' : ext === 'xlsx' ? 'xls' : ext;
    const map = FILE_TYPES[ext] || FILE_TYPES[key];
    return map || { cls: 'other', label: (ext || 'FILE').toUpperCase().slice(0, 4) };
}

function getFilterBucket(ext) {
    if (ext === 'pdf') return 'pdf';
    if (ext === 'doc' || ext === 'docx') return 'doc';
    // PPT/PPTX and other office/data files are grouped under "Other".
    return 'other';
}

async function fetchDocuments() {
    try {
        const { data, error } = await window.db.from('documents').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        State.documents = data || [];
        renderDocuments(State.documents);
        updateDocTabBadge();
        if (RightPanel.current === 'documents' && DOM.rightPanelSubtitle) {
            const count = State.documents.length;
            DOM.rightPanelSubtitle.textContent = count
                ? count + ' file' + (count === 1 ? '' : 's') + ' available'
                : 'Notes • PDFs • Slides';
        }
    } catch (e) {
        console.warn('Documents fetch error:', e);
        State.documents = [];
        renderDocuments([]);
        updateDocTabBadge();
        DOM.documentsContainer.innerHTML =
            '<div class="doc-empty">' +
            '<span class="doc-empty-icon">⚠️</span>' +
            '<h4>Unable to load documents</h4>' +
            '<p>Please check your connection and try again.</p>' +
            '</div>';
    }
}

function renderDocuments(list) {
    const container = DOM.documentsContainer;
    const query = State.docSearchQuery.trim().toLowerCase();
    const filter = State.docFilter;

    const filtered = (list || []).filter(function (d) {
        const ext = getDocExtension(d);
        if (filter !== 'all' && getFilterBucket(ext) !== filter) return false;
        if (!query) return true;
        const hay = ((d.title || '') + ' ' + (d.subject || '') + ' ' + (d.description || '') + ' ' + ext).toLowerCase();
        return hay.indexOf(query) !== -1;
    });

    if (RightPanel.current === 'documents' && DOM.rightPanelSubtitle) {
        DOM.rightPanelSubtitle.textContent = filtered.length
            ? filtered.length + ' file' + (filtered.length === 1 ? '' : 's') + ' available'
            : 'Notes • PDFs • Slides';
    }

    if (!filtered.length) {
        const isFiltering = query || filter !== 'all';
        container.innerHTML =
            '<div class="doc-empty">' +
            '<span class="doc-empty-icon"><i class="' + (isFiltering ? 'ri-search-line' : 'ri-folder-open-line') + '" aria-hidden="true"></i></span>' +
            '<h4>' + (isFiltering ? 'No matching documents' : 'No documents yet') + '</h4>' +
            '<p>' + (isFiltering ? 'Try a different search or filter.' : 'Files uploaded by the school will appear here.') + '</p>' +
            '</div>';
        return;
    }

    let html = '';
    for (let i = 0; i < filtered.length; i++) {
        const d = filtered[i];
        const ext = getDocExtension(d);
        const info = getDocTypeInfo(ext);
        const title = d.title || (d.file_url ? decodeURIComponent(String(d.file_url).split('/').pop()) : 'Document');
        const size = Helpers.formatBytes(d.file_size);
        const date = d.created_at ? Helpers.formatDate(d.created_at) : (d.date ? Helpers.formatDate(d.date) : '');

        const key = docKey(d);
        const isDownloaded = Downloads.has(key);

        html += '<div class="doc-card' + (isDownloaded ? ' doc-downloaded' : '') +
            '" data-doc-index="' + i + '" data-doc-key="' + Helpers.sanitize(key) +
            '" style="animation-delay:' + Math.min(i * 50, 350) + 'ms">';
        html += '  <div class="doc-file-icon ' + info.cls + '" aria-hidden="true">' + info.label + '</div>';
        html += '  <div class="doc-info">';
        html += '    <h4 title="' + Helpers.sanitize(title) + '">' + Helpers.sanitize(title) + '</h4>';
        html += '    <div class="doc-meta">';
        if (size) { html += '<span>' + size + '</span><span class="dot"></span>'; }
        if (date) { html += '<span>' + date + '</span>'; }
        if (!size && !date) { html += '<span>Tap to open</span>'; }
        if (isDownloaded) {
            html += '<span class="downloaded-tag"><i class="ri-checkbox-circle-fill"></i> Saved</span>';
        }
        html += '    </div>';
        if (d.subject) html += '<span class="doc-subject-tag">' + Helpers.sanitize(d.subject) + '</span>';
        html += '  </div>';
        html += '  <div class="doc-actions">';
        html += '    <div class="doc-menu-wrap" data-doc-menu>';
        html += '      <button class="doc-menu-btn" type="button" aria-label="More options" aria-haspopup="true" aria-expanded="false"><i class="ri-more-2-fill"></i></button>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.doc-card').forEach(function (card) {
        const idx = parseInt(card.getAttribute('data-doc-index'), 10);
        const doc = filtered[idx];
        if (!doc) return;

        card.addEventListener('click', function (e) {
            if (e.target.closest('.doc-menu-wrap')) return;
            handleDocumentTap(doc);
        });

        const menuBtn = card.querySelector('.doc-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                openDocMenu(menuBtn, doc);
            });
        }
    });
}

/* ============================================================
   FLOATING DOCUMENT MENU
   ============================================================ */
let currentDocMenuEl = null;
let currentDocMenuCard = null;

function openDocMenu(btn, doc) {
    const wasOpen = btn.getAttribute('aria-expanded') === 'true';
    closeAllDocMenus();
    if (wasOpen) return;

    const menu = document.createElement('div');
    menu.className = 'doc-menu open';
    menu.setAttribute('role', 'menu');
    menu.innerHTML =
        '<button class="doc-menu-item" type="button" data-action="view" role="menuitem">' +
        '  <i class="ri-eye-line"></i> View' +
        '</button>' +
        '<button class="doc-menu-item" type="button" data-action="download" role="menuitem">' +
        '  <i class="ri-download-2-line"></i> Download' +
        '</button>';

    document.body.appendChild(menu);

    const btnRect = btn.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuW = menuRect.width || 165;
    const menuH = menuRect.height || 88;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = btnRect.right - menuW;
    if (left < margin) left = margin;
    if (left + menuW > vw - margin) left = vw - menuW - margin;

    let top = btnRect.bottom + 6;
    if (top + menuH > vh - margin) {
        top = btnRect.top - menuH - 6;
    }
    if (top < margin) top = margin;

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';

    const card = btn.closest('.doc-card');
    if (card) card.classList.add('menu-active');
    btn.setAttribute('aria-expanded', 'true');

    menu.querySelector('.doc-menu-item[data-action="view"]').addEventListener('click', function (e) {
        e.stopPropagation();
        closeAllDocMenus();
        viewDocument(doc);
    });
    menu.querySelector('.doc-menu-item[data-action="download"]').addEventListener('click', function (e) {
        e.stopPropagation();
        closeAllDocMenus();
        downloadDocument(doc).then(function (ok) {
            if (ok) {
                Downloads.add(docKey(doc));
                markCardAsDownloaded(docKey(doc));
            }
        });
    });

    currentDocMenuEl = menu;
    currentDocMenuCard = card;
}

function closeAllDocMenus() {
    document.querySelectorAll('.doc-menu').forEach(function (m) { m.remove(); });
    document.querySelectorAll('.doc-card.menu-active').forEach(function (c) {
        c.classList.remove('menu-active');
    });
    document.querySelectorAll('.doc-menu-btn[aria-expanded="true"]').forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
    });
    currentDocMenuEl = null;
    currentDocMenuCard = null;
}

if (DOM.documentsContainer) {
    DOM.documentsContainer.addEventListener('scroll', closeAllDocMenus, { passive: true });
}
window.addEventListener('resize', closeAllDocMenus, { passive: true });

/* ============================================================
   DOWNLOADS REGISTRY
   ============================================================ */
const Downloads = {
    _key: function () {
        const p = Profile.get();
        const id = (p && p.created) ? p.created : 'guest';
        return 'psbs_downloads_' + id;
    },
    get: function () {
        try {
            const raw = localStorage.getItem(this._key());
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    },
    has: function (id) { return this.get().indexOf(String(id)) !== -1; },
    add: function (id) {
        const sid = String(id);
        const list = this.get();
        if (list.indexOf(sid) !== -1) return;
        list.push(sid);
        try { localStorage.setItem(this._key(), JSON.stringify(list)); } catch (e) { }
    },
    clear: function () { try { localStorage.removeItem(this._key()); } catch (e) { } }
};

function docKey(doc) {
    return String(doc.id != null ? doc.id : (doc.file_url || ''));
}

function markCardAsDownloaded(key) {
    DOM.documentsContainer.querySelectorAll('.doc-card').forEach(function (card) {
        if (card.getAttribute('data-doc-key') !== key) return;
        card.classList.add('doc-downloaded');
        const meta = card.querySelector('.doc-meta');
        if (meta && !meta.querySelector('.downloaded-tag')) {
            const tag = document.createElement('span');
            tag.className = 'downloaded-tag';
            tag.innerHTML = '<i class="ri-checkbox-circle-fill"></i> Saved';
            meta.appendChild(tag);
        }
    });
}

function viewDocument(doc) {
    const url = Helpers.safeUrl(doc.file_url);
    if (!url) { Toast.error('File link is not available or is invalid.'); return; }
    const ext = getDocExtension(doc);
    const officeExts = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

    if (officeExts.indexOf(ext) !== -1) {
        const viewerUrl = 'https://docs.google.com/viewer?url=' + encodeURIComponent(url) + '&embedded=true';
        Toast.info('📄 Opening preview...');
        const win = window.open(viewerUrl, '_blank', 'noopener,noreferrer');
        if (!win) Toast.warning('Popup blocked. Please allow popups to preview files.');
    } else if (imageExts.indexOf(ext) !== -1) {
        window.open(url, '_blank', 'noopener');
    } else {
        Toast.info('📂 Opening file...');
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (!win) Toast.warning('Popup blocked. Please allow popups to view files.');
    }
}

function handleDocumentTap(doc) {
    viewDocument(doc);
}

async function downloadDocument(doc, opts) {
    opts = opts || {};
    const url = Helpers.safeUrl(doc.file_url);
    if (!url) { Toast.error('File link is not available or is invalid.'); return false; }

    const rawName = doc.title ||
        decodeURIComponent(String(url).split('/').pop().split('?')[0]) || 'document';
    const ext = getDocExtension(doc);
    const filename = /\.[a-z0-9]{2,5}$/i.test(rawName) ? rawName : (rawName + (ext ? '.' + ext : ''));

    if (!opts.silent) Toast.info('⏳ Preparing download...');

    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('Network response was not ok');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 15000);
        if (!opts.silent) Toast.success('📥 Downloaded: ' + filename);
        return true;
    } catch (err) {
        console.warn('Blob download failed, falling back to direct link:', err);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (!opts.silent) Toast.info('📂 Opening file for download...');
        return true;
    }
}

if (DOM.docSearchInput) {
    DOM.docSearchInput.addEventListener('input', Helpers.debounce(function () {
        State.docSearchQuery = this.value || '';
        renderDocuments(State.documents);
    }, 200));
    DOM.docSearchInput.addEventListener('focus', function () {
        setTimeout(function () { DOM.docSearchInput.select(); }, 50);
    });
}

function scrollToolbarChipIntoView(btn) {
    const scroller = DOM.docToolbarScroll;
    if (!scroller || !btn) return;
    const target = btn.offsetLeft - (scroller.clientWidth - btn.offsetWidth) / 2;
    const max = scroller.scrollWidth - scroller.clientWidth;
    const left = Math.max(0, Math.min(target, max));
    try {
        scroller.scrollTo({ left: left, behavior: 'smooth' });
    } catch (e) {
        scroller.scrollLeft = left;
    }
}

if (DOM.docFilters) {
    DOM.docFilters.addEventListener('click', function (e) {
        const btn = e.target.closest('.doc-filter');
        if (!btn) return;
        DOM.docFilters.querySelectorAll('.doc-filter').forEach(function (b) {
            b.classList.remove('active');
        });
        btn.classList.add('active');
        State.docFilter = btn.getAttribute('data-filter') || 'all';
        renderDocuments(State.documents);
        scrollToolbarChipIntoView(btn);
        lockPanelViewport();
    });
}

// ===== REALTIME =====
let realtimeStarted = false;
function setupRealtime() {
    if (realtimeStarted) return;
    realtimeStarted = true;
    window.db.channel('notices_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, function () { fetchNotices(); })
        .subscribe();
    window.db.channel('faculty_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty' }, function () { fetchFaculty(); })
        .subscribe();
    window.db.channel('documents_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, function () { fetchDocuments(); })
        .subscribe();
    window.db.channel('school_info_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'school_info' }, function () { fetchSchoolInfo(); })
        .subscribe();
}

// ===== PROFILE =====
const Profile = {
    get: function () {
        if (State.profile) return State.profile;
        try {
            const data = localStorage.getItem(CONFIG.PROFILE_KEY);
            State.profile = data ? JSON.parse(data) : null;
            return State.profile;
        } catch (e) { return null; }
    },
    save: function (name, avatar, role) {
        const existing = this.get() || {};
        State.profile = {
            name: name || 'Guest',
            role: role || existing.role || 'Viewer',
            avatar: avatar !== undefined ? avatar : (existing.avatar || null),
            created: existing.created || Date.now(),
            lastLogin: Date.now(),
            visits: existing.visits || 1
        };
        try {
            localStorage.setItem(CONFIG.PROFILE_KEY, JSON.stringify(State.profile));
        } catch (e) {
            console.warn('Could not save profile (storage full?):', e);
            Toast.warning('Storage is full — profile photo not saved.');
        }
        this.updateUI();
        return State.profile;
    },
    updateAvatar: function (avatar) {
        const p = this.get() || { name: 'Guest', role: 'Viewer' };
        p.avatar = avatar;
        this.save(p.name, avatar, p.role);
    },
    updateName: function (name) {
        const p = this.get() || { role: 'Viewer' };
        p.name = name;
        this.save(name, p.avatar, p.role);
    },
    clear: function () {
        localStorage.removeItem(CONFIG.PROFILE_KEY);
        State.profile = null;
        this.updateUI();
    },
    updateUI: function () {
        const p = this.get();
        const profileBtn = DOM.profileBtn;
        const ddName = DOM.ddName, ddRole = DOM.ddRole, ddAvatar = DOM.ddAvatar;
        if (p && p.name) {
            profileBtn.innerHTML = '';
            profileBtn.style.backgroundImage = '';
            profileBtn.style.backgroundColor = '';
            if (p.avatar) {
                profileBtn.style.backgroundImage = 'url(' + p.avatar + ')';
                profileBtn.style.backgroundSize = 'cover';
                profileBtn.style.backgroundPosition = 'center';
            } else {
                profileBtn.textContent = Helpers.initials(p.name);
                profileBtn.style.backgroundColor = Helpers.colorFromName(p.name);
            }
            ddName.textContent = Helpers.sanitize(p.name);
            ddRole.textContent = p.role || 'Viewer';
            if (p.avatar) {
                ddAvatar.style.backgroundImage = 'url(' + p.avatar + ')';
                ddAvatar.style.backgroundSize = 'cover';
                ddAvatar.style.backgroundPosition = 'center';
                ddAvatar.textContent = '';
            } else {
                ddAvatar.textContent = Helpers.initials(p.name);
                ddAvatar.style.backgroundColor = Helpers.colorFromName(p.name);
                ddAvatar.style.backgroundImage = '';
            }
        } else {
            profileBtn.innerHTML = '<i class="ri-user-3-line" aria-hidden="true"></i>';
            profileBtn.style.backgroundImage = '';
            profileBtn.style.backgroundColor = '';
            ddName.textContent = 'Guest';
            ddRole.textContent = 'Viewer';
            ddAvatar.textContent = 'G';
            ddAvatar.style.backgroundColor = '#f39c12';
            ddAvatar.style.backgroundImage = '';
        }
        profileBtn.setAttribute('aria-expanded',
            String(DOM.profileDropdown.classList.contains('active')));
    }
};

// ===== VALIDATORS =====
const Validators = {
    name: function (value) {
        const trimmed = value.trim();
        if (!trimmed) return 'Name is required';
        if (trimmed.length < 2) return 'Name must be at least 2 characters';
        if (trimmed.length > CONFIG.MAX_NAME_LENGTH) return 'Name is too long (max 50)';
        if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) return 'Name contains invalid characters';
        return null;
    },
    email: function (value) {
        const trimmed = value.trim();
        if (!trimmed) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Please enter a valid email address';
        return null;
    },
    message: function (value) {
        const trimmed = value.trim();
        if (!trimmed) return 'Message is required';
        if (trimmed.length < 10) return 'Message must be at least 10 characters';
        if (trimmed.length > 1000) return 'Message is too long (max 1000)';
        return null;
    }
};

// ===== NAME MODAL =====
function openNameModal() {
    DOM.nameModal.classList.add('active');
    State.isNameModalOpen = true;
    State.panelOpen = true;
    State.openCount++;
    document.body.classList.add('modal-active');
    DOM.nameError.textContent = '';
    setTimeout(function () { DOM.userNameInput.focus(); }, 400);
}

function closeNameModal() {
    DOM.nameModal.classList.remove('active');
    State.isNameModalOpen = false;
    State.panelOpen = false;
    document.body.classList.remove('modal-active');
    if (State.openCount > 0) State.openCount--;
}

DOM.nameForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = DOM.userNameInput.value.trim();
    const err = Validators.name(name);
    if (err) {
        DOM.nameError.textContent = err;
        DOM.userNameInput.setAttribute('aria-invalid', 'true');
        return;
    }
    DOM.userNameInput.setAttribute('aria-invalid', 'false');
    Profile.save(name);
    closeNameModal();
    setTimeout(function () { showWelcomeCard(name); }, 300);
});

DOM.userNameInput.addEventListener('input', function () {
    DOM.nameError.textContent = '';
    DOM.userNameInput.setAttribute('aria-invalid', 'false');
});

// ===== WELCOME CARD =====
function showWelcomeCard(name) {
    const greeting = Helpers.getGreeting();
    DOM.welcomeTitle.textContent = greeting + ', ' + Helpers.sanitize(name) + '! 👋';
    DOM.welcomeAvatar.textContent = Helpers.initials(name);
    DOM.welcomeAvatar.style.backgroundColor = Helpers.colorFromName(name);
    const messages = [
        "We're thrilled to have you at " + SchoolInfo.acr() + " Portal! 🎉",
        "Your journey to excellence starts here! 🌟",
        "Together we learn, grow, and achieve! 📚",
        "Welcome to the " + SchoolInfo.acr() + " family! 💙",
        "Great things await you at " + SchoolInfo.acr() + "! 🏆",
        "🌸 Radhe Radhe! May you shine bright! 💝",
        "Every day is a new opportunity to learn! 🌈",
        "You are now part of something extraordinary! ✨",
        "The future belongs to those who prepare today. 💪",
        "Stay curious, stay inspired! 🔥"
    ];
    DOM.welcomeMessage.textContent = messages[Math.floor(Math.random() * messages.length)];
    DOM.welcomeCard.classList.add('active');
    State.isWelcomeOpen = true;
    State.panelOpen = true;
    State.openCount++;
    document.body.classList.add('welcome-active');
    setTimeout(function () { if (State.isWelcomeOpen) closeWelcomeCard(); }, 6000);
}

function closeWelcomeCard() {
    DOM.welcomeCard.classList.remove('active');
    State.isWelcomeOpen = false;
    State.panelOpen = false;
    document.body.classList.remove('welcome-active');
    if (State.openCount > 0) State.openCount--;
}
DOM.welcomeCloseBtn.addEventListener('click', closeWelcomeCard);

// ===== EDIT NAME MODAL =====
function openEditNameModal() {
    const p = Profile.get();
    DOM.editNameInput.value = p ? p.name || '' : '';
    DOM.editNameError.textContent = '';
    DOM.editNameModal.classList.add('active');
    State.isEditModalOpen = true;
    State.panelOpen = true;
    State.openCount++;
    document.body.classList.add('modal-active');
    setTimeout(function () { DOM.editNameInput.focus(); }, 300);
}

function closeEditNameModal() {
    DOM.editNameModal.classList.remove('active');
    State.isEditModalOpen = false;
    State.panelOpen = false;
    document.body.classList.remove('modal-active');
    if (State.openCount > 0) State.openCount--;
}

DOM.editNameForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = DOM.editNameInput.value.trim();
    const err = Validators.name(name);
    if (err) {
        DOM.editNameError.textContent = err;
        DOM.editNameInput.setAttribute('aria-invalid', 'true');
        return;
    }
    DOM.editNameInput.setAttribute('aria-invalid', 'false');
    const saveBtn = DOM.editNameSaveBtn;
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="ri-loader-4-line" aria-hidden="true"></i> Saving...';
    saveBtn.disabled = true;
    setTimeout(function () {
        Profile.updateName(name);
        closeEditNameModal();
        Toast.success('Name updated successfully! 🎉');
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }, 450);
});
DOM.editNameCloseBtn.addEventListener('click', closeEditNameModal);
DOM.editNameCancelBtn.addEventListener('click', closeEditNameModal);
DOM.editNameModal.addEventListener('click', function (e) {
    if (e.target === DOM.editNameModal) closeEditNameModal();
});

DOM.ddEditNameIcon.addEventListener('click', function (e) {
    e.stopPropagation();
    closeProfileDropdown();
    openEditNameModal();
});

// ===== DOCUMENTS TOOLBAR: same delayed hide/show as the header =====
(function () {
    const body = document.getElementById('documentsContainer');
    const bar = DOM.docToolbar;
    if (!body || !bar) return;
    let timer = null, last = 0;
    body.addEventListener('scroll', function () {
        const current = Math.max(0, body.scrollTop);
        clearTimeout(timer);
        timer = setTimeout(function () {
            const focused = DOM.docSearchInput && document.activeElement === DOM.docSearchInput;
            if (current <= 80 || focused) bar.classList.remove('is-hidden');
            else if (current > last + 10) bar.classList.add('is-hidden');
            else if (current < last - 10) bar.classList.remove('is-hidden');
            last = current;
        }, 120);
    }, { passive: true });
})();

// ===== SEARCH =====
function openSearch() {
    // Prevent double open animation glitch
    if (State.isSearchOpen) return;
    // Ensure closing state is cleared before starting open
    window.clearTimeout(DOM.searchOverlay._closeAnimationTimer);
    DOM.searchOverlay.classList.remove('is-closing');
    // Force reflow for crisp restart of transition
    void DOM.searchOverlay.offsetWidth;
    DOM.searchOverlay.classList.add('active');
    State.isSearchOpen = true;
    State.panelOpen = true;
    State.openCount++;
    document.body.classList.add('modal-active', 'search-open');
    DOM.searchOverlay.querySelector('.search-box').classList.remove('has-query');
    // Reset content + focus AFTER the first frames of the animation so the
    // main thread (and the mobile keyboard resize) never competes with it.
    var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    window.clearTimeout(DOM.searchOverlay._focusTimer);
    DOM.searchOverlay._focusTimer = window.setTimeout(function () {
        if (!State.isSearchOpen) return;
        try { DOM.searchInput.focus({ preventScroll: true }); } catch (e) { DOM.searchInput.focus(); }
        if (window.__psbsSearchSuggest) try { window.__psbsSearchSuggest(); } catch (e) {}
    }, isTouch ? 360 : 90);
    DOM.searchResults.innerHTML = '<div class="search-empty"><i class="ri-search-2-line" aria-hidden="true"></i> Type to start searching...</div>';
}

                function closeSearch() {
    var overlay = DOM.searchOverlay;
    if (!overlay.classList.contains('active') && !overlay.classList.contains('is-closing')) return;
    window.clearTimeout(overlay._focusTimer);
    try { DOM.searchInput.blur(); } catch (e) {}
    // Add closing class first - this triggers the close animation
    overlay.classList.add('is-closing');
    // Force reflow so the browser starts transition from active (1) to is-closing (0)
    void overlay.offsetWidth;
    overlay.classList.remove('active');
    State.isSearchOpen = false;
    State.panelOpen = false;
    var sb = overlay.querySelector('.search-box');
    if (sb) {
        void sb.offsetWidth;
        sb.classList.remove('has-query');
    }
    if (State.openCount > 0) State.openCount--;
    window.clearTimeout(overlay._closeAnimationTimer);
    overlay._closeAnimationTimer = window.setTimeout(function () {
        overlay.classList.remove('is-closing');
        document.body.classList.remove('modal-active', 'search-open');
        if (DOM.searchInput) DOM.searchInput.value = '';
        if (DOM.searchResults) DOM.searchResults.innerHTML = '<div class="search-empty"><i class="ri-search-2-line" aria-hidden="true"></i> Type to start searching...</div>';
    }, 340);
}

DOM.searchOverlay.addEventListener('click', function (e) {
    if (e.target === DOM.searchOverlay) closeSearch();
});

function performSearch(query) {
    const data = Helpers.getSearchData();
    const q = query.toLowerCase().trim();
    const container = DOM.searchResults;
    DOM.searchOverlay.querySelector('.search-box').classList.toggle('has-query', !!q);
    if (!q) {
        container.innerHTML = '<div class="search-empty"><i class="ri-search-2-line" aria-hidden="true"></i> Type to start searching...</div>';
        return;
    }
    const results = data.filter(function (item) {
        return item.title.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q);
    });
    if (results.length === 0) {
        container.innerHTML = '<div class="search-empty"><i class="ri-emotion-unhappy-line" aria-hidden="true"></i> No results found for "' + Helpers.sanitize(q) + '"</div>';
        return;
    }
    let html = '';
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        html += '<div class="search-result-item" data-id="' + r.id + '" style="animation: fadeUp 0.35s ' + (i * 40) + 'ms both cubic-bezier(0.16,1,0.3,1);">';
        html += '<span class="sri-icon">' + (/^ri-/.test(r.icon) ? '<i class="' + r.icon + '" aria-hidden="true"></i>' : r.icon) + '</span>';
        html += '<div class="sri-text"><h4>' + Helpers.sanitize(r.title) + '</h4><p>' + Helpers.sanitize(r.desc) + '</p></div>';
        html += '</div>';
    }
    container.innerHTML = html;
    container.querySelectorAll('.search-result-item').forEach(function (el) {
        el.addEventListener('click', function () {
            const id = el.getAttribute('data-id');
            const target = document.getElementById(id);
            if (target) {
                closeSearch();
                target.scrollIntoView({ behavior: 'smooth' });
                setTimeout(function () { target.classList.add('visible'); }, 100);
            }
        });
    });
}
DOM.searchInput.addEventListener('input', function () { performSearch(this.value); });
if (DOM.searchClearBtn) {
    /* The X closes the entire search card/overlay. Capture the interaction
       before any overlay/document handler can interfere with it. */
    var closeSearchFromButton = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (!State.isSearchOpen) return;
        closeSearch();
    };
    DOM.searchClearBtn.addEventListener('pointerdown', closeSearchFromButton, true);
    DOM.searchClearBtn.addEventListener('touchstart', closeSearchFromButton, { capture: true, passive: false });
    DOM.searchClearBtn.addEventListener('click', closeSearchFromButton, true);
}

// ===== SIDEBAR =====
function openSidebar() {
    if (State.panelOpen && !State.isSidebarOpen) return;
    closeAllPanels(['sidebar']);
    DOM.sidebar.classList.add('active');
    DOM.sidebarOverlay.classList.add('active');
    DOM.menuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    State.isSidebarOpen = true;
    State.panelOpen = true;
    State.openCount++;
    document.body.classList.add('sidebar-active');
}

function closeSidebar() {
    DOM.sidebar.classList.remove('active');
    if (!DOM.rightPanel.classList.contains('active')) {
        DOM.sidebarOverlay.classList.remove('active');
        if (!State.isDropdownOpen && !State.isEditModalOpen && !State.isSearchOpen &&
            !State.isThemePresetsOpen &&
            !State.isNameModalOpen && !State.isWelcomeOpen) {
            document.body.style.overflow = '';
        }
    }
    DOM.menuBtn.setAttribute('aria-expanded', 'false');
    State.isSidebarOpen = false;
    State.panelOpen = false;
    document.body.classList.remove('sidebar-active');
    if (State.openCount > 0) State.openCount--;
}

DOM.menuBtn.addEventListener('click', function () {
    State.isSidebarOpen ? closeSidebar() : openSidebar();
});
DOM.sidebarClose.addEventListener('click', closeSidebar);
DOM.sidebarOverlay.addEventListener('click', closeAllPanels);

document.querySelectorAll('.sidebar-links a[data-section]').forEach(function (link) {
    link.addEventListener('click', function () { setTimeout(closeSidebar, 80); });
});
document.querySelectorAll('.sidebar .social-link, .sidebar .action-pill-btn').forEach(function (link) {
    link.addEventListener('click', function () { setTimeout(closeSidebar, 100); });
});

// ===== PROFILE DROPDOWN =====
function toggleProfileDropdown(e) {
    e.stopPropagation();
    if (State.panelOpen && !State.isDropdownOpen) return;
    const isOpen = DOM.profileDropdown.classList.contains('active');
    if (!isOpen) {
        closeAllPanels(['dropdown']);
        DOM.profileDropdown.classList.add('active');
        DOM.profileBtn.setAttribute('aria-expanded', 'true');
        State.isDropdownOpen = true;
        State.panelOpen = true;
        State.openCount++;
        document.body.classList.add('dropdown-active');
    } else { closeProfileDropdown(); }
}

function closeProfileDropdown() {
    DOM.profileDropdown.classList.remove('active');
    DOM.profileBtn.setAttribute('aria-expanded', 'false');
    State.isDropdownOpen = false;
    State.panelOpen = false;
    document.body.classList.remove('dropdown-active');
    if (!State.isSidebarOpen && !State.isNoticeOpen && !State.isDocumentsOpen &&
        !State.isEditModalOpen && !State.isNameModalOpen && !State.isWelcomeOpen &&
        !State.isSearchOpen && !State.isThemePresetsOpen) {
        document.body.style.overflow = '';
    }
    if (State.openCount > 0) State.openCount--;
}

DOM.profileBtn.addEventListener('click', toggleProfileDropdown);
// First outside interaction closes the dropdown; scrolling is allowed on the next gesture.
var headerProfileOutsideTap = false;
var headerProfileTouchPending = false;
var headerProfileBlockTouchGesture = false;
document.addEventListener('pointerdown', function (e) {
    if (!State.isDropdownOpen) return;
    if (e.pointerType === 'touch') { headerProfileTouchPending = !DOM.profileDropdown.contains(e.target); return; }
    if (DOM.profileDropdown.contains(e.target) || DOM.profileBtn.contains(e.target)) return;
    headerProfileOutsideTap = true;
    setTimeout(function () { headerProfileOutsideTap = false; }, 700);
    e.preventDefault();
    closeProfileDropdown();
}, true);
document.addEventListener('touchmove', function (e) {
    if (!headerProfileTouchPending || !State.isDropdownOpen) return;
    headerProfileTouchPending = false;
    closeProfileDropdown();   // close first, and let the same swipe keep scrolling the page
}, { capture: true, passive: true });
document.addEventListener('touchend', function (e) {
    if (headerProfileTouchPending && State.isDropdownOpen) {
        // a plain tap outside: close it and swallow the click so nothing behind reacts
        headerProfileOutsideTap = true;
        setTimeout(function () { headerProfileOutsideTap = false; }, 700);
        if (e.cancelable) e.preventDefault();
        closeProfileDropdown();
    }
    headerProfileTouchPending = false;
    headerProfileBlockTouchGesture = false;
}, { capture: true, passive: false });
document.addEventListener('click', function (e) {
    if (headerProfileOutsideTap) {
        headerProfileOutsideTap = false;
        e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (DOM.profileDropdown && !DOM.profileDropdown.contains(e.target) && !DOM.profileBtn.contains(e.target)) {
        if (State.isDropdownOpen) { e.preventDefault(); closeProfileDropdown(); }
    }
    if (!e.target.closest('.doc-menu') && !e.target.closest('.doc-menu-btn')) closeAllDocMenus();
}, true);
document.addEventListener('wheel', function (e) {
    if (State.isDropdownOpen && !DOM.profileDropdown.contains(e.target)) closeProfileDropdown();
}, { capture: true, passive: true });
window.addEventListener('scroll', function () {
    if (State.isDropdownOpen) closeProfileDropdown();
}, { passive: true });

// ===== PROFILE ACTIONS =====
DOM.ddAvatarWrap.addEventListener('click', function (e) {
    e.stopPropagation();
    DOM.avatarUploader.click();
});

DOM.avatarUploader.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
        Toast.error('Image must be less than 15MB');
        DOM.avatarUploader.value = '';
        return;
    }
    if (!file.type.startsWith('image/')) {
        Toast.error('Please select an image file');
        DOM.avatarUploader.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function (ev) {
        const img = new Image();
        img.onload = function () {
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            const min = Math.min(img.width, img.height);
            ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
            let out;
            try { out = canvas.toDataURL('image/jpeg', 0.82); }
            catch (err) { out = ev.target.result; }
            Profile.updateAvatar(out);
            Toast.success('Profile photo updated! 📸');
            DOM.avatarUploader.value = '';
            closeProfileDropdown();
        };
        img.onerror = function () {
            Profile.updateAvatar(ev.target.result);
            Toast.success('Profile photo updated! 📸');
            DOM.avatarUploader.value = '';
            closeProfileDropdown();
        };
        img.src = ev.target.result;
    };
    reader.onerror = function () {
        Toast.error('Failed to load image');
        DOM.avatarUploader.value = '';
    };
    reader.readAsDataURL(file);
});

DOM.ddLogoutBtn.addEventListener('click', function () {
    Profile.clear();
    Toast.info('Logged out successfully');
    closeProfileDropdown();
    setTimeout(openNameModal, 500);
});
DOM.ddAdminLogin.addEventListener('click', function (e) {
    // Native link: the browser itself opens the page, so nothing else can swallow the tap.
    try { closeProfileDropdown(); } catch (err) { /* never let the menu stop the navigation */ }
    // A stored token is only a convenience; admin-dashboard.html validates it with Supabase.
    let adminToken = null;
    try { adminToken = localStorage.getItem('psbs_admin_session_token') || sessionStorage.getItem('psbs_admin_session_token'); } catch (err) { }
    DOM.ddAdminLogin.setAttribute('href', adminToken ? 'admin-dashboard.html' : CONFIG.LOGIN_ADMIN);
});
(function () {
    var qcAdmin = document.getElementById('qcAdminCard');
    if (!qcAdmin) return;
    qcAdmin.addEventListener('click', function (e) {
        e.preventDefault();
        var adminToken = localStorage.getItem('psbs_admin_session_token') || sessionStorage.getItem('psbs_admin_session_token');
        window.location.href = adminToken ? 'admin-dashboard.html' : CONFIG.LOGIN_ADMIN;
    });
})();
DOM.ddCalendarBtn.addEventListener('click', function (e) {
    e.preventDefault();
    closeProfileDropdown();
    window.location.href = CONFIG.CALENDAR_PAGE;
});

// ===== PROFILE DROPDOWN ACTIONS =====
DOM.ddShareBtn.addEventListener('click', function () {
    Helpers.sharePage();
    closeProfileDropdown();
});

// ===== THEME CONTROLS =====
DOM.headerThemePresetsBtn.addEventListener('click', openThemePresets);
DOM.headerThemeToggleBtn.addEventListener('click', function () {
    const isDark = Helpers.toggleDark();
    Toast.info(isDark ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
});

// ===== THEME PRESETS =====
const themePresets = [
    { id: 'gold', label: 'Gold', color: '#f39c12' },
    { id: 'cyan', label: 'Cyan', color: '#06b6d4' },
    { id: 'coral', label: 'Coral', color: '#e85d75' },
    { id: 'indigo', label: 'Indigo', color: '#4f46e5' },
    { id: 'red', label: 'Red', color: '#e74c3c' },
    { id: 'rose', label: 'Rose', color: '#e11d48' },
    { id: 'teal', label: 'Teal', color: '#27ae9e' },
    { id: 'yellow', label: 'Yellow', color: '#f1c40f' },
];

let selectedThemePreset = Helpers.getThemePreset();

function renderThemePresets() {
    const grid = DOM.themePresetsGrid;
    let html = '';
    for (let i = 0; i < themePresets.length; i++) {
        const t = themePresets[i];
        const active = t.id === selectedThemePreset ? 'active-theme' : '';
        html += '<div class="theme-option ' + active + '" data-theme-id="' + t.id + '" style="animation: fadeUp 0.4s ' + (i * 35) + 'ms both cubic-bezier(0.16,1,0.3,1);">';
        html += '<div class="theme-swatch" style="background:' + t.color + ';"></div>';
        html += '<div class="theme-name">' + t.label + '</div>';
        html += '<div class="theme-check"><i class="ri-check-line"></i></div>';
        html += '</div>';
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.theme-option').forEach(function (el) {
        el.addEventListener('click', function () {
            grid.querySelectorAll('.theme-option').forEach(function (c) {
                c.classList.remove('active-theme');
            });
            el.classList.add('active-theme');
            selectedThemePreset = el.getAttribute('data-theme-id');
        });
    });
}

function openThemePresets() {
    if (State.panelOpen && !State.isThemePresetsOpen) return;
    closeAllPanels(['themePresets']);
    renderThemePresets();
    DOM.themePresetsModal.classList.add('active');
    State.isThemePresetsOpen = true;
    State.panelOpen = true;
    State.openCount++;
    document.body.classList.add('modal-active');
}

function closeThemePresets() {
    DOM.themePresetsModal.classList.remove('active');
    State.isThemePresetsOpen = false;
    State.panelOpen = false;
    document.body.classList.remove('modal-active');
    if (State.openCount > 0) State.openCount--;
}

DOM.themePresetsCloseBtn.addEventListener('click', closeThemePresets);
DOM.themePresetsModal.addEventListener('click', function (e) {
    if (e.target === DOM.themePresetsModal) closeThemePresets();
});

DOM.themePresetsApplyBtn.addEventListener('click', function () {
    if (!selectedThemePreset) { Toast.warning('Please select a theme first.'); return; }
    Helpers.setThemePreset(selectedThemePreset);
    const found = themePresets.find(function (p) { return p.id === selectedThemePreset; });
    Toast.success('🎨 Theme applied: ' + (found ? found.label : selectedThemePreset));
    closeThemePresets();
});

// ===== CONTACT FORM VALIDATION =====
function validateContactField(input, validator) {
    const error = validator(input.value);
    const errorEl = input.closest('.input-group').querySelector('.input-error');
    if (error) {
        input.setAttribute('aria-invalid', 'true');
        if (errorEl) errorEl.textContent = error;
        return false;
    }
    input.setAttribute('aria-invalid', 'false');
    if (errorEl) errorEl.textContent = '';
    return true;
}

DOM.contactName.addEventListener('blur', function () { validateContactField(DOM.contactName, Validators.name); });
DOM.contactEmail.addEventListener('blur', function () { validateContactField(DOM.contactEmail, Validators.email); });
DOM.contactMessage.addEventListener('blur', function () { validateContactField(DOM.contactMessage, Validators.message); });
DOM.contactName.addEventListener('input', function () { validateContactField(DOM.contactName, Validators.name); });
DOM.contactEmail.addEventListener('input', function () { validateContactField(DOM.contactEmail, Validators.email); });
DOM.contactMessage.addEventListener('input', function () { validateContactField(DOM.contactMessage, Validators.message); });

DOM.contactForm.addEventListener('submit', function (e) {
    const okName = validateContactField(DOM.contactName, Validators.name);
    const okEmail = validateContactField(DOM.contactEmail, Validators.email);
    const okMessage = validateContactField(DOM.contactMessage, Validators.message);
    if (!okName || !okEmail || !okMessage) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const firstBad = DOM.contactForm.querySelector('[aria-invalid="true"]');
        if (firstBad) firstBad.focus();
        Toast.error('Please fix the highlighted fields before sending.');
    }
}, true);

// ===== HEADER SCROLL =====
let headerScrollTimer = null;
let headerLastScrollTop = 0;

const handleHeaderScroll = function () {
    const current = window.pageYOffset || document.documentElement.scrollTop;
    clearTimeout(headerScrollTimer);
    if (DOM.fabTop) {
        DOM.fabTop.classList.toggle('show', current > 400);
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        DOM.fabTop.style.setProperty('--scroll-pct', Math.min(100, Math.round((current / maxScroll) * 100)));
    }

    headerScrollTimer = setTimeout(function () {
        if (current <= 0) {
            DOM.header.classList.remove('header-hidden');
        } else if (current > 80) {
            if (current > headerLastScrollTop + 10) DOM.header.classList.add('header-hidden');
            else if (current < headerLastScrollTop - 10) DOM.header.classList.remove('header-hidden');
        } else {
            DOM.header.classList.remove('header-hidden');
        }
        headerLastScrollTop = current;
    }, 120);
};

window.addEventListener('scroll', handleHeaderScroll, { passive: true });

// ===== CLOSE ALL PANELS =====
function closeAllPanels(exclude) {
    exclude = Array.isArray(exclude) ? exclude : [];
    if (exclude.indexOf('dropdown') === -1) closeProfileDropdown();
    if (exclude.indexOf('sidebar') === -1) closeSidebar();
    if (exclude.indexOf('rightpanel') === -1) RightPanel.close();
    if (exclude.indexOf('edit') === -1) closeEditNameModal();
    if (exclude.indexOf('search') === -1) closeSearch();
    if (exclude.indexOf('themePresets') === -1) closeThemePresets();
    closeAllDocMenus();

    if (!DOM.sidebar.classList.contains('active') &&
        !DOM.rightPanel.classList.contains('active')) {
        DOM.sidebarOverlay.classList.remove('active');
    }

    if (!State.isSidebarOpen && !State.isNoticeOpen &&
        !State.isDocumentsOpen && !State.isDropdownOpen && !State.isEditModalOpen &&
        !State.isNameModalOpen && !State.isWelcomeOpen && !State.isSearchOpen &&
        !State.isThemePresetsOpen) {
        document.body.style.overflow = '';
        document.body.classList.remove('modal-active', 'sidebar-active', 'right-panel-active',
            'dropdown-active', 'welcome-active');
    }
}

// ===== BACK BUTTON =====
// Every open overlay owns one history entry (pushed right after the user's tap, so Android Chrome honours it).
// Back closes the top-most overlay; closing with ✕ / outside tap quietly removes that entry again.
(function () {
    var depth = 0, ignore = false, timer = 0, ignoreTimer = 0;
    function fabEl() { return document.querySelector('.doc-search-fab'); }
    var layers = [
        { open: function () { return !!(window.__sbPm && window.__sbPm.isOpen()); }, close: function () { window.__sbPm.close(); } },
        { open: function () { return State.isThemePresetsOpen; }, close: function () { closeThemePresets(); } },
        { open: function () { return State.isSearchOpen; }, close: function () { closeSearch(); } },
        { open: function () { var f = fabEl(); return !!(f && f.classList.contains('expanded')); },
          close: function () { var f = fabEl(); if (f) f.classList.remove('expanded'); if (DOM.docSearchInput) DOM.docSearchInput.blur(); } },
        { open: function () { return State.isWelcomeOpen; }, close: function () { closeWelcomeCard(); } },
        { open: function () { return State.isEditModalOpen; }, close: function () { closeEditNameModal(); } },
        { open: function () { return State.isNameModalOpen; }, close: function () { closeNameModal(); } },
        { open: function () { return RightPanel._isOpen; }, close: function () { RightPanel.close(); } },
        { open: function () { return State.isSidebarOpen; }, close: function () { closeSidebar(); } },
        { open: function () { return State.isDropdownOpen; }, close: function () { closeProfileDropdown(); } }
    ];
    function openNow() {
        var n = 0;
        for (var i = 0; i < layers.length; i++) { try { if (layers[i].open()) n++; } catch (e) {} }
        return n;
    }
    function sync() {
        var n = openNow();
        if (n > depth) {
            while (depth < n) { depth++; history.pushState({ psbsLayer: depth }, ''); }
        } else if (n < depth) {
            var d = depth - n;
            depth = n;
            ignore = true;
            clearTimeout(ignoreTimer);
            ignoreTimer = setTimeout(function () { ignore = false; }, 600);
            history.go(-d);
        }
    }
    function schedule() { clearTimeout(timer); var so = document.getElementById('searchOverlay'); timer = setTimeout(sync, so && (so.classList.contains('active') || so.classList.contains('is-closing')) ? 420 : 0); }
    window.addEventListener('popstate', function () {
        if (ignore) { ignore = false; clearTimeout(ignoreTimer); return; }
        if (depth > 0) depth--;
        for (var i = 0; i < layers.length; i++) {
            try { if (layers[i].open()) { layers[i].close(); break; } } catch (e) {}
        }
        schedule();
    });
    new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    ['pointerup', 'touchend', 'click', 'keyup'].forEach(function (ev) {
        document.addEventListener(ev, function () { setTimeout(sync, 80); setTimeout(sync, 380); }, true);
    });
})();

// ============================================================
// OUTER SWIPE GESTURES
// ============================================================
const Gestures = {
    init: function () {
        document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
        document.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: true });
    },
    _computeEdgeHint: function () {
        return; /* edge hints are hidden; skip the needless style work on every touch */
        if (!DOM.edgeHintRight || !DOM.edgeHintLeft) return;
        const rightOpen = DOM.rightPanel.classList.contains('active');
        const sidebarOpen = DOM.sidebar.classList.contains('active');
        DOM.edgeHintRight.classList.toggle('show', !rightOpen);
        DOM.edgeHintLeft.classList.toggle('show', !sidebarOpen && !rightOpen);
    },
    onTouchStart: function (e) {
        this._computeEdgeHint();
        if (State.isSearchOpen) return;
        const touch = e.touches[0];
        State.touchStartX = touch.clientX;
        State.touchStartY = touch.clientY;
        State.touchCurrentX = State.touchStartX;
        State.touchCurrentY = State.touchStartY;
        State.isDragging = false;
        State.isDraggingSidebar = false;
        State.isDraggingRightPanel = false;
        State.verticalSwipeLock = false;
        State.touchStartT = Date.now();
        State.noSwipe = !!(e.target.closest && e.target.closest('input,textarea,select,iframe,.doc-toolbar-scroll,[data-no-swipe]'));
        var inPanel = !!(DOM.rightPanel && DOM.rightPanel.contains(e.target) && DOM.rightPanel.classList.contains('active'));
        if (!State.noSwipe && !inPanel) {
            for (var n = e.target; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
                if (n.scrollWidth > n.clientWidth + 4) {
                    var ox = getComputedStyle(n).overflowX;
                    if (ox === 'auto' || ox === 'scroll') { State.noSwipe = true; break; }
                }
            }
        }
        State.touchInsideRightPanel = !!(DOM.rightPanel && DOM.rightPanel.contains(e.target) &&
            DOM.rightPanel.classList.contains('active'));
    },
    onTouchMove: function (e) {
        if (State.isSearchOpen) return;
        if (State.touchInsideRightPanel) return;

        const touch = e.touches[0];
        State.touchCurrentX = touch.clientX;
        State.touchCurrentY = touch.clientY;
        const deltaX = State.touchCurrentX - State.touchStartX;
        const deltaY = State.touchCurrentY - State.touchStartY;
        if (!State.isDragging && Math.abs(deltaY) > Math.abs(deltaX) * 0.7 && Math.abs(deltaY) > 6) { State.verticalSwipeLock = true; return; }
        if (State.verticalSwipeLock) return;

        const isSidebarOpen = DOM.sidebar.classList.contains('active');
        const isRightOpen = DOM.rightPanel.classList.contains('active');

        if (!State.isDragging && Math.abs(deltaX) > 10) {
            State.isDragging = true;
                                if (deltaX > 0 && !isSidebarOpen && !isRightOpen && !State.noSwipe) State.isDraggingSidebar = true;
            else if (deltaX < 0 && !isSidebarOpen && !isRightOpen && !State.noSwipe) State.isDraggingRightPanel = true;
            else if (isSidebarOpen && deltaX < 0) State.isDraggingSidebar = true;
            else if (isRightOpen && deltaX > 0) State.isDraggingRightPanel = true;
            else return;
        }

        if (State.isDraggingSidebar && DOM.sidebar) {
            e.preventDefault();
            const W = DOM.sidebar.offsetWidth || 300;
            const base = isSidebarOpen ? 0 : -W;
            const tx = Helpers.clamp(base + deltaX, -W, 0);
            const p = 1 - (Math.abs(tx) / W);
            DOM.sidebar.style.setProperty('transition', 'none', 'important');
            DOM.sidebar.style.transform = 'translateX(' + tx + 'px) scale(' + (0.96 + 0.04 * p).toFixed(4) + ')';
            DOM.sidebar.style.opacity = String(0.4 + 0.6 * p);
            DOM.sidebar.style.borderRadius = '0 ' + (18 * p).toFixed(2) + 'px ' + (18 * p).toFixed(2) + 'px 0';
            DOM.sidebarOverlay.style.opacity = String(0.85 * p);
            DOM.sidebarOverlay.style.visibility = 'visible';
        }

        if (State.isDraggingRightPanel && DOM.rightPanel) {
            e.preventDefault();
            const W = DOM.rightPanel.offsetWidth || 300;
            const base = isRightOpen ? 0 : W;
            const tx = Helpers.clamp(base + deltaX, 0, W);
            const p = 1 - (tx / W);
            DOM.rightPanel.style.setProperty('transition', 'none', 'important');
            DOM.rightPanel.style.transform = 'translateX(' + tx + 'px) scale(' + (0.96 + 0.04 * p).toFixed(4) + ')';
            DOM.sidebarOverlay.style.opacity = String(0.85 * p);
            DOM.sidebarOverlay.style.visibility = 'visible';
        }

        if (State.isDragging) {
            DragTrail.show(State.touchCurrentX, State.touchCurrentY);
        }
    },
    onTouchEnd: function () {
        const deltaX = State.touchCurrentX - State.touchStartX;
        const threshold = CONFIG.SWIPE_THRESHOLD;

        const isSidebarOpen = DOM.sidebar.classList.contains('active');
        const isRightOpen = DOM.rightPanel.classList.contains('active');

        const wasDraggingSidebar = State.isDraggingSidebar;
        const wasDraggingRightPanel = State.isDraggingRightPanel;
        const verticalLock = State.verticalSwipeLock;

        if (DOM.sidebar) {
            DOM.sidebar.style.transition = '';
            DOM.sidebar.style.transform = '';
            DOM.sidebar.style.opacity = '';
            DOM.sidebar.style.borderRadius = '';
        }
        if (DOM.rightPanel) {
            DOM.rightPanel.classList.remove('dragging');
            DOM.rightPanel.style.transition = '';
            DOM.rightPanel.style.transform = '';
            DOM.rightPanel.style.opacity = '';
        }
        if (DOM.sidebarOverlay) {
            DOM.sidebarOverlay.style.opacity = '';
            DOM.sidebarOverlay.style.visibility = '';
        }
        DragTrail.hide();

        State.isDragging = false;
        State.isDraggingSidebar = false;
        State.isDraggingRightPanel = false;
        State.verticalSwipeLock = false;
        State.noSwipe = false;
        State.touchInsideRightPanel = false;

        if (verticalLock) return;
        var quick = (Date.now() - (State.touchStartT || 0)) < 260 && Math.abs(deltaX) > 16;
        if (Math.abs(deltaX) <= Math.min(threshold, 32) && !quick) return;

        if (wasDraggingSidebar) {
            if (!isSidebarOpen && deltaX > 0) openSidebar();
            else if (isSidebarOpen && deltaX < 0) closeSidebar();
        }
        if (wasDraggingRightPanel) {
            if (!isRightOpen && deltaX < 0) RightPanel.open(RightPanel.getLast());
            else if (isRightOpen && deltaX > 0) RightPanel.close();
        }
    }
};
Gestures.init();

setTimeout(function () {
    Gestures._computeEdgeHint();
    setTimeout(function () {
        if (DOM.edgeHintRight) DOM.edgeHintRight.classList.remove('show');
        if (DOM.edgeHintLeft) DOM.edgeHintLeft.classList.remove('show');
    }, 2600);
}, 1200);

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        State.isSearchOpen ? closeSearch() : openSearch();
        return;
    }
    if (e.key === 'Escape') {
        if (document.querySelector('.doc-menu')) { closeAllDocMenus(); return; }
        if (State.isEditModalOpen) closeEditNameModal();
        else if (State.isWelcomeOpen) closeWelcomeCard();
        else if (State.isDropdownOpen) closeProfileDropdown();
        else if (RightPanel._isOpen) RightPanel.close();
        else if (State.isSidebarOpen) closeSidebar();
        else if (State.isNameModalOpen) closeNameModal();
        else if (State.isSearchOpen) closeSearch();
        else if (State.isThemePresetsOpen) closeThemePresets();
        else closeAllPanels();
    }
    if (e.altKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        const links = $$('.sidebar-links a[data-section]');
        if (links[idx]) {
            links[idx].click();
            const id = links[idx].getAttribute('data-section');
            const target = document.getElementById(id);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
                closeAllPanels();
            }
        }
    }
});

// ===== HERO MOTTO =====
// Static text + a single GPU-friendly reveal; no typing interval/cursor.
function revealMotto() {
    const el = DOM.heroMotto;
    if (!el) return;
    requestAnimationFrame(function () {
        el.classList.add('motto-ready');
    });
}
revealMotto();

// ===== HERO PARTICLES =====
if (DOM.heroContainer) {
    const count = 22;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'hero-particle';
        const size = 4 + Math.random() * 12;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDuration = (5 + Math.random() * 6) + 's';
        particle.style.animationDelay = (Math.random() * 4) + 's';
        particle.style.opacity = String(0.1 + Math.random() * 0.3);
        DOM.heroContainer.appendChild(particle);
    }
}

// ===== HERO STATS ANIMATION =====

// ===== SECTION ANIMATIONS =====
if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(function (entries) {
        for (let i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) entries[i].target.classList.add('visible');
        }
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.section').forEach(function (s) { sectionObserver.observe(s); });
}

// ===== SCROLL SPY =====
const navLinks = $$('.sidebar-links a[data-section]');
const sections = [];
navLinks.forEach(function (link) {
    const sectionId = link.getAttribute('data-section');
    const el = document.getElementById(sectionId);
    if (el) sections.push({ id: sectionId, element: el, link: link });
});

// ---- Own PC scroll indicator: a right-edge dot rail synced to sections ----
var pcScrollDotsEl = null, pcScrollDotButtons = [];
(function buildPcScrollDots() {
    if (!sections.length) return;
    pcScrollDotsEl = document.createElement('nav');
    pcScrollDotsEl.id = 'pcScrollDots';
    pcScrollDotsEl.setAttribute('aria-label', 'Page section indicator');
    pcScrollDotsEl.innerHTML = sections.map(function (s) {
        var label = (s.link.querySelector('.nav-title') || {}).textContent || s.id;
        return '<button type="button" class="psd-dot" data-id="' + s.id + '" data-label="' + label + '" aria-label="Go to ' + label + '"></button>';
    }).join('');
    document.body.appendChild(pcScrollDotsEl);
    pcScrollDotButtons = Array.prototype.slice.call(pcScrollDotsEl.querySelectorAll('.psd-dot'));
    pcScrollDotsEl.addEventListener('click', function (e) {
        const btn = e.target.closest('.psd-dot');
        if (!btn) return;
        const el = document.getElementById(btn.getAttribute('data-id'));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
})();

var lastActiveSectionId = null;
function updateActiveSection() {
    const pos = (window.pageYOffset || document.documentElement.scrollTop) + (window.innerHeight * 0.35);
    const atBottom = (window.innerHeight + window.pageYOffset) >=
        document.documentElement.scrollHeight - 50;
    let active = null;
    if (atBottom && sections.length) active = sections[sections.length - 1];
    else {
        for (let i = 0; i < sections.length; i++) {
            if (pos >= sections[i].element.offsetTop - 50) active = sections[i];
        }
    }
    if (!active && sections.length) active = sections[0];
    for (let i = 0; i < sections.length; i++) {
        sections[i].link.classList.toggle('active', active && sections[i].id === active.id);
    }
    if (pcScrollDotButtons.length) {
        pcScrollDotButtons.forEach(function (dot) {
            dot.classList.toggle('active', !!active && dot.getAttribute('data-id') === active.id);
        });
    }
    // 19. Keep the sidebar's own scroll position following the highlighted link,
    // so the active item never drifts out of view as the page section changes.
    if (active && active.id !== lastActiveSectionId) {
        lastActiveSectionId = active.id;
        if (active.link && typeof active.link.scrollIntoView === 'function') {
            active.link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }
}
window.addEventListener('scroll', Helpers.debounce(updateActiveSection, 50), { passive: true });
window.addEventListener('resize', Helpers.debounce(updateActiveSection, 100), { passive: true });
setTimeout(updateActiveSection, 100);

// ===== FAB =====
DOM.fabTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== FOOTER YEAR =====
if (DOM.footerYear) DOM.footerYear.textContent = new Date().getFullYear();

// ===== INIT =====
// 11. Discourage password-manager / autofill suggestion bars on every text field,
// including ones rendered later (faculty search, contact form, etc.).
function hardenInputsAgainstAutofill(root) {
    (root || document).querySelectorAll('input, textarea').forEach(function (el) {
        if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' || el.type === 'submit') return;
        el.setAttribute('autocomplete', 'off');
        el.setAttribute('autocorrect', 'off');
        el.setAttribute('autocapitalize', 'off');
        el.setAttribute('spellcheck', 'false');
        el.setAttribute('aria-autocomplete', 'none');
        el.setAttribute('data-autofill', 'off');
        el.setAttribute('data-lpignore', 'true');
        el.setAttribute('data-1p-ignore', 'true');
        el.setAttribute('data-bwignore', 'true');
        el.setAttribute('data-form-type', el.getAttribute('data-form-type') || 'other');
    });
}
hardenInputsAgainstAutofill(document);
document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (!el || !el.matches || !el.matches('input, textarea')) return;
    if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file' || el.type === 'submit') return;
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('aria-autocomplete', 'none');
});

async function init() {
    Helpers.applyTheme();
    Helpers.setThemePreset(Helpers.getThemePreset());
    Profile.updateUI();

    RightPanel.current = null;
    const lastTab = RightPanel.getLast();
    DOM.panelSlider.setAttribute('data-active', lastTab);
    DOM.rightPanel.setAttribute('data-active-tab', lastTab);
    DOM.panelSlider.style.transform = '';
    lockPanelViewport();

    await Promise.all([
        fetchSchoolInfo(),
        fetchNotices(),
        fetchFaculty(),
        fetchDocuments()
    ]);

    updateDocTabBadge();

    const profile = Profile.get();
    if (!profile || !profile.name) {
        setTimeout(openNameModal, 600);
    } else {
        setTimeout(function () {
            Toast.info('👋 Welcome back, ' + profile.name + '!');
        }, 1000);
    }

    setupRealtime();
    NoticeManager.updateBadge();
    updateActiveSection();

    Helpers.log('🌸 Radhe Radhe! PSBS Portal ready.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/* ===== 4. Enhancement layer ===== */
try {
    /* =====================================================================
       PSBS ENHANCEMENT LAYER (progressive — the page works without it)
       ===================================================================== */
    (function () {
        'use strict';
        var d = document;
        function $(s, r) { return (r || d).querySelector(s); }
        function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
        function esc(t) { return Helpers.sanitize(t); }
        function safe(fn) { try { return fn(); } catch (e) { if (window.console) console.warn('[PSBS+]', e); } }

        /* ---------- 1. Scroll progress + header shadow (one rAF-throttled listener) ---------- */
        var bar = $('#scrollProgress'), hdr = $('.header'), ticking = false;
        function onScroll() {
            ticking = false;
            var h = d.documentElement;
            var y = window.pageYOffset || h.scrollTop;
            var max = h.scrollHeight - h.clientHeight;
            if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ')';
            if (hdr) hdr.classList.toggle('is-scrolled', y > 8);
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
        }, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        onScroll();

        /* ---------- 2. Quick actions (hero, quick cards, ticker, footer, sidebar, header) ---------- */
        var actions = {
            notices: function () { RightPanel.open('notice'); },
            documents: function () { RightPanel.open('documents'); },
            search: function () { openSearch(); }
        };
        function afterSidebar(fn) {
            if (State.isSidebarOpen) { closeSidebar(); setTimeout(fn, 160); } else { fn(); }
        }
        d.addEventListener('click', function (e) {
            var qa = e.target.closest('[data-qa]');
            if (qa) {
                var f = actions[qa.getAttribute('data-qa')];
                if (f) { e.preventDefault(); safe(f); }
                return;
            }
            var sq = e.target.closest('[data-sq]');
            if (sq) {
                var g = actions[sq.getAttribute('data-sq')];
                if (g) { e.preventDefault(); afterSidebar(function () { safe(g); }); }
            }
        });
        var hs = $('#headerSearchBtn');
        if (hs) hs.addEventListener('click', function () { State.isSearchOpen ? closeSearch() : openSearch(); });
        if (typeof window.renderDocuments === 'function') {
            var _rd = window.renderDocuments;
            window.renderDocuments = function () {
                var r = _rd.apply(this, arguments);
                safe(function () {
                    var n = (State.documents || []).length, s = $('#qcDocSub');
                    if (s) s.textContent = n ? n + (n === 1 ? ' file' : ' files') : 'Notes & files';
                });
                return r;
            };
        }
        var nb = $('#noticeBadge'), qb = $('#qcNoticeBadge');
        function syncBadge() {
            if (!nb || !qb) return;
            var t = nb.textContent.trim();
            qb.hidden = nb.classList.contains('hidden-badge') || !t || t === '0';
            qb.textContent = t;
        }
        if (nb && window.MutationObserver) {
            new MutationObserver(syncBadge).observe(nb, { attributes: true, childList: true, characterData: true, subtree: true });
        }
        syncBadge();

        /* ---------- 4. Faculty count and empty state (no local search) ---------- */
        var fCnt = $('#facultyCount'), fEmpty = $('#facultyEmpty'), fGrid = $('#facultyContainer');
        function updateFacultySummary() {
            if (!fGrid) return;
            var cards = $$('.faculty-card', fGrid);
            if (fEmpty) fEmpty.hidden = cards.length !== 0;
            if (fCnt) fCnt.textContent = cards.length ? cards.length + ' teachers' : '';
        }
        if (typeof window.renderFaculty === 'function') {
            var _rf = window.renderFaculty;
            window.renderFaculty = function () { var r = _rf.apply(this, arguments); safe(updateFacultySummary); return r; };
        }

        /* ---------- 5. Smarter search: sections, FAQ, teachers, notices, documents, actions ---------- */
        Helpers.getSearchData = function () {
            return [
                { id: 'hero', title: 'Home', desc: 'Welcome to the school portal', icon: 'ri-home-5-line' },
                { id: 'about', title: 'About Us', desc: 'Mission, vision and principal\'s message', icon: 'ri-information-line' },
                { id: 'academics', title: 'Academics', desc: 'Play Group to Grade 10 programs', icon: 'ri-book-open-line' },
                { id: 'highlights', title: 'Why Us', desc: 'Labs, computer education, mock tests, career guidance', icon: 'ri-sparkling-line' },
                { id: 'faculty', title: 'Faculty', desc: 'Meet our dedicated teachers', icon: 'ri-user-star-line' },
                { id: 'gallery', title: 'Gallery', desc: 'Campus life photos', icon: 'ri-image-line' },
                { id: 'faq', title: 'FAQ', desc: 'Answers to common questions', icon: 'ri-question-line' },
                { id: 'contact', title: 'Contact', desc: 'Phone, email, address and map', icon: 'ri-phone-line' }
            ];
        };
        function actionItems() {
            return [
                { kind: 'action', title: 'School Calendar', desc: 'Events, holidays and exams', icon: 'ri-calendar-line', tag: 'Page', run: function () { location.href = CONFIG.CALENDAR_PAGE; } },
                { kind: 'action', title: 'Notice Board', desc: 'Latest school notices', icon: 'ri-megaphone-line', tag: 'Open', run: actions.notices },
                { kind: 'action', title: 'Documents', desc: 'Notes, PDFs and slides', icon: 'ri-folder-line', tag: 'Open', run: actions.documents },
                { kind: 'action', title: 'Theme Presets', desc: 'Change the colour theme', icon: 'ri-palette-line', tag: 'Action', run: function () { openThemePresets(); } },
                { kind: 'action', title: 'Toggle Dark Mode', desc: 'Switch between light and dark', icon: 'ri-moon-line', tag: 'Action', run: function () { var dk = Helpers.toggleDark(); Toast.info(dk ? '🌙 Dark mode enabled' : '☀️ Light mode enabled'); } },
                { kind: 'action', title: 'Student Login', desc: 'Go to the student portal', icon: 'ri-graduation-cap-line', tag: 'Page', run: function () { location.href = CONFIG.LOGIN_BASE + CONFIG.LOGIN_STUDENT; } },
                { kind: 'action', title: 'Teacher Login', desc: 'Go to the teacher portal', icon: 'ri-user-star-line', tag: 'Page', run: function () { location.href = CONFIG.LOGIN_BASE + CONFIG.LOGIN_TEACHER; } },
                { kind: 'action', title: 'Share this Page', desc: 'Send the link to a friend', icon: 'ri-share-line', tag: 'Action', run: function () { Helpers.sharePage(); } }
            ];
        }
        var current = [];
        function match(q, hay) { return String(hay || '').toLowerCase().indexOf(q) > -1; }
        function collect(q) {
            var out = [];
            Helpers.getSearchData().forEach(function (s) {
                if (match(q, s.title + ' ' + s.desc + ' ' + s.id)) out.push({ kind: 'section', id: s.id, title: s.title, desc: s.desc, icon: s.icon, tag: 'Section' });
            });
            actionItems().forEach(function (a) { if (match(q, a.title + ' ' + a.desc)) out.push(a); });
            $$('.faq-item').forEach(function (el) {
                var sm = $('summary span', el), p = $('p', el);
                var title = sm ? sm.textContent : '', body = p ? p.textContent : '';
                if (match(q, title + ' ' + body)) out.push({ kind: 'faq', el: el, title: title, desc: body.slice(0, 80) + (body.length > 80 ? '…' : ''), icon: 'ri-question-line', tag: 'FAQ' });
            });
            (State.faculty || []).forEach(function (f) {
                if (match(q, (f.name || '') + ' ' + (f.subject || ''))) out.push({ kind: 'faculty', title: f.name || 'Teacher', desc: 'Faculty · ' + (f.subject || ''), icon: f.emoji || '👨‍🏫', tag: 'Teacher' });
            });
            (State.notices || []).forEach(function (n) {
                if (match(q, (n.title || '') + ' ' + (n.description || ''))) out.push({ kind: 'notice', title: n.title, desc: Helpers.formatDate(n.date), icon: 'ri-megaphone-line', tag: 'Notice' });
            });
            (State.documents || []).forEach(function (dc) {
                if (match(q, (dc.title || '') + ' ' + (dc.subject || ''))) out.push({ kind: 'doc', title: dc.title || 'Document', desc: dc.subject || 'Study document', icon: 'ri-file-text-line', tag: 'Document' });
            });
            return out.slice(0, 14);
        }
        function paint(items, heading) {
            current = items;
            var box = DOM.searchResults;
            if (!items.length) return false;
            var html = heading ? '<div class="search-group-title">' + esc(heading) + '</div>' : '';
            items.forEach(function (it, i) {
                html += '<div class="search-result-item" role="button" tabindex="0" data-i="' + i + '" style="animation: fadeUp 0.3s ' + Math.min(i * 30, 240) + 'ms backwards cubic-bezier(0.16,1,0.3,1);">' +
                    '<span class="sri-icon">' + (/^ri-/.test(it.icon) ? '<i class="' + it.icon + '" aria-hidden="true"></i>' : esc(it.icon)) + '</span>' +
                    '<div class="sri-text"><h4>' + esc(it.title) + '</h4><p>' + esc(it.desc) + '</p></div>' +
                    '<span class="sri-tag">' + esc(it.tag || '') + '</span></div>';
            });
            box.innerHTML = html;
            return true;
        }
        function suggestions() {
            var picks = [
                { kind: 'action', title: 'Notice Board', desc: 'Latest school notices', icon: 'ri-megaphone-line', tag: 'Open', run: actions.notices },
                { kind: 'action', title: 'Documents', desc: 'Notes, PDFs and slides', icon: 'ri-folder-line', tag: 'Open', run: actions.documents },
                { kind: 'action', title: 'School Calendar', desc: 'Events, holidays and exams', icon: 'ri-calendar-line', tag: 'Page', run: function () { location.href = CONFIG.CALENDAR_PAGE; } },
                { kind: 'section', id: 'academics', title: 'Academics', desc: 'Education from PG to Grade 10', icon: 'ri-graduation-cap-line', tag: 'Section' },
                { kind: 'section', id: 'contact', title: 'Contact', desc: 'Phone, email, address and map', icon: 'ri-phone-line', tag: 'Section' }
            ];
            paint(picks, 'Quick jump');
        }
        function scrollToId(id) {
            var el = d.getElementById(id);
            if (el) { el.classList.add('visible'); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }
        function runItem(it) {
            closeSearch();
            setTimeout(function () {
                safe(function () {
                    if (it.kind === 'section') scrollToId(it.id);
                    else if (it.kind === 'faculty') { scrollToId('faculty'); }
                    else if (it.kind === 'faq') { scrollToId('faq'); if (it.el) it.el.open = true; }
                    else if (it.kind === 'notice') RightPanel.open('notice');
                    else if (it.kind === 'doc') {
                        RightPanel.open('documents');
                        if (DOM.docSearchInput) {
                            DOM.docSearchInput.value = it.title;
                            DOM.docSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    } else if (it.run) it.run();
                });
            }, 220);
        }
        window.performSearch = function (query) {
            var q = String(query || '').toLowerCase().trim();
            if (!q) { suggestions(); return; }
            var res = collect(q);
            if (!paint(res, res.length + (res.length === 1 ? ' result' : ' results'))) {
                current = [];
                DOM.searchResults.innerHTML = '<div class="search-empty"><i class="ri-emotion-unhappy-line" aria-hidden="true"></i> No results found for "' + esc(q) + '"</div>';
            }
        };
        var _os = window.openSearch;
        window.openSearch = function () { _os.apply(this, arguments); requestAnimationFrame(suggestions); };
        if (DOM.searchResults) {
            DOM.searchResults.addEventListener('click', function (e) {
                var el = e.target.closest('.search-result-item');
                if (el && current[+el.getAttribute('data-i')]) runItem(current[+el.getAttribute('data-i')]);
            });
            DOM.searchResults.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter') return;
                var el = e.target.closest('.search-result-item');
                if (el) el.click();
            });
        }
        if (DOM.searchInput) {
            DOM.searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { var first = $('.search-result-item', DOM.searchResults); if (first) first.click(); }
            });
        }
        /* Clear button is handled by the single authoritative handler above. */

        /* ---------- 6. Contact helpers ---------- */
        // 6a. Live office status (Nepal time). Change office hours HERE only.
        var OFFICE = {
            days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            open: 10 * 60, close: 16 * 60,            // minutes from midnight
            openLabel: '10:00 AM', closeLabel: '4:00 PM',
            daysShort: 'Mon-Fri', daysLong: 'Monday to Friday'
        };
        var WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var WEEK_FULL = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
        $$('[data-office="range"]').forEach(function (n) { n.textContent = OFFICE.daysShort + ': ' + OFFICE.openLabel + ' - ' + OFFICE.closeLabel; });
        $$('[data-office="sentence"]').forEach(function (n) { n.textContent = OFFICE.daysLong + ', ' + OFFICE.openLabel + ' \u2013 ' + OFFICE.closeLabel; });
        function nepalNow() {
            try {
                var f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kathmandu', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
                var o = {};
                f.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
                return { day: o.weekday, mins: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
            } catch (e) {
                var n = new Date();
                return { day: WEEK[n.getDay()], mins: n.getHours() * 60 + n.getMinutes() };
            }
        }
        function nextOpenDay(day) {
            var i = WEEK.indexOf(day);
            for (var k = 1; k <= 7; k++) {
                var d = WEEK[(i + k) % 7];
                if (OFFICE.days.indexOf(d) > -1) return WEEK_FULL[d];
            }
            return WEEK_FULL[OFFICE.days[0]];
        }
        function updateStatus() {
            var el = $('#openStatus');
            if (!el) return;
            var t = nepalNow(), work = OFFICE.days.indexOf(t.day) > -1, open = false, txt;
            if (work && t.mins >= OFFICE.open && t.mins < OFFICE.close) { open = true; txt = 'Open now \u00b7 closes ' + OFFICE.closeLabel + ' (NPT)'; }
            else if (work && t.mins < OFFICE.open) { txt = 'Closed \u00b7 opens today ' + OFFICE.openLabel + ' (NPT)'; }
            else { txt = 'Closed \u00b7 opens ' + nextOpenDay(t.day) + ' ' + OFFICE.openLabel + ' (NPT)'; }
            el.classList.toggle('closed', !open);
            var tx = $('.os-text', el);
            if (tx) tx.textContent = txt;
        }
        updateStatus();
        setInterval(updateStatus, 60000);

        // 6b. One-tap copy buttons on contact cards
        function copyText(text, btn) {
            function ok() {
                var i = $('i', btn);
                btn.classList.add('done');
                if (i) i.className = 'ri-check-line';
                Toast.success('Copied: ' + text);
                setTimeout(function () { btn.classList.remove('done'); if (i) i.className = 'ri-file-copy-line'; }, 1600);
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(ok).catch(function () { Toast.info(text); });
            } else {
                var ta = d.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                d.body.appendChild(ta); ta.select();
                try { d.execCommand('copy'); ok(); } catch (e) { Toast.info(text); }
                ta.remove();
            }
        }
        $$('.contact-card').forEach(function (card) {
            var val = '', label = '';
            var tel = $('a[href^="tel:"]', card), mail = $('a[href^="mailto:"]', card), h3 = $('h3', card), p = $('p', card);
            if (tel) { val = tel.textContent.trim(); label = 'phone number'; }
            else if (mail) { val = mail.textContent.trim(); label = 'email address'; }
            else if (h3 && /address/i.test(h3.textContent) && p) { val = p.textContent.trim(); label = 'address'; }
            if (!val) return;
            var b = d.createElement('button');
            b.type = 'button'; b.className = 'copy-btn'; b.setAttribute('aria-label', 'Copy ' + label);
            b.innerHTML = '<i class="ri-file-copy-line" aria-hidden="true"></i>';
            b.addEventListener('click', function () { copyText(val, b); });
            card.appendChild(b);
        });

        // 6c. Message length counter
        var ta = $('#contactMessage'), cf = $('#contactForm');
        if (ta) {
            var MAX = 1000, cc = d.createElement('div'), grp = ta.closest('.input-group');
            ta.setAttribute('maxlength', String(MAX));
            cc.className = 'char-count'; cc.setAttribute('aria-live', 'off'); cc.textContent = '0 / ' + MAX;
            if (grp) grp.insertAdjacentElement('afterend', cc);
            var upd = function () { var n = ta.value.length; cc.textContent = n + ' / ' + MAX; cc.classList.toggle('warn', n > MAX * 0.9); };
            ta.addEventListener('input', upd);
            if (cf) {
                cf.addEventListener('reset', function () { setTimeout(upd, 0); });
                cf.addEventListener('fs:success', function () { setTimeout(upd, 50); });
            }
        }

        // 6d. Click-to-load map (keeps the first paint fast)
        var mb = $('#loadMapBtn');
        if (mb) mb.addEventListener('click', function () {
            var card = $('#mapCard'), ph = $('#mapPlaceholder');
            if (!card) return;
            var f = d.createElement('iframe');
            f.src = 'https://www.google.com/maps?q=' + encodeURIComponent((SchoolInfo.name() + ' ' + SchoolInfo.address()).trim()) + '&output=embed';
            f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
            f.title = 'Map showing ' + (SchoolInfo.name() || 'the school'); f.setAttribute('allowfullscreen', '');
            card.appendChild(f);
            if (ph) ph.remove();
        });

        /* ---------- 7. Hero polish: pause decorative animation when the hero is off-screen ---------- */
        var hero = $('#hero');
        if (hero && 'IntersectionObserver' in window) {
            new IntersectionObserver(function (en) {
                hero.classList.toggle('offscreen', !en[0].isIntersecting);
            }, { threshold: 0 }).observe(hero);
        }
    })();
} catch (err) {
    console.warn('[psbs] section 4 failed:', err);
}

/* ===== 5. Contact form (Formspree) ===== */
try {
    // ---------- Formspree ----------
    window.formspree = window.formspree || function () {
        (formspree.q = formspree.q || []).push(arguments);
    };
    formspree('initForm', {
        formElement: '#contactForm',
        formId: 'mrenjbra'
    });

    const contactFormEl = document.getElementById('contactForm');
    if (contactFormEl) {
        contactFormEl.addEventListener('fs:success', function () {
            Toast.success('Message sent successfully! 📨');
        });
        contactFormEl.addEventListener('fs:error', function (e) {
            Toast.error('Failed to send message. Please check your inputs or try again later.');
            console.warn('Formspree error details:', e.detail);
        });
    }
} catch (err) {
    console.warn('[psbs] section 5 failed:', err);
}

/* ===== 6. Keyboard-aware layout ===== */
try {
    (function(){
      var vv=window.visualViewport, root=document.documentElement;
      function upd(){
        if(!vv) return;
        var kb=Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        root.style.setProperty('--kb', (kb>80?kb:0)+'px');
      }
      if(vv){ vv.addEventListener('resize',upd); vv.addEventListener('scroll',upd); upd(); }
      function isField(t){ return t && /^(INPUT|TEXTAREA)$/.test(t.tagName) && t.type!=='file'; }
      document.addEventListener('focusin',function(e){
        var t=e.target; if(!isField(t)) return;
        [150,350,600].forEach(function(d){
          setTimeout(function(){
            if(document.activeElement===t) t.scrollIntoView({block:'center',behavior:'smooth'});
          },d);
        });
      });
      document.addEventListener('focusout',function(){ setTimeout(upd,100); });
    })();
} catch (err) {
    console.warn('[psbs] section 6 failed:', err);
}

/* ===== 7. Contact form data map ===== */
try {
    (function(){
      var f=document.getElementById('contactForm'); if(!f) return;
      f.addEventListener('formdata',function(e){
        var d=e.formData;
        d.set('name',(d.get('psbs_c_a81')||''));  d.delete('psbs_c_a81');
        d.set('email',(d.get('psbs_c_b52')||'')); d.delete('psbs_c_b52');
      });
    })();
} catch (err) {
    console.warn('[psbs] section 7 failed:', err);
}

/* ===== 8. Tab glider ===== */
try {
    (function(){
      var bar=document.querySelector('.right-panel .panel-tabbar'); if(!bar)return;
      var panel=document.getElementById('rightPanel'), slider=document.getElementById('panelSlider');
      var nTab=bar.querySelector('[data-panel-tab="notice"]'), dTab=bar.querySelector('[data-panel-tab="documents"]');
      if(!nTab||!dTab)return;
      var g=document.createElement('span'); g.className='tab-glider'; g.setAttribute('aria-hidden','true'); bar.insertBefore(g,bar.firstChild);
      var dragP=null, last='', geo=null;
      if(window.ResizeObserver){var ro=new ResizeObserver(function(){last='';geo=null;}); ro.observe(bar); ro.observe(nTab); ro.observe(dTab);}
      function curP(){
        if(dragP!==null)return dragP;
        var v=parseFloat(dTab.style.getPropertyValue('--swipe-p'));
        if(!isNaN(v))return v;
        return dTab.classList.contains('active')?1:0;
      }
      function paint(){
        if(last===''||!geo){geo={nl:nTab.offsetLeft,dl:dTab.offsetLeft,nw:nTab.offsetWidth,dw:dTab.offsetWidth};}
        var p=curP(), x=geo.nl+(geo.dl-geo.nl)*p, w=geo.nw+(geo.dw-geo.nw)*p;
        var key=x.toFixed(1)+'|'+w.toFixed(1);
        if(key!==last&&w>0){last=key;g.style.width=w+'px';g.style.transform='translateX('+x+'px)';}
      }
      (function loop(){ if(panel&&panel.classList.contains('active')||dragP!==null)paint(); requestAnimationFrame(loop); })();
      window.addEventListener('resize',function(){last='';paint();});
      if(panel)new MutationObserver(function(){last='';paint();}).observe(panel,{attributes:true,attributeFilter:['class']});
      paint();

      // finger-drag the highlight across the dock
      var down=false,moved=false,sx=0,suppress=false;
      var startP=0,travel=60,lastX=0,t0=0,tgtP=0,raf=0;
      function tick(){
        raf=0; if(!down||!moved)return;
        var cur=dragP===null?startP:dragP; cur+= (tgtP-cur)*0.2; if(Math.abs(tgtP-cur)<0.002)cur=tgtP;
        dragP=cur; tint(cur);
        if(slider)slider.style.transform='translateX('+(-50*cur).toFixed(2)+'%)';
        paint();
        if(cur!==tgtP) raf=requestAnimationFrame(tick);
      }
      function pFromX(cx){
        return Math.max(0,Math.min(1,startP+(cx-sx)/travel));
      }
      function tint(p){nTab.style.setProperty('--swipe-p',(1-p).toFixed(3));dTab.style.setProperty('--swipe-p',p.toFixed(3));}
      bar.addEventListener('pointerdown',function(e){
        if(e.pointerType==='mouse'&&e.button!==0)return;
        down=true;moved=false;sx=lastX=e.clientX;t0=Date.now();startP=curP();
        var ra=nTab.getBoundingClientRect(), rb=dTab.getBoundingClientRect();
        travel=Math.max(40,((rb.left+rb.width/2)-(ra.left+ra.width/2))*0.75); tgtP=startP; raf=0; /* short travel = faster switching */
        try{bar.setPointerCapture(e.pointerId);}catch(_){}
      });
      bar.addEventListener('pointermove',function(e){
        if(!down)return;
        if(!moved&&Math.abs(e.clientX-sx)<2)return;
        if(!moved){moved=true;bar.classList.add('is-dragging');if(slider)slider.style.transition='none';}
        lastX=e.clientX;tgtP=pFromX(e.clientX); if(dragP===null)dragP=startP;
        if(!raf)raf=requestAnimationFrame(tick);
      });
      function end(e){
        if(!down)return;down=false;
        if(!moved)return;
        var p=dragP===null?curP():dragP, target=p>0.5?'documents':'notice';
        var dir0=lastX-sx; if(Math.abs(dir0)>=5){ target=dir0>0?'documents':'notice'; }
        var fdx=lastX-sx; if(Date.now()-t0<450&&Math.abs(fdx)>=4) target=fdx>0?'documents':'notice'; /* quick flick, same direction the highlight moves */
        if(raf){cancelAnimationFrame(raf);raf=0;}
        suppress=true;setTimeout(function(){suppress=false;},400);
        dragP=null;bar.classList.remove('is-dragging');
        nTab.style.removeProperty('--swipe-p');dTab.style.removeProperty('--swipe-p');
        if(slider){slider.style.transition='';slider.style.transform='';}
        var btn=target==='documents'?dTab:nTab;
        if(!btn.classList.contains('active')){suppress=false;btn.click();suppress=true;}
        last='';paint();
      }
      bar.addEventListener('pointerup',end);
      bar.addEventListener('pointercancel',end);
      bar.addEventListener('click',function(e){if(suppress){e.stopPropagation();e.preventDefault();}},true);
    })();
} catch (err) {
    console.warn('[psbs] section 8 failed:', err);
}

/* ===== 9. Premium menu ===== */
try {
    (function(){
      var $=function(i){return document.getElementById(i)};
      function sync(){
        var n=$('ddName'),r=$('ddRole'),a=$('ddAvatar');
        if(n&&$('sbName'))$('sbName').textContent=n.textContent;
        if(r&&$('sbRole'))$('sbRole').textContent=r.textContent;
        if(a&&$('sbAvatar')){ var sa=$('sbAvatar'), bi=a.style.backgroundImage, im=a.querySelector('img'), u=(bi&&bi!=='none')?bi:((im&&im.src)?'url("'+im.src+'")':'');
          if(u){ sa.textContent=''; sa.style.setProperty('background-image',u,'important'); sa.style.setProperty('background-size','cover','important'); sa.style.setProperty('background-position','center','important'); }
          else { ['background-image','background-size','background-position'].forEach(function(p){sa.style.removeProperty(p);}); sa.innerHTML=a.innerHTML; } }
        var dark=document.body.classList.contains('dark'), sw=$('sbDarkBtn');
        if(sw)sw.setAttribute('aria-checked',dark?'true':'false');
      }
      function closeThen(fn){
        var c=document.querySelector('.sidebar-close'); if(c)c.click();
        setTimeout(fn,260);
      }
      document.addEventListener('DOMContentLoaded',function(){
        sync();
        var mo=new MutationObserver(sync);
        ['ddName','ddRole','ddAvatar'].forEach(function(i){var e=$(i);if(e)mo.observe(e,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['style']});});
        mo.observe(document.body,{attributes:true,attributeFilter:['class']});
        /* profile card now opens the in-menu popover (section 23) */
        var t=$('sbThemesBtn'); if(t)t.addEventListener('click',function(){closeThen(function(){var e=$('headerThemePresetsBtn'); if(e)e.click();});});
        var d=$('sbDarkBtn'); if(d)d.addEventListener('click',function(){var e=$('headerThemeToggleBtn'); if(e)e.click(); setTimeout(sync,50);});
      });
    })();
} catch (err) {
    console.warn('[psbs] section 9 failed:', err);
}

/* ===== 10. Panel sync ===== */
try {
    (function(){
      var panel=document.getElementById('rightPanel'); if(!panel)return;
      var src=panel.querySelector('.panel-header-source');
      var t=panel.querySelector('[data-docs-title]'), p=panel.querySelector('[data-docs-sub]');
      if(!src||!t||!p)return;
      var st=src.querySelector('#rightPanelSubtitle');
      function sync(){
        if(panel.getAttribute('data-active-tab')==='documents' && st && st.textContent) p.textContent=st.textContent;
      }
      new MutationObserver(sync).observe(src,{childList:true,characterData:true,subtree:true});
      new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['data-active-tab']});
    })();
} catch (err) {
    console.warn('[psbs] section 10 failed:', err);
}

/* ===== 11. Filter glider ===== */
try {
    (function(){
      var wrap=document.getElementById('docFilters'); if(!wrap)return;
      var g=document.createElement('span'); g.className='filter-glider'; g.setAttribute('aria-hidden','true'); wrap.insertBefore(g,wrap.firstChild);
      function btns(){return [].slice.call(wrap.querySelectorAll('.doc-filter'));}
      function activeBtn(){return wrap.querySelector('.doc-filter.active')||btns()[0];}
      function place(b){ if(!b||!b.offsetWidth)return; g.style.width=b.offsetWidth+'px'; g.style.transform='translateX('+b.offsetLeft+'px)'; }
      function sync(){ if(!dragging) place(activeBtn()); }
      var dragging=false,moved=false,sx=0,startX=0,curX=0,tgtX=0,raf=0,suppress=false,pickBtn=null;
      new MutationObserver(sync).observe(wrap,{subtree:true,attributes:true,attributeFilter:['class']});
      if(window.ResizeObserver) new ResizeObserver(sync).observe(wrap);
      window.addEventListener('resize',sync); setTimeout(sync,0); setTimeout(sync,400);
      function nearest(x){ var bs=btns(),best=bs[0],bd=1e9; bs.forEach(function(b){var d=Math.abs(b.offsetLeft+b.offsetWidth/2-x); if(d<bd){bd=d;best=b;}}); return best; }
      function tick(){
        raf=0; if(!dragging||!moved)return;
        curX+=(tgtX-curX)*0.25; if(Math.abs(tgtX-curX)<0.4)curX=tgtX;
        g.style.transform='translateX('+curX.toFixed(1)+'px)';
        if(curX!==tgtX) raf=requestAnimationFrame(tick);
      }
      wrap.addEventListener('pointerdown',function(e){
        if(e.pointerType==='mouse'&&e.button!==0)return;
        var a=activeBtn(); if(!a)return;
        dragging=true;moved=false;sx=e.clientX;startX=a.offsetLeft;curX=startX;tgtX=startX;wrap._pid=e.pointerId;
      });
      wrap.addEventListener('pointermove',function(e){
        if(!dragging)return;
        if(!moved&&Math.abs(e.clientX-sx)<3)return;
        if(!moved){moved=true;wrap.classList.add('is-dragging');try{wrap.setPointerCapture(wrap._pid);}catch(_){}}
        var bs=btns(),first=bs[0],last=bs[bs.length-1],w=g.offsetWidth;
        tgtX=Math.max(first.offsetLeft,Math.min(last.offsetLeft+last.offsetWidth-w,startX+(e.clientX-sx)));
        var nb=nearest(tgtX+w/2);
        if(nb!==pickBtn){ if(pickBtn)pickBtn.classList.remove('pick'); pickBtn=nb; nb.classList.add('pick'); }
        if(!raf)raf=requestAnimationFrame(tick);
      });
      function end(){
        if(!dragging)return; dragging=false;
        if(raf){cancelAnimationFrame(raf);raf=0;}
        if(!moved)return;
        suppress=true;setTimeout(function(){suppress=false;},350);
        wrap.classList.remove('is-dragging');
        var target=pickBtn||activeBtn(); if(pickBtn){pickBtn.classList.remove('pick');pickBtn=null;}
        if(target&&!target.classList.contains('active')){suppress=false;target.click();suppress=true;}
        place(target);
      }
      wrap.addEventListener('pointerup',end); wrap.addEventListener('pointercancel',end);
      wrap.addEventListener('click',function(e){if(suppress){e.stopPropagation();e.preventDefault();}},true);
    })();
} catch (err) {
    console.warn('[psbs] section 11 failed:', err);
}

/* ===== 12. Docs search FAB ===== */
try {
    (function(){
      var panel=document.getElementById('rightPanel'); if(!panel)return;
      var wrap=panel.querySelector('.doc-search-wrap'), input=document.getElementById('docSearchInput');
      if(!wrap||!input)return;
      var fab=document.createElement('div'); fab.className='doc-search-fab';
      var btn=document.createElement('button'); btn.type='button'; btn.className='dsf-btn'; btn.setAttribute('aria-label','Search documents'); btn.innerHTML='<i class="ri-search-2-line" aria-hidden="true"></i>';
      fab.appendChild(btn); fab.appendChild(wrap);
      var hdr=panel.querySelector('.panel-pane[data-pane="documents"] .panel-scroll-header')||panel; hdr.style.position='relative'; hdr.appendChild(fab);   /* moves the existing search box, so its logic is unchanged */
      function open(){ fab.classList.add('expanded'); setTimeout(function(){try{input.focus({preventScroll:true});}catch(_){input.focus();}},180); }
      btn.addEventListener('click',open);
      function clearClose(){
        if(input.value){ input.value=''; input.dispatchEvent(new Event('input',{bubbles:true})); }
        fab.classList.remove('expanded');
      }
      /* keyboard closes (input loses focus) -> search clears and closes */
      input.addEventListener('blur',function(){
        setTimeout(function(){ if(document.activeElement!==input && fab.classList.contains('expanded')) clearClose(); },150);
      });
      /* Android: hiding the keyboard with Back doesn't always blur, so watch the viewport too */
      if(window.visualViewport){
        var baseH=window.visualViewport.height;
        window.visualViewport.addEventListener('resize',function(){
          var h=window.visualViewport.height;
          if(h>baseH)baseH=h;
          if(fab.classList.contains('expanded') && document.activeElement===input && h>=baseH-40 && input._kbWasOpen){ input._kbWasOpen=false; input.blur(); }
          else if(h<baseH-120){ input._kbWasOpen=true; }
        });
      }
      /* while search is open, the cross closes the search first (not the whole panel) */
      var cross=document.getElementById('rightPanelClose'), swallow=false;
      if(cross){
        ['pointerdown','touchstart','mousedown'].forEach(function(ev){
          cross.addEventListener(ev,function(){ if(fab.classList.contains('expanded')){ swallow=true; setTimeout(function(){swallow=false;},700); } },true);
        });
        cross.addEventListener('click',function(e){
          if(swallow||fab.classList.contains('expanded')){ e.stopImmediatePropagation(); e.preventDefault(); swallow=false; clearClose(); try{input.blur();}catch(_){} }
        },true);
      }
      new MutationObserver(function(){ if(panel.getAttribute('data-active-tab')!=='documents'){ input.blur(); fab.classList.remove('expanded'); } else if(input.value.trim()){ fab.classList.add('expanded'); } })
        .observe(panel,{attributes:true,attributeFilter:['data-active-tab']});
    })();
} catch (err) {
    console.warn('[psbs] section 12 failed:', err);
}

/* ===== 13. Scrolling panel headers ===== */
try {
    (function(){
      /* sidebar: put the existing ✕ back inside the scrolling header */
      var sb=document.querySelector('.sidebar'), sbClose=sb&&sb.querySelector('.sidebar-close'), sbHead=sb&&sb.querySelector('.sidebar-header');
      if(sbClose&&sbHead) sbHead.appendChild(sbClose);
      /* right panel: docs header gets the real ✕, notices header gets a twin that triggers it */
      var panel=document.getElementById('rightPanel'); if(!panel)return;
      var real=document.getElementById('rightPanelClose');
      var heads=panel.querySelectorAll('.panel-pane>.panel-scroll-header');
      var nHead=heads[0], dHead=heads[1];
      if(real&&dHead) dHead.appendChild(real);
      if(real&&nHead){
        var twin=document.createElement('button'); twin.type='button'; twin.className='notice-close'; twin.setAttribute('aria-label','Close panel');
        twin.innerHTML='<i class="ri-close-large-line" aria-hidden="true"></i>';
        twin.addEventListener('click',function(){ real.click(); });
        nHead.appendChild(twin);
      }
    })();
} catch (err) {
    console.warn('[psbs] section 13 failed:', err);
}

/* ===== 14. Hero logo interaction ===== */
try {
    (function () {
      var f = document.querySelector('#hero .hv-frame');
      if (!f) return;
      f.setAttribute('tabindex', '0');
      f.setAttribute('role', 'button');
      f.setAttribute('aria-pressed', 'false');
      f.setAttribute('aria-label', 'Highlight school logo');
      function toggle() {
        var on = f.classList.toggle('hv-lit');
        f.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      f.addEventListener('click', toggle);
      f.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    })();
} catch (err) {
    console.warn('[psbs] section 14 failed:', err);
}

/* ===== 15. Final system layer ===== */
try {
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
} catch (err) {
    console.warn('[psbs] section 15 failed:', err);
}

/* ===== 16. Performance layer ===== */
try {
    (function(){
      var h=document.documentElement;
      try{
        var c=navigator.connection||{};
        var weak=(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||c.saveData||/(^|-)2g$/.test(c.effectiveType||'');
        if(weak)h.classList.add('psbs-lite');
      }catch(e){}
      document.addEventListener('visibilitychange',function(){h.classList.toggle('psbs-tab-hidden',document.hidden);});
      function init(){
        if(!('IntersectionObserver' in window))return;
        var bg=document.querySelector('.hero-premium-bg');
        var hero=bg&&(bg.closest('section')||bg.parentElement);
        if(!hero)return;
        new IntersectionObserver(function(en){
          hero.classList.toggle('psbs-offscreen',!en[0].isIntersecting);
        },{rootMargin:'80px'}).observe(hero);
      }
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
    })();
} catch (err) {
    console.warn('[psbs] section 16 failed:', err);
}

/* ===== 17. Panels polish ===== */
try {
    (function(){
      var fab=document.querySelector('.doc-search-fab'); if(!fab)return;
      var btn=fab.querySelector('.dsf-btn'), input=document.getElementById('docSearchInput');
      if(btn){
        btn.setAttribute('aria-expanded','false');
        btn.setAttribute('aria-controls','docSearchInput');
        new MutationObserver(function(){
          btn.setAttribute('aria-expanded',fab.classList.contains('expanded')?'true':'false');
        }).observe(fab,{attributes:true,attributeFilter:['class']});
      }
      /* Esc inside the search box clears and collapses it, without closing the whole panel */
      if(input) input.addEventListener('keydown',function(e){
        if(e.key==='Escape'){ e.stopPropagation(); input.blur(); }
      });
    })();
} catch (err) {
    console.warn('[psbs] section 17 failed:', err);
}

/* ===== 18. Pinned close button ===== */
try {
    (function(){
      var panel=document.getElementById('rightPanel'), real=document.getElementById('rightPanelClose');
      if(!panel||!real)return;
      /* put the real ✕ back on the panel itself and drop the scrolling twin (it only forwarded clicks to the real one) */
      panel.querySelectorAll('.panel-scroll-header>.notice-close').forEach(function(b){ if(b!==real) b.remove(); });
      if(real.parentNode!==panel){
        var vp=panel.querySelector('.panel-viewport');
        panel.insertBefore(real,vp||panel.firstChild);
      }
      /* mark the filter pill as "stuck" once it reaches the top, so CSS can make room for the ✕ beside it */
      var pane=panel.querySelector('.panel-pane[data-pane="documents"]'), tb=pane&&pane.querySelector(':scope>.doc-toolbar');
      if(!pane||!tb)return;
      var mark=document.createElement('div'); mark.setAttribute('aria-hidden','true'); mark.style.cssText='height:0;margin:0;padding:0;pointer-events:none';
      pane.insertBefore(mark,tb);
      var raf=0;
      function check(){
        raf=0;
        var lim=parseFloat(getComputedStyle(tb).top)||0;
        var stuck=mark.getBoundingClientRect().top-pane.getBoundingClientRect().top<=lim+0.5;
        if(stuck!==tb.classList.contains('psbs-stuck')) tb.classList.toggle('psbs-stuck',stuck);
      }
      pane.addEventListener('scroll',function(){ if(!raf) raf=requestAnimationFrame(check); },{passive:true});
      window.addEventListener('resize',check,{passive:true});
      check();
    })();
} catch (err) {
    console.warn('[psbs] section 18 failed:', err);
}

/* ===== 19. Hero polish ===== */
try {
    (function(){
      /* on large screens the Explore Campus button lives in the logo card; on phones it stays in the info card */
      var cta=document.querySelector('#hero .hero-cta-m'), right=document.querySelector('#hero .hero-right');
      if(!cta||!right||!cta.parentNode||!window.matchMedia)return;
      var home=document.createComment('hero-cta-home'); cta.parentNode.insertBefore(home,cta);
      var mq=window.matchMedia('(min-width:900px)');
      function place(){ if(mq.matches) right.appendChild(cta); else home.parentNode.insertBefore(cta,home.nextSibling); }
      if(mq.addEventListener) mq.addEventListener('change',place); else if(mq.addListener) mq.addListener(place);
      place();
    })();
} catch (err) {
    console.warn('[psbs] section 19 failed:', err);
}

/* ===== 20. Image fallbacks ===== */
try {
    /* If an image file can't be loaded (e.g. the HTML was opened alone from a file manager, so logo.png / school.jpg / principal.jpg
       aren't next to it), swap in a tidy placeholder instead of showing broken-image alt text. Working images are never touched. */
    (function(){
      function svg(inner,vb){ return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+vb+'">'+inner+'</svg>'); }
      var LOGO=svg('<circle cx="100" cy="100" r="96" fill="#fff"/><circle cx="100" cy="100" r="88" fill="#c0272d"/><circle cx="100" cy="100" r="70" fill="#fff"/><path d="M100 48l44 76H56z" fill="none" stroke="#1b7a3a" stroke-width="6"/><path d="M100 152l-44-76h88z" fill="none" stroke="#1b7a3a" stroke-width="6"/><text x="100" y="112" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="34" fill="#c0272d">PSBS</text>','0 0 200 200');
      var CAMPUS=svg('<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdebc8"/><stop offset="1" stop-color="#f6c76b"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><rect x="170" y="150" width="260" height="170" rx="6" fill="#fff" opacity=".9"/><rect x="150" y="130" width="300" height="30" rx="6" fill="#d68910"/><rect x="270" y="220" width="60" height="100" fill="#d68910" opacity=".8"/><rect x="195" y="190" width="48" height="48" rx="4" fill="#f6c76b"/><rect x="357" y="190" width="48" height="48" rx="4" fill="#f6c76b"/>','0 0 600 400');
      var PERSON=svg('<rect width="150" height="150" fill="#fdebc8"/><circle cx="75" cy="58" r="26" fill="#d68910" opacity=".85"/><path d="M24 150c4-34 26-52 51-52s47 18 51 52z" fill="#d68910" opacity=".85"/>','0 0 150 150');
      function pick(img){
        var a=(img.getAttribute('alt')||'').toLowerCase(), c=img.className||'';
        if(/logo/.test(a)||/logo/.test(c)||a==='') return LOGO;
        if(/campus|school/.test(a)) return CAMPUS;
        if(/principal|teacher|faculty|staff/.test(a)) return PERSON;
        return CAMPUS;
      }
      function fix(img){
        if(!img||img.tagName!=='IMG'||img.getAttribute('data-psbs-fb'))return;
        if((img.currentSrc||img.src||'').indexOf('data:')===0)return;
        if(!img.getAttribute('data-retry') && /\/storage\/v1\/object\/public\//.test(img.src)){ img.setAttribute('data-retry','1'); img.src=img.src.split('?')[0]+'?r='+Date.now(); return; }
        var loc=img.getAttribute('data-local');
        if(loc&&!img.getAttribute('data-local-tried')){ img.setAttribute('data-local-tried','1'); img.src=loc; return; }
        img.setAttribute('data-psbs-fb','1');
        img.removeAttribute('srcset'); img.removeAttribute('loading');
        img.src=pick(img);
      }
      document.addEventListener('error',function(e){ fix(e.target); },true);   /* image errors don't bubble, so listen in the capture phase */
      function sweep(){ var l=document.images; for(var i=0;i<l.length;i++){ if(l[i].complete&&l[i].naturalWidth===0&&l[i].getAttribute('src')) fix(l[i]); } }
      window.addEventListener('load',sweep); setTimeout(sweep,1500);
    })();
} catch (err) {
    console.warn('[psbs] section 20 failed:', err);
}

/* ===== 21. Smooth reveal ===== */
try {
    (function () {
      if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal').forEach(function (el) {
          el.classList.add('is-visible');
        });
        return;
      }
      var revealItems = document.querySelectorAll('.reveal:not(.is-visible)');
      if (!revealItems.length) return;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
      revealItems.forEach(function (el) { observer.observe(el); });
    })();
} catch (err) {
    console.warn('[psbs] section 21 failed:', err);
}

/* ===== 22. Edit-name modal: live avatar preview + counter ===== */
try {
    (function () {
      var modal = document.getElementById('editNameModal'), input = document.getElementById('editNameInput');
      var av = document.getElementById('enAvatar'), cnt = document.getElementById('enCount');
      if (!modal || !input || !av) return;
      function paint() {
        var v = input.value.trim(), p = Profile.get() || {};
        cnt.textContent = input.value.length + '/50';
        if (p.avatar) { av.style.backgroundImage = 'url(' + p.avatar + ')'; av.textContent = ''; }
        else {
          av.style.backgroundImage = '';
          av.textContent = Helpers.initials(v || p.name || 'Guest');
          av.style.background = v ? Helpers.colorFromName(v) : '';
        }
      }
      input.addEventListener('input', function () {
        paint(); av.classList.add('pop'); setTimeout(function () { av.classList.remove('pop'); }, 160);
      });
      new MutationObserver(function () { if (modal.classList.contains('active')) setTimeout(paint, 0); })
        .observe(modal, { attributes: true, attributeFilter: ['class'] });
    })();
} catch (err) {
    console.warn('[psbs] section 22 failed:', err);
}

/* ===== 23. In-menu profile popover ===== */
try {
    (function () {
      var $ = function (i) { return document.getElementById(i); };
      var card = $('sbProfileCard'), menu = $('sbProfileMenu'), sb = document.querySelector('.sidebar');
      if (!card || !menu || !sb) return;
      function fill() {
        var a = $('sbpAvatar'), src = $('sbAvatar'), p = (typeof Profile !== 'undefined' && Profile.get()) || {};
        $('sbpName').textContent = ($('sbName') || {}).textContent || 'Guest';
        $('sbpRole').textContent = ($('sbRole') || {}).textContent || 'Viewer';
        if (p.avatar) { a.style.backgroundImage = 'url(' + p.avatar + ')'; a.textContent = ''; }
        else { a.style.backgroundImage = ''; a.textContent = src ? src.textContent : 'G'; }
      }
      var menuCloseTimer = null;
      function open() {
        if (menuCloseTimer) { clearTimeout(menuCloseTimer); menuCloseTimer = null; }
        fill(); menu.hidden = false; menu.classList.remove('is-leaving');
        menu.classList.remove('is-entering'); void menu.offsetWidth; menu.classList.add('is-entering');
        card.setAttribute('aria-expanded', 'true');
        setTimeout(function () { menu.classList.remove('is-entering'); }, 650);
        setTimeout(function () { document.dispatchEvent(new Event('keyup')); }, 0);
        setTimeout(function () { if (isOpen()) menu.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30);
      }
      function close() {
        var was = !menu.hidden;
        if (!was) return;
        if (menuCloseTimer) clearTimeout(menuCloseTimer);
        menu.classList.remove('is-entering'); menu.classList.add('is-leaving');
        card.setAttribute('aria-expanded', 'false');
        menuCloseTimer = setTimeout(function () {
          menu.hidden = true; menu.classList.remove('is-leaving'); menuCloseTimer = null;
        }, 240);
        setTimeout(function () { document.dispatchEvent(new Event('keyup')); }, 0);
      }
      function isOpen() { return !menu.hidden && !menu.classList.contains('is-leaving'); }
      card.addEventListener('click', function (e) { e.stopPropagation(); isOpen() ? close() : open(); });
      var outsideTap = false, touchPending = false, blockTouchGesture = false;
      function outside(e) { return isOpen() && !menu.contains(e.target) && !card.contains(e.target); }
      // First outside gesture dismisses the popover and is blocked; a later gesture can scroll.
      document.addEventListener('pointerdown', function (e) {
        if (!isOpen()) return;
        if (e.pointerType === 'touch') { touchPending = !menu.contains(e.target) && !card.contains(e.target); return; }
        if (!outside(e)) return;
        outsideTap = true;
        setTimeout(function () { outsideTap = false; }, 700);
        e.preventDefault(); close();
      }, true);
      document.addEventListener('touchmove', function (e) {
        if (!touchPending || !isOpen()) return;
        touchPending = false;
        close();   // close first, and let the same swipe keep scrolling the menu
      }, { capture: true, passive: true });
      document.addEventListener('touchend', function (e) {
        if (touchPending && isOpen()) {
          outsideTap = true; setTimeout(function () { outsideTap = false; }, 700);
          if (e.cancelable) e.preventDefault();
          close();
        }
        touchPending = false; blockTouchGesture = false;
      }, { capture: true, passive: false });
      document.addEventListener('click', function (e) {
        if (outsideTap) {
          outsideTap = false; e.preventDefault(); e.stopImmediatePropagation(); return;
        }
        if (outside(e)) { outsideTap = true; close(); e.preventDefault(); e.stopImmediatePropagation(); }
      }, true);
      document.addEventListener('wheel', function (e) {
        if (isOpen() && !menu.contains(e.target)) close();
      }, { capture: true, passive: true });
      var sbScrollEl = sb.querySelector('.sidebar-scroll');
      if (sbScrollEl) sbScrollEl.addEventListener('scroll', function () { if (isOpen()) close(); }, { passive: true });
      window.addEventListener('blur', close);
      window.__sbPm = { isOpen: isOpen, close: close };
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } }, true);
      new MutationObserver(function () { if (!sb.classList.contains('active') && isOpen()) close(); })
        .observe(sb, { attributes: true, attributeFilter: ['class'] });
      function afterClose(fn) {
        close();
        var narrow = !window.matchMedia('(min-width:1200px)').matches;
        if (narrow) { closeSidebar(); setTimeout(fn, 260); } else fn();
      }
      menu.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pm]'); if (!b) return;
        var k = b.getAttribute('data-pm');
        if (k === 'photo') { close(); $('avatarUploader').click(); }
        else if (k === 'name') afterClose(openEditNameModal);
        else if (k === 'admin') afterClose(function () { $('ddAdminLogin').click(); });
        else if (k === 'logout') afterClose(function () { $('ddLogoutBtn').click(); });
      });
    })();
} catch (err) {
    console.warn('[psbs] section 23 failed:', err);
}
    
