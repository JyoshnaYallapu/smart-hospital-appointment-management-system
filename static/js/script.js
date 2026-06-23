/* =============================================================
   Smart Hospital Portal – script.js
   Handles:
     1. Navbar hamburger toggle
     2. Homepage stats counter animation
     3. Login form authentication & redirect
     4. Doctor search / filter
     5. Appointment form validation & localStorage
     6. Appointment history render & delete
     7. Toast notification system
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────────
   1. NAVBAR HAMBURGER
   ───────────────────────────────────────────── */
(function initNav() {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close nav when a link is clicked (mobile)
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
    });
  });
})();


/* ─────────────────────────────────────────────
   2. STATS COUNTER ANIMATION (index.html)
   ───────────────────────────────────────────── */
(function initStats() {
  // Target numbers for each stat
  const targets = {
    'stat-doctors':  120,
    'stat-patients': 50000,
    'stat-beds':     500,
    'stat-depts':    12
  };

  // Only run on pages that have the stat elements
  const hasStats = Object.keys(targets).some(id => document.getElementById(id));
  if (!hasStats) return;

  /**
   * Animate a counter from 0 to target over ~1.8 seconds
   * @param {HTMLElement} el
   * @param {number} target
   */
  function animateCounter(el, target) {
    const duration = 1800;
    const start    = performance.now();

    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased    = 1 - Math.pow(1 - progress, 3);
      const current  = Math.floor(eased * target);

      // Format large numbers with "K+" suffix
      el.textContent = target >= 1000
        ? (current / 1000).toFixed(current >= 1000 ? 0 : 1) + 'K+'
        : current + (progress === 1 ? '+' : '');

      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // Use IntersectionObserver so animation fires when section scrolls into view
  const statsSection = document.querySelector('.stats');
  if (!statsSection) return;

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      Object.entries(targets).forEach(([id, target]) => {
        const el = document.getElementById(id);
        if (el) animateCounter(el, target);
      });
      observer.disconnect(); // run only once
    }
  }, { threshold: 0.3 });

  observer.observe(statsSection);
})();


/* ─────────────────────────────────────────────
   3. TOAST NOTIFICATION SYSTEM
   ───────────────────────────────────────────── */

/**
 * Show a toast notification
 * @param {string} message  - Text to display
 * @param {'success'|'error'|'info'} type
 * @param {number} duration - Auto-dismiss after ms (default 3500)
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;

  container.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(80px)';
    setTimeout(() => toast.remove(), 420);
  }, duration);
}


/* ─────────────────────────────────────────────
   4. LOGIN FUNCTIONALITY (login.html)
   ───────────────────────────────────────────── */
(function initLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  /**
   * Validate a single field and toggle error message
   * @param {string} fieldId
   * @param {string} errorId
   * @param {Function} testFn - returns true if VALID
   * @returns {boolean}
   */
  function validateField(fieldId, errorId, testFn) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    const valid = testFn(field.value.trim());

    field.classList.toggle('error', !valid);
    if (error) error.classList.toggle('show', !valid);
    return valid;
  }

  form.addEventListener('submit', e => {
    //e.preventDefault();

    // Validate all three fields
    const roleOK  = validateField('role',     'roleError',     v => v !== '');
    const emailOK = validateField('email',    'emailError',    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
    const passOK  = validateField('password', 'passwordError', v => v.length >= 6);

    if (!roleOK || !emailOK || !passOK) {
      showToast('Please fix the errors above.', 'error');
      return;
    }

    const role  = document.getElementById('role').value;
    const email = document.getElementById('email').value.trim();

    // Store a minimal "session" so other pages can greet the user
    sessionStorage.setItem('loggedInUser', JSON.stringify({ role, email }));

    showToast('Login successful! Redirecting…', 'success', 1800);

    // Redirect after short delay
    setTimeout(() => {
      if (role === 'doctor') {
        window.location.href = 'doctors.html';
      } else {
        window.location.href = 'appointments.html';
      }
    }, 1500);
  });

  // Live clear errors on input
  ['role', 'email', 'password'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const errEl = document.getElementById(id + 'Error');
      if (errEl) errEl.classList.remove('show');
    });
  });
})();


/* ─────────────────────────────────────────────
   5. DOCTOR SEARCH / FILTER (doctors.html)
   ───────────────────────────────────────────── */
(function initDoctorSearch() {
  const searchInput = document.getElementById('doctorSearch');
  if (!searchInput) return;

  const grid      = document.getElementById('doctorsGrid');
  const noResults = document.getElementById('noResults');
  // Collect all real doctor cards (exclude the noResults placeholder)
  const cards     = Array.from(grid.querySelectorAll('.doctor-card'));

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
      const name      = card.dataset.name      || '';
      const specialty = card.dataset.specialty || '';
      const matches   = name.includes(query) || specialty.includes(query);

      card.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });

    // Show/hide "no results" message
    if (noResults) {
      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  });
})();


