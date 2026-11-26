/* ==================================================
   TECHNICAL LANGUAGE LAYER START
   Drawing symbols follow the selected language. The English master supplies
   the canonical source symbols (L, W, T, D, OD, rho, ...) and their positions;
   MW_I18N.t() supplies the native spelling shown in each language, exactly as
   the corrected Chinese master prints 长 / 宽 / 厚. Internationally standardized
   unit symbols (MM, kg, g/cm3, kg/m3) stay canonical; only the pound button
   uses a native short name where the dictionary provides one.
   ================================================== */
(function () {
    "use strict";

    var CANONICAL_UNITS = {
        mm: { short: "MM", name: "Millimeter" },
        in: { short: "Inches", name: "Inch" },
        kg: { short: "kg", name: "Kilogram" },
        lb: { short: "lb", name: "Pound" },
        g_cm3: { short: "g/cm³", name: "Gram per cubic centimeter" },
        kg_m3: { short: "kg/m³", name: "Kilogram per cubic meter" }
    };

    var FALLBACK = {
        dimensions: {},
        units: CANONICAL_UNITS,
        pageTokens: {}
    };

    var UNIT_NAME_KEYS = {
        mm: ["Millimeter"],
        in: ["Inch", "Inches"],
        kg: ["Kilogram"],
        lb: ["Pound"],
        g_cm3: ["Gram per cubic centimeter"],
        kg_m3: ["Kilogram per cubic meter"]
    };

    /* A language page is built with its own language, so the drawings start in
       that language instead of waiting for the first switch. */
    var initialConfig = window.__MW_I18N_CONFIG || {};
    var currentCode = (initialConfig.current && initialConfig.current !== "en")
        ? initialConfig.current
        : "en";
    var applying = false;
    var pending = false;

    function dictionaries() {
        return window.MW_I18N_DICTIONARIES || {};
    }

    function activeDictionary(code) {
        var all = dictionaries();
        return all[code || currentCode] || all.en || {};
    }

    function englishTechnical() {
        var en = dictionaries().en || {};
        return en.technical || FALLBACK;
    }

    /* The English page tokens are the canonical symbols. Invert them once so
       MWTechnicalLang.symbol() can resolve a semantic name back to the symbol
       that the English master actually printed in the drawing. */
    function canonicalSymbols() {
        var symbols = {};
        var tokens = englishTechnical().pageTokens || {};
        Object.keys(tokens).forEach(function (token) {
            var semantic = tokens[token];
            if (semantic && !Object.prototype.hasOwnProperty.call(symbols, semantic)) {
                symbols[semantic] = token;
            }
        });
        return symbols;
    }

    function translatedValue(dict, keys) {
        var strings = dict.strings || {};
        var terms = dict.terms || {};
        for (var i = 0; i < keys.length; i += 1) {
            var key = keys[i];
            if (strings[key] && strings[key] !== key) {
                return strings[key];
            }
            if (terms[key] && terms[key] !== key) {
                return terms[key];
            }
        }
        return null;
    }

    function unitName(code, id) {
        var dict = activeDictionary(code);
        var translated = translatedValue(dict, UNIT_NAME_KEYS[id] || []);
        if (translated) {
            return translated;
        }
        var technical = dict.technical || {};
        var unit = (technical.units || {})[id];
        return (unit && unit.name) || CANONICAL_UNITS[id].name;
    }

    function unitShort(code, id) {
        /* MM, kg and the density units are internationally standardized and
           remain canonical. Inches and pounds have native short names in the
           dictionaries (英寸, 磅, पाउंड, رطل, ...), so use them for buttons. */
        if (id !== "in" && id !== "lb") {
            return CANONICAL_UNITS[id].short;
        }
        var dict = activeDictionary(code);
        var translated = translatedValue(dict, id === "lb" ? ["LB"] : ["Inches"]);
        return translated || CANONICAL_UNITS[id].short;
    }

    function dictionary(code) {
        var current = activeDictionary(code);
        var units = {};
        Object.keys(CANONICAL_UNITS).forEach(function (id) {
            units[id] = {
                short: unitShort(code || currentCode, id),
                name: unitName(code || currentCode, id)
            };
        });
        var technical = current.technical || {};
        return {
            dimensions: canonicalSymbols(),
            units: units,
            pageTokens: englishTechnical().pageTokens || technical.pageTokens || {}
        };
    }

    function pageSlug() {
        var match = String(window.location.pathname || "").match(/\/calculators\/([^/]+)\//);
        return match ? match[1] : "";
    }

    function pageTokens() {
        return dictionary().pageTokens[pageSlug()] || {};
    }

    /* English wording of every dimension a drawing labels. A language that
       stores its own dimension names in the dictionary (Chinese, Japanese,
       Hindi, Marathi, Arabic) is served from there; the others are resolved
       through the shared term list, so one dimension keeps one name on every
       page: 长 / 幅 / लंबाई / Longitud / Länge / Longueur / Comprimento. */
    var DIMENSION_EN = {
        length: "Length",
        width: "Width",
        height: "Height",
        overallHeight: "Overall Height",
        outerHeight: "Outer Height",
        innerHeight: "Inner Height",
        outerWidth: "Outer Width",
        thickness: "Thickness",
        diameter: "Diameter",
        outerDiameter: "Outer Diameter",
        innerDiameter: "Inner Diameter",
        insideDiameter: "Inside Diameter",
        radius: "Radius",
        knuckleRadius: "Knuckle Radius",
        straightFace: "Straight Face",
        acrossFlats: "Across Flats",
        acrossCorners: "Across Corners",
        holeDiameter: "Hole Diameter",
        slantHeight: "Slant Height",
        plateThickness: "Plate Thickness",
        shellThickness: "Shell Thickness",
        weight: "Weight",
        volume: "Volume",
        density: "Density",
        pitch: "Thread Pitch",
        threadLength: "Thread Length",
        headHeight: "Head Height",
        headDiameter: "Head Diameter",
        headAcrossFlats: "Head Across Flats",
        neckAcrossFlats: "Neck Across Flats",
        neckHeight: "Neck Height",
        nutHeight: "Nut Height",
        nominalDiameter: "Nominal Thread Diameter",
        boltHoleCount: "Bolt Holes",
        boltHoleDiameter: "Bolt Hole Diameter",
        pitchCircleDiameter: "Pitch Circle Diameter",
        developedSurfaceArea: "Developed Surface Area",
        baseDiameter: "Base Diameter",
        flangeWidth: "Flange Width",
        flangeThickness: "Flange Thickness",
        webThickness: "Web Thickness",
        firstParallelSide: "First Parallel Side",
        secondParallelSide: "Second Parallel Side",
        perpendicularHeight: "Perpendicular Height",
        base: "Base",
        verticalLeg: "Vertical Leg",
        horizontalLeg: "Horizontal Leg",
        socketDepth: "Socket Depth",
        socketWidth: "Socket Width",
        largeEndDiameter: "Large End Diameter",
        smallEndDiameter: "Small End Diameter",
        lateralArea: "Lateral Surface Area",
        threadLength2: "Second Thread Length"
    };

    /* Names for dimensions whose English wording is not part of the shared
       term list of a language that keeps Latin symbols in its formulas. */
    var EXTRA_NAMES = {
        es: {
            radius: "Radio",
            neckAcrossFlats: "Ancho entre caras del cuello",
            headAcrossFlats: "Ancho entre caras de la cabeza",
            pitchCircleDiameter: "Diámetro del círculo de pernos",
            developedSurfaceArea: "Área de superficie desarrollada",
            acrossCorners: "Diagonal entre vértices",
            nutHeight: "Altura de la tuerca",
            headHeight: "Altura de la cabeza",
            nominalDiameter: "Diámetro nominal",
            socketDepth: "Profundidad de la llave",
            socketWidth: "Ancho de la llave"
        },
        de: {
            radius: "Radius",
            neckAcrossFlats: "Schlüsselweite Hals",
            headAcrossFlats: "Schlüsselweite Kopf",
            pitchCircleDiameter: "Teilkreisdurchmesser",
            developedSurfaceArea: "Abgewickelte Oberfläche",
            acrossCorners: "Eckenmaß",
            nutHeight: "Mutterhöhe",
            headHeight: "Kopfhöhe",
            nominalDiameter: "Nenndurchmesser",
            socketDepth: "Schlüsseltiefe",
            socketWidth: "Schlüsselweite"
        },
        fr: {
            radius: "Rayon",
            neckAcrossFlats: "Sur plats du col",
            headAcrossFlats: "Sur plats de tête",
            pitchCircleDiameter: "Diamètre du cercle de perçage",
            developedSurfaceArea: "Surface développée",
            acrossCorners: "Diagonale entre sommets",
            nutHeight: "Hauteur d'écrou",
            headHeight: "Hauteur de tête",
            nominalDiameter: "Diamètre nominal",
            socketDepth: "Profondeur de douille",
            socketWidth: "Largeur de douille"
        },
        pt: {
            radius: "Raio",
            neckAcrossFlats: "Entre faces do colo",
            headAcrossFlats: "Entre faces da cabeça",
            pitchCircleDiameter: "Diâmetro do círculo de furação",
            developedSurfaceArea: "Área da superfície desenvolvida",
            acrossCorners: "Diagonal entre vértices",
            nutHeight: "Altura da porca",
            headHeight: "Altura da cabeça",
            nominalDiameter: "Diâmetro nominal",
            socketDepth: "Profundidade do soquete",
            socketWidth: "Largura do soquete"
        }
    };

    /* Captions printed inside a drawing. They are not dimensions, but they sit
       in the same figure and follow the same language. */
    var CAPTIONS = {
        mirrorLine: {
            en: "MIRROR LINE", zh: "镜像线", ja: "ミラー線", hi: "प्रतिबिंब रेखा",
            mr: "आरसा रेषा", ar: "خط الانعكاس", de: "SPIEGELLINIE",
            es: "LÍNEA DE SIMETRÍA", fr: "LIGNE DE SYMÉTRIE", pt: "LINHA DE ESPELHAMENTO"
        },
        halfSection: {
            en: "HALF SECTION", zh: "半剖视图", ja: "半断面", hi: "आधा कटाव दृश्य",
            mr: "अर्ध कात दृश्य", ar: "مقطع نصفي", de: "HALBSCHNITT",
            es: "MEDIO CORTE", fr: "DEMI-COUPE", pt: "MEIO CORTE"
        },
        developedBlank: {
            en: "DEVELOPED BLANK", zh: "展开毛坯", ja: "展開ブランク", hi: "विकसित रिक्त",
            mr: "विकसित रिक्त", ar: "الفراغ المفرود", de: "ABGEWICKELTER ZUSCHNITT",
            es: "DESARROLLO EN BLANCO", fr: "FLAN DÉVELOPPÉ", pt: "BLANK DESENVOLVIDO"
        },
        blankDiameter: {
            en: "BLANK Ø", zh: "毛坯 Ø", ja: "ブランク Ø", hi: "रिक्त Ø",
            mr: "रिक्त Ø", ar: "Ø الفراغ", de: "ZUSCHNITT Ø",
            es: "Ø DESARROLLO", fr: "Ø FLAN", pt: "Ø BLANK"
        },
        divisionsAt: {
            en: "{n} equal divisions at {angle}°", zh: "{n} 等分，间隔 {angle}°",
            ja: "{n} 等分割（{angle}°）", hi: "{n} बराबर विभाजन, {angle}°",
            mr: "{n} समान विभाग, {angle}°", ar: "{n} تقسيمات متساوية بزاوية {angle}°",
            de: "{n} gleiche Teilungen bei {angle}°", es: "{n} divisiones iguales a {angle}°",
            fr: "{n} divisions égales à {angle}°", pt: "{n} divisões iguais a {angle}°"
        },
        areaEquivalent: {
            en: "Area-equivalent · {n} radial lines", zh: "面积等效 · {n} 条径向线",
            ja: "面積等価・{n} 本の放射線", hi: "क्षेत्रफल-समतुल्य · {n} रेडियल रेखाएँ",
            mr: "क्षेत्रफळ-समतुल्य · {n} त्रिज्य रेषा", ar: "مكافئ المساحة · {n} خطوط شعاعية",
            de: "Flächengleich · {n} radiale Linien", es: "Equivalente en área · {n} líneas radiales",
            fr: "Équivalent en surface · {n} lignes radiales", pt: "Equivalente em área · {n} linhas radiais"
        },
        detailA: {
            en: "DETAIL A · 60°", zh: "详图 A · 60°", ja: "詳細 A · 60°", hi: "विवरण A · 60°",
            mr: "तपशील A · 60°", ar: "تفصيل A · 60°", de: "DETAIL A · 60°",
            es: "DETALLE A · 60°", fr: "DÉTAIL A · 60°", pt: "DETALHE A · 60°"
        },
        planView: {
            en: "PLAN VIEW", zh: "俯视图", ja: "平面図", hi: "ऊपरी दृश्य",
            mr: "वरचे दृश्य", ar: "منظر علوي", de: "DRAUFSICHT",
            es: "VISTA EN PLANTA", fr: "VUE EN PLAN", pt: "VISTA SUPERIOR"
        },
        sectionAA: {
            en: "SECTION A–A", zh: "A–A 剖视", ja: "A–A 断面", hi: "कटाव A–A",
            mr: "कात A–A", ar: "مقطع A–A", de: "SCHNITT A–A",
            es: "SECCIÓN A–A", fr: "COUPE A–A", pt: "CORTE A–A"
        }
    };

    /* The native dimension name of the selected language. English keeps the
       conventional Latin initials the master drawing prints. */
    function dimensionName(semantic) {
        var enName = DIMENSION_EN[semantic] || semantic;

        if (currentCode === "en") {
            return enName;
        }

        var dict = activeDictionary(currentCode);
        var dimensions = (dict.technical || {}).dimensions || {};

        if (dimensions[semantic]) {
            return dimensions[semantic];
        }

        var extra = EXTRA_NAMES[currentCode];

        if (extra && extra[semantic]) {
            return extra[semantic];
        }

        var translated = translatedValue(dict, [enName]);

        if (translated) {
            return translated;
        }

        if (window.MW_I18N && typeof window.MW_I18N.t === "function") {
            var viaRuntime = window.MW_I18N.t(enName);

            if (viaRuntime) {
                return viaRuntime;
            }
        }

        return enName;
    }

    /* A drawing label token ("L", "OD", "SF") as the selected language
       prints it: 长, 外径, 直边. English is returned untouched. */
    function dimensionLabel(token) {
        if (!token) {
            return token || "";
        }

        if (currentCode === "en") {
            return token;
        }

        var semantic = pageTokens()[token];

        return semantic ? (dimensionName(semantic) || token) : token;
    }

    function caption(id, data) {
        var entry = CAPTIONS[id];

        if (!entry) {
            return "";
        }

        var text = entry[currentCode] || entry.en;

        if (data) {
            Object.keys(data).forEach(function (key) {
                text = text.replace(new RegExp("\\{" + key + "\\}", "g"), data[key]);
            });
        }

        return text;
    }

    function tokenRegex(token) {
        var escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
        return new RegExp("(^|[^A-Za-z0-9ρ])(" + escaped + ")(?=$|[^A-Za-z0-9ρ])", "g");
    }

    function replaceTokens(text, tokens, symbols) {
        var result = String(text == null ? "" : text);
        Object.keys(tokens)
            .sort(function (a, b) { return b.length - a.length; })
            .forEach(function (token) {
                var symbol = symbols[tokens[token]];
                if (!symbol || symbol === token) {
                    return;
                }
                result = result.replace(tokenRegex(token), function (all, before) {
                    return before + symbol;
                });
            });
        return result;
    }

    function markSource(element, attribute) {
        if (!element || element.hasAttribute(attribute)) {
            return;
        }
        element.setAttribute(attribute, element.textContent);
        element.setAttribute("data-i18n-skip", "");
    }

    function localizeDrawing(root) {
        var scope = root && root.querySelectorAll ? root : document;
        var texts = scope.querySelectorAll
            ? scope.querySelectorAll("svg text")
            : [];

        /* The generic translator supplies the native symbol spelling. Here we
           only force an LTR text direction so Arabic layout cannot reorder a
           drawing annotation or its dimension arrows. */
        Array.prototype.forEach.call(texts, function (element) {
            element.setAttribute("dir", "ltr");
        });
    }

    /* A fully translated dimension name is longer than the Latin symbol it
       replaces (Espesor de la brida, 过渡半径). Keep every label inside its
       own drawing: a label that would cross the viewBox edge is moved back by
       the few units it overflows, so it stays readable and never runs under
       another panel. Rotated labels are left alone: their anchor already sits
       along a dimension line. */
    function fitDrawingLabels(root) {
        var scope = root && root.querySelectorAll ? root : document;
        var texts = scope.querySelectorAll ? scope.querySelectorAll("svg text") : [];

        Array.prototype.forEach.call(texts, function (element) {
            if (!element.getBBox || !element.getCTM) {
                return;
            }

            var svg = element.ownerSVGElement;
            var box = svg && svg.viewBox && svg.viewBox.baseVal;

            if (!box || !box.width || !box.height) {
                return;
            }

            if (/rotate|matrix|scale/.test(element.getAttribute("transform") || "")) {
                return;
            }

            var rect;
            var matrix;

            try {
                rect = element.getBoundingClientRect();
                matrix = svg.getScreenCTM();
            } catch (error) {
                return;
            }

            if (!rect || (!rect.width && !rect.height) || !matrix || matrix.a === 0) {
                return;
            }

            /* The screen box of the label mapped back into the drawing's own
               coordinates, so it can be compared with the viewBox directly. */
            matrix = matrix.inverse();

            var pad = 3;
            var left = Infinity;
            var right = -Infinity;
            var top = Infinity;
            var bottom = -Infinity;
            var corners = [
                [rect.left, rect.top],
                [rect.right, rect.top],
                [rect.left, rect.bottom],
                [rect.right, rect.bottom]
            ];

            corners.forEach(function (corner) {
                var x = matrix.a * corner[0] + matrix.c * corner[1] + matrix.e;
                var y = matrix.b * corner[0] + matrix.d * corner[1] + matrix.f;

                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
            });

            var shiftX = 0;
            var shiftY = 0;

            if (left < box.x + pad) {
                shiftX = box.x + pad - left;
            } else if (right > box.x + box.width - pad) {
                shiftX = box.x + box.width - pad - right;
            }

            if (top < box.y + pad) {
                shiftY = box.y + pad - top;
            } else if (bottom > box.y + box.height - pad) {
                shiftY = box.y + box.height - pad - bottom;
            }

            if (shiftX) {
                element.setAttribute("x", parseFloat(element.getAttribute("x")) + shiftX);
            }

            if (shiftY) {
                element.setAttribute("y", parseFloat(element.getAttribute("y")) + shiftY);
            }
        });
    }

    function localizeToggle(id, unitId) {
        var element = document.getElementById(id);
        if (!element) {
            return;
        }
        var unit = dictionary().units[unitId];
        if (!unit) {
            return;
        }
        markSource(element, "data-mw-source-text");
        /* While a browser translator owns the page, leave its output alone:
           rewriting these four toggles made it re-translate them forever. */
        if (translatorBusy()) {
            return;
        }
        /* Only touch the DOM when the label actually changes, so a scheduled
           pass cannot produce a mutation of its own. */
        if (element.textContent !== unit.short) {
            element.textContent = unit.short;
        }
        element.setAttribute("title", unit.name);
        element.setAttribute("aria-label", unit.name);
        element.setAttribute("lang", currentCode);
    }

    function localizeToggles() {
        localizeToggle("mmBtn", "mm");
        localizeToggle("inchBtn", "in");
        localizeToggle("kgBtn", "kg");
        localizeToggle("lbBtn", "lb");
    }

    function apply(root) {
        if (applying) {
            return;
        }
        applying = true;
        try {
            localizeToggles();
            localizeDrawing(root);
            fitDrawingLabels(root);
        } finally {
            applying = false;
        }
    }

    /* A browser page translator owns the text once it starts. This module
       writes toggle labels and label geometry; doing that over translated
       output would fight the translator and keep laying out the page. */
    function translatorBusy() {
        var root = document.documentElement;
        if (/(^|\s)translated-(ltr|rtl)(\s|$)/.test(" " + (root.className || "") + " ")) {
            return true;
        }
        if (document.querySelector(".skiptranslate, #goog-gt-tt, iframe.goog-te-banner-frame")) {
            return true;
        }
        /* A page translator wraps the text it has replaced in <font> before
           its own banner and the html class appear. This site writes no <font>
           element of its own, so its presence is already a translation. */
        return !!document.querySelector("font");
    }

    function schedule() {
        if (pending || applying || translatorBusy()) {
            return;
        }
        pending = true;
        window.requestAnimationFrame(function () {
            pending = false;
            apply(document);
        });
    }

    window.addEventListener("mw:languagechange", function (event) {
        currentCode = (event.detail && event.detail.language) ||
            (window.MW_I18N && window.MW_I18N.language) || "en";
        apply(document);
    });

    if (typeof MutationObserver === "function") {
        /* Only the two things this module localizes can require a new pass: a
           drawing (svg) and the unit toggles. Watching every inserted element
           in the document made the page re-run a full layout pass for
           unrelated DOM changes, including the ones a translator makes. */
        function matters(node) {
            if (node.nodeType !== 1) {
                return false;
            }
            if (node.nodeName === "svg" || node.nodeName === "SVG") {
                return true;
            }
            if (node.id === "mmBtn" || node.id === "inchBtn" || node.id === "kgBtn" || node.id === "lbBtn") {
                return true;
            }
            return !!(node.querySelector && node.querySelector("svg, .unit-switch"));
        }

        var observer = new MutationObserver(function (mutations) {
            if (applying) {
                return;
            }
            for (var i = 0; i < mutations.length; i += 1) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j += 1) {
                    if (matters(added[j])) {
                        schedule();
                        return;
                    }
                }
            }
        });
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    window.MWTechnicalLang = {
        get language() { return currentCode; },
        symbol: function (semantic) { return dictionary().dimensions[semantic] || ""; },
        unit: function (unitId, style) {
            var unit = dictionary().units[unitId];
            return unit ? unit[style || "short"] : "";
        },
        tokens: pageTokens,
        name: dimensionName,
        label: dimensionLabel,
        caption: caption,
        localizeText: function (text) {
            return replaceTokens(text, pageTokens(), dictionary().dimensions);
        },
        refresh: function (root) { apply(root); }
    };
}());
