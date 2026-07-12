(function () {
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function initMobileMenu() {
    var toggle = qs("[data-nav-toggle]");
    var menu = qs("[data-mobile-menu]");
    if (!toggle || !menu) return;

    function setOpen(next) {
      menu.classList.toggle("is-open", next);
      toggle.setAttribute("aria-expanded", String(next));
    }

    toggle.addEventListener("click", function () {
      setOpen(!menu.classList.contains("is-open"));
    });

    qsa("a", menu).forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });

    document.addEventListener("click", function (event) {
      if (!menu.classList.contains("is-open")) return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });
  }

  function initReveals() {
    var items = qsa(".reveal");
    if (!items.length) return;

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      items.forEach(function (item) {
        item.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -4% 0px" },
    );

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  function initRotators() {
    var roots = qsa("[data-rotator]");
    if (!roots.length) return;

    roots.forEach(function (root) {
      var items = qsa("[data-rotator-item]", root);
      if (!items.length) return;

      function activate(index) {
        items.forEach(function (item, itemIndex) {
          item.classList.toggle("is-active", itemIndex === index);
        });
      }

      activate(0);
      if (prefersReducedMotion() || items.length === 1) return;

      var current = 0;
      var interval = Number(root.getAttribute("data-interval") || 3200);

      window.setInterval(function () {
        current = (current + 1) % items.length;
        activate(current);
      }, interval);
    });
  }

  function initYear() {
    qsa("[data-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });
  }

  function initContactForms() {
    var forms = qsa("[data-contact-form]");
    if (!forms.length) return;

    var errorMessages = {
      missing_required_fields: "Please complete each required field before sending.",
      invalid_email: "Please enter a valid email address.",
      rate_limited: "Too many requests came through at once. Please wait a few minutes and try again.",
      send_failed: "We could not send the request just now. Please email contact@ozehr.com instead.",
      timeout: "The request timed out. Please try again or email contact@ozehr.com instead.",
      payload_too_large: "That message is a little too long. Please shorten it and try again.",
    };

    function normalize(value) {
      return String(value || "").trim();
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function setStatus(form, type, message) {
      var status = qs("[data-contact-status]", form);
      if (!status) return;
      status.textContent = message || "";
      status.classList.remove("is-success", "is-error");
      if (type) status.classList.add("is-" + type);
    }

    function setPending(form, pending) {
      var submit = qs("[data-contact-submit]", form);
      var label = qs("[data-contact-submit-label]", form);
      if (!submit) return;
      if (label && !submit.getAttribute("data-default-label")) {
        submit.setAttribute("data-default-label", label.textContent || "Send demo request");
      }
      var defaultLabel = submit.getAttribute("data-default-label") || "Send demo request";
      var pendingLabel = submit.getAttribute("data-pending-label") || "Sending...";
      submit.disabled = pending;
      submit.setAttribute("aria-busy", String(pending));
      if (label) label.textContent = pending ? pendingLabel : defaultLabel;
    }

    function composeDemoMessage(formData) {
      var organization = normalize(formData.get("institution") || formData.get("organization"));
      var role = normalize(formData.get("role"));
      var interest = normalize(formData.get("focus") || formData.get("interest"));
      var note = normalize(formData.get("note"));

      var lines = [
        "ozehr website demo request",
        "",
        "Institution: " + organization,
        "Requested focus: " + (interest || "General product review"),
      ];

      if (role) lines.push("Role: " + role);

      if (note) {
        lines.push("", "Optional note:", note);
      }

      return lines.join("\n");
    }

    function getMessage(form, formData) {
      var composeMode = form.getAttribute("data-contact-compose");
      if (composeMode === "demo") {
        return composeDemoMessage(formData);
      }
      return normalize(formData.get("message"));
    }

    function hasMissingRequiredField(form) {
      return qsa("[required]", form).some(function (field) {
        return !normalize(field.value);
      });
    }

    forms.forEach(function (form) {
      var pageField = qs("[data-contact-page]", form);
      if (pageField) pageField.value = window.location.href;

      form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (hasMissingRequiredField(form)) {
          setStatus(form, "error", errorMessages.missing_required_fields);
          form.reportValidity();
          return;
        }

        var formData = new FormData(form);
        var payload = {
          name: normalize(formData.get("name")),
          email: normalize(formData.get("email")).toLowerCase(),
          topic: normalize(formData.get("topic")),
          message: getMessage(form, formData),
          honeypot: normalize(formData.get("honeypot")),
          page: normalize(formData.get("page") || window.location.href),
        };

        if (!payload.name || !payload.email || !payload.topic || !payload.message) {
          setStatus(form, "error", errorMessages.missing_required_fields);
          return;
        }

        if (!isValidEmail(payload.email)) {
          setStatus(form, "error", errorMessages.invalid_email);
          return;
        }

        setPending(form, true);
        setStatus(form, "", "");

        var controller = new AbortController();
        var timeout = window.setTimeout(function () {
          controller.abort();
        }, 15000);

        fetch(form.getAttribute("action"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
          .then(function (response) {
            return response
              .json()
              .catch(function () {
                return {};
              })
              .then(function (body) {
                if (!response.ok || !body.ok) {
                  throw new Error(body.error || "send_failed");
                }
                return body;
              });
          })
          .then(function () {
            form.reset();
            if (pageField) pageField.value = window.location.href;
            var successMessage =
              form.getAttribute("data-success-message") || "Thanks. Your request was sent, and the ozehr team will follow up soon.";
            setStatus(form, "success", successMessage);
          })
          .catch(function (error) {
            var errorCode = error && error.name === "AbortError" ? "timeout" : error.message;
            var message = errorMessages[errorCode] || errorMessages.send_failed;
            setStatus(form, "error", message);
          })
          .finally(function () {
            window.clearTimeout(timeout);
            setPending(form, false);
          });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.documentElement.classList.add("js-ready");
    initMobileMenu();
    initReveals();
    initRotators();
    initYear();
    initContactForms();
  });
})();
