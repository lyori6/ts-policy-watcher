/*
 * Accessibility layer for the T&S Policy Watcher dashboard (WCAG 2.2 AA).
 *
 * The dashboard renders most of its markup from template strings in script.js.
 * Rather than touch every template, this file watches the DOM and adds the
 * semantics that assistive technology needs: names for icon-only controls,
 * keyboard access for clickable cards and rows, state (pressed / expanded /
 * current), dialog behaviour for modals (focus in, focus trapped, Escape,
 * focus returned), and text alternatives for the chart. It changes nothing
 * visually.
 */
(function () {
    'use strict';

    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var NEW_TAB_NOTE = ' (opens in a new tab)';
    var dialogStack = [];
    var lastOutsideOpener = null;

    function isVisible(el) {
        if (!el) return false;
        var style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
    }

    function textOf(el) {
        return (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function setAttr(el, name, value) {
        if (el.getAttribute(name) !== value) el.setAttribute(name, value);
    }

    // ---------- Decorative icons ----------
    function hideDecorativeIcons(root) {
        root.querySelectorAll('i[class*="fa-"]:not([aria-hidden])').forEach(function (icon) {
            icon.setAttribute('aria-hidden', 'true');
        });
    }

    // ---------- Accessible names ----------
    function nameIconOnlyControls(root) {
        root.querySelectorAll('button, a[href], [role="button"]').forEach(function (el) {
            if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
            if (textOf(el) && textOf(el) !== '×') return;
            var name = el.getAttribute('title');
            if (!name) {
                if (el.matches('.close-button, .close-modal, .widget-close, .alert-dismiss, .error-dismiss') || textOf(el) === '×') {
                    name = el.closest('.health-alert-banner') ? 'Dismiss alert' : 'Close';
                }
            }
            if (name) el.setAttribute('aria-label', name);
        });

        // Icon-only links that open a new tab
        root.querySelectorAll('a[target="_blank"]').forEach(function (link) {
            var label = link.getAttribute('aria-label');
            if (label && label.indexOf(NEW_TAB_NOTE.trim()) === -1) {
                link.setAttribute('aria-label', label + NEW_TAB_NOTE);
            } else if (!label && link.querySelector('.sr-only.a11y-newtab') === null) {
                var note = document.createElement('span');
                note.className = 'sr-only a11y-newtab';
                note.textContent = NEW_TAB_NOTE;
                link.appendChild(note);
            }
        });
    }

    // ---------- Pagination ----------
    function enhancePagination(root) {
        root.querySelectorAll('[id$="-pagination-controls"], .pagination-controls, .table-pagination').forEach(function (group) {
            if (!group.getAttribute('role') && group.tagName !== 'NAV') {
                group.setAttribute('role', 'group');
                group.setAttribute('aria-label', 'Pagination');
            }
        });
        root.querySelectorAll('.pagination-btn').forEach(function (btn) {
            var onclick = btn.getAttribute('onclick') || '';
            var label = textOf(btn);
            if (/prevPage/.test(onclick)) {
                setAttr(btn, 'aria-label', 'Previous page');
            } else if (/nextPage/.test(onclick)) {
                setAttr(btn, 'aria-label', 'Next page');
            } else if (/^\d+$/.test(label)) {
                setAttr(btn, 'aria-label', 'Page ' + label);
                if (btn.classList.contains('active')) setAttr(btn, 'aria-current', 'page');
                else btn.removeAttribute('aria-current');
            }
        });
    }

    // ---------- Clickable non-button elements ----------
    function activateOnKey(event) {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            event.currentTarget.click();
        }
    }

    function makeButtonLike(el, label) {
        if (el.dataset.a11yButton) return;
        el.dataset.a11yButton = 'true';
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        if (label) el.setAttribute('aria-label', label);
        el.addEventListener('keydown', activateOnKey);
    }

    function enhanceClickables(root) {
        // Block & moderation pills: simple buttons with no nested controls.
        root.querySelectorAll('.policy-pill[onclick]').forEach(function (pill) {
            var platform = textOf(pill.querySelector('.pill-platform') || pill);
            var name = textOf(pill.querySelector('.pill-name') || pill);
            var updated = textOf(pill.querySelector('.pill-updated') || pill);
            makeButtonLike(pill, name + ', ' + platform + (updated ? ', updated ' + updated : '') + '. Open summary');
        });

        // Policy cards contain their own link and buttons, so the whole card
        // cannot be a button. Give the title a real button instead.
        root.querySelectorAll('.policy-card[onclick]').forEach(function (card) {
            var heading = card.querySelector('.policy-title-section h3, .policy-title-section h4');
            if (heading && !heading.hasAttribute('aria-level') && heading.tagName === 'H4') heading.setAttribute('aria-level', '3');
            if (!heading || heading.querySelector('.a11y-text-button')) return;
            var match = /openPolicyModal\('([^']+)'\)/.exec(card.getAttribute('onclick') || '');
            if (!match) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'a11y-text-button';
            btn.setAttribute('aria-haspopup', 'dialog');
            while (heading.firstChild) btn.appendChild(heading.firstChild);
            heading.appendChild(btn);
            // The card's own click handler opens the modal when the click bubbles up.
        });

        // Matrix platform accordion rows: put the button role on the cell
        // content so table semantics stay intact.
        root.querySelectorAll('tr.platform-accordion-header').forEach(function (row) {
            var content = row.querySelector('.platform-header-content');
            if (!content) return;
            var expanded = !row.classList.contains('collapsed');
            makeButtonLike(content);
            setAttr(content, 'aria-expanded', String(expanded));
        });
    }

    // ---------- Toggle state ----------
    function syncPressedStates(root) {
        root.querySelectorAll('.platform-tab, .range-btn, .history-entry-button').forEach(function (btn) {
            setAttr(btn, 'aria-pressed', String(btn.classList.contains('active')));
        });
        root.querySelectorAll('.nav-tab').forEach(function (tab) {
            var active = tab.classList.contains('active');
            if (tab.dataset.tab) setAttr(tab, 'aria-controls', tab.dataset.tab);
            if (active) setAttr(tab, 'aria-current', 'true');
            else tab.removeAttribute('aria-current');
        });
        root.querySelectorAll('.read-more-btn, .read-more-btn-clean').forEach(function (btn) {
            setAttr(btn, 'aria-expanded', String(btn.classList.contains('expanded')));
        });
        var trigger = document.getElementById('widgetTrigger');
        var form = document.getElementById('widgetForm');
        if (trigger && form) {
            setAttr(trigger, 'aria-expanded', String(form.classList.contains('expanded')));
            setAttr(trigger, 'aria-controls', 'widgetForm');
            if (form.classList.contains('expanded')) form.removeAttribute('inert');
            else setAttr(form, 'inert', '');
        }
    }

    // ---------- Headings rendered below the page's h2 cards ----------
    function fixHeadingLevels(root) {
        root.querySelectorAll('.change-header-clean h4.policy-name-clean').forEach(function (h) {
            setAttr(h, 'aria-level', '3');
        });
    }

    // ---------- Chart text alternative ----------
    function describeCharts(root) {
        root.querySelectorAll('svg.timeline-svg').forEach(function (svg) {
            if (svg.dataset.a11yDescribed) return;
            svg.dataset.a11yDescribed = 'true';
            var points = Array.prototype.map.call(svg.querySelectorAll('circle title'), function (t) {
                return textOf(t);
            });
            svg.setAttribute('role', 'img');
            svg.setAttribute('focusable', 'false');
            var summary = 'Line chart of unique policy changes per week.';
            if (points.length) {
                summary += ' ' + points.length + ' weeks shown, from ' + points[0].replace(/_to_/g, ' to ') + ' to ' + points[points.length - 1].replace(/_to_/g, ' to ') + '. A data table follows.';
            }
            svg.setAttribute('aria-label', summary);
            Array.prototype.forEach.call(svg.children, function (child) {
                if (child.tagName.toLowerCase() !== 'title') child.setAttribute('aria-hidden', 'true');
            });
            if (points.length) {
                var table = document.createElement('table');
                table.className = 'sr-only';
                var html = '<caption>Unique policy changes per week</caption><thead><tr><th scope="col">Week</th><th scope="col">Changes</th></tr></thead><tbody>';
                points.forEach(function (p) {
                    var parts = p.split(':');
                    var week = parts.shift().replace(/_to_/g, ' to ');
                    html += '<tr><td>' + week + '</td><td>' + parts.join(':').replace(/changes?/, '').trim() + '</td></tr>';
                });
                table.innerHTML = html + '</tbody>';
                svg.parentNode.insertBefore(table, svg.nextSibling);
            }
        });
    }

    // ---------- Dialogs ----------
    function dialogFor(el) {
        if (el.matches('.modal')) return el.querySelector('.modal-content') || el;
        if (el.matches('.modal-overlay')) return el.querySelector('[role="dialog"]') || el;
        return el;
    }

    function prepareDialog(el) {
        var dialog = dialogFor(el);
        setAttr(dialog, 'role', 'dialog');
        setAttr(dialog, 'aria-modal', 'true');
        if (!dialog.hasAttribute('aria-labelledby')) {
            var heading = dialog.querySelector('h1, h2, h3');
            if (heading) {
                if (!heading.id) heading.id = (el.id || 'dialog') + '-title-' + Math.random().toString(36).slice(2, 7);
                dialog.setAttribute('aria-labelledby', heading.id);
            }
        }
        if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
        return dialog;
    }

    function openDialogs() {
        var list = [];
        document.querySelectorAll('.modal, .modal-overlay').forEach(function (el) {
            if (isVisible(el)) list.push(el);
        });
        return list;
    }

    function syncDialogs() {
        var open = openDialogs();
        // Newly opened dialogs: remember who opened them and move focus in.
        open.forEach(function (el) {
            if (dialogStack.some(function (d) { return d.el === el; })) return;
            var dialog = prepareDialog(el);
            var opener = document.activeElement;
            var inModal = opener && opener.closest ? opener.closest('.modal, .modal-overlay') : null;
            if (!opener || opener === document.body || (inModal && !isVisible(inModal))) {
                opener = lastOutsideOpener;
            } else if (!inModal) {
                lastOutsideOpener = opener;
            }
            dialogStack.push({ el: el, dialog: dialog, opener: opener });
            window.requestAnimationFrame(function () {
                var target = dialog.querySelector('.close-button, .close-modal, button') || dialog;
                if (!dialog.contains(document.activeElement)) target.focus();
            });
        });
        // Dialogs that closed (hidden or removed): return focus to the opener.
        for (var i = dialogStack.length - 1; i >= 0; i--) {
            var entry = dialogStack[i];
            if (open.indexOf(entry.el) === -1) {
                dialogStack.splice(i, 1);
                var stillOpen = dialogStack.length ? dialogStack[dialogStack.length - 1] : null;
                var opener = entry.opener;
                if (stillOpen && stillOpen.dialog.contains(opener) === false) opener = null;
                if (opener && document.contains(opener) && isVisible(opener)) {
                    opener.focus();
                } else if (stillOpen) {
                    stillOpen.dialog.focus();
                }
            }
        }
        // Hide background content from assistive tech while a dialog is open.
        var page = document.querySelectorAll('body > header, body > nav, body > main, body > footer, body > .newsletter-widget, body > .health-alert-banner, body > .skip-link');
        page.forEach(function (region) {
            if (dialogStack.length) setAttr(region, 'aria-hidden', 'true');
            else if (region.getAttribute('aria-hidden') === 'true') region.removeAttribute('aria-hidden');
        });
    }

    function topDialog() {
        return dialogStack.length ? dialogStack[dialogStack.length - 1] : null;
    }

    function closeDialog(entry) {
        var closer = entry.el.querySelector('.close-button, .close-modal');
        if (closer) closer.click();
        else entry.el.style.display = 'none';
    }

    document.addEventListener('keydown', function (event) {
        var top = topDialog();
        if (!top) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeDialog(top);
            return;
        }
        if (event.key !== 'Tab') return;
        var items = Array.prototype.filter.call(top.dialog.querySelectorAll(FOCUSABLE), isVisible);
        if (!items.length) {
            event.preventDefault();
            top.dialog.focus();
            return;
        }
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === top.dialog)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        } else if (!top.dialog.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
        }
    }, true);

    // ---------- Run everything ----------
    var scheduled = false;
    function enhance() {
        scheduled = false;
        var root = document.body;
        hideDecorativeIcons(root);
        nameIconOnlyControls(root);
        enhancePagination(root);
        enhanceClickables(root);
        syncPressedStates(root);
        fixHeadingLevels(root);
        describeCharts(root);
        syncDialogs();
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(enhance);
    }

    function start() {
        enhance();
        new MutationObserver(schedule).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'disabled']
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
