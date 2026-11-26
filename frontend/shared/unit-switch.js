/* ==================================================
   MM / INCHES UNIT SELECTION START
   Shared unit-selection helper for dimension calculators.

   The selected unit is one website-wide setting, remembered the same way the
   KG/LB switch remembers its own: in localStorage, under its own key, read
   once per page. Every calculator page shows the saved unit on load and a
   change in any one of them applies to all of them.

   The unit is painted onto the page's own MM / INCHES buttons as soon as this
   file runs, which is before the calculator script and before the first
   frame. The calculator then starts in that same unit, so nothing is ever
   shown in MM first and switched to Inches afterwards.
================================================== */
(function () {
    "use strict";

    var INCH_IN_MM = 25.4;
    var STORAGE_KEY = "mw.dimensionUnit";
    var MM = "mm";
    var IN = "in";

    /* Read once, at parse time, so the buttons can be drawn with the saved
       unit before anything is shown. */
    var unit = MM;

    function readStoredUnit() {
        try {
            var saved = window.localStorage.getItem(STORAGE_KEY);

            if (saved === MM || saved === IN) {
                return saved;
            }
        } catch (error) {
            /* Storage can be blocked; millimetres stay the default. */
        }

        return null;
    }

    function storeUnit(next) {
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch (error) {
            /* The choice still applies to this page. */
        }
    }

    var stored = readStoredUnit();

    if (stored) {
        unit = stored;
    }

    /* ---------------- the switch never edits the entered values ---------------- */

    /* Choosing MM or INCHES only changes the unit that the same typed number
       is read in: 100 stays 100 in both modes. Nothing is converted, rounded
       or rewritten here, so a unit switch can never alter what the user
       entered. The function is kept because every calculator calls it from
       its own changeUnit() handler. */
    function convert() {
        return;
    }

    /* ---------------- one selection for the whole site ---------------- */

    function buttonFor(next) {
        return document.getElementById(next === IN ? "inchBtn" : "mmBtn");
    }

    function isActive(button) {
        return Boolean(button) && button.classList.contains("active");
    }

    function noteText(next) {
        return next === IN
            ? "All dimensions are in inches."
            : "All dimensions are in millimeters.";
    }

    /* Draws the switch for one unit. A silent draw freezes the sliding
       indicator first, so a state applied while the page is still loading
       cannot animate. */
    function paint(next, silent) {
        var mmButton = buttonFor(MM);
        var inchButton = buttonFor(IN);

        if (!mmButton || !inchButton) {
            return false;
        }

        var isInches = next === IN;
        var group = mmButton.parentElement;

        if (silent && group) {
            group.classList.add("is-initializing");
        }

        mmButton.classList.toggle("active", !isInches);
        inchButton.classList.toggle("active", isInches);

        mmButton.setAttribute("aria-pressed", String(!isInches));
        inchButton.setAttribute("aria-pressed", String(isInches));

        var note = document.getElementById("unitNote");

        if (note) {
            var text = noteText(next);

            if (note.textContent !== text) {
                note.textContent = text;
            }
        }

        if (silent && group) {
            /* Push the frozen state through the style system before the
               transition comes back, so the final state never animates. */
            void group.offsetWidth;
            group.classList.remove("is-initializing");
        }

        return true;
    }

    /* The switch markup always sits above this script, so this runs during
       parsing: the first painted frame already shows the saved unit. */
    var primed = false;

    function prime() {
        primed = paint(unit, true);
        return primed;
    }

    /* Press the button for the saved unit when the page is not already on it.
       Only a page that does not start from MWUnitSwitch.unit needs this. */
    function applySavedUnit() {
        var button = buttonFor(unit);

        if (!button || isActive(button)) {
            return;
        }

        var group = button.parentElement;

        if (group) {
            group.classList.add("is-initializing");
        }

        button.click();

        if (group) {
            void group.offsetWidth;
            group.classList.remove("is-initializing");
        }
    }

    function remember(next) {
        if (next !== MM && next !== IN) {
            return;
        }

        if (next === unit) {
            return;
        }

        unit = next;
        storeUnit(unit);
    }

    /* The buttons themselves are the single source of truth for what the
       visitor picked: whatever turns active is the unit to remember. */
    function startWatching() {
        document.addEventListener("click", function (event) {
            var target = event.target;
            var button = target && target.closest
                ? target.closest("#mmBtn, #inchBtn")
                : null;

            if (button) {
                remember(button.id === "inchBtn" ? IN : MM);
            }
        }, true);

        /* Another tab or window changed the selection. */
        window.addEventListener("storage", function (event) {
            if (event.key !== STORAGE_KEY) {
                return;
            }

            var next = event.newValue === IN ? IN : (event.newValue === MM ? MM : null);

            if (!next || next === unit) {
                return;
            }

            unit = next;
            applySavedUnit();
        });
    }

    function start() {
        startWatching();

        if (!primed) {
            /* A page that builds its switch later still gets the saved unit. */
            window.setTimeout(function () {
                if (!prime()) {
                    applySavedUnit();
                }
            }, 0);
        }
    }

    function set(next) {
        if (next !== MM && next !== IN) {
            return;
        }

        remember(next);
        applySavedUnit();
    }

    prime();

    window.MWUnitSwitch = {
        convert: convert,
        inchInMm: INCH_IN_MM,
        get unit() {
            return unit;
        },
        set: set
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();

/* ==================================================
   MM / INCHES UNIT SELECTION END
================================================== */