/* ─────────────────────────────────────────────
   6. APPOINTMENT FORM (appointments.html)
   ───────────────────────────────────────────── */

(function initAppointments() {
  return;
  const form = document.getElementById('appointmentForm');
  if (!form) return;

  /* ── 6a. Set minimum date to today ── */
  const dateInput = document.getElementById('apptDate');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }

  /* ── 6b. Validation helpers ── */

  /**
   * Validate a field; show/hide its error span
   * @param {string} fieldId
   * @param {string} errorId
   * @param {Function} testFn
   * @returns {boolean}
   */
  function validate(fieldId, errorId, testFn) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (!field) return true;

    const valid = testFn(field.value.trim());
    field.classList.toggle('error', !valid);
    if (error) error.classList.toggle('show', !valid);
    return valid;
  }

  /** True if date is today or in the future */
  function isFutureOrToday(dateStr) {
    if (!dateStr) return false;
    const chosen = new Date(dateStr);
    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    return chosen >= today;
  }

  /* ── 6c. Live error clearing ── */
  ['patientName','phone','apptEmail','doctorSelect','apptDate','timeSlot','symptoms'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input',  () => clearError(id));
    el.addEventListener('change', () => clearError(id));
  });

  function clearError(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) field.classList.remove('error');
    const err = document.getElementById(fieldId + 'Error');
    if (err) err.classList.remove('show');
  }

  /* ── 6d. Form submit ── */
  form.addEventListener('submit', e => {
    //e.preventDefault();

    // Run all validations
    const nameOK   = validate('patientName',  'patientNameError',  v => v.length >= 2);
    const phoneOK  = validate('phone',         'phoneError',        v => /^\d{10}$/.test(v));
    const emailOK  = validate('apptEmail',     'apptEmailError',    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
    const doctorOK = validate('doctorSelect',  'doctorSelectError', v => v !== '');
    const dateOK   = validate('apptDate',      'apptDateError',     isFutureOrToday);
    const timeOK   = validate('timeSlot',      'timeSlotError',     v => v !== '');
    const sympOK   = validate('symptoms',      'symptomsError',     v => v.length >= 5);

    if (!nameOK || !phoneOK || !emailOK || !doctorOK || !dateOK || !timeOK || !sympOK) {
      showToast('Please fill all required fields correctly.', 'error');
      return;
    }

    // Build appointment object
    const appointment = {
      id:       Date.now(),                                          // unique ID
      name:     document.getElementById('patientName').value.trim(),
      phone:    document.getElementById('phone').value.trim(),
      email:    document.getElementById('apptEmail').value.trim(),
      doctor:   document.getElementById('doctorSelect').value,
      date:     document.getElementById('apptDate').value,
      time:     document.getElementById('timeSlot').value,
      symptoms: document.getElementById('symptoms').value.trim(),
      bookedAt: new Date().toLocaleString()
    };

    // Save to localStorage
    saveAppointment(appointment);

    // Reset form
    form.reset();

    // Re-set min date after reset
    if (dateInput) dateInput.setAttribute('min', new Date().toISOString().split('T')[0]);

    showToast('🎉 Appointment booked successfully!', 'success');
    renderHistory();
  });

  /* ── 6e. localStorage helpers ── */

  /** Load all appointments from localStorage */
  function loadAppointments() {
    try {
      return JSON.parse(localStorage.getItem('medicare_appointments') || '[]');
    } catch {
      return [];
    }
  }

  /** Save a new appointment */
  function saveAppointment(appt) {
    const all = loadAppointments();
    all.unshift(appt); // newest first
    localStorage.setItem('medicare_appointments', JSON.stringify(all));
  }

  /** Delete an appointment by ID */
  function deleteAppointment(id) {
    const all     = loadAppointments();
    const updated = all.filter(a => a.id !== id);
    localStorage.setItem('medicare_appointments', JSON.stringify(updated));
    showToast('Appointment cancelled.', 'info');
    renderHistory();
  }

  /* ── 6f. Render appointment history ── */
  function renderHistory() {
    const container = document.getElementById('appointmentHistory');
    if (!container) return;

    const appointments = loadAppointments();
    container.innerHTML = ''; // clear

    if (appointments.length === 0) {
      container.innerHTML = `
        <div class="empty-history">
          <div class="empty-icon">📭</div>
          <p>No appointments booked yet.<br>Use the form to schedule your first visit.</p>
        </div>`;
      return;
    }

    appointments.forEach(appt => {
      const card = document.createElement('div');
      card.className = 'appt-item';

      // Format date nicely
      const dateObj    = new Date(appt.date + 'T00:00:00');
      const dateString = dateObj.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

      card.innerHTML = `
        <button class="btn btn-danger appt-delete" data-id="${appt.id}" title="Cancel appointment">🗑 Cancel</button>
        <h4>👤 ${escHtml(appt.name)}</h4>
        <p>🩺 <strong>Doctor:</strong> ${escHtml(appt.doctor)}</p>
        <p>📅 <strong>Date:</strong> ${dateString} &nbsp;|&nbsp; ⏰ <strong>Time:</strong> ${escHtml(appt.time)}</p>
        <p>📞 ${escHtml(appt.phone)} &nbsp;|&nbsp; ✉️ ${escHtml(appt.email)}</p>
        <p>🩹 <strong>Symptoms:</strong> ${escHtml(appt.symptoms)}</p>
        <p style="font-size:0.78rem;color:var(--muted);margin-top:6px;">Booked on: ${escHtml(appt.bookedAt)}</p>
      `;

      // Attach delete handler
      card.querySelector('.appt-delete').addEventListener('click', function () {
        const idToDelete = Number(this.dataset.id);
        if (confirm('Are you sure you want to cancel this appointment?')) {
          deleteAppointment(idToDelete);
        }
      });

      container.appendChild(card);
    });
  }

  /* ── 6g. Simple HTML-escape to prevent XSS ── */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  // Initial render on page load
  renderHistory();
})(); 



