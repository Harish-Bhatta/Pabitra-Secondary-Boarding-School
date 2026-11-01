    (function () {
        'use strict';

        // ---------------------------------------------------------------
        // Constants & small helpers
        // ---------------------------------------------------------------
        const YEAR_BS = 2083;      // fallback year only: every year found in `calendar_data` is loaded now
        let MONTH_COUNT = 12;      // = number of months loaded (any number of years)

        // Anything that originates in the database is escaped before it reaches innerHTML.
        const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC_MAP[c]);
        // Muhurta text may legitimately contain simple line-break / emphasis tags: escape everything,
        // then restore only those bare, attribute-free tags.
        const safeRich = s => esc(s).replace(/&lt;(\/?)(br|b|strong|i|em)\s*\/?&gt;/gi,
            (m, slash, tag) => tag.toLowerCase() === 'br' ? '<br>' : '<' + slash + tag.toLowerCase() + '>');

        // `new Date('2026-04-14')` is UTC midnight: that is 05:45 local in Nepal (which broke "is today inside this
        // month?" on the 1st of every month) and the previous evening for anyone west of UTC (AD day numbers were off
        // by one). Stored start dates are calendar dates, so parse them as *local* dates.
        function toLocalMidnight(v) {
            if (v == null || v === '') return null;
            if (typeof v === 'string') {
                const s = v.trim();
                let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
                if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
                // "…T00:00:00Z" is how a date-only column often serialises: its intended calendar date is the UTC one.
                m = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.0+)?(?:Z|\+00:00)$/.exec(s);
                if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
            }
            const d = v instanceof Date ? v : new Date(v);
            if (isNaN(d.getTime())) return null;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        }

        const withTimeout = (promise, ms) => {
            let t;
            const timeout = new Promise((_, reject) => { t = setTimeout(() => reject(new Error('Request timed out')), ms); });
            return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
        };

        const $id = id => document.getElementById(id);

        // ---------------------------------------------------------------
        // Toasts: reuse the portal's queued Toast so the two never fight over #toast
        // ---------------------------------------------------------------
        const CalHelpers = {
            _last: { msg: '', at: 0 },
            showToast: function (msg, type) {
                const now = Date.now();
                if (msg === this._last.msg && now - this._last.at < 2800) return; // rapid repeats (e.g. spamming "आज")
                this._last = { msg: msg, at: now };
                if (typeof Toast !== 'undefined' && Toast && typeof Toast.show === 'function') {
                    Toast.show(msg, type || 'info', 2800);
                    return;
                }
                const el = $id('toast');
                if (!el) { if ((function(){try{return localStorage.getItem('psbs_debug')==='1'}catch(e){return false}})()) console.log('[Cal]', msg); return; }
                el.className = 'toast toast-' + (type || 'info');
                el.querySelector('.toast-message').textContent = msg;
                const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
                const icon = el.querySelector('.toast-icon');
                if (icon) icon.textContent = icons[type] || icons.info;
                el.classList.add('active');
                clearTimeout(el._calT);
                el._calT = setTimeout(() => el.classList.remove('active'), 2800);
            }
        };

        // ---------------------------------------------------------------
        // Scroll lock (used while the month dropdown is open)
        // ---------------------------------------------------------------
        // The stylesheet pins `top: 0 !important` on the locked body, which silently overrode the inline negative
        // `top` the old code set. The page therefore jumped to the top and the dropdown (positioned beforehand)
        // ended up detached from its button. The offset now travels through a CSS variable the stylesheet honours.
        const ScrollLock = {
            _y: 0, _locked: false,
            // PERF: overflow:hidden on <html>/<body> keeps the scroll offset by itself, so opening/closing a card no
            // longer re-lays-out the page (body was position:fixed) and the position needs no manual restore.
            lock() {
                if (this._locked) return;
                document.documentElement.classList.add('scroll-locked');
                document.body.classList.add('body-scroll-locked');
                this._locked = true;
            },
            unlock() {
                if (!this._locked) return;
                document.documentElement.classList.remove('scroll-locked');
                document.body.classList.remove('body-scroll-locked');
                this._locked = false;
            },
            isLocked() { return this._locked; }
        };
        // Marks "a sheet is opening/closing": history bookkeeping waits until the slide has finished.
        let sheetToggledAt = 0;
        window.PSBSSheetBusy = function () { return performance.now() - sheetToggledAt < 700; };

        // ---------------------------------------------------------------
        // State
        // ---------------------------------------------------------------
        let MONTHS = [];
        let currentMonthIdx = 3;
        let selectedMonthIdx = -1;
        let selectedDayBS = -1;
        let TODAY = { monthIdx: 3, dayBS: 8, yearBS: YEAR_BS };
        let isAnimatingSwipe = false;
        let calendarReady = false;
        let builtMonthIdx = -1, builtData = null;   // which month/data the carousel DOM currently shows

        const nepaliNumbers = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
        const toNepaliDigits = n => n.toString().split('').map(d => nepaliNumbers[d] || d).join('');
        const dayHeaders = [
            { bs: "आइत", en: "SUN" }, { bs: "सोम", en: "MON" }, { bs: "मंगल", en: "TUE" },
            { bs: "बुध", en: "WED" }, { bs: "विही", en: "THU" }, { bs: "शुक्र", en: "FRI" }, { bs: "शनि", en: "SAT" }
        ];
        const dayNamesFullBS = ["आइतबार", "सोमबार", "मङ्गलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];
        const monthNamesBS = ["वैशाख", "जेठ", "असार", "श्रावण", "भदौ", "असोज", "कार्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत्र"];

        // Frequently used elements (the script runs after the markup, so they exist)
        const quoteEl = $id('quoteText');
        const detailPanelEl = $id('detailPanel');
        const programsCardEl = document.querySelector('.programs-card');
        const daysDiffEl = $id('daysDiffText');
        const clockEl = $id('clockDisplay');

        // Month helpers (AD day numbers are computed once per month instead of per cell render)
        function finishMonth(md) {
            md.adDays = [];
            if (md.adStartDate) {
                const y = md.adStartDate.getFullYear(), mo = md.adStartDate.getMonth(), d0 = md.adStartDate.getDate();
                for (let i = 0; i < md.daysCount; i++) md.adDays.push(new Date(y, mo, d0 + i).getDate());
            }
            md.progByDay = {};
            md.programs.forEach(p => { if (!(p.day in md.progByDay)) md.progByDay[p.day] = p; });
            return md;
        }
        const adDay = (m, d) => (m.adDays[d - 1] == null ? '' : m.adDays[d - 1]);
        const adDateOf = (m, d) => m.adStartDate
            ? new Date(m.adStartDate.getFullYear(), m.adStartDate.getMonth(), m.adStartDate.getDate() + d - 1) : null;

        function calculateTodayBS() {
            if (!MONTHS || MONTHS.length === 0) return;
            const now = new Date();
            const todayAD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            for (let m = 0; m < MONTH_COUNT; m++) {
                if (!MONTHS[m].adStartDate) continue;
                const offset = Math.round((todayAD - MONTHS[m].adStartDate) / 86400000);
                if (offset >= 0 && offset < MONTHS[m].daysCount) {
                    TODAY = { monthIdx: m, dayBS: offset + 1, yearBS: MONTHS[m].yearBS };
                    return;
                }
            }
            // Today lies outside the loaded year: clamp to the nearest edge (was a hard-coded Shrawan 8).
            const first = MONTHS[0].adStartDate;
            TODAY = (first && todayAD < first)
                ? { monthIdx: 0, dayBS: 1, yearBS: MONTHS[0].yearBS }
                : { monthIdx: MONTH_COUNT - 1, dayBS: MONTHS[MONTH_COUNT - 1].daysCount, yearBS: MONTHS[MONTH_COUNT - 1].yearBS };
        }

        // ---------------------------------------------------------------
        // Clock + "days from today" ticker (one timer, idle while the tab is hidden)
        // ---------------------------------------------------------------
        function updateClock() {
            const now = new Date();
            const p = n => String(n).padStart(2, '0');
            if (clockEl) clockEl.textContent = p(now.getHours()) + ':' + p(now.getMinutes()) + ':' + p(now.getSeconds());
        }
        let ticks = 0;
        setInterval(function () {
            if (document.hidden) return;
            updateClock();
            if (++ticks % 60 === 0) updateDaysDifference();
        }, 1000);
        updateClock();

        // ---------------------------------------------------------------
        // Month dropdown
        // ---------------------------------------------------------------
        const dropdownBtn = $id('monthDropdownBtn');
        const dropdownPortal = $id('monthDropdownPortal');
        const dropdownBackdrop = $id('dropdownBackdrop');
                let dropdownOpen = false;
        let dropdownBuiltFor = null;
        dropdownBtn.setAttribute('aria-haspopup', 'listbox');
        $id('prevMonthBtn').setAttribute('aria-label', 'Previous month');
        $id('nextMonthBtn').setAttribute('aria-label', 'Next month');

        function populateDropdownPortal(selectedIdx) {
            if (!MONTHS || MONTHS.length === 0) return;
            if (dropdownBuiltFor !== MONTHS) {            // build once per data load, not on every render
                let html = '';
                MONTHS.forEach((m, idx) => {
                    html += '<div class="month-option" data-index="' + idx + '" role="option" tabindex="-1" aria-selected="false">' +
                        '<span class="month-label">' + esc(m.nameBS) + '</span><span class="month-sub">' + esc(m.nameAD) + '</span></div>';
                });
                dropdownPortal.setAttribute('role', 'dialog'); dropdownPortal.setAttribute('aria-modal', 'true'); dropdownPortal.setAttribute('aria-label', 'महिना छान्नुहोस्');
                dropdownPortal.innerHTML =
                    '<div class="ss-grab" aria-hidden="true"></div>' +
                    '<div class="ss-head">' +
                        '<span class="ss-ico" aria-hidden="true"><i class="fa-solid fa-calendar-days"></i></span>' +
                        '<div class="ss-titles"><h2>महिना छान्नुहोस्</h2><p id="mdSub"></p></div>' +
                        '<button type="button" class="ss-close md-close" id="monthDdClose" aria-label="बन्द गर्नुहोस्" title="Close (Esc)"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
                    '</div>' +
                    '<div class="md-body" role="listbox" aria-label="महिना">' + html + '</div>';
                dropdownBuiltFor = MONTHS;
            }
            markActiveOption(selectedIdx);
            dropdownBtn.textContent = MONTHS[selectedIdx].nameBS;
        }
        function markActiveOption(idx) {
            const opts = dropdownPortal.querySelectorAll('.month-option');
            for (let i = 0; i < opts.length; i++) {
                const on = i === idx;
                opts[i].classList.toggle('active-option', on);
                opts[i].classList.toggle('is-now', !!(TODAY && TODAY.monthIdx === i));
                opts[i].setAttribute('aria-selected', on ? 'true' : 'false');
            }
            const sub = $id('mdSub');
            if (sub && MONTHS[idx]) sub.textContent = 'वि.सं. ' + toNepaliDigits(MONTHS[idx].yearBS) + ' · ' + MONTHS[idx].nameBS + ' (' + MONTHS[idx].nameAD + ')';
        }
        // One delegated listener instead of one per option per render
        dropdownPortal.addEventListener('click', function (e) {
            const opt = e.target.closest('.month-option');
            if (!opt) return;
            const idx = parseInt(opt.getAttribute('data-index'), 10);
            if (isNaN(idx)) return;
            changeMonth(idx); closeDropdown();
        });
        dropdownPortal.addEventListener('keydown', function (e) {
            const opts = Array.prototype.slice.call(dropdownPortal.querySelectorAll('.month-option'));
            const i = opts.indexOf(document.activeElement);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const n = opts.length; if (!n) return;
                const step = e.key === 'ArrowDown' ? 3 : e.key === 'ArrowUp' ? -3 : e.key === 'ArrowRight' ? 1 : -1;
                opts[Math.max(0, Math.min(n - 1, (i < 0 ? 0 : i + step)))].focus({ preventScroll: true });
            } else if ((e.key === 'Enter' || e.key === ' ') && i > -1) {
                e.preventDefault();
                const idx = parseInt(opts[i].getAttribute('data-index'), 10);
                changeMonth(idx); closeDropdown(true);
            }
        });

        function placeDropdown(rect) {
            // Centered in the viewport, independent of the button position
            const vw = window.innerWidth, vh = window.innerHeight;
            const width = Math.min(380, vw - 20);
            const height = Math.min(520, vh - 20);
            dropdownPortal.style.left = Math.round((vw - width) / 2) + 'px';
            dropdownPortal.style.top = Math.round((vh - height) / 2) + 'px';
            dropdownPortal.style.width = width + 'px';
            dropdownPortal.style.maxHeight = height + 'px';
        }
        function openDropdown() {
            if (dropdownOpen || !MONTHS.length) return;
            dropdownOpen = true; sheetToggledAt = performance.now();
            if (dropdownCleanTimer) { clearTimeout(dropdownCleanTimer); dropdownCleanTimer = 0; }
            dropdownPortal.style.transform = ''; dropdownPortal.style.transition = ''; dropdownPortal.style.visibility = '';
            placeDropdown();                                      // viewport-centred: needs no element measurement (was a wasted forced layout)
            dropdownBackdrop.classList.add('show');
            dropdownPortal.classList.add('open');
            dropdownBtn.setAttribute('aria-expanded', 'true');
            ScrollLock.lock(); document.body.classList.add('sheet-open');
            markActiveOption(currentMonthIdx);
            const active = dropdownPortal.querySelector('.month-option.active-option');
            if (active) active.focus({ preventScroll: true });
        }
        var dropdownCleanTimer = 0;
        function closeDropdown(restoreFocus, swiped) {
            if (!dropdownOpen) return;
            dropdownOpen = false; sheetToggledAt = performance.now();
            const hadFocusInside = dropdownPortal.contains(document.activeElement);
            dropdownBackdrop.classList.remove('show');
            if (swiped === true) {
                /* The card is already off-screen from the swipe: keep it hidden and where it is
                   (no snap back to the closed pose = no blink), reset the inline styles afterwards. */
                dropdownPortal.style.transition = 'none';
                dropdownPortal.style.visibility = 'hidden';
                dropdownPortal.classList.remove('open');
                dropdownCleanTimer = setTimeout(function () {
                    dropdownCleanTimer = 0;
                    if (dropdownOpen) return;
                    dropdownPortal.style.transform = ''; dropdownPortal.style.transition = ''; dropdownPortal.style.visibility = '';
                }, 420);
            } else {
                dropdownPortal.classList.remove('open');
                dropdownPortal.style.transform = ''; dropdownPortal.style.transition = '';
            }
            dropdownBtn.setAttribute('aria-expanded', 'false');
            ScrollLock.unlock(); document.body.classList.remove('sheet-open');
            if (restoreFocus === true || hadFocusInside) dropdownBtn.focus({ preventScroll: true });
        }
        window.PSBSCalendarCloseDropdown = function () { closeDropdown(); };
        window.PSBSCalendarDropdownOpen = function () { return dropdownOpen; };
        dropdownPortal.addEventListener('click', function (e) {
            if (e.target.closest('.md-close')) { e.stopPropagation(); closeDropdown(true); }
        });
        // Swipe down to close (works from the header/handle any time, and from the list once it is scrolled to the top)
        (function () {
            const bodyEl = function () { return dropdownPortal.querySelector('.md-body'); };
            let sy = 0, sx = 0, dy = 0, on = false, decided = false, fromBody = false, raf = 0;
            function paint() { raf = 0; if (on) dropdownPortal.style.transform = 'translate3d(0,' + dy + 'px,0)'; }
            dropdownPortal.addEventListener('touchstart', function (e) {
                if (!dropdownOpen || !e.touches || e.touches.length !== 1) return;
                sy = e.touches[0].clientY; sx = e.touches[0].clientX; dy = 0; on = false; decided = false;
                fromBody = !!(e.target.closest && e.target.closest('.md-body'));
            }, { passive: true });
            dropdownPortal.addEventListener('touchmove', function (e) {
                if (!dropdownOpen || !e.touches || !e.touches.length) return;
                const ty = e.touches[0].clientY - sy, tx = e.touches[0].clientX - sx;
                if (!decided) {
                    if (Math.abs(ty) < 6 && Math.abs(tx) < 6) return;
                    decided = true;
                    const b = bodyEl();
                    on = ty > 0 && Math.abs(ty) > Math.abs(tx) && (!fromBody || !b || b.scrollTop <= 0);
                    if (on) dropdownPortal.style.transition = 'none';
                }
                if (!on) return;
                dy = Math.max(0, ty);
                if (e.cancelable) e.preventDefault();
                if (!raf) raf = requestAnimationFrame(paint);
            }, { passive: false });
            function end() {
                if (!on) { decided = false; return; }
                on = false; decided = false;
                if (raf) { cancelAnimationFrame(raf); raf = 0; }
                if (dy > 80) {
                    dropdownPortal.style.transition = 'transform .2s ease';
                    dropdownPortal.style.transform = 'translate3d(0,110%,0)';
                    setTimeout(function () { closeDropdown(true, true); }, 200);
                } else {
                    dropdownPortal.style.transition = 'transform .25s var(--spring)';
                    dropdownPortal.style.transform = '';
                }
            }
            dropdownPortal.addEventListener('touchend', end);
            dropdownPortal.addEventListener('touchcancel', end);
        })();

        dropdownBtn.addEventListener('click', function (e) { e.stopPropagation(); dropdownOpen ? closeDropdown() : openDropdown(); });
        dropdownBackdrop.addEventListener('click', function (e) { e.stopPropagation(); closeDropdown(); });
        document.addEventListener('keydown', function (e) {
            if (!dropdownOpen) return;
            // Esc, Ctrl + Left Arrow, Ctrl + Backspace all close the month list
            if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowLeft' || e.key === 'Backspace'))) {
                e.preventDefault(); closeDropdown(true);
            }
        });
        let resizeTimer;
        window.addEventListener('resize', function () {
            if (!dropdownOpen) return;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (dropdownOpen) placeDropdown();
            }, 150);
        }, { passive: true });

        // ---------------------------------------------------------------
        // Search data for the portal's search overlay (cached per data load)
        // ---------------------------------------------------------------
        const SEARCH_ALIASES = {
            'कृष्ण जन्माष्टमी': 'krishna janmashtami janmashtami कृष्ण जन्माष्टमी',
            'जन्माष्टमी': 'krishna janmashtami janmashtami जन्माष्टमी',
            'दशैं': 'dashain दशैं dasain',
            'दशैँ': 'dashain दशैं dasain',
            'तिहार': 'tihar दीपावली diwali festival तिहार',
            'दीपावली': 'diwali tihar दीपावली तिहार',
            'नाग पञ्चमी': 'nag panchami naga panchami नाग पञ्चमी नाग पंचमी',
            'नाग पंचमी': 'nag panchami naga panchami नाग पञ्चमी नाग पंचमी',
            'होली': 'holi होली फागु',
            'शिवरात्रि': 'shivaratri maha shivaratri शिवरात्रि महाशिवरात्रि',
            'राम नवमी': 'ram navami राम नवमी',
            'बुद्ध जयन्ती': 'buddha jayanti बुद्ध जयन्ती बुद्ध पूर्णिमा',
            'गाईजात्रा': 'gaijatra gai jatra गाईजात्रा',
            'इन्द्रजात्रा': 'indra jatra indrajatra इन्द्रजात्रा',
            'तीज': 'teej हरितालिका तीज',
            'जनै पूर्णिमा': 'janai purnima raksha bandhan जनै पूर्णिमा रक्षा बन्धन',
            'माघे सङ्क्रान्ति': 'maghe sankranti maghi माघे सङ्क्रान्ति',
            'सरस्वती पूजा': 'saraswati puja basanta panchami सरस्वती पूजा',
            'फागु पूर्णिमा': 'holi fagu purnima फागु पूर्णिमा होली',
            'valentine': 'valentine day valentines day भ्यालेन्टाइन',
            'chocolate day': 'chocolate day चकलेट डे',
            'rose day': 'rose day रोज डे',
            'friendship day': 'friendship day मित्रता दिवस',
            "mother's day": 'mothers day mother day मातातीर्थ औंसी आमाको मुख हेर्ने दिन',
            "father's day": 'fathers day father day बुबाको मुख हेर्ने दिन',
            'new year': 'new year नयाँ वर्ष नव वर्ष',
            'christmas': 'christmas क्रिसमस',
            'eid': 'eid ईद',
            'republic day': 'republic day गणतन्त्र दिवस',
            'constitution day': 'constitution day संविधान दिवस'
        };
        // The old matcher tested every *word* of every alias as a substring of the title, so "day" (from "rose day",
        // "valentine day"…) tagged unrelated titles such as "Republic Day", and "holi" matched "Holiday". Aliases are now
        // matched on the phrase itself or on whole, non-generic words.
        const GENERIC_WORDS = new Set(['day', 'डे', 'new', 'year', 'festival', 'puja', 'पूजा', 'purnima', 'पूर्णिमा', 'jatra',
            'जात्रा', 'jayanti', 'जयन्ती', 'mother', 'mothers', 'father', 'fathers', 'special', 'event', 'the', 'of', 'and']);
        const tokenize = s => String(s || '').toLowerCase().split(/[\s/,.\-–—()'’"]+/).filter(Boolean);
        const ALIAS_INDEX = Object.keys(SEARCH_ALIASES).map(key => ({
            key: key.toLowerCase(), value: SEARCH_ALIASES[key],
            words: tokenize(SEARCH_ALIASES[key]).filter(w => w.length > 1 && !GENERIC_WORDS.has(w))
        }));
        function getAliases(title) {
            const t = String(title || '').toLowerCase().trim();
            const tokens = new Set(tokenize(t));
            let out = '';
            ALIAS_INDEX.forEach(function (a) {
                if (t.indexOf(a.key) !== -1 || a.words.some(w => tokens.has(w))) out += ' ' + a.value;
            });
            return out;
        }

        let searchCache = null, searchCacheFor = null;
        window.PSBSCalendarSearchData = function () {
            if (!MONTHS || !MONTHS.length) return [];
            if (searchCache && searchCacheFor === MONTHS) return searchCache;
            const data = [];
            MONTHS.forEach(function (m, mi) {
                const monthLabel = (m.nameBS || '') + ' ' + (m.nameAD || '');
                Object.keys(m.events || {}).forEach(function (day) {
                    const ev = m.events[day];
                    if (!ev || !ev.title) return;
                    const title = String(ev.title);
                    const typeWords = ev.isHoliday
                        ? 'festival holiday पर्व बिदा छुट्टी उत्सव'
                        : 'event special day कार्यक्रम घटना';
                    const item = {
                        id: 'calendar-event-' + mi + '-' + day,
                        title: title,
                        desc: monthLabel + ' · ' + toNepaliDigits(day) + ' गते · ' + (ev.isHoliday ? 'Festival / पर्व' : 'Event / कार्यक्रम'),
                        icon: ev.isHoliday ? '🎉' : '📌',
                        calendarMonth: mi,
                        calendarDay: Number(day),
                        searchType: ev.isHoliday ? 'festival' : 'event',
                        searchText: [title, monthLabel, day, typeWords, getAliases(title)].join(' ')
                    };
                    item._hay = [item.title, item.desc, item.id, item.searchType, item.searchText].join(' ').toLowerCase();
                    data.push(item);
                });
            });
            searchCache = data; searchCacheFor = MONTHS;
            return data;
        };

        // ---------------------------------------------------------------
        // Carousel
        // ---------------------------------------------------------------
        const gridBox = $id('gridSwipeContainer');
        const track = $id('monthTrack');
        const dotsEl = $id('monthDots');
        const EASE = 'cubic-bezier(.22,1,.36,1)';
        let W = 0, STEP = 0, H = [0, 0, 0], curX = 0, drag = null, raf = 0, settling = null, clickBlock = 0;
        let dotsBuiltFor = null;

        function setX(x) { curX = x; track.style.transform = 'translate3d(' + x + 'px,0,0)'; }
        // Measurements are cached: `measured` is cleared whenever the DOM or size changes, and nothing re-measures during a drag.
        let measured = false, GAP = 0, gapW = -1, HMAX = 0, lastW = -1;
        function measure() {
            W = gridBox.clientWidth;
            if (W !== gapW) { GAP = parseFloat(getComputedStyle(track).getPropertyValue('--swipe-gap')) || 0; gapW = W; }   // style read only when the width (breakpoint) changed
            STEP = W + GAP;
            if (W !== lastW) { HMAX = 0; lastW = W; }
            for (let i = 0; i < 3; i++) { H[i] = track.children[i] ? track.children[i].offsetHeight : 0; if (H[i] > HMAX) HMAX = H[i]; }
            measured = true;
        }
        let paneRO = null;
        // One layout read per render, AFTER every DOM write of that render (it used to sit in the middle, forcing a second layout).
        function layoutPanes() {
            measure(); setX(-STEP); fitTo(1);
            if (paneRO) { paneRO.disconnect(); paneRO.observe(track); for (let i = 0; i < track.children.length; i++) paneRO.observe(track.children[i]); }
        }
        // Height only ever grows to the tallest pane seen at this width (panes are equal now, so in practice it is set once).
        function fitTo(i) { const h = Math.max(HMAX, H[i] || H[1] || 0); if (h) gridBox.style.height = h + 'px'; }

        const SPACER = '<div class="calendar-cell empty spacer" aria-hidden="true"></div>';
        function paneHTML(mi, interactive) {
            if (mi < 0 || mi >= MONTH_COUNT) return '';
            const md = MONTHS[mi], pi = mi - 1, ni = mi + 1, pm = MONTHS[pi], nm = MONTHS[ni];
            const ghost = (m, idx, d) =>
                '<div class="calendar-cell empty ghost" data-m="' + idx + '" data-d="' + d + '"><div class="cell-top"><span class="bs-day">' +
                toNepaliDigits(d) + '</span><span class="ad-day">' + adDay(m, d) + '</span></div><div class="tithi-text">' + esc(m.tithis[d - 1] || '') +
                '</div><div class="indicator-dots"></div></div>';
            const blank = '<div class="calendar-cell empty" style="pointer-events:none"></div>';
            let h = '<div class="month-header-details"><div class="month-title-bs">' + esc(md.nameBS) + '</div><div class="month-title-ad">' + esc(md.nameAD) + '</div></div><div class="calendar-grid">';
            dayHeaders.forEach((dh, i) => { h += '<div class="day-header' + (i === 0 || i === 6 ? ' saturday' : '') + '">' + dh.bs + '<span>' + dh.en + '</span></div>'; });
            const se = md.startDayOfWeek;
            for (let i = 0; i < se; i++) h += mi === 0 ? blank : ghost(pm, pi, pm.daysCount - se + i + 1);
            for (let d = 1; d <= md.daysCount; d++) {
                const info = getDateInfo(mi, d), ev = md.events[d];
                const prog = md.progByDay[d] !== undefined;
                const isToday = mi === TODAY.monthIdx && d === TODAY.dayBS;
                const isSel = selectedMonthIdx === mi && selectedDayBS === d;
                const cls = 'calendar-cell' + (info.isHoliday ? ' holiday' : '') + (isToday ? ' today' : '') + (isSel ? ' selected' : '');
                // Keyboard access: cells of the visible month are buttons with a single roving tab stop (the selected cell)
                const a11y = interactive ? ' role="button" tabindex="' + (isSel ? '0' : '-1') + '"' + (isToday ? ' aria-current="date"' : '') : '';
                const dots = (info.isHoliday ? '<span class="dot dot-holiday"></span>' : '') + (prog ? '<span class="dot dot-program"></span>' : '') + ((ev && !ev.isHoliday && !info.isSunOrSat) ? '<span class="dot dot-event"></span>' : '');
                h += '<div class="' + cls + '" data-m="' + mi + '" data-d="' + d + '"' + a11y + '><div class="cell-top"><span class="bs-day">' + toNepaliDigits(d) + '</span><span class="ad-day">' + adDay(md, d) + '</span></div><div class="tithi-text">' + esc(md.tithis[d - 1] || '') + '</div><div class="indicator-dots">' + dots + '</div></div>';
            }
            const rem = (se + md.daysCount) % 7, ee = rem ? 7 - rem : 0;
            for (let i = 0; i < ee; i++) h += mi === MONTH_COUNT - 1 ? blank : ghost(nm, ni, i + 1);
            // PERF / no layout shift: months have 4-6 week rows. Padding every pane to 6 rows with invisible spacers makes all
            // panes the same height, so the grid box never animates its height (that was a layout pass on every frame of
            // every month change) and nothing below the calendar jumps when you move between a 5- and a 6-row month.
            for (let c = se + md.daysCount + ee; c < 42; c++) h += SPACER;
            return h + '</div>';
        }

        // After a one-month swipe two of the three panes are already in the DOM: rotate them and build only the one new
        // pane, instead of rebuilding ~100 cells at the exact moment the swipe lands (that was the hitch).
        let fastDir = 0, panesFor = null;
        function paneSection(i, c) { return '<section class="month-pane" data-mi="' + i + '" aria-hidden="' + (i !== c) + '">' + paneHTML(i, i === c) + '</section>'; }
        function setPaneInteractive(pane, on) {
            const cells = pane.querySelectorAll('.calendar-cell:not(.empty)');
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                if (on) {
                    cell.setAttribute('role', 'button');
                    cell.setAttribute('tabindex', cell.classList.contains('selected') ? '0' : '-1');
                    if (cell.classList.contains('today')) cell.setAttribute('aria-current', 'date');
                } else { cell.removeAttribute('role'); cell.removeAttribute('tabindex'); cell.removeAttribute('aria-current'); }
            }
        }
        function rotatePanes(dir, c) {
            const kids = track.children, oldC = kids[1], newC = kids[1 + dir];
            const sel = oldC.querySelectorAll('.calendar-cell.selected');
            for (let i = 0; i < sel.length; i++) sel[i].classList.remove('selected');
            setPaneInteractive(oldC, false);
            const fresh = document.createElement('section');
            fresh.className = 'month-pane'; fresh.setAttribute('data-mi', String(c + dir)); fresh.setAttribute('aria-hidden', 'true');
            fresh.innerHTML = paneHTML(c + dir, false);
            if (dir > 0) { track.removeChild(kids[0]); track.appendChild(fresh); }
            else { track.removeChild(kids[2]); track.insertBefore(fresh, track.firstChild); }
            const cell = newC.querySelector('.calendar-cell[data-m="' + c + '"][data-d="' + selectedDayBS + '"]:not(.ghost)');
            if (cell) cell.classList.add('selected');
            setPaneInteractive(newC, true);
            for (let i = 0; i < track.children.length; i++) {
                const pn = track.children[i];
                pn.style.opacity = ''; pn.setAttribute('aria-hidden', String(pn !== newC));
            }
        }
        function buildPanes() {
            const c = currentMonthIdx;
            track.style.transition = 'none'; gridBox.style.transition = 'none';
            const dir = fastDir; fastDir = 0;
            const kids = track.children;
            if (dir && panesFor === MONTHS && kids.length === 3 && selectedMonthIdx === c &&
                kids[1].getAttribute('data-mi') === String(c - dir) && kids[1 + dir].getAttribute('data-mi') === String(c)) {
                rotatePanes(dir, c);
            } else {
                track.innerHTML = [c - 1, c, c + 1].map(i => paneSection(i, c)).join('');
                panesFor = MONTHS;
            }
            measured = false;                               // layout is read once, at the end of renderCalendar (layoutPanes)
            if (dotsBuiltFor !== MONTHS) {                 // dots only change when the data does
                dotsEl.innerHTML = MONTHS.map((m, i) => '<button class="mdot" role="tab" data-i="' + i + '" aria-label="' + esc(m.nameBS) + '"></button>').join('');
                dotsBuiltFor = MONTHS;
            }
            const dots = dotsEl.children;
            for (let i = 0; i < dots.length; i++) {
                dots[i].classList.toggle('on', i === c);
                dots[i].setAttribute('aria-selected', i === c ? 'true' : 'false');
            }
        }
        // PERF: the old popIn removed a class, read offsetWidth (a forced synchronous layout, twice per tap) and re-added
        // it to restart a CSS animation. Element.animate() restarts without touching layout and only moves opacity/transform.
        const REDUCED = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
        function popIn(el) {
            if (!el || !el.animate || (REDUCED && REDUCED.matches)) return;
            if (el._pop) el._pop.cancel();
            el._pop = el.animate([{ opacity: .6, transform: 'translate3d(0,6px,0)' }, { opacity: 1, transform: 'none' }],
                                 { duration: 170, easing: 'cubic-bezier(.22,1,.36,1)' });
        }

        function selectedCellEl() {
            const pane = track.children[1];
            return pane ? pane.querySelector('.calendar-cell.selected') : null;
        }

        // Full (re)render of the carousel for a month
        function renderCalendar(monthIdx) {
            if (!MONTHS || MONTHS.length === 0) return;
            const hadFocus = gridBox.contains(document.activeElement);   // don't drop keyboard focus when the DOM is rebuilt
            currentMonthIdx = monthIdx;
            const md = MONTHS[monthIdx];
            quoteEl.innerText = md.quote;
            dropdownBtn.textContent = md.nameBS;
            buildPanes();
            renderPrograms(md);
            populateDropdownPortal(monthIdx);
            updateDaysDifference();
            popIn(detailPanelEl);
            popIn(programsCardEl);
            layoutPanes();
            builtMonthIdx = monthIdx; builtData = MONTHS;
            if (hadFocus) { const c = selectedCellEl(); if (c) c.focus({ preventScroll: true }); }
        }

        // While the finger is down the ONLY thing that changes is the track's transform (compositor-only):
        // no layout, no opacity, no height work per frame.
        function follow(dx) { setX(-STEP + dx); }
        function applyDrag() { raf = 0; if (drag && drag.on) follow(drag.dx); }   // rAF-batched: one write per frame however many events arrive
        function settle(dir, vx, day) {
            if (settling) return;
            const target = -STEP - dir * STEP, dist = Math.abs(target - curX);
            const dur = Math.round(Math.max(190, Math.min(340, dist / Math.max(Math.abs(vx || 0), 1.1))));
            isAnimatingSwipe = true;
            settling = { dir, day, t: setTimeout(finalize, dur + 70) };
            track.style.transition = 'transform ' + dur + 'ms ' + EASE;
            gridBox.style.transition = 'height ' + dur + 'ms ' + EASE;
            setX(target); fitTo(dir > 0 ? 2 : dir < 0 ? 0 : 1);
        }
        function finalize() {
            const s = settling; if (!s) return;
            settling = null; clearTimeout(s.t);
            track.style.transition = 'none'; gridBox.style.transition = 'none';
            if (s.dir) {
                const ni = currentMonthIdx + s.dir;
                fastDir = s.dir;
                // applySelection (not selectDate): a scroll-lock must never leave a finished swipe half-applied
                applySelection(ni, s.day || (ni === TODAY.monthIdx ? TODAY.dayBS : 1));
            } else { setX(-STEP); fitTo(1); for (let i = 0; i < track.children.length; i++) track.children[i].style.opacity = ''; }
            isAnimatingSwipe = false;
        }
        track.addEventListener('transitionend', e => { if (e.target === track && e.propertyName === 'transform') finalize(); });

        function goToMonth(newIdx, day) {
            if (!MONTHS.length || newIdx < 0 || newIdx >= MONTH_COUNT) return;
            if (settling) finalize();                          // land any in-flight swipe so currentMonthIdx is up to date
            if (newIdx === currentMonthIdx) {
                // Same month: still honour an explicit day (e.g. a search hit inside the month on screen)
                if (day && day !== selectedDayBS) { closeDropdown(); applySelection(newIdx, day); }
                return;
            }
            if (drag && drag.on) return;                       // a real drag is in progress
            drag = null;                                       // …but a stale, never-started press must not freeze navigation
            closeDropdown();
            if (!measured) measure();
            const diff = newIdx - currentMonthIdx;
            if (Math.abs(diff) === 1) { settle(diff, 0, day); return; }
            isAnimatingSwipe = true;
            track.style.transition = 'none';
            gridBox.style.transition = 'height .28s ' + EASE;
            applySelection(newIdx, day || (newIdx === TODAY.monthIdx ? TODAY.dayBS : 1));
            requestAnimationFrame(function () {
                gridBox.style.transition = 'none';
                isAnimatingSwipe = false;
            });
        }
        // Relative navigation must be resolved *after* any pending swipe lands, otherwise a quick second tap on
        // "next" computed the same target as the first and was swallowed.
        function stepMonth(delta) {
            if (settling) finalize();
            goToMonth(currentMonthIdx + delta);
        }

        window.PSBSCalendarGoToMonth = goToMonth;

        gridBox.addEventListener('pointerdown', function (e) {
            if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || dropdownOpen || ScrollLock.isLocked() || !MONTHS.length) return;
            if (settling) finalize();
            if (!measured) measure();
            drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, lt: e.timeStamp, vx: 0, dx: 0, on: false };
        });
        gridBox.addEventListener('pointermove', function (e) {
            if (!drag || e.pointerId !== drag.id) return;
            const mx = e.clientX - drag.x0, my = e.clientY - drag.y0;
            if (!drag.on) {
                if (Math.abs(mx) < 4 && Math.abs(my) < 4) return;
                if (Math.abs(my) > Math.abs(mx) * 1.35) { drag = null; return; }
                drag.on = true; drag.x0 = e.clientX; drag.lx = e.clientX; drag.lt = e.timeStamp;
                try { gridBox.setPointerCapture(e.pointerId); } catch (_) { }
                document.body.classList.add('is-dragging');
                track.style.transition = 'none';
                // If a neighbouring month is taller, grow the box once (short transition) so nothing is clipped,
                // then the drag itself never touches layout again.
                let mh = H[1];
                if (currentMonthIdx > 0 && H[0] > mh) mh = H[0];
                if (currentMonthIdx < MONTH_COUNT - 1 && H[2] > mh) mh = H[2];
                if (mh > H[1]) { gridBox.style.transition = 'height .16s ease-out'; gridBox.style.height = mh + 'px'; }
                else gridBox.style.transition = 'none';
                return;
            }
            const dt = e.timeStamp - drag.lt;
            if (dt > 0) drag.vx = drag.vx * 0.6 + ((e.clientX - drag.lx) / dt) * 0.4;
            drag.lx = e.clientX; drag.lt = e.timeStamp;
            const dx = e.clientX - drag.x0;
            const edge = (dx > 0 && currentMonthIdx === 0) || (dx < 0 && currentMonthIdx === MONTH_COUNT - 1);
            drag.dx = edge ? dx * 0.3 : Math.max(-STEP, Math.min(STEP, dx));
            if (!raf) raf = requestAnimationFrame(applyDrag);  // handler stays tiny: math + one scheduled transform write
        });
        function endDrag(e) {
            if (!drag || e.pointerId !== drag.id) return;
            const d = drag; drag = null;
            if (raf) { cancelAnimationFrame(raf); raf = 0; if (d.on) setX(-STEP + d.dx); }   // flush the last pending frame so the settle starts from the finger
            document.body.classList.remove('is-dragging');
            if (!d.on) return;
            clickBlock = performance.now() + 60;
            const dir = d.dx < 0 ? 1 : -1, ni = currentMonthIdx + dir;
            const flick = Math.abs(d.vx) > 0.3 && Math.sign(d.vx) === Math.sign(d.dx) && Math.abs(d.dx) > 10;
            if ((Math.abs(d.dx) > W * 0.18 || flick) && ni >= 0 && ni < MONTH_COUNT && e.type !== 'pointercancel') { settle(dir, d.vx); }
            else {
                if ((ni < 0 || ni >= MONTH_COUNT) && Math.abs(d.dx) > 24) CalHelpers.showToast(ni < 0 ? '📅 पहिलो महिना' : '📅 अन्तिम महिना', 'info');
                settle(0, d.vx);
            }
        }
        gridBox.addEventListener('pointerup', endDrag);
        gridBox.addEventListener('pointercancel', endDrag);
        gridBox.addEventListener('click', function (e) {
            if (performance.now() < clickBlock || isAnimatingSwipe) return;
            const cell = e.target.closest('.calendar-cell[data-m]');
            if (!cell) return;
            const m = +cell.dataset.m, d = +cell.dataset.d;
            if (m === currentMonthIdx) selectDate(m, d); else goToMonth(m, d);
        });
        gridBox.addEventListener('keydown', function (e) {
            const cell = e.target.closest && e.target.closest('.calendar-cell[data-m]');
            if (!cell || cell.classList.contains('ghost') || e.altKey || e.ctrlKey || e.metaKey) return;
            const m = +cell.dataset.m, d = +cell.dataset.d;
            let nd = null;
            if (e.key === 'Enter' || e.key === ' ') nd = d;
            else if (e.key === 'ArrowDown') nd = d + 7;
            else if (e.key === 'ArrowUp') nd = d - 7;
            if (nd == null || !MONTHS[m] || nd < 1 || nd > MONTHS[m].daysCount) return;
            e.preventDefault();
            selectDate(m, nd);
            const c = selectedCellEl(); if (c) c.focus({ preventScroll: true });
        });
        dotsEl.addEventListener('click', e => { const b = e.target.closest('.mdot'); if (b) goToMonth(+b.dataset.i); });

        // Left/Right arrows change month, but never while typing, with modifiers (Alt+← is browser "back"),
        // or while any dialog / panel / dropdown is open.
        function anyOverlayOpen() {
            const c = document.body.classList;
            return dropdownOpen || ScrollLock.isLocked() || c.contains('modal-active') || c.contains('sidebar-active') ||
                c.contains('right-panel-active') || c.contains('dropdown-active');
        }
        document.addEventListener('keydown', function (e) {
            if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            if (anyOverlayOpen()) return;
            stepMonth(e.key === 'ArrowRight' ? 1 : -1);
        });

        if (window.ResizeObserver) {
            // Observes the track AND its panes (fonts arriving late can change a row height without changing the track).
            paneRO = new ResizeObserver(function () {
                if (!MONTHS.length || track.children.length !== 3) return;
                if (drag || settling) { measured = false; return; }           // re-measure on the next press instead of mid-gesture
                const oldW = W, oldH = H[1];
                measure();
                if (W !== oldW || H[1] !== oldH) { setX(-STEP); fitTo(1); }   // skip the write when nothing moved
            });
            paneRO.observe(track);
        }

        // ---------------------------------------------------------------
        // Detail panel / programs
        // ---------------------------------------------------------------
        function updateDaysDifference() {
            if (!daysDiffEl) return;
            if (selectedMonthIdx === -1 || selectedDayBS === -1) { daysDiffEl.textContent = '—'; return; }
            const md = MONTHS[selectedMonthIdx]; if (!md) { daysDiffEl.textContent = '—'; return; }
            const selDate = adDateOf(md, selectedDayBS);
            if (!selDate) { daysDiffEl.textContent = '—'; return; }
            const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const diffDays = Math.round((selDate.getTime() - today.getTime()) / 86400000);
            daysDiffEl.textContent = diffDays === 0 ? 'आज' : (diffDays > 0 ? toNepaliDigits(diffDays) + ' दिन पछि' : toNepaliDigits(Math.abs(diffDays)) + ' दिन अगाडि');
        }

        // Per-month cache (month objects are rebuilt whenever Supabase data changes, so the cache can never go stale).
        function getDateInfo(monthIdx, dayBS) {
            const md = MONTHS && MONTHS[monthIdx];
            if (!md) return computeDateInfo(monthIdx, dayBS);
            const c = md._info || (md._info = []);
            return c[dayBS] || (c[dayBS] = computeDateInfo(monthIdx, dayBS));
        }
        function computeDateInfo(monthIdx, dayBS) {
            if (!MONTHS || MONTHS.length === 0) return { isHoliday: false, eventTitle: null, isSunOrSat: false, dayOfWeekIdx: 0 };
            const md = MONTHS[monthIdx];
            const dayOfWeekIdx = (md.startDayOfWeek + dayBS - 1) % 7;
            const eventData = md.events[dayBS];
            const isSunOrSat = (dayOfWeekIdx === 0 || dayOfWeekIdx === 6);
            // School vacation ranges below are for B.S. 2083 only, matched on the real month (not its list position).
            const bi = md.yearBS === 2083 ? md.bsIdx : -1;
            if ((bi === 5 && dayBS >= 28) || (bi === 6 && dayBS <= 9)) return { isHoliday: true, eventTitle: eventData ? eventData.title : "दशैं बिदा", isSunOrSat, dayOfWeekIdx };
            if (bi === 6 && dayBS >= 10 && dayBS <= 27) return { isHoliday: true, eventTitle: eventData ? eventData.title : "तिहार बिदा", isSunOrSat, dayOfWeekIdx };
            // Weekends are red by default; an event turns a weekend into a normal day only when its "Working day" box is ticked.
            // On weekdays the event's Holiday tick decides.
            const isHoliday = eventData ? (isSunOrSat ? (!!eventData.isHoliday || !eventData.workday) : !!eventData.isHoliday) : isSunOrSat;
            return { isHoliday, eventTitle: eventData ? eventData.title : null, isSunOrSat, dayOfWeekIdx };
        }

        // Month summary cards: derived only from data that is already loaded (no new queries).
        function updateMonthStats(md) {
            const mi = MONTHS.indexOf(md);
            const elH = $id('statHolidays'), elS = $id('statSchoolDays'), elP = $id('statPrograms'), elE = $id('statEvents');
            if (mi < 0 || !elH) return;
            statsMonthIdx = mi;
            let st = md._stats;
            if (!st) {
                st = { hol: 0, special: 0 };
                for (let d = 1; d <= md.daysCount; d++) {
                    const info = getDateInfo(mi, d), ev = md.events[d];
                    if (info.isHoliday) st.hol++;
                    if (ev && !ev.isHoliday && !info.isSunOrSat) st.special++;   // same rule as the blue calendar dot
                }
                md._stats = st;
            }
            const hol = st.hol, special = st.special;
            // Only touch a number when it really changed, and fade it in (no layout shift: the slot has a fixed size)
            const setStat = function (el, v) {
                if (el.textContent === v) return;
                el.textContent = v;
                if (el.animate && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
                    el.animate([{ opacity: 0, transform: 'translate3d(0,6px,0)' }, { opacity: 1, transform: 'none' }],
                               { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
                }
            };
            setStat(elH, toNepaliDigits(hol));
            setStat(elS, toNepaliDigits(md.daysCount - hol));
            setStat(elP, toNepaliDigits(md.programs ? md.programs.length : 0));
            setStat(elE, toNepaliDigits(special));
        }

        function renderPrograms(md) {
            updateMonthStats(md);
            $id('programsCardTitle').innerText = md.nameBS.split(' ')[0] + ' महिनाका कार्यक्रमहरू';
            const list = $id('programList');
            if (md.programs && md.programs.length > 0) {
                let html = '';
                md.programs.forEach(p => { html += '<li class="program-item"><i class="fa-solid fa-circle-check"></i> <span>' + esc(p.title) + '</span></li>'; });
                list.innerHTML = html;
            } else {
                list.innerHTML = '<li class="program-item"><i class="fa-regular fa-circle"></i> <span>यस महिना विशेष कार्यक्रम तोकिएको छैन।</span></li>';
            }
            const mBox = $id('muhurtaBox');
            const mhItems = [['पास्नी', md.pasni], ['विवाह', md.bibah], ['व्रतबन्ध', md.bratabandha]].filter(x => x[1]);
            if (mhItems.length) {
                mBox.style.display = 'flex'; mBox.style.flexDirection = 'column'; mBox.style.alignItems = 'flex-start'; mBox.style.gap = '6px';
                mBox.innerHTML = '<strong><i class="fa-solid fa-heart"></i> साइत / मुहूर्तः</strong>' +
                    mhItems.map(x => '<span><strong>' + x[0] + ' :</strong> ' + safeRich(x[1]) + '</span>').join('') +
                    (md.muhurta ? '<span>' + safeRich(md.muhurta) + '</span>' : '');
            }
            else if (md.muhurta) { mBox.style.display = 'flex'; mBox.style.flexDirection = ''; mBox.style.alignItems = ''; mBox.style.gap = ''; mBox.innerHTML = '<strong><i class="fa-solid fa-heart"></i> साइत / मुहूर्तः:</strong> ' + safeRich(md.muhurta); }
            else { mBox.style.display = 'none'; }
        }

        // ---------------------------------------------------------------
        // Summary cards: tap one to see what is behind its number.
        // Everything shown is derived from the month data already loaded (same rules as updateMonthStats),
        // so the list always adds up to the number on the card.
        // ---------------------------------------------------------------
        let statsMonthIdx = -1;                 // month the four cards currently describe (set by updateMonthStats)
        const STAT_KINDS = {
            holidays: { icon: 'fa-umbrella-beach', color: '#D4A017', title: 'बिदा दिन' },
            study:    { icon: 'fa-school',         color: '#FF6F61',     title: 'पढाइ दिन' },
            programs: { icon: 'fa-calendar-check', color: '#DC2626',  title: 'कार्यक्रम' },
            events:   { icon: 'fa-star',           color: '#EAB308',  title: 'विशेष दिन' }
        };
        const ssEl = document.createElement('div');
        ssEl.className = 'ss-overlay'; ssEl.id = 'statSheet'; ssEl.setAttribute('aria-hidden', 'true');
        ssEl.innerHTML =
            '<div class="ss-panel" role="dialog" aria-modal="true" aria-labelledby="ssTitle" tabindex="-1">' +
                '<div class="ss-grab" aria-hidden="true"></div>' +
                '<div class="ss-head">' +
                    '<span class="ss-ico" aria-hidden="true"></span>' +
                    '<div class="ss-titles"><h2 id="ssTitle"></h2><p id="ssSub"></p></div>' +
                    '<button type="button" class="ss-close" aria-label="बन्द गर्नुहोस्"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
                '</div>' +
                '<div class="ss-body" id="ssBody"></div>' +
            '</div>';
        document.body.appendChild(ssEl);
        const ssPanel = ssEl.querySelector('.ss-panel'), ssIco = ssEl.querySelector('.ss-ico'), ssTitleEl = $id('ssTitle'),
              ssSubEl = $id('ssSub'), ssBody = $id('ssBody'), ssCloseBtn = ssEl.querySelector('.ss-close');
        let ssOpen = false, ssOpener = null, ssLockT = 0, ssUnlockT = 0;

        function statAdText(mi, d) {
            const dt = adDateOf(MONTHS[mi], d);
            return dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        }
        function statRel(mi, d) {
            const dt = adDateOf(MONTHS[mi], d); if (!dt) return null;
            const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
            if (diff === 0) return { text: 'आज', cls: ' today' };
            return diff > 0 ? { text: toNepaliDigits(diff) + ' दिन पछि', cls: '' } : { text: toNepaliDigits(-diff) + ' दिन अगाडि', cls: ' past' };
        }
        // One tappable row: date tile · title/sub · "in N days" tag
        function ssRow(mi, d, title, sub, endDay, idx) {
            const md = MONTHS[mi], valid = Number.isInteger(d) && d >= 1 && d <= md.daysCount;
            const dow = valid ? (md.startDayOfWeek + d - 1) % 7 : 0, rel = valid ? statRel(mi, d) : null;
            const tileSub = endDay && endDay > d ? '–' + toNepaliDigits(endDay) : dayHeaders[dow].bs;
            return '<' + (valid ? 'button type="button"' : 'div') + ' class="ss-row' + (valid ? '' : ' static') + '"' + (valid ? ' data-day="' + d + '"' : '') + ' style="--i:' + Math.min(idx, 10) + '">' +
                '<span class="ss-date"><b>' + (valid ? toNepaliDigits(d) : '–') + '</b><i>' + esc(valid ? tileSub : '') + '</i></span>' +
                '<span class="ss-main"><span class="ss-t">' + esc(title) + '</span><span class="ss-s">' + esc(sub) + '</span></span>' +
                (rel && valid ? '<span class="ss-rel' + rel.cls + '">' + esc(rel.text) + '</span>' : '') +
                (valid ? '<i class="fa-solid fa-chevron-right ss-chev" aria-hidden="true"></i>' : '') +
                '</' + (valid ? 'button' : 'div') + '>';
        }
        const ssDaySub = (mi, d) => {
            const md = MONTHS[mi], dow = (md.startDayOfWeek + d - 1) % 7, ad = statAdText(mi, d);
            return dayNamesFullBS[dow] + (ad ? ' · ' + ad : '');
        };

        // Same classification rules as updateMonthStats / getDateInfo
        function statDays(mi) {
            const md = MONTHS[mi], out = { holidays: [], study: [], events: [] };
            for (let d = 1; d <= md.daysCount; d++) {
                const info = getDateInfo(mi, d), ev = md.events[d];
                const row = { day: d, info: info, title: info.eventTitle, weekend: info.isSunOrSat };
                if (info.isHoliday) out.holidays.push(row); else out.study.push(row);
                if (ev && !ev.isHoliday && !info.isSunOrSat) out.events.push({ day: d, title: ev.title });
            }
            return out;
        }

        function buildStatBody(kind, mi) {
            const md = MONTHS[mi], st = statDays(mi);
            if (kind === 'holidays') {
                const festival = st.holidays.filter(r => r.title || !r.weekend);
                const weekly = st.holidays.filter(r => !r.title && r.weekend);
                const groups = [];
                festival.forEach(r => {                       // merge consecutive days with the same name (e.g. Dashain break)
                    const t = r.title || 'बिदा', g = groups[groups.length - 1];
                    if (g && g.title === t && g.end === r.day - 1) g.end = r.day; else groups.push({ title: t, start: r.day, end: r.day });
                });
                let html = '<div class="ss-kpis">' +
                    '<div class="ss-kpi" style="--i:0"><b>' + toNepaliDigits(festival.length) + '</b><span>पर्व / विशेष बिदा</span></div>' +
                    '<div class="ss-kpi" style="--i:1"><b>' + toNepaliDigits(weekly.length) + '</b><span>साप्ताहिक बिदा</span></div></div>';
                if (groups.length) {
                    html += '<div class="ss-sec">पर्व तथा विशेष बिदा</div>';
                    groups.forEach((g, i) => {
                        const n = g.end - g.start + 1;
                        const sub = n > 1 ? toNepaliDigits(n) + ' दिन · ' + toNepaliDigits(g.start) + '–' + toNepaliDigits(g.end) + ' गते' : ssDaySub(mi, g.start);
                        html += ssRow(mi, g.start, g.title, sub, g.end, i);
                    });
                }
                if (weekly.length) {
                    html += '<div class="ss-sec">साप्ताहिक बिदा</div><div class="ss-chips">' +
                        weekly.map(r => '<button type="button" class="ss-chip" data-day="' + r.day + '">' + toNepaliDigits(r.day) + ' · ' + esc(dayHeaders[(md.startDayOfWeek + r.day - 1) % 7].bs) + '</button>').join('') + '</div>';
                }
                if (!st.holidays.length) html += '<div class="ss-empty"><i class="fa-regular fa-calendar-check"></i>यस महिना कुनै बिदा छैन।</div>';
                return { sub: toNepaliDigits(st.holidays.length) + ' दिन बिदा', html: html };
            }
            if (kind === 'study') {
                const total = md.daysCount, hol = st.holidays.length, study = st.study.length;
                const pct = Math.round(study / total * 100), offDays = new Set(st.holidays.map(r => r.day));
                let html = '<div class="ss-ring-row"><div class="ss-ring" style="--p:' + pct + '"><div><b>' + toNepaliDigits(study) + '</b><span>पढाइ दिन</span></div></div>' +
                    '<div class="ss-kpis">' +
                    '<div class="ss-kpi" style="--i:0"><span>कुल दिन</span><b>' + toNepaliDigits(total) + '</b></div>' +
                    '<div class="ss-kpi" style="--i:1;--k:var(--holiday-red)"><span>बिदा</span><b>' + toNepaliDigits(hol) + '</b></div>' +
                    '<div class="ss-kpi" style="--i:2"><span>पढाइ (' + toNepaliDigits(pct) + '%)</span><b>' + toNepaliDigits(study) + '</b></div></div></div>';
                html += '<div class="ss-sec">महिनाको नक्सा · दिन छान्नुहोस्</div><div class="ss-map">';
                dayHeaders.forEach(h => { html += '<div class="ss-wd">' + esc(h.bs) + '</div>'; });
                for (let p = 0; p < md.startDayOfWeek; p++) html += '<span class="ss-pad"></span>';
                for (let d = 1; d <= total; d++) {
                    const isToday = TODAY.monthIdx === mi && TODAY.dayBS === d;
                    html += '<button type="button" class="ss-dot' + (offDays.has(d) ? ' off' : '') + (isToday ? ' today' : '') + '" data-day="' + d + '" style="--i:' + d + '" aria-label="' + esc(toNepaliDigits(d) + ' गते · ' + (offDays.has(d) ? 'बिदा' : 'पढाइ')) + '">' + toNepaliDigits(d) + '</button>';
                }
                html += '</div><div class="ss-legend"><span><i></i>पढाइ दिन</span><span><i class="off"></i>बिदा</span><span><i class="today"></i>आज</span></div>';
                return { sub: toNepaliDigits(study) + ' दिन पढाइ · ' + toNepaliDigits(pct) + '%', html: html };
            }
            if (kind === 'programs') {
                const list = (md.programs || []).slice().sort((a, b) => a.day - b.day);
                let html = list.length ? '' : '<div class="ss-empty"><i class="fa-regular fa-calendar"></i>यस महिना विशेष कार्यक्रम तोकिएको छैन।</div>';
                list.forEach((p, i) => { html += ssRow(mi, p.day, p.title, p.day >= 1 && p.day <= md.daysCount ? ssDaySub(mi, p.day) : '', 0, i); });
                if (list.length) html += '<div class="ss-hint">कुनै कार्यक्रममा थिच्नुहोस् — क्यालेन्डरमा त्यही दिन खुल्छ</div>';
                return { sub: toNepaliDigits(list.length) + ' कार्यक्रम', html: html };
            }
            // events
            let html = st.events.length ? '' : '<div class="ss-empty"><i class="fa-regular fa-star"></i>यस महिना कुनै विशेष दिन छैन।</div>';
            st.events.forEach((e, i) => { html += ssRow(mi, e.day, e.title, ssDaySub(mi, e.day), 0, i); });
            if (st.events.length) html += '<div class="ss-hint">कुनै दिनमा थिच्नुहोस् — क्यालेन्डरमा त्यही दिन खुल्छ</div>';
            return { sub: toNepaliDigits(st.events.length) + ' विशेष दिन', html: html };
        }

        function openStatSheet(kind, opener) {
            const k = STAT_KINDS[kind], md = MONTHS[statsMonthIdx];
            if (!k || !md || !calendarReady || ssOpen || ScrollLock.isLocked() || dropdownOpen) return;
            const built = buildStatBody(kind, statsMonthIdx);
            ssPanel.style.setProperty('--c', k.color);
            ssIco.innerHTML = '<i class="fa-solid ' + k.icon + '"></i>';
            ssTitleEl.textContent = k.title;
            ssSubEl.textContent = md.nameBS + ' ' + toNepaliDigits(md.yearBS) + ' · ' + built.sub;
            ssBody.innerHTML = built.html; ssBody.scrollTop = 0;
            ssOpener = opener || null;
            if (ssOpener) ssOpener.setAttribute('aria-expanded', 'true');
            ssOpen = true;
            sheetToggledAt = performance.now();
            clearTimeout(ssUnlockT); clearTimeout(ssLockT);
            document.body.classList.add('sheet-open');           // cheap: only JS reads it
            ssEl.setAttribute('aria-hidden', 'false');
            ssEl.classList.add('pre');                           // visible but ~transparent: the sheet gets painted before it moves
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {              // the slide starts on a frame whose content is already painted
                    if (!ssOpen) return;
                    ssEl.classList.add('active');
                    // The page-wide scroll lock restyles every calendar cell, so it waits until the slide has finished.
                    ssLockT = setTimeout(function () {
                        if (!ssOpen) return;
                        ScrollLock.lock();
                        ssCloseBtn.focus({ preventScroll: true });
                    }, 600);
                });
            });
        }
        function closeStatSheet(skipFocus) {
            if (!ssOpen) return;
            ssOpen = false; sheetToggledAt = performance.now();
            ssPanel.style.transform = '';
            ssEl.classList.remove('active', 'pre'); ssEl.setAttribute('aria-hidden', 'true');
            clearTimeout(ssLockT);
            document.body.classList.remove('sheet-open');
            ssUnlockT = setTimeout(function () { ScrollLock.unlock(); }, 340);   // after the slide-out, not during it
            if (ssOpener) { ssOpener.removeAttribute('aria-expanded'); if (!skipFocus) ssOpener.focus({ preventScroll: true }); }
        }
        window.PSBSStatSheetOpen = function () { return ssOpen; };
        window.PSBSStatSheetClose = function () { closeStatSheet(true); };
        // Jump the calendar to a tapped day, show its details, and pulse the cell
        function statJump(day) {
            const mi = statsMonthIdx;
            closeStatSheet(true);
            setTimeout(function () {                             // re-render the calendar only after the sheet has slid away
                goToMonth(mi, day);
                if (selectedMonthIdx !== mi || selectedDayBS !== day) applySelection(mi, day);
                setTimeout(function () {
                    if (detailPanelEl && detailPanelEl.scrollIntoView) detailPanelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    const cell = document.querySelector('#monthTrack .calendar-cell.selected');
                    if (cell) { cell.classList.add('ss-flash'); setTimeout(function () { cell.classList.remove('ss-flash'); }, 2300); }
                }, 80);
            }, 400);
        }

        ssBody.addEventListener('click', function (e) {
            const t = e.target.closest('[data-day]'); if (!t || !ssBody.contains(t)) return;
            const d = Number(t.getAttribute('data-day')); if (d >= 1) statJump(d);
        });
        ssCloseBtn.addEventListener('click', function () { closeStatSheet(); });
        ssEl.addEventListener('click', function (e) { if (e.target === ssEl) closeStatSheet(); });
        document.addEventListener('keydown', function (e) {
            if (!ssOpen) return;
            if (e.key === 'Escape') { e.preventDefault(); closeStatSheet(); return; }
            if (e.key !== 'Tab') return;
            const f = Array.prototype.filter.call(ssPanel.querySelectorAll('button:not([disabled])'), function (el) { return el.getClientRects().length > 0; });
            if (!f.length) return;
            const first = f[0], last = f[f.length - 1];
            if (!ssPanel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
            else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
        // Swipe down anywhere on the sheet (or the dim area) to dismiss (phones).
        // Inside the scrolling list it only kicks in once the list is at the top.
        (function () {
            let sy = 0, sx = 0, dy = 0, on = false, decided = false, fromBody = false, raf = 0;
            function paint() { raf = 0; if (on) ssPanel.style.transform = 'translate3d(0,' + dy + 'px,0)'; }
            function start(e) {
                if (!ssOpen || window.innerWidth >= 700 || !e.touches || e.touches.length !== 1) return;
                sy = e.touches[0].clientY; sx = e.touches[0].clientX; dy = 0; on = false; decided = false;
                fromBody = !!(e.target.closest && e.target.closest('.ss-body'));
            }
            function move(e) {
                if (!ssOpen || !e.touches || !e.touches.length || window.innerWidth >= 700) return;
                const ty = e.touches[0].clientY - sy, tx = e.touches[0].clientX - sx;
                if (!decided) {
                    if (Math.abs(ty) < 6 && Math.abs(tx) < 6) return;
                    decided = true;
                    on = ty > 0 && Math.abs(ty) > Math.abs(tx) && (!fromBody || ssBody.scrollTop <= 0);
                    if (on) ssPanel.style.transition = 'none';
                }
                if (!on) return;
                dy = Math.max(0, ty);
                if (e.cancelable) e.preventDefault();
                if (!raf) raf = requestAnimationFrame(paint);
            }
            function end() {
                if (!on) { decided = false; return; }
                on = false; decided = false;
                if (raf) { cancelAnimationFrame(raf); raf = 0; }
                ssPanel.style.transition = '';
                if (dy > 80) closeStatSheet(); else ssPanel.style.transform = '';
            }
            ssEl.addEventListener('touchstart', start, { passive: true });
            ssEl.addEventListener('touchmove', move, { passive: false });
            ssEl.addEventListener('touchend', end);
            ssEl.addEventListener('touchcancel', end);
        })();

        document.querySelectorAll('.stat-card[data-stat]').forEach(function (card) {
            const go = function () {
                try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) { /* optional haptic */ }
                openStatSheet(card.getAttribute('data-stat'), card);
            };
            card.addEventListener('click', go);
            card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        });

        // ---------------------------------------------------------------
        // Warm-up: the first tap used to pay for font loading, building the list and creating the
        // sheet's GPU layer all at once. Do that work quietly in idle time so the first open is as
        // smooth as every later one. Skipped on data-saver; aborted if the user opens a card meanwhile.
        // ---------------------------------------------------------------
        (function warmStatSheet() {
            let done = false;
            const conn = navigator.connection;
            if (conn && conn.saveData) return;
            const idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 300); };
            function loadFonts() {
                if (!document.fonts || !document.fonts.load) return Promise.resolve();
                const sample = 'बिदा दिन पढाइ कार्यक्रम विशेष १२३';
                return Promise.all([
                    document.fonts.load('400 1em "Yatra One"', sample),
                    document.fonts.load('400 1em "Mukta"', sample),
                    document.fonts.load('700 1em "Mukta"', sample),
                    document.fonts.load('900 1em "Font Awesome 6 Free"'),
                    document.fonts.load('400 1em "Font Awesome 6 Free"')
                ]).catch(function () { /* optional */ });
            }
            function paintOnce() {
                if (done || ssOpen || statsMonthIdx < 0 || !MONTHS[statsMonthIdx]) return;
                done = true;
                const built = buildStatBody('holidays', statsMonthIdx);
                ssBody.innerHTML = built.html;
                ssPanel.style.transition = 'none';
                ssPanel.style.transform = 'translate3d(0,0,0)';   // on-screen (but ~invisible) so it really gets painted
                ssEl.classList.add('pre');
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        if (!ssOpen) {                                // user already opened a card: leave everything alone
                            ssEl.classList.remove('pre');
                            ssBody.innerHTML = '';
                        }
                        ssPanel.style.transition = '';
                        ssPanel.style.transform = '';
                    });
                });
            }
            function start(tries) {
                if (done) return;
                if (!calendarReady || statsMonthIdx < 0) { if (tries < 24) setTimeout(function () { start(tries + 1); }, 500); return; }
                loadFonts().then(function () { idle(paintOnce, { timeout: 2500 }); });
            }
            start(0);
        })();

        // Applies a selection (details panel + highlight). Re-renders the carousel only when the month changed.
        function applySelection(monthIdx, dayBS) {
            if (!MONTHS || MONTHS.length === 0 || !MONTHS[monthIdx]) return;
            const md = MONTHS[monthIdx];
            dayBS = Math.max(1, Math.min(md.daysCount, dayBS));
            selectedMonthIdx = monthIdx; selectedDayBS = dayBS;
            const info = getDateInfo(monthIdx, dayBS);
            const dayOfWeekIdx = info.dayOfWeekIdx;
            const isHoliday = info.isHoliday;
            const eventTitle = info.eventTitle;
            const adDate = adDateOf(md, dayBS);
            const adFull = adDate ? adDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
            const tithi = md.tithis[dayBS - 1] || '—';
            const progInfo = md.progByDay[dayBS];

            $id('detailDateBS').textContent = toNepaliDigits(md.yearBS) + ' ' + monthNamesBS[md.bsIdx != null ? md.bsIdx : monthIdx] + ' ' + toNepaliDigits(dayBS) + ' गते, ' + dayNamesFullBS[dayOfWeekIdx];
            $id('detailDateAD').textContent = adFull + ' (' + dayHeaders[dayOfWeekIdx].en + ')';
            $id('detailTithi').textContent = tithi;

            let evtTxt = '—', evtClass = 'empty-text';
            if (eventTitle) { evtTxt = eventTitle; evtClass = isHoliday ? 'holiday-text' : 'event-text'; }
            else if (info.isSunOrSat && isHoliday) { evtTxt = 'साप्ताहिक बिदा (Weekly Holiday)'; evtClass = 'holiday-text'; }
            else if (isHoliday) { evtTxt = 'विदा'; evtClass = 'holiday-text'; }
            $id('detailEvent').innerHTML = '<span class="' + evtClass + '">' + esc(evtTxt) + '</span>';

            let progTxt = '—', progClass = 'empty-text';
            if (isHoliday) { progTxt = 'बिदा · कुनै कार्यक्रम छैन'; progClass = 'holiday-text'; }
            else if (progInfo) { progTxt = progInfo.title; progClass = 'program-text'; }
            else if (dayOfWeekIdx === 5) { progTxt = 'शुक्रबारीय नियमित क्रियाकलाप'; progClass = 'program-text'; }
            else { progTxt = 'नियमित पठनपाठन'; progClass = 'empty-text'; }
            $id('detailProgram').innerHTML = '<span class="' + progClass + '">' + esc(progTxt) + '</span>';

            const pane = track.children[1];
            if (builtData === MONTHS && builtMonthIdx === monthIdx && currentMonthIdx === monthIdx && track.children.length === 3 && pane) {
                // Same month already on screen: just move the highlight instead of rebuilding three panes
                const old = pane.querySelector('.calendar-cell.selected');
                const cell = pane.querySelector('.calendar-cell[data-m="' + monthIdx + '"][data-d="' + dayBS + '"]:not(.ghost)');
                if (old && old !== cell) { old.classList.remove('selected'); old.setAttribute('tabindex', '-1'); }
                if (cell) { cell.classList.add('selected'); cell.setAttribute('tabindex', '0'); }
                updateDaysDifference();
                popIn(detailPanelEl);            // the programs card does not depend on the selected day: leave it alone
            } else {
                renderCalendar(monthIdx);
            }
        }
        function selectDate(monthIdx, dayBS) {
            if (ScrollLock.isLocked()) return;
            applySelection(monthIdx, dayBS);
        }

        function changeMonth(newIdx) { goToMonth(newIdx); }
        function goToToday() {
            if (isAnimatingSwipe || ScrollLock.isLocked() || !MONTHS.length) return;
            if (TODAY.monthIdx !== currentMonthIdx) goToMonth(TODAY.monthIdx, TODAY.dayBS); else selectDate(TODAY.monthIdx, TODAY.dayBS);
            CalHelpers.showToast('📅 आज: ' + MONTHS[TODAY.monthIdx].nameBS + ' ' + toNepaliDigits(TODAY.dayBS), 'info');
        }

        $id('prevMonthBtn').onclick = () => stepMonth(-1);
        $id('nextMonthBtn').onclick = () => stepMonth(1);
        $id('todayBtn').onclick = goToToday;

        // Re-render after the data or "today" changed, keeping the user's own selection
        // (previously every refresh yanked the selection back to today).
        function refreshView(prevToday) {
            if (!MONTHS.length) return;
            if (drag && drag.on) { setTimeout(function () { refreshView(prevToday); }, 300); return; }  // never rebuild under a finger
            if (settling) finalize();
            builtData = null;                                  // force a full rebuild
            const wasOnToday = prevToday && selectedMonthIdx === prevToday.monthIdx && selectedDayBS === prevToday.dayBS;
            if (selectedMonthIdx === -1 || wasOnToday) applySelection(TODAY.monthIdx, TODAY.dayBS);
            else applySelection(selectedMonthIdx, selectedDayBS);
        }

        let midnightTimer = 0;
        function scheduleMidnightRefresh() {
            clearTimeout(midnightTimer);
            const now = new Date();
            const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
            midnightTimer = setTimeout(function () {
                const prev = TODAY;
                calculateTodayBS();
                refreshView(prev);
                scheduleMidnightRefresh();
            }, Math.max(1000, next - now));
        }
        // Timers can be late after sleep / background throttling: re-check the date when the tab returns.
        document.addEventListener('visibilitychange', function () {
            if (document.hidden || !MONTHS.length) return;
            if (rtPending) { rtPending = false; runRealtimeRefresh(); }
            updateClock();
            const prev = TODAY;
            calculateTodayBS();
            if (prev.monthIdx !== TODAY.monthIdx || prev.dayBS !== TODAY.dayBS) { refreshView(prev); scheduleMidnightRefresh(); }
            else updateDaysDifference();
        });

        // ---------------------------------------------------------------
        // Data
        // ---------------------------------------------------------------
        const BUILTIN_EVENTS_2083 = {
            0: { 1: ['Nepali New Year / नयाँ वर्ष', true], 18: ['Buddha Jayanti / बुद्ध जयन्ती', true] },
            1: { 14: ['Eid al-Adha / बकर ईद', true], 15: ['Republic Day / गणतन्त्र दिवस', true] },
            3: { 10: ['Nag Panchami / नाग पञ्चमी', true], 28: ['Janai Purnima / जनै पूर्णिमा', true], 29: ['Gai Jatra / गाईजात्रा', true] },
            4: { 19: ['Krishna Janmashtami / कृष्ण जन्माष्टमी', true], 29: ['Haritalika Teej / हरितालिका तीज', true] },
            5: { 3: ['Constitution Day / संविधान दिवस', true], 9: ['Indra Jatra / इन्द्रजात्रा', true], 25: ['Ghatasthapana / घटस्थापना — Dashain Begins / दशैं सुरु', true], 31: ['Phulpati / फूलपाती', true] },
            6: { 1: ['Maha Ashtami / महाअष्टमी', true], 2: ['Maha Navami / महानवमी', true], 3: ['Vijaya Dashami / विजया दशमी — Dashain / दशैं', true], 22: ['Laxmi Puja / लक्ष्मी पूजा — Tihar / तिहार', true], 24: ['Govardhan Puja / गोवर्धन पूजा — Mha Puja / म्ह पूजा', true], 25: ['Bhai Tika / भाइटीका — Tihar / तिहार', true], 29: ['Chhath Puja / छठ पर्व', true] },
            9: { 1: ['Maghe Sankranti / माघे सङ्क्रान्ति', true] },
            10: { 15: ['Holi / होली — Fagu Purnima / फागु पूर्णिमा', true] },
            11: { 30: ['Ram Navami / राम नवमी', true] }
        };

        function normalizeEvents(rawEvents, monthIdx, yearBS) {
            const out = {};
            const put = (day, title, isHoliday, workday) => { const n = Number(day); if (Number.isFinite(n) && title) out[n] = { title: String(title), isHoliday: !!isHoliday, workday: !!workday }; };
            if (Array.isArray(rawEvents)) {
                rawEvents.forEach(function (ev) { if (ev && ev.day != null && ev.title) put(ev.day, ev.title, ev.isHoliday, ev.workday); });
            } else if (rawEvents && typeof rawEvents === 'object') {
                Object.keys(rawEvents).forEach(function (day) {
                    const ev = rawEvents[day];
                    if (ev && typeof ev === 'object' && ev.title) put(day, ev.title, ev.isHoliday, ev.workday);
                    else if (typeof ev === 'string') put(day, ev, false);
                });
            }
            const fallback = (yearBS === 2083 && BUILTIN_EVENTS_2083[monthIdx]) || {};
            Object.keys(fallback).forEach(function (day) {
                if (!out[Number(day)]) out[Number(day)] = { title: fallback[day][0], isHoliday: fallback[day][1] };
            });
            return out;
        }

        // Turns one DB row into a month object; returns null when the row is unusable.
        function normalizeMonth(raw, idx, yearBS) {
            if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { return null; } }
            if (!raw || typeof raw !== 'object') return null;
            const start = toLocalMidnight(raw.adStartDate);
            const daysCount = parseInt(raw.daysCount, 10);
            if (!start || !(daysCount >= 28 && daysCount <= 32)) return null;
            let sdow = parseInt(raw.startDayOfWeek, 10);
            if (!(sdow >= 0 && sdow <= 6)) sdow = start.getDay();
            return finishMonth({
                yearBS: yearBS, bsIdx: idx, nameBS: String(raw.nameBS || (monthNamesBS[idx] + ' ' + toNepaliDigits(yearBS))), nameAD: String(raw.nameAD || ''), daysCount: daysCount, startDayOfWeek: sdow,
                adStartDate: start, quote: String(raw.quote || ''),
                programs: (Array.isArray(raw.programs) ? raw.programs : []).filter(p => p && p.title).map(p => Object.assign({}, p, { day: Number(p.day), title: String(p.title) })),
                muhurta: String(raw.muhurta || ''), pasni: String(raw.pasni || ''), bibah: String(raw.bibah || ''), bratabandha: String(raw.bratabandha || ''),
                tithis: Array.isArray(raw.tithis) ? raw.tithis.map(t => (t == null ? '' : String(t))) : [],
                events: normalizeEvents(raw.events, idx, yearBS)
            });
        }
        // Month with missing/invalid data: keeps the grid contiguous (start date follows the previous month) instead of
        // using "now" as its start, which made today resolve into the wrong month.
        function placeholderMonth(idx, prev, yearBS) {
            const start = prev && prev.adStartDate
                ? new Date(prev.adStartDate.getFullYear(), prev.adStartDate.getMonth(), prev.adStartDate.getDate() + prev.daysCount) : null;
            return finishMonth({ yearBS: yearBS, bsIdx: idx, nameBS: 'अज्ञात', nameAD: 'Unknown', daysCount: 30, startDayOfWeek: start ? start.getDay() : 0, adStartDate: start, quote: '', programs: [], muhurta: '', tithis: [], events: normalizeEvents({}, idx) });
        }

        // Returns true (loaded), false (failed) or null (a newer request superseded this one: ignore it).
        let fetchSeq = 0, lastSig = '', lastFetchChanged = true;
        async function fetchAllMonths(quiet) {
            const seq = ++fetchSeq;
            try {
                if (!window.db) throw new Error('Supabase client is not available');
                const { data, error } = await withTimeout(
                    window.db.from('calendar_data').select('*').order('year_bs', { ascending: true }).order('month_idx', { ascending: true }), 15000);
                if (seq !== fetchSeq) return null;            // an older response must never overwrite newer data
                if (error) throw error;
                if (!data || data.length === 0) { if (!quiet) CalHelpers.showToast('⚠️ क्यालेन्डर डाटा भेटिएन।', 'warning'); return false; }
                // Same rows as last time (e.g. a realtime event for an unrelated edit): keep the existing month objects,
                // caches and DOM - nothing to rebuild.
                const sig = JSON.stringify(data.map(r => [r.year_bs, r.month_idx, r.data]));
                if (MONTHS.length && sig === lastSig) { lastFetchChanged = false; return true; }
                const keyOf = (y, i) => y * 12 + i;
                const byKey = new Map();
                data.forEach(r => {
                    const y = Number(r.year_bs) || YEAR_BS, i = Number(r.month_idx);
                    if (Number.isInteger(i) && i >= 0 && i <= 11) byKey.set(keyOf(y, i), { row: r, y: y, i: i });
                });
                const keys = Array.from(byKey.keys()).sort((x, z) => x - z);
                if (!keys.length) { if (!quiet) CalHelpers.showToast('⚠️ क्यालेन्डर डाटा भेटिएन।', 'warning'); return false; }
                // Walk from the first to the last stored month; short gaps become placeholders so the grid stays contiguous.
                const months = [];
                for (let k = keys[0]; k <= keys[keys.length - 1]; k++) {
                    const hit = byKey.get(k), y = Math.floor(k / 12), i = k % 12;
                    if (!hit && keys[keys.length - 1] - keys[0] > 400) continue;
                    const m = hit ? normalizeMonth(hit.row.data, i, y) : null;
                    if (hit && !m) console.warn('[Calendar] ' + y + ' month ' + i + ' has invalid data; showing placeholder');
                    months.push(m || placeholderMonth(i, months[months.length - 1], y));
                }
                MONTH_COUNT = months.length;
                MONTHS = months;
                lastSig = sig; lastFetchChanged = true;
                return true;
            } catch (err) {
                if (seq !== fetchSeq) return null;
                console.error('[Calendar] data load failed:', err);
                if (!quiet) CalHelpers.showToast('❌ क्यालेन्डर डाटा लोड गर्न असफल', 'error');
                return false;
            }
        }

        let realtimeChannel = null, realtimeTimer = 0, rtBusy = false, rtAgain = false, rtPending = false;
        // One refresh at a time (a burst arriving mid-fetch queues exactly one more), nothing while the tab is hidden
        // (it runs when the tab returns), and no re-render when the rows did not actually change.
        async function runRealtimeRefresh() {
            if (document.hidden) { rtPending = true; return; }
            if (rtBusy) { rtAgain = true; return; }
            rtBusy = true;
            try {
                const prev = TODAY;
                const ok = await fetchAllMonths(true);
                if (ok && MONTHS.length && lastFetchChanged) {     // failed / superseded / unchanged: keep what is on screen
                    calculateTodayBS();
                    refreshView(prev);
                    CalHelpers.showToast('📅 क्यालेन्डर अपडेट भयो', 'info');
                }
            } finally {
                rtBusy = false;
                if (rtAgain) { rtAgain = false; runRealtimeRefresh(); }
            }
        }
        function setupCalendarRealtime() {
            if (realtimeChannel || !window.db || typeof window.db.channel !== 'function') return;
            realtimeChannel = window.db.channel('calendar_changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_data' }, function () {
                    // An admin edit touches several rows: coalesce the burst into one refetch.
                    clearTimeout(realtimeTimer);
                    realtimeTimer = setTimeout(runRealtimeRefresh, 400);
                })
                .subscribe();
        }

        // ---------------------------------------------------------------
        // Start-up (loading state, failure state with automatic retry)
        // ---------------------------------------------------------------
        const RETRY_DELAYS = [3000, 8000, 20000, 60000];
        let loadAttempts = 0, retryTimer = 0;

        function showStatus(text) {
            track.style.transform = '';
            gridBox.style.height = '';
            track.innerHTML = '<div class="month-pane empty-msg">' + text + '</div>';
        }
        function scheduleRetry() {
            clearTimeout(retryTimer);
            if (loadAttempts > RETRY_DELAYS.length) return;
            retryTimer = setTimeout(initCalendar, RETRY_DELAYS[loadAttempts - 1]);
        }
        async function initCalendar() {
            clearTimeout(retryTimer);
            if (calendarReady) return;
            gridBox.setAttribute('aria-busy', 'true');
            if (loadAttempts === 0) showStatus('क्यालेन्डर लोड हुँदैछ…');
            const ok = await fetchAllMonths(loadAttempts > 0);
            if (ok === null) return;
            if (!ok || MONTHS.length === 0) {
                loadAttempts++;
                gridBox.removeAttribute('aria-busy');
                showStatus('डाटा लोड हुन सकेन');
                quoteEl.innerText = '';
                scheduleRetry();
                return;
            }
            calendarReady = true;
            gridBox.removeAttribute('aria-busy');
            calculateTodayBS();
            applySelection(TODAY.monthIdx, TODAY.dayBS);
            setupCalendarRealtime();
            scheduleMidnightRefresh();
        }
        // Back online: load if we never managed to, otherwise catch up on edits missed while offline.
        window.addEventListener('online', function () { if (!calendarReady) initCalendar(); else runRealtimeRefresh(); });
        // Leaving the page: drop timers and the realtime channel (bfcache restore re-creates them).
        window.addEventListener('pagehide', function () {
            clearTimeout(realtimeTimer); clearTimeout(retryTimer); clearTimeout(midnightTimer);
            if (realtimeChannel && window.db && typeof window.db.removeChannel === 'function') { try { window.db.removeChannel(realtimeChannel); } catch (_) { } }
            realtimeChannel = null;
        });
        window.addEventListener('pageshow', function (e) {
            if (!e.persisted || !calendarReady) return;
            setupCalendarRealtime(); scheduleMidnightRefresh(); runRealtimeRefresh();
        });

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCalendar);
        else initCalendar();
    })();
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
    
