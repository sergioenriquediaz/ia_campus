/* ==========================================================================
   Fogón de la Abuela — app.js
   JavaScript puro, sin librerías. Se carga con "defer", así que cuando se
   ejecuta el HTML ya está disponible.

   Funciones:
     1. Marca de JavaScript activo (clase .js en <html>)
     2. initNav ........ menú móvil (hamburguesa)
     3. initFilters .... filtros del menú de platos
     4. initForm ....... validación del formulario y confirmación
     5. initBackToTop .. visibilidad del botón "Volver arriba"

   Importante: este sitio es una maqueta académica. El formulario NO envía
   ni guarda datos: no hay servidor, ni fetch, ni localStorage.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. MARCA DE JAVASCRIPT ACTIVO
     style.css muestra los filtros y el botón ☰ solo cuando existe esta clase.
     Sin JavaScript, el menú y los 12 platos siguen visibles.
     ------------------------------------------------------------------------ */
  document.documentElement.classList.add('js');


  /* ------------------------------------------------------------------------
     2. MENÚ MÓVIL (por debajo de 1024 px)
     Patrón "disclosure": un botón con aria-expanded muestra u oculta la lista.
     Se cierra con Esc, al elegir un enlace o al hacer clic fuera del menú.
     ------------------------------------------------------------------------ */
  function initNav() {
    var toggle = document.getElementById('nav-toggle');
    var list = document.getElementById('menu-principal');
    var label = document.getElementById('nav-toggle-texto');
    if (!toggle || !list) return;

    var nav = toggle.closest('nav');
    var desktop = window.matchMedia('(min-width: 64em)');

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }

    // Cambia el estado del botón; el CSS muestra la lista según aria-expanded
    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Cerrar menú' : 'Abrir menú';
    }

    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    // Al elegir un enlace, el menú se cierra y el navegador salta a la sección
    list.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    // Esc cierra el menú y devuelve el foco al botón
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Clic o toque fuera del menú lo cierra
    document.addEventListener('click', function (event) {
      if (isOpen() && !nav.contains(event.target)) setOpen(false);
    });

    // Si la ventana pasa a escritorio con el menú abierto, se reinicia el estado
    desktop.addEventListener('change', function (event) {
      if (event.matches) setOpen(false);
    });
  }


  /* ------------------------------------------------------------------------
     3. FILTROS DEL MENÚ
     Un filtro activo a la vez (aria-pressed). Los platos de otras categorías
     se ocultan con el atributo hidden, que también los quita de lo que leen
     los lectores de pantalla. Una región role="status" anuncia el resultado.
     ------------------------------------------------------------------------ */
  function initFilters() {
    var group = document.querySelector('.filters');
    var dishes = document.querySelectorAll('#lista-platos [data-category]');
    var status = document.getElementById('menu-estado');
    if (!group || !dishes.length) return;

    var buttons = group.querySelectorAll('.filters__btn');

    // Delegación de eventos: un solo listener para los 5 botones
    group.addEventListener('click', function (event) {
      var button = event.target.closest('.filters__btn');
      if (!button) return;

      var filter = button.dataset.filter;
      var visibles = 0;

      buttons.forEach(function (btn) {
        btn.setAttribute('aria-pressed', String(btn === button));
      });

      dishes.forEach(function (dish) {
        var show = filter === 'todos' || dish.dataset.category === filter;
        dish.hidden = !show;
        if (show) visibles += 1;
      });

      status.textContent = filter === 'todos'
        ? 'Mostrando los ' + visibles + ' platos.'
        : button.textContent.trim() + ': ' + visibles + ' platos.';
    });
  }


  /* ------------------------------------------------------------------------
     4. FORMULARIO DE RESERVA
     - Reglas aprobadas: nombre ≥ 2 caracteres; celular de 10 dígitos que
       empieza por 3; correo válido; fecha de hoy a 30 días; hora de 11:30 a. m.
       a 8:30 p. m. (domingos hasta 4:30 p. m.) en intervalos de 15 min;
       de 1 a 12 personas; comentarios opcionales de máximo 300 caracteres.
     - Valida al enviar y al salir de un campo que ya mostró un error.
     - Si hay errores, NO continúa, muestra un resumen y lleva el foco al primero.
     - Si todo es válido, muestra la confirmación. No se envía nada.
     ------------------------------------------------------------------------ */
  function initForm() {
    var form = document.getElementById('form-reserva');
    if (!form) return;

    // novalidate: se usan los mensajes propios en lugar de los del navegador.
    // Si este archivo no carga, el navegador valida con las reglas del HTML.
    form.noValidate = true;

    var fields = {
      nombre: document.getElementById('nombre'),
      celular: document.getElementById('celular'),
      correo: document.getElementById('correo'),
      fecha: document.getElementById('fecha'),
      hora: document.getElementById('hora'),
      personas: document.getElementById('personas'),
      comentarios: document.getElementById('comentarios')
    };

    var summary = document.getElementById('resumen-errores');
    var summaryText = document.getElementById('resumen-errores-texto');
    var counter = document.getElementById('comentarios-contador');
    var confirmation = document.getElementById('confirmacion');
    var confirmationTitle = document.getElementById('confirmacion-titulo');
    var newBookingButton = document.getElementById('nueva-reserva');

    // Constantes del negocio (en minutos desde la medianoche)
    var APERTURA = 11 * 60 + 30;        // 11:30 a. m.
    var ULTIMA_HORA = 20 * 60 + 30;     // 8:30 p. m. (lunes a sábado)
    var ULTIMA_HORA_DOMINGO = 16 * 60 + 30; // 4:30 p. m.
    var INTERVALO = 15;                 // minutos
    var DIAS_ANTICIPACION = 30;
    var MAX_COMENTARIOS = 300;

    /* ---------- Utilidades de fecha y hora ---------- */

    // Fecha local en formato AAAA-MM-DD (el que usa <input type="date">)
    function toISODate(date) {
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      return date.getFullYear() + '-' + month + '-' + day;
    }

    // Rango permitido: hoy (según el reloj del dispositivo) a hoy + 30 días
    function getDateLimits() {
      var today = new Date();
      var last = new Date(today.getFullYear(), today.getMonth(), today.getDate() + DIAS_ANTICIPACION);
      return { min: toISODate(today), max: toISODate(last) };
    }

    // Convierte "AAAA-MM-DD" en un objeto Date local (sin desfase de zona horaria)
    function parseISODate(value) {
      var parts = value.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    // Convierte "HH:MM" en minutos desde la medianoche
    function toMinutes(value) {
      var parts = value.split(':').map(Number);
      return parts[0] * 60 + parts[1];
    }

    // "18:30" → "6:30 p. m."
    function formatTime(value) {
      var parts = value.split(':').map(Number);
      var hour12 = ((parts[0] + 11) % 12) + 1;
      var suffix = parts[0] < 12 ? 'a. m.' : 'p. m.';
      return hour12 + ':' + String(parts[1]).padStart(2, '0') + ' ' + suffix;
    }

    // "2026-11-29" → "domingo, 29 de noviembre de 2026"
    function formatDate(value) {
      return parseISODate(value).toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }

    function isSunday(dateValue) {
      return parseISODate(dateValue).getDay() === 0;
    }

    // Aplica min y max al campo de fecha para que el calendario los respete
    function applyDateLimits() {
      var limits = getDateLimits();
      fields.fecha.min = limits.min;
      fields.fecha.max = limits.max;
    }

    applyDateLimits();

    /* ---------- Reglas de validación ----------
       Cada regla recibe el campo y devuelve un mensaje de error comprensible,
       o una cadena vacía si el valor es válido. */
    var rules = {
      nombre: function (input) {
        var value = input.value.trim();
        if (!value) return 'Escribe tu nombre.';
        if (value.length < 2) return 'Tu nombre debe tener al menos 2 letras.';
        return '';
      },

      celular: function (input) {
        var digits = input.value.replace(/[\s-]/g, ''); // se ignoran espacios y guiones
        if (!digits) return 'Escribe tu número de celular.';
        if (!/^\d+$/.test(digits)) return 'Escribe solo números, sin letras ni símbolos.';
        if (!/^3\d{9}$/.test(digits)) {
          return 'Escribe un celular de 10 dígitos que empiece por 3. Ej.: 300 123 4567.';
        }
        return '';
      },

      correo: function (input) {
        var value = input.value.trim();
        if (!value) return 'Escribe tu correo electrónico.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
        }
        return '';
      },

      fecha: function (input) {
        // badInput: el usuario dejó la fecha incompleta (ej. sin el año)
        if (input.validity.badInput) return 'Escribe una fecha completa: día, mes y año.';
        if (!input.value) return 'Elige la fecha de tu reserva.';
        var limits = getDateLimits();
        if (input.value < limits.min) return 'La fecha no puede ser anterior a hoy.';
        if (input.value > limits.max) return 'Recibimos reservas con máximo 30 días de anticipación.';
        return '';
      },

      hora: function (input) {
        if (input.validity.badInput) return 'Escribe una hora completa.';
        if (!input.value) return 'Elige la hora de tu reserva.';

        var minutes = toMinutes(input.value);
        // La regla del domingo solo se aplica si ya hay una fecha válida
        var sunday = fields.fecha.value && !rules.fecha(fields.fecha) && isSunday(fields.fecha.value);
        var limit = sunday ? ULTIMA_HORA_DOMINGO : ULTIMA_HORA;

        if (minutes < APERTURA) return 'Abrimos a las 11:30 a. m. Elige una hora desde ese momento.';
        if (minutes > limit) {
          return sunday
            ? 'Los domingos recibimos reservas hasta las 4:30 p. m.'
            : 'De lunes a sábado recibimos reservas hasta las 8:30 p. m.';
        }
        if (minutes % INTERVALO !== 0) {
          return 'Elige una hora en intervalos de 15 minutos, por ejemplo 12:15 o 12:30.';
        }
        return '';
      },

      personas: function (input) {
        if (input.validity.badInput) return 'Escribe solo números.';
        if (!input.value) return 'Indica cuántas personas vienen.';
        var value = Number(input.value);
        if (!Number.isInteger(value)) return 'Escribe un número entero de personas.';
        if (value < 1 || value > 12) {
          return 'Elige entre 1 y 12 personas. Para grupos mayores, escríbenos por WhatsApp.';
        }
        return '';
      },

      comentarios: function (input) {
        if (input.value.length > MAX_COMENTARIOS) {
          return 'Los comentarios pueden tener máximo 300 caracteres.';
        }
        return '';
      }
    };

    /* ---------- Mostrar y quitar errores ---------- */

    // Escribe el mensaje junto al campo y marca aria-invalid.
    // El mensaje ya está asociado al campo con aria-describedby en el HTML.
    function setError(input, message) {
      var errorElement = document.getElementById(input.id + '-error');
      errorElement.textContent = message; // textContent: nunca se interpreta como HTML
      if (message) {
        input.setAttribute('aria-invalid', 'true');
      } else {
        input.removeAttribute('aria-invalid');
      }
    }

    // Valida un campo, muestra u oculta su error y devuelve true si es válido
    function validateField(input) {
      var message = rules[input.id](input);
      setError(input, message);
      return message === '';
    }

    function hasError(input) {
      return input.getAttribute('aria-invalid') === 'true';
    }

    function clearAllErrors() {
      Object.keys(fields).forEach(function (key) {
        setError(fields[key], '');
      });
      summary.hidden = true;
      summaryText.textContent = '';
    }

    function updateCounter() {
      counter.textContent = fields.comentarios.value.length + '/' + MAX_COMENTARIOS + ' caracteres';
    }

    /* ---------- Validación mientras se corrige ----------
       No se muestran errores mientras la persona escribe por primera vez.
       Solo se revalida un campo que YA mostró un error:
       - al escribir (input): el error desaparece en cuanto el valor es válido;
       - al salir del campo (blur): se actualiza el mensaje si sigue inválido. */
    Object.keys(fields).forEach(function (key) {
      var input = fields[key];

      input.addEventListener('input', function () {
        if (hasError(input) && rules[key](input) === '') setError(input, '');
      });

      input.addEventListener('blur', function () {
        if (hasError(input)) validateField(input);
      });
    });

    // Si cambia la fecha (por ejemplo, a un domingo), se revisa de nuevo la hora elegida
    fields.fecha.addEventListener('change', function () {
      if (fields.hora.value) validateField(fields.hora);
    });

    // Contador de caracteres de los comentarios
    fields.comentarios.addEventListener('input', updateCounter);

    /* ---------- Envío ---------- */
    form.addEventListener('submit', function (event) {
      // Siempre se evita el envío: es una maqueta sin servidor
      event.preventDefault();

      applyDateLimits(); // por si la página quedó abierta desde el día anterior

      // Valida todos los campos y guarda los que tienen error, en orden
      var invalid = Object.keys(fields)
        .map(function (key) { return fields[key]; })
        .filter(function (input) { return !validateField(input); });

      if (invalid.length > 0) {
        // Resumen de errores (role="alert" lo anuncia) y foco en el primer campo con error
        summary.hidden = false;
        summaryText.textContent = invalid.length === 1
          ? 'Hay 1 campo por corregir. Revisa el mensaje junto a él.'
          : 'Hay ' + invalid.length + ' campos por corregir. Revisa los mensajes junto a cada uno.';
        invalid[0].focus();
        return;
      }

      showConfirmation();
    });

    /* ---------- Confirmación ---------- */
    function showConfirmation() {
      var personas = Number(fields.personas.value);

      // Se usa textContent para mostrar los datos tal como se escribieron
      document.getElementById('confirmacion-nombre').textContent = fields.nombre.value.trim();
      document.getElementById('confirmacion-fecha').textContent = formatDate(fields.fecha.value);
      document.getElementById('confirmacion-hora').textContent = formatTime(fields.hora.value);
      document.getElementById('confirmacion-personas').textContent =
        personas === 1 ? '1 persona' : personas + ' personas';

      summary.hidden = true;
      form.hidden = true;
      confirmation.hidden = false;

      // El foco pasa al título para que el lector de pantalla anuncie la confirmación
      confirmationTitle.focus();
    }

    // "Hacer otra reserva": limpia el formulario y vuelve al primer campo
    newBookingButton.addEventListener('click', function () {
      form.reset();
      clearAllErrors();
      updateCounter();
      applyDateLimits();
      confirmation.hidden = true;
      form.hidden = false;
      fields.nombre.focus();
    });
  }


  /* ------------------------------------------------------------------------
     5. BOTÓN "VOLVER ARRIBA"
     Se oculta mientras el hero está en pantalla y aparece al bajar.
     IntersectionObserver evita escuchar cada evento de scroll.
     Sin soporte (o sin JavaScript), el botón permanece visible.
     ------------------------------------------------------------------------ */
  function initBackToTop() {
    var button = document.getElementById('volver-arriba');
    var hero = document.getElementById('inicio');
    if (!button || !hero || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      button.hidden = entries[0].isIntersecting;
    });

    observer.observe(hero);
  }


  /* ------------------------------------------------------------------------
     INICIO
     ------------------------------------------------------------------------ */
  initNav();
  initFilters();
  initForm();
  initBackToTop();
})();
