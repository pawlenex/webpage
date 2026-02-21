/* ============================================================
   PawLenx — Enterprise Pet Care Platform
   Main JavaScript — Interactions & Functionality
   ============================================================ */

(function () {
  'use strict';

  // ---- DOM Ready ----
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    initHeader();
    initMobileMenu();
    initSearchTabs();
    initPricingToggle();
    initFAQ();
    initBackToTop();
    initCountUp();
    initScrollAnimations();
    initSmoothScroll();
  }

  // ============================================================
  // HEADER — Sticky shrink + shadow on scroll
  // ============================================================
  function initHeader() {
    const header = document.getElementById('mainHeader');
    if (!header) return;

    let lastScrollY = 0;
    let ticking = false;

    function onScroll() {
      lastScrollY = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(function () {
          if (lastScrollY > 10) {
            header.classList.add('scrolled');
          } else {
            header.classList.remove('scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ============================================================
  // MOBILE MENU
  // ============================================================
  function initMobileMenu() {
    const toggle = document.getElementById('mobileToggle');
    const menu = document.getElementById('mobileMenu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      toggle.classList.toggle('active');
      menu.classList.toggle('active');
      document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : '';
    });

    // Close menu when clicking a link
    const links = menu.querySelectorAll('.mobile-link');
    links.forEach(function (link) {
      link.addEventListener('click', function () {
        toggle.classList.remove('active');
        menu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // ============================================================
  // SEARCH TABS (Hero)
  // ============================================================
  function initSearchTabs() {
    const tabs = document.querySelectorAll('.search-tab');
    if (!tabs.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');

        // Update placeholder text based on tab
        const type = tab.dataset.tab;
        const fields = document.querySelectorAll('.search-field');
        
        if (type === 'companion') {
          updateSearchFields(fields, 'Pet Type', 'Enter breed or mix', 'City or ZIP code');
        } else if (type === 'nutrition') {
          updateSearchFields(fields, 'Pet Type', 'Pet\'s age (years)', 'Weight (lbs)');
        } else if (type === 'ai') {
          updateSearchFields(fields, 'Pet Type', 'Primary concern', 'Upload photo (optional)');
        }
      });
    });
  }

  function updateSearchFields(fields, label1Placeholder, input1Placeholder, input2Placeholder) {
    if (fields.length >= 3) {
      var labels = [];
      var inputs = [];
      fields.forEach(function(f) {
        var label = f.querySelector('label');
        var input = f.querySelector('input');
        if (label) labels.push(label);
        if (input) inputs.push(input);
      });
      if (inputs.length >= 2) {
        inputs[0].placeholder = input1Placeholder;
        inputs[1].placeholder = input2Placeholder;
      }
    }
  }

  // ============================================================
  // PRICING TOGGLE (Monthly / Annual)
  // ============================================================
  function initPricingToggle() {
    const switchBtn = document.getElementById('pricingSwitch');
    if (!switchBtn) return;

    const labels = document.querySelectorAll('.pricing-label');
    const amounts = document.querySelectorAll('.price-amount');
    let isAnnual = false;

    switchBtn.addEventListener('click', function () {
      isAnnual = !isAnnual;
      switchBtn.classList.toggle('active', isAnnual);

      labels.forEach(function (label) {
        var period = label.dataset.period;
        label.classList.toggle('active', (isAnnual && period === 'annual') || (!isAnnual && period === 'monthly'));
      });

      amounts.forEach(function (amount) {
        var price = isAnnual ? amount.dataset.annual : amount.dataset.monthly;
        amount.textContent = '$' + price;
      });
    });
  }

  // ============================================================
  // FAQ ACCORDION
  // ============================================================
  function initFAQ() {
    const items = document.querySelectorAll('.faq-item');
    if (!items.length) return;

    items.forEach(function (item) {
      var question = item.querySelector('.faq-question');
      if (!question) return;

      question.addEventListener('click', function () {
        var isActive = item.classList.contains('active');

        // Close all items
        items.forEach(function (i) { i.classList.remove('active'); });

        // Open clicked if it wasn't already open
        if (!isActive) {
          item.classList.add('active');
        }
      });
    });
  }

  // ============================================================
  // BACK TO TOP BUTTON
  // ============================================================
  function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;

    function toggleBtn() {
      if (window.scrollY > 500) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', toggleBtn, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ============================================================
  // COUNT UP ANIMATION (Stats Section)
  // ============================================================
  function initCountUp() {
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');
    if (!statNumbers.length) return;

    var hasAnimated = false;

    function animateNumbers() {
      if (hasAnimated) return;

      var statsSection = document.querySelector('.stats-section');
      if (!statsSection) return;

      var rect = statsSection.getBoundingClientRect();
      var windowHeight = window.innerHeight;

      if (rect.top < windowHeight * 0.85) {
        hasAnimated = true;

        statNumbers.forEach(function (el) {
          var target = parseInt(el.dataset.target, 10);
          var duration = 2000;
          var startTime = null;

          function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);

            // Ease out cubic
            var easedProgress = 1 - Math.pow(1 - progress, 3);
            var current = Math.floor(easedProgress * target);

            if (target >= 1000000) {
              el.textContent = (current / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
            } else if (target >= 1000) {
              el.textContent = Math.floor(current / 1000) + 'K';
            } else {
              el.textContent = current;
            }

            if (progress < 1) {
              window.requestAnimationFrame(step);
            } else {
              // Final value
              if (target >= 1000000) {
                el.textContent = (target / 1000000).toFixed(0) + 'M';
              } else if (target >= 1000) {
                el.textContent = Math.floor(target / 1000) + 'K';
              } else {
                el.textContent = target;
              }
            }
          }

          window.requestAnimationFrame(step);
        });
      }
    }

    window.addEventListener('scroll', animateNumbers, { passive: true });
    animateNumbers(); // Check on load
  }

  // ============================================================
  // SCROLL ANIMATIONS (Intersection Observer)
  // ============================================================
  function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;

    var animateElements = document.querySelectorAll(
      '.service-card, .step-card, .feature-item, .nutrition-card, ' +
      '.ai-feature-card, .testimonial-card, .gallery-item, .pricing-card, ' +
      '.stat-card, .split-content, .split-image'
    );

    if (!animateElements.length) return;

    // Set initial state
    animateElements.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, index) {
          if (entry.isIntersecting) {
            // Stagger the animation slightly
            setTimeout(function () {
              entry.target.style.opacity = '1';
              entry.target.style.transform = 'translateY(0)';
            }, index * 80);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    animateElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // ============================================================
  // SMOOTH SCROLL for anchor links
  // ============================================================
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        if (href === '#') return;

        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          var headerHeight = document.querySelector('.main-header')
            ? document.querySelector('.main-header').offsetHeight
            : 0;
          var announcementBar = document.querySelector('.announcement-bar');
          var announcementHeight = announcementBar ? announcementBar.offsetHeight : 0;

          var targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - announcementHeight - 20;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }

})();
