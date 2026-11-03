        // ============================================================
        // HELPERS
        // ============================================================
        const Helpers = {
            getTheme: function () { return localStorage.getItem('psbs_theme') || 'light'; },
            getThemePreset: function () { return localStorage.getItem('psbs_theme_preset') || 'gold'; },
            applyTheme: function () {
                const theme = this.getTheme();
                const preset = this.getThemePreset();
                const body = document.body;
                const icon = document.getElementById('themeIcon');
                if (theme === 'dark') {
                    body.classList.add('dark');
                    if (icon) icon.className = 'ri-sun-line';
                } else {
                    body.classList.remove('dark');
                    if (icon) icon.className = 'ri-moon-line';
                }
                body.className = body.className.split(' ').filter(function (c) {
                    return !c.startsWith('theme-');
                }).join(' ');
                if (preset !== 'default') body.classList.add('theme-' + preset);
            },
            toggleTheme: function () {
                const isDark = document.body.classList.contains('dark');
                const icon = document.getElementById('themeIcon');
                if (isDark) {
                    document.body.classList.remove('dark');
                    localStorage.setItem('psbs_theme', 'light');
                    if (icon) icon.className = 'ri-moon-line';
                } else {
                    document.body.classList.add('dark');
                    localStorage.setItem('psbs_theme', 'dark');
                    if (icon) icon.className = 'ri-sun-line';
                }
                const preset = this.getThemePreset();
                document.body.className = document.body.className.split(' ').filter(function (c) {
                    return !c.startsWith('theme-');
                }).join(' ');
                if (preset !== 'default') document.body.classList.add('theme-' + preset);
            },
            showToast: function (message, type) {
                const el = document.getElementById('toast');
                const msgEl = el.querySelector('.toast-message');
                const iconEl = el.querySelector('.toast-icon');
                const closeBtn = el.querySelector('.toast-close');
                const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
                msgEl.textContent = message;
                el.className = 'toast toast-' + (type || 'info');
                if (iconEl) iconEl.textContent = icons[type] || icons.info;
                el.classList.add('active');
                clearTimeout(el._timeout);
                closeBtn.onclick = function () { el.classList.remove('active'); };
                el._timeout = setTimeout(function () { el.classList.remove('active'); }, 4000);
            },
            sanitize: function (input) {
                const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
                return String(input).replace(/[&<>"'/]/g, function (s) { return map[s] || s; });
            }
        };

        function showToast(msg, type) { Helpers.showToast(msg, type); }

        // THEME
        document.getElementById('themeToggle').addEventListener('click', function () { Helpers.toggleTheme(); });
        Helpers.applyTheme();

        const tabs = document.querySelectorAll('.tab-bar button');
        const panels = { signin: document.getElementById('panel-signin'), signup: document.getElementById('panel-signup') };
        tabs.forEach(btn => btn.addEventListener('click', function () {
            const tab = this.getAttribute('data-tab');
            this.parentNode.setAttribute('data-active', tab);
            tabs.forEach(b => { b.classList.remove('active-tab'); b.setAttribute('aria-selected','false'); });
            this.classList.add('active-tab'); this.setAttribute('aria-selected','true');
            Object.values(panels).forEach(p => p.classList.remove('active-panel'));
            panels[tab].classList.add('active-panel');
            document.querySelectorAll('.input-error').forEach(el => el.textContent='');
        }));

        const loginForm = document.getElementById('loginForm');
        const emailInput = document.getElementById('emailInput');
        const passwordInput = document.getElementById('passwordInput');
        const emailError = document.getElementById('emailError');
        const passwordError = document.getElementById('passwordError');
        const loginBtn = document.getElementById('loginBtn');
        const rememberMe = document.getElementById('rememberMe');
        const savedEmail = localStorage.getItem('psbs_admin_email');
        if (savedEmail) { emailInput.value = savedEmail; rememberMe.checked = true; }
        emailInput.type='email'; passwordInput.autocomplete='current-password';

        loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            const email=emailInput.value.trim().toLowerCase(), password=passwordInput.value;
            emailError.textContent=''; passwordError.textContent='';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailError.textContent='Enter a valid admin email.'; return; }
            if (!password) { passwordError.textContent='Password is required.'; return; }
            loginBtn.disabled=true; loginBtn.classList.add('loading');
            try {
                const {data,error}=await supabaseClient.rpc('admin_login',{p_email:email,p_password:password});
                if(error) throw error;
                const admin=Array.isArray(data)?data[0]:data;
                if(!admin || admin.success!==true || !admin.session_token) { showToast('Invalid email or password, or the admin account is disabled.','error'); return; }
                // Remember-me stores the session token persistently on this device; the server still validates expiry/revocation.
                if(rememberMe.checked) {
                    localStorage.setItem('psbs_admin_session_token',admin.session_token);
                    localStorage.setItem('psbs_admin_name',admin.name||'Admin');
                    sessionStorage.removeItem('psbs_admin_session_token');
                    sessionStorage.removeItem('psbs_admin_name');
                    localStorage.setItem('psbs_admin_email',email);
                } else {
                    sessionStorage.setItem('psbs_admin_session_token',admin.session_token);
                    sessionStorage.setItem('psbs_admin_name',admin.name||'Admin');
                    localStorage.removeItem('psbs_admin_session_token');
                    localStorage.removeItem('psbs_admin_name');
                    localStorage.removeItem('psbs_admin_email');
                }
                showToast('Welcome! Redirecting…','success');
                setTimeout(()=>window.location.replace('admin-dashboard.html'),600);
            } catch(err) { console.error(err); showToast('Login error: '+(err.message||'Check SQL setup.'),'error'); }
            finally { loginBtn.disabled=false; loginBtn.classList.remove('loading'); }
        });

        // Request Access uses a custom SQL RPC, never Supabase Auth signUp.
        const signupForm=document.getElementById('signupForm');
        const signupName=document.getElementById('signupName');
        const signupEmail=document.getElementById('signupEmail');
        const signupPassword=document.getElementById('signupPassword');
        const signupConfirm=document.getElementById('signupConfirm');
        const signupBtn=document.getElementById('signupBtn');
        signupForm.addEventListener('submit', async e=>{
            e.preventDefault();
            const name=signupName.value.trim(), email=signupEmail.value.trim().toLowerCase();
            const password=signupPassword.value;
            document.querySelectorAll('#panel-signup .input-error').forEach(el=>el.textContent='');
            let valid=true;
            if(name.length<2){document.getElementById('signupNameError').textContent='Enter your full name.';valid=false;}
            if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){document.getElementById('signupEmailError').textContent='Enter a valid email.';valid=false;}
            if(password.length<8){document.getElementById('signupPasswordError').textContent='Use at least 8 characters.';valid=false;}
            if(password!==signupConfirm.value){document.getElementById('signupConfirmError').textContent='Passwords do not match.';valid=false;}
            if(!valid) return;
            signupBtn.disabled=true; signupBtn.classList.add('loading');
            try {
                const {data,error}=await supabaseClient.rpc('submit_admin_request',{p_name:name,p_email:email,p_password:password});
                if(error) throw error;
                const result=Array.isArray(data)?data[0]:data;
                if(!result || result.success!==true) { showToast(result?.message||'Could not submit request.','error'); return; }
                showToast('Request submitted. An administrator must approve it before you can sign in.','success');
                signupForm.reset();
                setTimeout(()=>{tabs[0]?.click(); emailInput.value=email;},1200);
            } catch(err) { console.error('Request access error:',err); showToast('Request failed: '+(err.message||'Check SQL setup.'),'error'); }
            finally {signupBtn.disabled=false; signupBtn.classList.remove('loading');}
        });
        document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){const active=document.querySelector('.tab-panel.active-panel');if(active?.id==='panel-signin')loginForm.requestSubmit();else if(active?.id==='panel-signup')signupForm.requestSubmit();}});
        // Custom sessions are checked server-side by protected RPCs; do not trust a local flag.
    
