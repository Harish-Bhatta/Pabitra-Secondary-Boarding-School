    /* SCHOOL INFO — same Supabase source as the main site (school_info row); cached for instant repeat visits. */
    (function () {
        'use strict';
        var KEY = 'psbs_school_info_v1', cur = null;
        var STOP = { of: 1, and: 1, the: 1, for: 1, in: 1, at: 1 };
        function str(v) { return v == null ? '' : String(v).trim(); }
        function derive(d) {
            var name = str(d.school_name), words = name.split(/\s+/).filter(Boolean);
            var acr = words.filter(function (w) { return !STOP[w.toLowerCase()]; }).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
            if (words.length < 2) acr = name.toUpperCase();
            var email = str(d.email), domain = email.indexOf('@') > 0 ? email.split('@').pop() : '';
            var host = ''; try { if (/^https?:$/.test(location.protocol)) host = location.host; } catch (e) { }
            return { school_name: name, name: name, acronym: acr || name, motto: str(d.motto), email: email,
                     host: host || domain, admin_email: domain ? 'admin@' + domain : '' };
        }
        function setMeta(sel, val) { var t = document.querySelector(sel); if (t && val) t.setAttribute('content', val); }
        function apply(d) {
            var v = derive(d), list, i, el, k, val;
            list = document.querySelectorAll('[data-si]');
            for (i = 0; i < list.length; i++) { el = list[i]; k = el.getAttribute('data-si'); val = v[k]; if (val) el.textContent = val; }
            list = document.querySelectorAll('[data-si-alt]');
            for (i = 0; i < list.length; i++) if (v.name) list[i].setAttribute('alt', v.name + ' Logo');
            list = document.querySelectorAll('[data-si-aria="home"]');
            for (i = 0; i < list.length; i++) if (v.name) list[i].setAttribute('aria-label', v.name + ' home');
            list = document.querySelectorAll('[data-si-ph]');
            for (i = 0; i < list.length; i++) if (v.admin_email) list[i].setAttribute('placeholder', v.admin_email);
            if (v.name) {
                var desc = 'Secure administrator sign in for ' + v.name + (v.motto ? ' — ' + v.motto : '') + '. Manage notices, documents, gallery, faculty and calendar.';
                document.title = 'Admin Login · ' + v.acronym;
                setMeta('meta[name="description"]', desc);
                setMeta('meta[property="og:site_name"]', v.name);
                setMeta('meta[property="og:title"]', 'Admin Login · ' + v.name);
                setMeta('meta[property="og:description"]', desc);
                setMeta('meta[property="og:image:alt"]', v.name);
                setMeta('meta[name="twitter:title"]', 'Admin Login · ' + v.name);
                setMeta('meta[name="twitter:description"]', desc);
            }
        }
        window.SchoolInfo = {
            set: function (d) { if (!d) return; cur = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { } apply(d); },
            get: function () { return cur; },
            acr: function () { return cur ? derive(cur).acronym : 'PSBS'; }
        };
        try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.school_name) { cur = c; apply(c); } } catch (e) { }
        async function fetchSchoolInfo() {
            try {
                var r = await supabaseClient.from('school_info').select('*').eq('id', 1).maybeSingle();
                if (!r.error && r.data) window.SchoolInfo.set(r.data);
            } catch (e) { console.warn('school_info fetch failed', e); }
        }
        fetchSchoolInfo();
        try {
            supabaseClient.channel('school_info_changes_admin_login')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'school_info' }, fetchSchoolInfo)
                .subscribe();
        } catch (e) { }
        /* Supabase image -> retry once -> local file -> hide (the icon behind it stays visible). */
        function fix(img) {
            if (!img || img.tagName !== 'IMG' || img.getAttribute('data-psbs-fb')) return;
            if (!img.getAttribute('data-retry') && /\/storage\/v1\/object\/public\//.test(img.src)) { img.setAttribute('data-retry', '1'); img.src = img.src.split('?')[0] + '?r=' + Date.now(); return; }
            var loc = img.getAttribute('data-local');
            if (loc && !img.getAttribute('data-local-tried')) { img.setAttribute('data-local-tried', '1'); img.src = loc; return; }
            img.setAttribute('data-psbs-fb', '1'); img.style.display = 'none';
        }
        document.addEventListener('error', function (e) { fix(e.target); }, true);
        window.addEventListener('load', function () { var l = document.images; for (var i = 0; i < l.length; i++) if (l[i].complete && l[i].naturalWidth === 0 && l[i].getAttribute('src')) fix(l[i]); });
    })();
    
