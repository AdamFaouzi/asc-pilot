/* ASC Pilot — marketing site behaviour.
   No dependencies, no analytics, no cookies. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Mobile menu: hamburger morphs to an X, overlay staggers in ---- */

  var burger = document.querySelector('.burger');
  var menu = document.getElementById('menu');

  if (burger && menu) {
    var setMenu = function (open) {
      burger.setAttribute('aria-expanded', String(open));
      menu.setAttribute('data-open', String(open));
      menu.setAttribute('aria-hidden', String(!open));
      document.body.style.overflow = open ? 'hidden' : '';
    };

    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });

    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        burger.focus();
      }
    });
  }

  /* ---- Scroll reveal ---- */

  var reveals = document.querySelectorAll('[data-reveal]');

  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('shown'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('shown');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });

    Array.prototype.forEach.call(reveals, function (el) { revealObserver.observe(el); });
  }

  /* ---- Tagline reveal: words light up one at a time, in reading order ---- */

  var block = document.querySelector('.reveal-block');

  if (block && !reduced && 'IntersectionObserver' in window) {
    var text = block.textContent.replace(/\s+/g, ' ').trim();
    block.textContent = '';

    text.split(' ').forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'w';
      span.textContent = word;
      span.style.transitionDelay = (i * 45) + 'ms';
      block.appendChild(span);
      block.appendChild(document.createTextNode(' '));
    });

    var words = block.querySelectorAll('.w');
    var wordObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Array.prototype.forEach.call(words, function (w) { w.classList.add('on'); });
        wordObserver.disconnect();
      });
    }, { threshold: 0.35 });

    wordObserver.observe(block);
  }

  /* ---- Contact form: validate here, hand off to the visitor's mail app ---- */

  var form = document.getElementById('contact-form');
  if (!form) return;

  var mailTo = form.getAttribute('data-mailto');

  var showError = function (field, message) {
    field.setAttribute('data-invalid', 'true');
    field.querySelector('.error').textContent = message;
  };

  var clearError = function (field) {
    field.removeAttribute('data-invalid');
    field.querySelector('.error').textContent = '';
  };

  Array.prototype.forEach.call(form.querySelectorAll('input, textarea'), function (input) {
    input.addEventListener('input', function () { clearError(input.closest('.field')); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = form.elements.name;
    var email = form.elements.email;
    var business = form.elements.business;
    var message = form.elements.message;
    var ok = true;

    [name, email, business, message].forEach(function (el) { clearError(el.closest('.field')); });

    if (!message.value.trim()) {
      showError(message.closest('.field'), 'Tell us a little about the business.');
      ok = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
      showError(email.closest('.field'), 'That does not look like an email address.');
      ok = false;
    }
    if (!name.value.trim()) {
      showError(name.closest('.field'), 'Please add your name.');
      ok = false;
    }

    if (!ok) {
      form.querySelector('[data-invalid="true"] input, [data-invalid="true"] textarea').focus();
      return;
    }

    var subject = 'Website enquiry from ' + name.value.trim();
    var body =
      'Name: ' + name.value.trim() + '\n' +
      'Email: ' + email.value.trim() + '\n' +
      'Business: ' + (business.value.trim() || 'not given') + '\n\n' +
      message.value.trim();

    var status = document.getElementById('form-status');
    status.textContent = 'Opening your email app with the message ready to send.';

    window.location.href =
      'mailto:' + mailTo +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  });
})();
