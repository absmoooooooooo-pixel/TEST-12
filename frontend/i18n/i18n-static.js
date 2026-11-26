/* ==================================================
   CENTRAL MULTILINGUAL RUNTIME
   One translator for every page and calculator.

   Every page is an English page. A language choice only
   rewrites visible text in place: the URL, the page's
   links, form values, selected options and calculation
   results are never changed.
================================================== */
(function () {
    "use strict";

    var STORAGE_KEY = "mw-lang";
    var html = document.documentElement;
    var config = window.__MW_I18N_CONFIG || {};
    /* Generated page tree: the URL fixes the language. In-place switching
       is disabled; navigation goes to the equivalent language page. */
    var lockedLanguage = config.lockLanguage || "";
    var languages = config.languages || [];

    /* Centralised language-name table. Every supported language name is
       available in every supported website language. The tooltip runtime
       below reads this table using the CURRENT website language, never the
       browser locale and never the language being hovered. */
    var LANGUAGE_NAMES = {
        en: { mr: "Marathi", hi: "Hindi", en: "English", de: "German", es: "Spanish", fr: "French", ja: "Japanese", zh: "Chinese", pt: "Portuguese", ar: "Arabic" },
        mr: { mr: "मराठी", hi: "हिंदी", en: "इंग्रजी", de: "जर्मन", es: "स्पॅनिश", fr: "फ्रेंच", ja: "जपानी", zh: "चिनी", pt: "पोर्तुगीज", ar: "अरबी" },
        hi: { mr: "मराठी", hi: "हिंदी", en: "अंग्रेज़ी", de: "जर्मन", es: "स्पेनिश", fr: "फ्रेंच", ja: "जापानी", zh: "चीनी", pt: "पुर्तगाली", ar: "अरबी" },
        de: { mr: "Marathi", hi: "Hindi", en: "Englisch", de: "Deutsch", es: "Spanisch", fr: "Französisch", ja: "Japanisch", zh: "Chinesisch", pt: "Portugiesisch", ar: "Arabisch" },
        es: { mr: "Marathi", hi: "Hindi", en: "Inglés", de: "Alemán", es: "Español", fr: "Francés", ja: "Japonés", zh: "Chino", pt: "Portugués", ar: "Árabe" },
        fr: { mr: "Marathi", hi: "Hindi", en: "Anglais", de: "Allemand", es: "Espagnol", fr: "Français", ja: "Japonais", zh: "Chinois", pt: "Portugais", ar: "Arabe" },
        ja: { mr: "マラーティー語", hi: "ヒンディー語", en: "英語", de: "ドイツ語", es: "スペイン語", fr: "フランス語", ja: "日本語", zh: "中国語", pt: "ポルトガル語", ar: "アラビア語" },
        zh: { mr: "马拉地语", hi: "印地语", en: "英语", de: "德语", es: "西班牙语", fr: "法语", ja: "日语", zh: "中文", pt: "葡萄牙语", ar: "阿拉伯语" },
        pt: { mr: "Marathi", hi: "Hindi", en: "Inglês", de: "Alemão", es: "Espanhol", fr: "Francês", ja: "Japonês", zh: "Chinês", pt: "Português", ar: "Árabe" },
        ar: { mr: "الماراثية", hi: "الهندية", en: "الإنجليزية", de: "الألمانية", es: "الإسبانية", fr: "الفرنسية", ja: "اليابانية", zh: "الصينية", pt: "البرتغالية", ar: "العربية" }
    };

    var dictionaries = window.MW_I18N_DICTIONARIES || {};
    /* Dictionaries are downloaded one at a time, only when needed. English is
       shipped in the HTML itself and never needs a dictionary download. */
    var dictBase = config.dictBase || "dict-";
    var dictVersion = config.version || "49";
    var dictPromises = Object.create(null);
    /* A generated page opens in the language of its own URL, which begin()
       applies before the first paint. English is only the neutral
       starting dictionary while the locked one is installed. */
    var currentCode = "en";
    var dictionary = normalizeDictionary(dictionaries.en);
    var currentIndex = indexDictionary(dictionary);
    var pageSources = readSourceMap();
    var nodeSources = new WeakMap();
    /* The original leading/trailing whitespace of each text node is kept
       separately. Dictionary entries sometimes contain decorative spaces of
       their own; without this, switching back to English would inherit them
       and show " Plate Weight Calculator " instead of the original heading. */
    var nodeWhitespace = new WeakMap();
    var attrSources = new WeakMap();
    var switching = false;
    var observer = null;
    var originalMeta = null;
    var missingTranslations = Object.create(null);
    var debugMissing = !!(
        config.debug || window.__MW_I18N_DEBUG__ || /[?&]i18nDebug=1/.test(location.search)
    );
    var skipSelector = ".lang-switch, script, style, textarea, code, pre, kbd, samp, [data-i18n-skip]";
    /* Set when the browser's own page translator (Google Translate, Edge
       Translate) is rewriting this document. From that moment the runtime is
       passive: it never writes text again, so the two engines cannot undo
       each other. See translatorMarkers(). */
    var translatorDetected = false;
    /* Chrome's translator and the tooltip frame it injects. */
    var translatorSelector = "font, .skiptranslate, #goog-gt-tt, iframe.goog-te-banner-frame";
    var translatedAttrs = ["placeholder", "aria-label", "title", "alt"];
    /* Every translated value in every language, mapped back to its English
       source. This lets a page recover the English text even when a string
       was produced by a dictionary other than the current one. */
    var globalReverse = buildGlobalReverse();
    var globalReverseTemplates = buildGlobalReverseTemplates();

    /* ---------------- dictionary helpers ---------------- */

    function has(object, key) {
        return !!object && Object.prototype.hasOwnProperty.call(object, key);
    }

    function availableLanguage(code) {
        if (!code) {
            return false;
        }
        if (code === "en") {
            return true;
        }
        for (var i = 0; i < languages.length; i += 1) {
            if (languages[i] && languages[i].code === code) {
                return true;
            }
        }
        return false;
    }

    /* Loads a single language file with a script tag: works over http(s), in
       an installed PWA, and from a local file:// WebView asset where fetch()
       is not allowed. The promise is cached, so a language is never
       downloaded twice in one page session. */
    function ensureDictionary(code) {
        if (!code || code === "en" || has(dictionaries, code)) {
            return Promise.resolve(true);
        }
        if (!availableLanguage(code)) {
            return Promise.resolve(false);
        }
        if (dictPromises[code]) {
            return dictPromises[code];
        }

        dictPromises[code] = new Promise(function (resolve) {
            var script = document.createElement("script");
            var done = false;

            function finish(ok) {
                if (done) {
                    return;
                }
                done = true;

                if (ok) {
                    globalReverse = buildGlobalReverse();
                    globalReverseTemplates = buildGlobalReverseTemplates();
                } else {
                    delete dictPromises[code];
                    if (script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                }

                resolve(Boolean(ok));
            }

            script.src = dictBase + encodeURIComponent(code) + "/dict-" +
                encodeURIComponent(code) + ".js?v=" + encodeURIComponent(dictVersion);
            /* Some static hosts serve .js without a charset. Force UTF-8 so
               Devanagari, Arabic, CJK and every other dictionary decode
               correctly instead of appearing as mojibake. */
            script.charset = "UTF-8";
            script.async = true;
            script.onload = function () { finish(has(dictionaries, code)); };
            script.onerror = function () { finish(false); };
            (document.head || document.documentElement).appendChild(script);
        });

        return dictPromises[code];
    }

    function normalizeDictionary(raw) {
        return {
            code: raw && raw.code ? raw.code : "en",
            terms: (raw && raw.terms) || {},
            strings: (raw && raw.strings) || {},
            templates: (raw && raw.templates) || {}
        };
    }

    function buildGlobalReverse() {
        var map = {};
        Object.keys(dictionaries).forEach(function (code) {
            if (code === "en") {
                return;
            }
            var source = dictionaries[code] || {};
            [source.strings, source.terms].forEach(function (section) {
                Object.keys(section || {}).forEach(function (key) {
                    var value = section[key];
                    if (value && value !== key && !has(map, value)) {
                        map[value] = key;
                    }
                });
            });
        });
        return map;
    }

    /* Dictionary entries with placeholders describe complete composed strings
       such as "{count} calculations saved across all calculators." or
       "Enter {term}". Once the placeholders are filled, the rendered string is
       no longer in any dictionary. These helpers compile both directions so a
       live result can be recognized in any language and rebuilt in the active
       language without leaking the previous language's words. */
    function escapeRegExp(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function normalizeTemplateText(text) {
        return latinDigits(text)
            .replace(/\u066B/g, ".")
            .replace(/\u066C/g, ",");
    }

    function compileTemplatePattern(template) {
        var normalized = normalizeTemplateText(template);
        var parts = normalized.split(/(\{\w+\})/);
        var pattern = "";
        var params = [];
        var literal = "";

        parts.forEach(function (part, index) {
            var placeholder = part.match(/^\{(\w+)\}$/);
            if (placeholder) {
                params.push(placeholder[1]);
                /* A greedy final capture keeps text with repeated separator
                   words ("of", ":") assigned to the correct placeholder. */
                pattern += index === parts.length - 2 ? "(.+)" : "(.+?)";
            } else {
                pattern += escapeRegExp(part);
                literal += part;
            }
        });

        if (!params.length) {
            return null;
        }
        return {
            regex: new RegExp("^" + pattern + "$"),
            params: params,
            specificity: literal.length + literal.replace(/\s/g, "").length
        };
    }

    function buildTemplateRecords(dict, reverse) {
        var records = [];
        [dict.templates, dict.strings, dict.terms].forEach(function (section) {
            Object.keys(section || {}).forEach(function (key) {
                var value = section[key];
                if (!value || value === key) {
                    return;
                }
                var source = reverse ? value : key;
                var target = reverse ? key : value;
                var compiled = compileTemplatePattern(source);
                if (compiled) {
                    records.push({
                        key: key,
                        target: target,
                        regex: compiled.regex,
                        params: compiled.params,
                        specificity: compiled.specificity
                    });
                }
            });
        });
        records.sort(function (left, right) {
            return right.specificity - left.specificity;
        });
        return records;
    }

    function fillTemplateRecord(value, records, preserveDigits) {
        var normalized = preserveDigits
            ? String(value == null ? "" : value)
            : normalizeTemplateText(value);
        for (var i = 0; i < records.length; i += 1) {
            var record = records[i];
            var match = normalized.match(record.regex);
            if (!match) {
                continue;
            }
            var values = {};
            record.params.forEach(function (name, index) {
                values[name] = match[index + 1];
            });
            return fill(record.target, values);
        }
        return null;
    }

    function buildGlobalReverseTemplates() {
        var records = [];
        Object.keys(dictionaries).forEach(function (code) {
            if (code === "en") {
                return;
            }
            records = records.concat(buildTemplateRecords(dictionaries[code] || {}, true));
        });
        records.sort(function (left, right) {
            return right.specificity - left.specificity;
        });
        return records;
    }

    function indexDictionary(dict) {
        var lowered = {};
        var reverseStrings = {};
        var reverseTerms = {};

        Object.keys(dict.terms || {}).forEach(function (key) {
            lowered[key.toLowerCase()] = dict.terms[key];
            if (dict.terms[key] !== key) {
                reverseTerms[dict.terms[key]] = key;
            }
        });
        Object.keys(dict.strings || {}).forEach(function (key) {
            if (dict.strings[key] !== key) {
                reverseStrings[dict.strings[key]] = key;
            }
        });

        return {
            lowerTerms: lowered,
            reverseStrings: reverseStrings,
            reverseTerms: reverseTerms,
            forwardTemplates: buildTemplateRecords(dict, false)
        };
    }

    function fill(template, values) {
        return String(template).replace(/\{(\w+)\}/g, function (whole, key) {
            return has(values, key) ? values[key] : whole;
        });
    }

    function termIn(value, dict, index) {
        if (!value) {
            return null;
        }
        if (has(dict.terms, value)) {
            return dict.terms[value];
        }
        var lowered = index.lowerTerms[value.toLowerCase()];
        if (lowered) {
            return lowered;
        }
        if (has(dict.strings, value)) {
            return dict.strings[value];
        }
        return null;
    }

    /* Only complete interface strings and known patterns are translated.
       Formulas, dimensions, standard numbers, grades and values return null
       and therefore stay exactly as written in the English page. */
    /* Numbers on the page are formatted in the reader's own digits (7,850
       can appear as ७,८५० or ٧٬٨٥٠). Dictionary keys always use Latin digits,
       so lookups are done on Latin digits and the result is converted back to
       the digit family the page is already using. */
    var DIGIT_ZEROS = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0xff10];
    var LOCAL_DIGITS = /[\u0660-\u0669\u06f0-\u06f9\u0966-\u096f\u09e6-\u09ef\u0a66-\u0a6f\u0ae6-\u0aef\u0b66-\u0b6f\u0be6-\u0bef\uFF10-\uFF19]/g;

    function digitZeroOf(text) {
        var found = String(text || "").match(LOCAL_DIGITS);
        if (!found) {
            return 0;
        }
        var code = found[0].charCodeAt(0);
        for (var i = 0; i < DIGIT_ZEROS.length; i += 1) {
            if (code >= DIGIT_ZEROS[i] && code <= DIGIT_ZEROS[i] + 9) {
                return DIGIT_ZEROS[i];
            }
        }
        return 0;
    }

    function latinDigits(text) {
        return String(text == null ? "" : text).replace(LOCAL_DIGITS, function (character) {
            var zero = digitZeroOf(character);
            return zero ? String(character.charCodeAt(0) - zero) : character;
        });
    }

    function localDigits(text, zero) {
        if (!zero) {
            return text;
        }
        return String(text).replace(/[0-9]/g, function (character) {
            return String.fromCharCode(zero + Number(character));
        });
    }

    function translateWith(text, dict, index) {
        var value = String(text == null ? "" : text).trim();
        if (!value) {
            return null;
        }

        /* Arabic locale digits are handled above; Arabic separators must be
           normalized too, otherwise "0٫0785 metric tonnes" never matches the
           Latin template "0.0785 metric tonnes". The separators are restored
           on the translated result below. */
        var zero = digitZeroOf(value);
        var source = latinDigits(value)
            .replace(/\u066B/g, ".")
            .replace(/\u066C/g, ",");
        var result = translateValue(source, dict, index);
        if (result === null) {
            return null;
        }
        /* A whole sentence can match a template entry ("{name} weight
           calculator"). Rendering it here would put a literal brace on the
           page, because the caller has no value to fill in. Treat it as
           untranslated instead: the source sentence stays readable and the
           gap is reported by the missing-translation log. */
        if (/\{\w+\}/.test(result)) {
            return null;
        }
        result = localDigits(result, zero);
        if (dict.code === "ar" || currentCode === "ar") {
            result = result.replace(/\./g, "\u066B").replace(/,/g, "\u066C");
        }
        return result;
    }

    function translateValue(value, dict, index) {

        var strings = dict.strings || {};
        var templates = dict.templates || {};
        var terms = dict.terms || {};

        /* Some generated dictionaries contain an identity "strings" entry
           beside a real "terms" translation. The identity entry must never
           shadow the translation. */
        if (has(strings, value) && strings[value] !== value) {
            return strings[value];
        }
        if (has(templates, value)) {
            return templates[value];
        }
        if (has(terms, value) && terms[value] !== value) {
            return terms[value];
        }

        /* Source text in HTML can be wrapped over several lines. Dictionary
           entries are written with single spaces, so compare the collapsed
           form before giving up. */
        var collapsed = value.replace(/\s+/g, " ");

        if (collapsed !== value) {
            var collapsedResult = translateWith(collapsed, dict, index);
            if (collapsedResult !== null) {
                return collapsedResult;
            }
        }

        /* Dashboard cards label their link "Open <title>" and filter pills
           describe themselves as "Plates & sheets, 3 tools". Both must be
           recognised before the generic template pass, whose "{name} Weight
           Calculator" entry would otherwise swallow the whole phrase and leave
           the action word untranslated. */
        match = value.match(/^Open (.+) Weight Calculator$/);
        if (match && templates.open) {
            return fill(templates.open, { name: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^(.+), (\d+) tools$/);
        if (match && templates.categoryTools) {
            return fill(templates.categoryTools, {
                name: termIn(match[1], dict, index) || translateWith(match[1], dict, index) || match[1],
                count: match[2]
            });
        }

        /* Composed dictionary entries whose placeholders have already been
           filled by the calculator, for example a live history count. */
        var composed = fillTemplateRecord(value, index.forwardTemplates || []);
        if (composed !== null) {
            return composed;
        }

        /* Placeholder text: "Enter diameter", "Enter flange width", etc. */
        match = value.match(/^Enter (.+)$/);
        if (match && templates.enter) {
            return fill(templates.enter, { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^(.+) is required\. Please enter a value\.$/);
        if (match && strings["required value"]) {
            return fill(strings["required value"], { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^(.+) must be a number greater than zero\.$/);
        if (match && strings["must be number greater than zero"]) {
            return fill(strings["must be number greater than zero"], { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^(.+) must be a number\.$/);
        if (match && strings["must be number"]) {
            return fill(strings["must be number"], { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^(.+) must be zero or greater\.$/);
        if (match && strings["must be zero or greater"]) {
            return fill(strings["must be zero or greater"], { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^(.+) must be greater than zero\.$/);
        if (match && strings["must be greater than zero"]) {
            return fill(strings["must be greater than zero"], { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^Thickness must be smaller than the inside radius \(ID \u00f7 2 = (.+)\)\.$/);
        if (match && strings["thickness below inside radius"]) {
            return strings["thickness below inside radius"].replace("{value}", match[1]);
        }

        match = value.match(/^Knuckle radius must be smaller than the inside radius \(ID \u00f7 2 = (.+)\)\.$/);
        if (match && strings["knuckle below inside radius"]) {
            return strings["knuckle below inside radius"].replace("{value}", match[1]);
        }

        match = value.match(/^Dish height must not exceed the inside diameter \(ID = (.+)\)\.$/);
        if (match && strings["dish height below inside diameter"]) {
            return strings["dish height below inside diameter"].replace("{value}", match[1]);
        }

        var match = value.match(/^Enter (.+)$/);
        if (match && templates.enter) {
            var entered = termIn(match[1], dict, index);
            if (entered) {
                return fill(templates.enter, { term: entered });
            }
        }

        match = value.match(/^(.+?) \(([^()]*)\)$/);
        if (match) {
            var labelled = termIn(match[1], dict, index);
            if (labelled) {
                return labelled + " (" + match[2] + ")";
            }
        }

        match = value.match(/^(.+?) \| Metal Weight Calculator$/);
        if (match && templates.siteName) {
            var pageName = translateWith(match[1], dict, index) || match[1];
            return pageName + " | " + templates.siteName;
        }

        match = value.match(/^(.+) Weight Calculator$/);
        if (match && templates.h1) {
            return fill(templates.h1, { name: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^(.+) Dimensions$/);
        if (match && templates.dimensions) {
            return fill(templates.dimensions, { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^Current category: (.+)$/);
        if (match && templates.category) {
            return fill(templates.category, { name: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^Volume Per (.+)$/);
        if (match && templates.volumePer) {
            return fill(templates.volumePer, { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^Single (.+) Weight$/);
        if (match && templates.weightPer) {
            return fill(templates.weightPer, { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^(.+?) \u2014 ([\d.,]+) g\/cm\u00B3$/);
        if (match) {
            var material = termIn(match[1], dict, index);
            if (material) {
                return material + " \u2014 " + match[2] + " g/cm\u00B3";
            }
        }

        match = value.match(/^(.+) is required\. Please enter a valid positive number\.$/);
        if (match && templates.required) {
            return fill(templates.required, { term: termIn(match[1], dict, index) || match[1] });
        }

        match = value.match(/^All dimensions are in (.+?)\.$/);
        if (match) {
            var unit = termIn(match[1], dict, index);
            if (unit && templates.allDimensionsIn) {
                return fill(templates.allDimensionsIn, { unit: unit });
            }
        }

        match = value.match(/^([\d.,]+) metric tonnes$/);
        if (match && templates.tonnes) {
            return fill(templates.tonnes, { value: match[1] });
        }

        match = value.match(/^Hole area removed: ([\d.,]+) mm\u00b2 of ([\d.,]+) mm\u00b2 gross face \(([\d.]+)%\)$/);
        if (match && strings["hole area removed"]) {
            return strings["hole area removed"]
                .replace("{removed}", match[1])
                .replace("{gross}", match[2])
                .replace("{percent}", match[3]);
        }

        match = value.match(/^(\d+) equal divisions at ([\d.]+)\u00B0$/);
        if (match && strings["equal divisions at"]) {
            return strings["equal divisions at"]
                .replace("{count}", match[1])
                .replace("{angle}", match[2]);
        }

        match = value.match(/^(\d+) calculations? saved for this calculator\.$/);
        if (match && strings["calculations saved"] !== undefined) {
            return strings["calculations saved"].replace("{count}", match[1]);
        }

        match = value.match(/^Open calculation history, (\d+) calculations?$/);
        if (match && strings["open history count"] !== undefined) {
            return strings["open history count"].replace("{count}", match[1]);
        }

        match = value.match(/^(\d+(?:[.,]\d+)?) ([A-Za-z][A-Za-z ]{0,12})$/);
        if (match) {
            var measured = termIn(match[2], dict, index);
            if (measured && measured !== match[2]) {
                return match[1] + " " + measured;
            }
        }

        match = value.match(/^(\d+(?:[.,]\d+)?) (pc|pcs)$/);
        if (match) {
            var pieces = strings[match[2]] || match[2];
            return match[1] + " " + pieces;
        }

        match = value.match(/^([\d.,]+) tonnes total \u00b7 (.+)$/);
        if (match) {
            var total = templates.tonnes
                ? fill(templates.tonnes, { value: match[1] })
                : match[1] + " " + (strings["tonnes total"] || "tonnes total");
            return total + " \u00b7 " + (translateWith(match[2], dict, index) || match[2]);
        }

        match = value.match(/^Material: (.+?)( \| (.+))?$/);
        if (match && strings["Material: "]) {
            var named = termIn(match[1], dict, index) || match[1];
            var rest = match[3] ? " | " + (translateWith(match[3], dict, index) || match[3]) : "";
            return strings["Material: "] + named + rest;
        }

        match = value.match(/^Dimensions: (.+)$/);
        if (match && strings["Dimensions: "]) {
            return strings["Dimensions: "] + match[1];
        }

        match = value.match(/^([A-Za-z][A-Za-z ]{1,24}): (.+)$/);
        if (match) {
            var caption = termIn(match[1], dict, index) || strings[match[1]];
            if (caption && caption !== match[1]) {
                return caption + ": " + (translateWith(match[2], dict, index) || match[2]);
            }
        }

        /* Keep a leading icon or arrow (for example ↺ Reset) and translate
           only the human-readable words after it. */
        match = value.match(/^([^A-Za-z0-9]+)\s+(.+)$/);
        if (match) {
            var afterIcon = translateWith(match[2], dict, index);
            if (afterIcon) {
                return match[1] + " " + afterIcon;
            }
        }

        /* Step caption with the density baked in: "Material density
           (7,850 kg/m³) is multiplied in this step." */
        match = value.match(/^Material density \((.+?) kg\/m\u00B3\) is multiplied in this step\.$/);
        if (match) {
            var densityStep = strings["Material density ({d} kg/m\u00B3) is multiplied in this step."];
            if (densityStep) {
                return densityStep.split("{d}").join(match[1]);
            }
        }

        /* Category tab descriptions: "Structural sections, 5 tools". */
        match = value.match(/^(.+), (\d+) tools?$/);
        if (match && strings["tools"]) {
            var catName = termIn(match[1], dict, index) || translateWith(match[1], dict, index);
            if (catName && catName !== match[1]) {
                return catName + ", " + match[2] + " " + strings["tools"];
            }
        }

        /* "Open Dish Ends Calculator" and similar button descriptions. */
        match = value.match(/^Open (.+)$/);
        if (match && strings["Open"]) {
            var opened = translateWith(match[1], dict, index) || termIn(match[1], dict, index);
            if (opened && opened !== match[1]) {
                return strings["Open"] + " " + opened;
            }
        }

        /* Material density readout: "Carbon Steel — 7.85 g/cm³". The unit and
           the number stay exactly as calculated, only the name is translated. */
        match = value.match(/^(.+?) \u2014 (\S+ g\/cm\u00B3)$/);
        if (match) {
            var materialName = termIn(match[1], dict, index) ||
                translateWith(match[1], dict, index);
            if (materialName && materialName !== match[1]) {
                return materialName + " \u2014 " + match[2];
            }
        }

        if (value.indexOf(" | ") !== -1 || value.indexOf(" \u00B7 ") !== -1) {
            var separator = value.indexOf(" | ") !== -1 ? " | " : " \u00B7 ";
            var changed = false;
            var mapped = value.split(separator).map(function (segment) {
                var part = translateWith(segment, dict, index);
                if (part && part !== segment) {
                    changed = true;
                    return part;
                }
                return segment;
            });
            if (changed) {
                return mapped.join(separator);
            }
        }

        return null;
    }

    function translate(text) {
        /* In English the runtime dictionary is intentionally empty: the source
           text is already English. Returning null here made callers without a
           null guard print the literal string "null" into the UI. */
        if (currentCode === "en") {
            return text === null || text === undefined ? "" : String(text);
        }
        return translateWith(text, dictionary, currentIndex);
    }

    /* Callers that compose text themselves (calculator metadata such as
       "{n} edition" or "reaffirmed {date}") need the raw template, placeholders
       included. translate() rejects those results on purpose, so that a page
       never renders a literal brace, which is why this lookup exists. */
    function translateTemplate(text) {
        if (currentCode === "en" || text === null || text === undefined) {
            return null;
        }
        var templates = (dictionary && dictionary.templates) || {};
        var key = latinDigits(String(text))
            .replace(/\u066B/g, ".")
            .replace(/\u066C/g, ",");
        if (has(templates, key) && templates[key] !== key) {
            return templates[key];
        }
        return null;
    }

    /* A missing dictionary entry falls back to English, but it must never be
       silent. Development tools can read this list (or open with ?i18nDebug=1
       to see a console warning for every untranslated source string). */
    function noteMissing(source) {
        if (!source || currentCode === "en") {
            return;
        }
        missingTranslations[source] = true;
        if (debugMissing && typeof console !== "undefined" && console.warn) {
            console.warn("[i18n] Missing translation: " + source);
        }
    }

    /* ---------------- source recovery ---------------- */

    function leadingWhitespace(text) {
        var match = String(text == null ? "" : text).match(/^\s*/);
        return match ? match[0] : "";
    }

    function trailingWhitespace(text) {
        var match = String(text == null ? "" : text).match(/\s*$/);
        return match ? match[0] : "";
    }

    /* Remember the spacing from the first (English) pass and reuse it for
       every later language. The text itself may have been translated many
       times by then, so its current spacing is no longer authoritative. */
    function whitespaceFor(node, raw) {
        if (node && nodeWhitespace.has(node)) {
            return nodeWhitespace.get(node);
        }
        var spacing = {
            lead: leadingWhitespace(raw),
            trail: trailingWhitespace(raw)
        };
        if (node) {
            nodeWhitespace.set(node, spacing);
        }
        return spacing;
    }

    function clearNodeMemory(node) {
        nodeSources.delete(node);
        nodeWhitespace.delete(node);
    }

    function readSourceMap() {
        var element = document.getElementById("mw-i18n-sources");
        if (!element) {
            return { text: {}, attrs: {}, kind: "calculator" };
        }
        try {
            var parsed = JSON.parse(element.textContent || "{}");
            parsed.text = parsed.text || {};
            parsed.attrs = parsed.attrs || {};
            return parsed;
        } catch (error) {
            return { text: {}, attrs: {}, kind: "calculator" };
        }
    }

    function reverseText(value) {
        if (has(currentIndex.reverseStrings, value)) {
            return currentIndex.reverseStrings[value];
        }
        if (has(currentIndex.reverseTerms, value)) {
            return currentIndex.reverseTerms[value];
        }
        return null;
    }

    /* A composed interface string that already contains translated words must
       never be cached as its own English source. Technical symbols (superscripts,
       degree signs, arrows, Greek letters) are allowed; writing systems are not. */
    function hasForeignScript(text) {
        return /[\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\uFF01-\uFF60]/.test(String(text || ""));
    }

    function sourceFor(text, node, trustCache) {
        var value = String(text == null ? "" : text).trim();
        var latinValue = normalizeTemplateText(value);
        if (!value) {
            return null;
        }

        if (node && nodeSources.has(node)) {
            var cached = nodeSources.get(node);
            if (trustCache) {
                return cached;
            }
            var cachedTranslation = translateWith(cached, dictionary, currentIndex);
            var rendered = cachedTranslation === null ? cached : String(cachedTranslation);
            /* The numeral localizer may have changed only the digit family.
               Compare on Latin digits so a localized readout never looks like
               a different source string and poisons the English cache. */
            if (normalizeTemplateText(rendered).trim() === latinValue.trim()) {
                return cached;
            }
            clearNodeMemory(node);
        }

        if (has(pageSources.text, value) || has(pageSources.text, latinValue)) {
            var pageSource = pageSources.text[value] || pageSources.text[latinValue];
            if (node) {
                nodeSources.set(node, pageSource);
            }
            return pageSource;
        }

        var reversed = reverseText(value) || reverseText(latinValue);
        if (reversed) {
            if (node) {
                nodeSources.set(node, reversed);
            }
            return reversed;
        }

        /* The text on screen may be a translation produced by a language that
           is no longer selected (for example Japanese after switching to
           Portuguese). Recover its English source instead of treating the
           foreign translation as source text. */
        if (has(globalReverse, value) || has(globalReverse, latinValue)) {
            var source = globalReverse[value] || globalReverse[latinValue];
            if (node) {
                nodeSources.set(node, source);
            }
            return source;
        }

        var composedSource = fillTemplateRecord(value, globalReverseTemplates, true) ||
            fillTemplateRecord(latinValue, globalReverseTemplates, true);
        if (composedSource) {
            if (node) {
                nodeSources.set(node, composedSource);
            }
            return composedSource;
        }

        /* English pages keep their visible text as the source. Latin text on a
           translated page is normally an untranslated label, so it is also a
           safe source. */
        if ((currentCode === "en" || /[A-Za-z]/.test(latinValue)) && !hasForeignScript(latinValue)) {
            if (node) {
                nodeSources.set(node, latinValue);
            }
            return latinValue;
        }

        return null;
    }

    function sourceForAttribute(value, element, attribute, trustCache) {
        var current = String(value == null ? "" : value).trim();
        var normalized = normalizeTemplateText(current);
        if (!current) {
            return null;
        }

        var stored = attrSources.get(element);
        var cached = stored && stored[attribute];

        if (cached) {
            if (trustCache) {
                return cached;
            }
            var cachedTranslation = translateWith(cached, dictionary, currentIndex);
            var renderedAttribute = cachedTranslation === null ? cached : String(cachedTranslation);
            if (normalizeTemplateText(renderedAttribute).trim() === normalized.trim()) {
                return cached;
            }
            delete stored[attribute];
        }

        if (has(pageSources.attrs, current)) {
            rememberAttribute(element, attribute, pageSources.attrs[current]);
            return pageSources.attrs[current];
        }

        var reversed = reverseText(current) || reverseText(normalized);
        if (reversed) {
            rememberAttribute(element, attribute, reversed);
            return reversed;
        }

        if (has(globalReverse, current) || has(globalReverse, normalized)) {
            var reversedSource = globalReverse[current] || globalReverse[normalized];
            rememberAttribute(element, attribute, reversedSource);
            return reversedSource;
        }

        var composed = fillTemplateRecord(current, globalReverseTemplates, true) ||
            fillTemplateRecord(normalized, globalReverseTemplates, true);
        if (composed) {
            rememberAttribute(element, attribute, composed);
            return composed;
        }

        if ((currentCode === "en" || /[A-Za-z]/.test(normalized)) && !hasForeignScript(normalized)) {
            rememberAttribute(element, attribute, normalized);
            return normalized;
        }

        return null;
    }

    function rememberAttribute(element, attribute, source) {
        var stored = attrSources.get(element);
        if (!stored) {
            stored = {};
            attrSources.set(element, stored);
        }
        stored[attribute] = source;
    }

    /* ---------------- DOM translation ---------------- */

    /* Read-only: is a browser translator working on this page? Chrome marks
       <html> and wraps rewritten text in <font>; the tooltip frame and the
       skiptranslate container appear with it. */
    function translatorMarkers() {
        var root = document.documentElement;
        if (/(^|\s)translated-(ltr|rtl)(\s|$)/.test(" " + (root.className || "") + " ")) {
            return true;
        }
        try {
            return !!document.querySelector(".skiptranslate, #goog-gt-tt, iframe.goog-te-banner-frame");
        } catch (error) {
            return false;
        }
    }

    /* Called from the live observer when translator output is spotted. One way
       marker: the user chose to translate this page, so this runtime stays out
       of the way until the next load or an explicit language switch. */
    function goPassive() {
        translatorDetected = true;
        if (observer) {
            observer.disconnect();
        }
    }

    function shouldSkip(node) {
        if (translatorDetected) {
            return true;
        }
        var element = node.nodeType === 1 ? node : node.parentElement;
        if (!element || !element.closest) {
            return false;
        }
        /* Never rewrite text a translator has produced or wrapped. */
        if (element.closest(translatorSelector)) {
            return true;
        }
        return !!element.closest(skipSelector);
    }

    function collectTextNodes(root) {
        var nodes = [];
        if (!root) {
            return nodes;
        }
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        while (walker.nextNode()) {
            if (!shouldSkip(walker.currentNode)) {
                nodes.push(walker.currentNode);
            }
        }
        return nodes;
    }

    function applyTextNode(node, trustCache) {
        if (shouldSkip(node)) {
            return false;
        }
        var raw = node.nodeValue;
        if (!raw || raw.trim().length === 0) {
            return false;
        }

        var source = sourceFor(raw, node, trustCache);
        if (!source) {
            return false;
        }

        var translated = currentCode === "en"
            ? source
            : translateWith(source, dictionary, currentIndex);
        /* When the selected language has no entry for a string, show the
           English original rather than keeping the previous language's text. */
        if (translated === null) {
            noteMissing(source);
            translated = source;
        }

        var spacing = whitespaceFor(node, raw);
        var next = spacing.lead + translated + spacing.trail;
        if (next !== raw) {
            node.nodeValue = next;
        }
        nodeSources.set(node, source);
        return next !== raw;
    }

    /* data-i18n-skip protects a subtree whose text must stay untouched, such as
       an engineering drawing whose digits are dimensions. The element's own
       aria-label or title is a sentence about that drawing and still needs its
       translation, so only an inherited marker stops attribute translation. */
    function skipOwnAttributes(element) {
        if (translatorDetected) {
            return true;
        }
        if (element.closest && element.closest(translatorSelector)) {
            return true;
        }
        var parent = element.parentElement;
        return !!(parent && parent.closest && parent.closest(skipSelector));
    }

    function applyAttributes(element, trustCache) {
        if (skipOwnAttributes(element)) {
            return;
        }
        translatedAttrs.forEach(function (attribute) {
            if (!element.hasAttribute || !element.hasAttribute(attribute)) {
                return;
            }
            var source = sourceForAttribute(element.getAttribute(attribute), element, attribute, trustCache);
            if (!source) {
                return;
            }
            var translated = currentCode === "en"
                ? source
                : translateWith(source, dictionary, currentIndex);
            if (translated === null) {
                noteMissing(source);
                translated = source;
            }
            if (translated !== element.getAttribute(attribute)) {
                element.setAttribute(attribute, translated);
            }
            rememberAttribute(element, attribute, source);
        });
    }

    function captureAttributeSources(element) {
        translatedAttrs.forEach(function (attribute) {
            if (element.hasAttribute && element.hasAttribute(attribute)) {
                sourceForAttribute(element.getAttribute(attribute), element, attribute);
            }
        });
    }

    function applyPage(trustCache) {
        collectTextNodes(document.body).forEach(function (node) {
            applyTextNode(node, trustCache);
        });
        Array.prototype.forEach.call(
            document.querySelectorAll("[placeholder], [aria-label], [title], [alt]"),
            function (element) {
                applyAttributes(element, trustCache);
            }
        );
    }

    /* Digit localization is part of the same translation transaction. It is
       called only while the translator's observer is disconnected, so the
       numeral pass can never become a second, independently painted pass. */
    function refreshDigits() {
        /* The numeral pass writes to text nodes; doing that over translated
           output would undo the translator's work node by node. */
        if (translatorDetected) {
            return;
        }
        if (window.MWTextNumbers && typeof window.MWTextNumbers.refresh === "function") {
            window.MWTextNumbers.refresh();
        }
    }

    /* ---------------- page chrome ---------------- */

    function languageInfo(code) {
        for (var index = 0; index < languages.length; index += 1) {
            if (languages[index].code === code) {
                return languages[index];
            }
        }
        return { code: code, dir: code === "ar" ? "rtl" : "ltr", ogLocale: code };
    }

    function setMeta(selector, content) {
        if (!content) {
            return;
        }
        var element = document.querySelector(selector);
        if (element) {
            element.setAttribute("content", content);
        }
    }

    function pageHeadingSource() {
        if (pageSources.h1) {
            return pageSources.h1;
        }
        var heading = document.querySelector("h1");
        if (!heading) {
            return "";
        }
        return sourceFor(heading.textContent || "", null) || (heading.textContent || "").trim();
    }

    function translatedPageMeta() {
        var info = pageSources.kind || html.getAttribute("data-mw-page") || "calculator";
        var templates = dictionary.templates || {};
        var siteName = templates.siteName || "";
        var title = "";
        var description = "";

        if (info === "home") {
            title = templates.homeTitle || "";
            description = templates.homeDescription || "";
        } else if (info === "about") {
            title = templates.aboutTitle || "";
            description = templates.aboutDescription || "";
        } else {
            var headingSource = pageHeadingSource();
            var heading = translateWith(headingSource, dictionary, currentIndex) || headingSource;
            title = templates.title ? fill(templates.title, { page: heading }) : "";
            description = templates.description ? fill(templates.description, { name: heading }) : "";
        }

        return { title: title, description: description, siteName: siteName };
    }

    function captureOriginalMeta() {
        originalMeta = {
            title: document.title,
            description: (document.querySelector('meta[name="description"]') || {}).content || "",
            ogTitle: (document.querySelector('meta[property="og:title"]') || {}).content || "",
            ogDescription: (document.querySelector('meta[property="og:description"]') || {}).content || "",
            ogSiteName: (document.querySelector('meta[property="og:site_name"]') || {}).content || "",
            twitterTitle: (document.querySelector('meta[name="twitter:title"]') || {}).content || "",
            twitterDescription: (document.querySelector('meta[name="twitter:description"]') || {}).content || "",
            appleTitle: (document.querySelector('meta[name="apple-mobile-web-app-title"]') || {}).content || "",
            locale: (document.querySelector('meta[property="og:locale"]') || {}).content || "en_US"
        };
    }

    function restoreOriginalMeta() {
        if (!originalMeta) {
            return;
        }
        if (originalMeta.title) {
            document.title = originalMeta.title;
        }
        setMeta('meta[name="description"]', originalMeta.description);
        setMeta('meta[property="og:title"]', originalMeta.ogTitle);
        setMeta('meta[property="og:description"]', originalMeta.ogDescription);
        setMeta('meta[property="og:site_name"]', originalMeta.ogSiteName);
        setMeta('meta[name="twitter:title"]', originalMeta.twitterTitle);
        setMeta('meta[name="twitter:description"]', originalMeta.twitterDescription);
        setMeta('meta[name="apple-mobile-web-app-title"]', originalMeta.appleTitle);
        setMeta('meta[property="og:locale"]', originalMeta.locale);
    }

    function updatePageMeta() {
        /* Authored localized pages already carry reviewed SEO copy; a runtime
           template would replace it with a generated approximation. */
        if (config.preserveMeta) {
            return;
        }
        if (currentCode === "en" && originalMeta) {
            restoreOriginalMeta();
            return;
        }

        var meta = translatedPageMeta();
        if (meta.title) {
            document.title = meta.title;
            setMeta('meta[property="og:title"]', meta.title);
            setMeta('meta[name="twitter:title"]', meta.title);
        }
        if (meta.description) {
            setMeta('meta[name="description"]', meta.description);
            setMeta('meta[property="og:description"]', meta.description);
            setMeta('meta[name="twitter:description"]', meta.description);
        }
        if (meta.siteName) {
            setMeta('meta[property="og:site_name"]', meta.siteName);
            setMeta('meta[name="apple-mobile-web-app-title"]', meta.siteName);
        }
    }

    function updateLocaleMeta() {
        var info = languageInfo(currentCode);
        setMeta('meta[property="og:locale"]', info.ogLocale || currentCode);
    }

    function updateSwitcher() {
        var switcher = document.querySelector(".lang-switch");
        if (!switcher) {
            return;
        }

        var info = languageInfo(currentCode);
        var label = (dictionary.strings && dictionary.strings["Change language"]) || "Change language";

        switcher.setAttribute("data-lang", currentCode);
        var summary = switcher.querySelector("summary");
        if (summary) {
            if (label) {
                summary.setAttribute("aria-label", label);
                summary.setAttribute("title", label);
            }
            /* The button shows the full language name on wide screens and
               the short code on narrow ones; CSS picks which is visible. */
            var fullLabel = summary.querySelector(".lang-switch__label-full");
            if (fullLabel) {
                fullLabel.textContent = info.name || info.nativeName || info.short || "";
            }
            var shortLabel = summary.querySelector(".lang-switch__label-short");
            if (shortLabel && info.short) {
                shortLabel.textContent = info.short;
            }
        }

        Array.prototype.forEach.call(
            switcher.querySelectorAll(".lang-switch__menu a[hreflang]"),
            function (link) {
                var code = link.getAttribute("hreflang");
                var info = languageInfo(code);
                if (info.nativeName) {
                    link.setAttribute("title", info.nativeName);
                    link.setAttribute("aria-label", info.nativeName);
                }
                if (lockedLanguage && code !== lockedLanguage) {
            return Promise.resolve(currentCode);
        }
        if (code === currentCode) {
                    link.setAttribute("aria-current", "true");
                } else {
                    link.removeAttribute("aria-current");
                }
            }
        );
    }

    function rememberLanguage(code) {
        try {
            window.sessionStorage.setItem(STORAGE_KEY, code);
        } catch (error) {
            /* Private browsing can block storage; switching still works. */
        }
        try {
            window.localStorage.setItem(STORAGE_KEY, code);
        } catch (error) {
            /* Persistent storage is optional; session storage is enough. */
        }
    }

    function savedLanguage() {
        try {
            var sessionChoice = window.sessionStorage.getItem(STORAGE_KEY);
            if (sessionChoice) {
                return sessionChoice;
            }
        } catch (error) { /* ignore */ }
        try {
            return window.localStorage.getItem(STORAGE_KEY) || "";
        } catch (error) {
            return "";
        }
    }

    /* ---------- 10. Script typography ----------
       A translated page needs the script fonts, leading and tracking rules in
       localized-support.css. The generated language folders already link it,
       but the English master pages (home, about, calculators, analytics)
       translate in place, so they must request it when a language is chosen.
       English never loads it, so the master design is untouched. */
    var SUPPORT_CSS_ID = "mw-localized-support";

    function syncScriptTypography() {
        var head = document.head || document.documentElement;
        var linked = document.querySelector('link[rel="stylesheet"][href*="localized-support"]');
        var injected = document.getElementById(SUPPORT_CSS_ID);

        if (currentCode === "en") {
            if (injected) { injected.parentNode.removeChild(injected); }
            return;
        }
        if (linked || injected) { return; }

        var link = document.createElement("link");
        link.id = SUPPORT_CSS_ID;
        link.rel = "stylesheet";
        link.href = (config.dictBase || "i18n/") + "localized-support.css?v=8";
        head.appendChild(link);
    }

    /* Vertical dimension labels. The drawings rotate a label -90° so a Latin
       letter or word reads along the measurement line. A rotated CJK glyph is
       read sideways, so those labels are laid out upright instead — same
       coordinates, same dimension line — but only while the whole word still
       fits inside the drawing, so nothing is clipped. Devanagari keeps the
       rotation: upright stacking there splits a conjunct into separate
       characters (जाड renders as ज, ा, ड), which shaping must never do. */
    function resetVerticalLabel(label) {
        label.style.transform = "";
        label.style.writingMode = "";
        label.style.textOrientation = "";
        label.removeAttribute("data-mw-vertical");
    }

    function labelFitsDrawing(label, svg) {
        var box = label.getBoundingClientRect();
        var frame = svg.getBoundingClientRect();
        var slack = 1;
        return box.width > 0 && box.height > 0 &&
            box.top >= frame.top - slack &&
            box.bottom <= frame.bottom + slack &&
            box.left >= frame.left - slack &&
            box.right <= frame.right + slack;
    }

    function adaptVerticalLabels() {
        Array.prototype.forEach.call(
            document.querySelectorAll("svg text[data-mw-vertical]"),
            resetVerticalLabel
        );

        if (currentCode !== "ja" && currentCode !== "zh") {
            return;
        }

        Array.prototype.forEach.call(
            document.querySelectorAll("svg text[transform]"),
            function (label) {
                if (!/rotate\s*\(/i.test(label.getAttribute("transform") || "")) {
                    return;
                }
                /* A dimension symbol is one to five characters. Stacking a
                   longer phrase upright would stand taller than the drawing
                   itself, so it keeps the rotated layout. */
                if ((label.textContent || "").trim().length > 5) {
                    return;
                }
                var svg = label.ownerSVGElement;
                if (!svg) {
                    return;
                }
                label.style.transform = "none";
                label.style.writingMode = "vertical-rl";
                label.style.textOrientation = "upright";
                if (labelFitsDrawing(label, svg)) {
                    label.setAttribute("data-mw-vertical", "1");
                } else {
                    resetVerticalLabel(label);
                }
            }
        );
    }

    /* The upright decision depends on the drawing's pixel size, which is only
       known after the layout and the script font have settled, so it is settled
       again on load, after fonts resolve, and when the viewport changes. */
    var verticalTimer = null;

    function scheduleVerticalLabels() {
        adaptVerticalLabels();
        if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
            document.fonts.ready.then(function () {
                adaptVerticalLabels();
            }, function () {});
        }
        if (document.readyState !== "complete") {
            window.addEventListener("load", adaptVerticalLabels, { once: true });
        }
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(adaptVerticalLabels);
            });
        }
    }

    window.addEventListener("resize", function () {
        clearTimeout(verticalTimer);
        verticalTimer = setTimeout(adaptVerticalLabels, 150);
    });

    function updateChrome() {
        var info = languageInfo(currentCode);
        html.setAttribute("lang", currentCode);
        html.setAttribute("dir", info.dir || "ltr");
        syncScriptTypography();
        html.setAttribute("data-mw-page", pageSources.kind || html.getAttribute("data-mw-page") || "calculator");

        updatePageMeta();
        updateLocaleMeta();
        updateSwitcher();

        /* Give every form control the active language so the operating system
           can offer a matching keyboard/input method. Numeric fields stay LTR
           for correct digit and decimal order, including on RTL Arabic pages. */
        Array.prototype.forEach.call(
            document.querySelectorAll("input, textarea, select"),
            function (control) {
                control.setAttribute("lang", currentCode);
            }
        );
        Array.prototype.forEach.call(
            document.querySelectorAll(
                'input[type="number"], input[inputmode="decimal"], input[inputmode="numeric"], input.mw-num-field, input.nk-field'
            ),
            function (control) {
                control.setAttribute("dir", "ltr");
            }
        );

        var switcher = document.querySelector(".lang-switch");
        if (switcher) {
            switcher.removeAttribute("open");
        }
    }

    /* The event is dispatched only after the document has been fully
       translated. Listeners therefore render from an already-final page
       instead of racing a later cleanup pass. */
    function dispatchLanguageChange() {
        scheduleVerticalLabels();
        try {
            window.dispatchEvent(new CustomEvent("mw:languagechange", { detail: { language: currentCode } }));
        } catch (error) {
            /* CustomEvent is available in every browser this site supports. */
        }
    }

    /* ---------------- switching ---------------- */

    function switchTo(code) {
        if (!code) {
            return Promise.reject(new Error("A language code is required"));
        }
        if (!availableLanguage(code)) {
            return Promise.reject(new Error("That language is not available"));
        }
        if (code === currentCode) {
            var currentSwitcher = document.querySelector(".lang-switch");
            if (currentSwitcher) {
                currentSwitcher.removeAttribute("open");
            }
            return Promise.resolve(currentCode);
        }
        if (switching) {
            return Promise.reject(new Error("A language switch is already in progress"));
        }

        /* An explicit choice by the visitor overrides translator passivity for
           this one pass. The observer is only resumed if the translator has
           stopped, so choosing a language cannot restart the conflict. */
        translatorDetected = false;
        switching = true;
        html.classList.add("mw-language-switching");

        return ensureDictionary(code).then(function (loaded) {
            if (!loaded) {
                throw new Error("That language could not be loaded");
            }
            return applySwitch(code);
        }).then(function (result) {
            /* Every listener now sees final text. Anything a listener
               regenerates is collected by the live observer before paint. */
            html.classList.add("mw-language-switching");
            dispatchLanguageChange();
            refreshDigits();
            html.classList.remove("mw-language-switching");
            return result;
        }).catch(function (error) {
            html.classList.remove("mw-language-switching");
            switching = false;
            throw error;
        });
    }

    function applySwitch(code) {
        try {
            if (observer) {
                observer.disconnect();
            }

            /* Record the English source of every current string before the
               dictionary changes. This is what lets any number of switches
               keep working (for example Marathi -> Japanese -> Arabic). */
            collectTextNodes(document.body).forEach(function (node) {
                sourceFor(node.nodeValue, node);
            });
            Array.prototype.forEach.call(
                document.querySelectorAll("[placeholder], [aria-label], [title], [alt]"),
                captureAttributeSources
            );

            if (!pageSources.h1) {
                var heading = document.querySelector("h1");
                pageSources.h1 = heading
                    ? (sourceFor(heading.textContent || "", null) || (heading.textContent || "").trim())
                    : "";
            }

            currentCode = code;
            dictionary = normalizeDictionary(dictionaries[code]);
            currentIndex = indexDictionary(dictionary);

            /* One synchronized pass: translate, localize digits, then make the
               observer live again. No timer-based second pass remains. */
            applyPage(true);
            refreshDigits();
            updateChrome();
            rememberLanguage(currentCode);

            if (observer && !translatorMarkers()) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                    attributes: true,
                    attributeFilter: translatedAttrs
                });
            }
        } catch (error) {
            if (observer) {
                observer.disconnect();
            }
            throw error;
        } finally {
            switching = false;
        }

        return currentCode;
    }

    /* ---------------- live calculator output ---------------- */

    /* One observer, one synchronous flush per mutation batch. The old code
       queued this with setTimeout(0), which allowed a paint of the
       untranslated text first. That extra paint was the visible flicker. */
    observer = new MutationObserver(function (mutations) {
        if (switching || !observer) {
            return;
        }

        /* A browser translator is rewriting this page. Stop observing before
           touching its output: Chrome re-translates whatever changes under it,
           so writing our language back would start an endless two-engine
           argument and never let the main thread go idle. */
        if (translatorMarkers()) {
            goPassive();
            return;
        }

        var nodes = [];
        var attributeTargets = [];
        var translatedInsertion = false;
        mutations.forEach(function (mutation) {
            if (mutation.type === "characterData") {
                nodes.push(mutation.target);
                return;
            }
            /* Widgets write their accessible names after the page has been
               translated (the app button resets its aria-label when the
               install prompt resolves). Those late attribute writes were
               never translated before, so the English name stayed. */
            if (mutation.type === "attributes") {
                if (translatedAttrs.indexOf(mutation.attributeName) !== -1) {
                    attributeTargets.push(mutation.target);
                }
                return;
            }
            Array.prototype.forEach.call(mutation.addedNodes, function (node) {
                if (node.nodeType === 1 && (node.nodeName === "FONT" ||
                        (node.querySelector && node.querySelector("font")))) {
                    translatedInsertion = true;
                    return;
                }
                if (node.nodeType === 1 || node.nodeType === 3) {
                    nodes.push(node);
                }
            });
        });

        /* Google Translate wraps every string it rewrites in <font>, and does
           so before it marks <html>. Its wrappers are the earliest signal. */
        if (translatedInsertion) {
            goPassive();
            return;
        }

        if (!nodes.length && !attributeTargets.length) {
            return;
        }

        observer.disconnect();
        try {
            attributeTargets.forEach(function (element) {
                if (element.nodeType === 1) {
                    applyAttributes(element);
                }
            });
            nodes.forEach(function (node) {
                if (node.nodeType === 3) {
                    applyTextNode(node);
                } else if (node.nodeType === 1) {
                    applyTextNode(node);
                    applyAttributes(node);
                    collectTextNodes(node).forEach(applyTextNode);
                    Array.prototype.forEach.call(
                        node.querySelectorAll ? node.querySelectorAll("[placeholder], [aria-label], [title], [alt]") : [],
                        applyAttributes
                    );
                }
            });
            refreshDigits();
        } finally {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: translatedAttrs
            });
        }
    });

    /* ---------------- language dropdown tooltips ---------------- */

    var tooltipElement = null;
    var tooltipTimer = null;

    function currentTooltipLanguage() {
        var code = (
            config.lockLanguage ||
            html.getAttribute("lang") ||
            config.current ||
            currentCode ||
            "en"
        ).toLowerCase();
        if (code.indexOf("-") > 0) {
            code = code.split("-")[0];
        }
        return LANGUAGE_NAMES[code] ? code : "en";
    }

    function languageInfo(code) {
        for (var i = 0; i < languages.length; i += 1) {
            if (languages[i] && languages[i].code === code) {
                return languages[i];
            }
        }
        return null;
    }

    function tooltipLabel(code) {
        var table = LANGUAGE_NAMES[currentTooltipLanguage()] || LANGUAGE_NAMES.en;
        if (code && table[code]) {
            return table[code];
        }
        if (code && LANGUAGE_NAMES.en[code]) {
            return LANGUAGE_NAMES.en[code];
        }
        var info = languageInfo(code);
        return (info && (info.nativeName || info.name)) || code || "";
    }

    function ensureTooltip() {
        if (tooltipElement || !document.body) {
            return tooltipElement;
        }
        tooltipElement = document.createElement("div");
        tooltipElement.className = "mw-lang-tooltip";
        tooltipElement.setAttribute("role", "tooltip");
        tooltipElement.setAttribute("aria-hidden", "true");
        document.body.appendChild(tooltipElement);
        return tooltipElement;
    }

    function positionTooltip(link) {
        var rect = link.getBoundingClientRect();
        var tip = tooltipElement.getBoundingClientRect();
        var gap = 10;
        var edge = 8;
        var left = rect.left - tip.width - gap;
        var top = rect.top + ((rect.height - tip.height) / 2);

        if (left < edge) {
            left = rect.right + gap;
            if (left + tip.width > window.innerWidth - edge) {
                var above = rect.top - tip.height - gap;
                left = Math.min(Math.max(edge, rect.left), window.innerWidth - tip.width - edge);
                top = above >= edge ? above : rect.bottom + gap;
            }
        }
        if (left + tip.width > window.innerWidth - edge) {
            left = window.innerWidth - tip.width - edge;
        }
        if (left < edge) {
            left = edge;
        }
        if (top + tip.height > window.innerHeight - edge) {
            top = window.innerHeight - tip.height - edge;
        }
        if (top < edge) {
            top = edge;
        }
        tooltipElement.style.left = Math.round(left) + "px";
        tooltipElement.style.top = Math.round(top) + "px";
    }

    function showTooltip(link) {
        if (!link || !ensureTooltip()) {
            return;
        }
        var code = (link.getAttribute("hreflang") || "").toLowerCase();
        if (!code) {
            return;
        }
        if (tooltipTimer) {
            clearTimeout(tooltipTimer);
            tooltipTimer = null;
        }
        var currentInfo = languageInfo(currentTooltipLanguage());
        tooltipElement.textContent = tooltipLabel(code);
        tooltipElement.setAttribute("dir", (currentInfo && currentInfo.dir) || "ltr");
        tooltipElement.setAttribute("aria-hidden", "false");
        tooltipElement.classList.add("is-visible");
        positionTooltip(link);
    }

    function hideTooltip() {
        if (!tooltipElement) {
            return;
        }
        if (tooltipTimer) {
            clearTimeout(tooltipTimer);
            tooltipTimer = null;
        }
        tooltipElement.classList.remove("is-visible");
        tooltipElement.setAttribute("aria-hidden", "true");
    }

    function tooltipLink(event) {
        var target = event && event.target;
        if (!target || !target.closest) {
            return null;
        }
        return target.closest(".lang-switch__menu a[hreflang]");
    }

    function initLanguageTooltips() {
        if (!document.querySelector(".lang-switch__menu")) {
            return;
        }
        ensureTooltip();

        /* The menu links carry an English `title` for the no-JavaScript
           fallback. Remove it when the live tooltip takes over so the native
           browser bubble never competes with the translated label. */
        Array.prototype.forEach.call(
            document.querySelectorAll(".lang-switch__menu a[title]"),
            function (link) {
                link.removeAttribute("title");
            }
        );

        document.addEventListener("mouseover", function (event) {
            var link = tooltipLink(event);
            if (link) {
                showTooltip(link);
            }
        });

        document.addEventListener("mouseout", function (event) {
            var link = tooltipLink(event);
            if (link && (!event.relatedTarget || !link.contains(event.relatedTarget))) {
                hideTooltip();
            }
        });

        document.addEventListener("focusin", function (event) {
            var link = tooltipLink(event);
            if (link) {
                showTooltip(link);
            }
        });

        document.addEventListener("focusout", function (event) {
            if (tooltipLink(event)) {
                hideTooltip();
            }
        });

        /* Touch: show the label on first contact without stopping the click,
           then dismiss it automatically. The language still changes only on
           the click/navigation itself. */
        document.addEventListener("touchstart", function (event) {
            var link = tooltipLink(event);
            if (link) {
                showTooltip(link);
                if (tooltipTimer) {
                    clearTimeout(tooltipTimer);
                }
                tooltipTimer = setTimeout(hideTooltip, 2200);
            }
        }, { passive: true });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                hideTooltip();
            }
        });

        window.addEventListener("scroll", hideTooltip, { passive: true });
        window.addEventListener("resize", hideTooltip);
        window.addEventListener("mw:languagechange", hideTooltip);
    }

    function start() {
        if (!document.body) {
            return;
        }

        initLanguageTooltips();
        captureOriginalMeta();

        /* Choose the saved language before the first text pass. Returning
           visitors never see an English frame followed by a translated one.
           Only that one dictionary is downloaded; English needs none. */
        /* English URLs always open in English. Language pages are separate
           pre-rendered URLs; a stored choice must never auto-translate this
           page. Explicit switchTo() still works for previews and tooling. */
        var initial = config.initialLanguage || "en";

        function applyInitial(code) {
            if (code !== currentCode) {
                currentCode = code;
                dictionary = normalizeDictionary(dictionaries[code]);
                currentIndex = indexDictionary(dictionary);
            }

            applyPage();
            refreshDigits();
            updateChrome();

            if (observer && !translatorMarkers()) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                    attributes: true,
                    attributeFilter: translatedAttrs
                });
            }

            if (code !== "en") {
                rememberLanguage(code);
                html.classList.add("mw-language-switching");
                dispatchLanguageChange();
                refreshDigits();
                html.classList.remove("mw-language-switching");
            }
        }

        if (initial === "en") {
            applyInitial("en");
            return;
        }

        ensureDictionary(initial).then(function (loaded) {
            applyInitial(loaded ? initial : "en");
        }, function () {
            applyInitial("en");
        });
    }

    window.MW_I18N = {
        get language() {
            return currentCode;
        },
        t: translate,
        translate: translate,
        template: translateTemplate,
        switchTo: switchTo,
        isSwitching: function () {
            return switching;
        },
        /* Explicit refresh for modules that replace a subtree themselves.
           Translating and digit-localizing stay in the same transaction. */
        refresh: function (root) {
            var scope = root && root.nodeType ? root : document.body;
            if (!scope || !observer) {
                return;
            }

            var wasSwitching = switching;
            switching = true;
            observer.disconnect();
            try {
                if (scope === document.body || scope === document) {
                    applyPage();
                } else {
                    applyTextNode(scope);
                    applyAttributes(scope);
                    collectTextNodes(scope).forEach(applyTextNode);
                    Array.prototype.forEach.call(
                        scope.querySelectorAll ? scope.querySelectorAll("[placeholder], [aria-label], [title], [alt]") : [],
                        applyAttributes
                    );
                }
                refreshDigits();
            } finally {
                if (observer && !translatorMarkers()) {
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                        characterData: true,
                        attributes: true,
                        attributeFilter: translatedAttrs
                    });
                }
                switching = wasSwitching;
            }
        },
        missingTranslations: function () {
            return Object.keys(missingTranslations).sort();
        },
        clearMissingTranslations: function () {
            missingTranslations = Object.create(null);
        }
    };

    function begin() {
        start();
        if (lockedLanguage) {
            /* The URL already fixes this page language, so install it in
               this same task, before the first paint. Waiting for load
               and a timer showed English labels first and then flipped
               them to the page language. Text the calculator renders
               later is translated by the live observer as it is
               inserted, which is also before that frame paints. */
            switchTo(lockedLanguage).catch(function () {});
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", begin);
    } else {
        begin();
    }
})();