/* ─────────────────────────────────────────────
   7. GREET LOGGED-IN USER (optional UX touch)
   ───────────────────────────────────────────── */
(function greetUser() {
  const user = sessionStorage.getItem('loggedInUser');
  if (!user) return;

  try {
    const { role, email } = JSON.parse(user);
    // Show a subtle greeting toast only once per page load
    const firstName = email.split('@')[0];
    showToast(`Welcome, ${firstName}! (${role})`, 'info', 3000);
  } catch { /* ignore */ }
})();


function toggleAssistant(){

    let popup =
        document.getElementById("aiPopup");

    if(popup.style.display === "block")
    {
        popup.style.display = "none";
    }
    else
    {
        popup.style.display = "block";
    }
  }

function recommendDoctor() {

    let symptom = document
        .getElementById("symptomInput")
        .value
        .toLowerCase();

    let result = "";

    if(symptom.includes("heart") ||
       symptom.includes("chest"))
    {
        result = `
        <div class="assistant-card">
            <h3>👨‍⚕️ Dr. Arjun Sharma</h3>
            <p>❤️ Cardiology Specialist</p>
            <p>📅 Available: Monday - Saturday</p>
            <p>⏰ Timings: 9:00 AM - 5:00 PM</p>
            <p>📍 Room No: 101</p>
            <p><b>Reason:</b> Heart-related symptoms require a cardiologist.</p>
            <a href="/appointments" class="btn">
                Book Appointment
            </a>
        </div>`;
    }

    else if(symptom.includes("head") ||
            symptom.includes("migraine"))
    {
        result = `
        <div class="assistant-card">
            <h3>👨‍⚕️ Dr. Rajesh Kumar</h3>
            <p>🧠 Neurology Specialist</p>
            <p>📅 Available: Monday - Saturday</p>
            <p>⏰ Timings: 10:00 AM - 6:00 PM</p>
            <p>📍 Room No: 205</p>
            <p><b>Reason:</b> Neurological symptoms require a neurologist.</p>
            <a href="/appointments" class="btn">
                Book Appointment
            </a>
        </div>`;
    }

    else if(symptom.includes("bone") ||
            symptom.includes("fracture"))
    {
        result = `
        <div class="assistant-card">
            <h3>👨‍⚕️ Dr. Sunita Rao</h3>
            <p>🦴 Orthopedics Specialist</p>
            <p>📅 Available: Monday - Saturday</p>
            <p>⏰ Timings: 9:00 AM - 4:00 PM</p>
            <p>📍 Room No: 301</p>
            <p><b>Reason:</b> Bone and joint issues are treated by orthopedists.</p>
            <a href="/appointments" class="btn">
                Book Appointment
            </a>
        </div>`;
    }

    else if(symptom.includes("child") ||
            symptom.includes("baby"))
    {
        result = `
        <div class="assistant-card">
            <h3>👨‍⚕️ Dr. Priya Mehta</h3>
            <p>👶 Pediatrics Specialist</p>
            <p>📅 Available: Monday - Saturday</p>
            <p>⏰ Timings: 9:00 AM - 5:00 PM</p>
            <p>📍 Room No: 108</p>
            <p><b>Reason:</b> Child healthcare needs a pediatrician.</p>
            <a href="/appointments" class="btn">
                Book Appointment
            </a>
        </div>`;
    }

    else
    {
        result = `
        <div class="assistant-card">
            <h3>👨‍⚕️ Dr. Vikram Patel</h3>
            <p>🩺 General Medicine</p>
            <p>📅 Available: Monday - Saturday</p>
            <p>⏰ Timings: 8:00 AM - 6:00 PM</p>
            <p>📍 Room No: 102</p>
            <p><b>Reason:</b> General symptoms like fever, cold and cough.</p>
            <a href="/appointments" class="btn">
                Book Appointment
            </a>
        </div>`;
    }

    document.getElementById("recommendation").innerHTML = result;
}