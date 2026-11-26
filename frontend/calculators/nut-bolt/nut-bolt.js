/* ==================================================
   NUT AND BOLT WEIGHT CALCULATOR START
   Bolts, studs and nuts: product tables, drawings,
   unit conversion, validation, results and history.

   The engineering formulas run on the server
   (backend/calculations/nutBolt.js); this file only
   collects the inputs and displays the answer.
================================================== */
"use strict";

(function () {
    /* ==================================================
       CONSTANTS
    ================================================== */
    var INCH = 25.4;                       // millimetres in one inch
    var LBS_PER_KG = 2.2046226218;         // pounds in one kilogram
    var NYLON_INSERT_MM = 1.5;             // lock nut collar that is not metal

    /* Densities come from the server through /api/bootstrap.js. The local
       copy is only a fallback if that request failed. */
    var MATERIALS = window.MW_MATERIALS || {
        "carbon-steel": { name: "Carbon Steel", density: 7.85 },
        "stainless-steel": { name: "Stainless Steel", density: 8.00 },
        "aluminium": { name: "Aluminium", density: 2.70 },
        "brass": { name: "Brass", density: 8.45 },
        "bronze": { name: "Bronze", density: 8.73 },
        "cast-iron": { name: "Cast Iron", density: 7.20 },
        "copper": { name: "Copper", density: 8.96 },
        "zinc": { name: "Zinc", density: 7.14 },
        "lead": { name: "Lead", density: 11.34 },
        "tin": { name: "Tin", density: 7.31 },
        "titanium": { name: "Titanium", density: 4.50 },
        "nickel": { name: "Nickel", density: 8.90 },
        "magnesium": { name: "Magnesium", density: 1.74 },
        "inconel-625": { name: "Inconel 625", density: 8.44 },
        "monel-400": { name: "Monel 400", density: 8.80 }
    };

    var $ = function (id) {
        return document.getElementById(id);
    };

    /* Elements used again and again. */
    var categoryTabs = document.querySelectorAll(".category-tab");
    var productSelect = $("productSelect");
    var standardSelect = $("standardSelect");
    var sizeSelect = $("sizeSelect");
    var standardNote = $("standardNote");
    var standardMeta = $("standardMeta");

    /* Standard metadata and the drawing description are composed here with
       their own translations. Without this marker the runtime would translate
       the finished sentence again, which rewrote digits inside standard
       designations such as ISO 4017:2022 into local numerals. */
    if (standardMeta) {
        standardMeta.setAttribute("data-i18n-skip", "");
    }
    var dimensionFields = $("dimensionFields");
    var dimensionNote = $("dimensionNote");
    var unitNote = $("unitNote");
    var diagramViews = $("fastenerDiagramViews");
    var mmBtn = $("mmBtn");
    var inchBtn = $("inchBtn");
    var materialSelect = $("material");
    var customDensityBox = $("customBox");
    var customDensity = $("customDensity");
    var densityInfo = $("densityInfo");
    var quantity = $("quantity");
    var calculateBtn = $("calculateBtn");
    var resetBtn = $("resetBtn");
    var errorBox = $("error");
    var results = $("results");

    /* The shared calculation-history script reads this record after every
       successful Calculate click, exactly as it does on the other pages. */
    var lastCalculation = null;

    /* Which drawing is on the page. A bolt type keeps its fixed reference
       image while only its labels change; null means the current drawing
       belongs to a value-driven product (nut or stud). */
    var currentSheetKey = null;

    /* ==================================================
       DIMENSION FIELDS
       Every product picks the fields it needs from here,
       so the page never shows an input that does not apply.
    ================================================== */
    var FIELD_DEFS = {
        diameter: {
            label: "Nominal Thread Diameter",
            symbol: "d",
            hint: "Thread size, for example M12"
        },
        pitch: {
            label: "Thread Pitch",
            symbol: "P",
            hint: "Distance from one thread to the next"
        },
        length: {
            label: "Overall Length",
            symbol: "L",
            hint: "Measured from the bearing face under the head to the end"
        },
        threadLength: {
            label: "Thread Length",
            symbol: "b",
            hint: "Threaded length at the end"
        },
        threadLength2: {
            label: "Second Thread Length",
            symbol: "b2",
            hint: "Threaded length at the other end"
        },
        acrossFlats: {
            label: "Width Across Flats",
            symbol: "s",
            hint: "Wrench size, flat to flat"
        },
        headHeight: {
            label: "Head Height",
            symbol: "k",
            hint: "Height of the head"
        },
        headDiameter: {
            label: "Head Diameter",
            symbol: "dk",
            hint: "Widest diameter of the head"
        },
        socketAcrossFlats: {
            label: "Socket Width Across Flats",
            symbol: "s",
            hint: "Hex key size of the socket"
        },
        socketDepth: {
            label: "Socket Depth",
            symbol: "t",
            hint: "Depth of the hexagon socket"
        },
        neckAcrossFlats: {
            label: "Square Neck Width",
            /* DIN 603 / ISO 8677 letter the square neck v across flats and f
               for its height; the drawing and the labels follow the standard. */
            symbol: "v",
            hint: "Width of the square neck"
        },
        neckHeight: {
            label: "Square Neck Height",
            symbol: "f",
            hint: "Height of the square neck"
        },
        nutHeight: {
            label: "Nut Height",
            symbol: "m",
            hint: "Nut thickness, face to face"
        }
    };

    /* ==================================================
       STANDARD SIZE TABLES
       All values are stored in millimetres. Inch tables are
       converted from inches once, when the page loads.
    ================================================== */
    function inchValue(value) {
        return value * INCH;
    }

    function boltSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: row[1],
                    pitch: row[2],
                    acrossFlats: row[3],
                    headHeight: row[4]
                }
            };
        });
    }

    function socketSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: row[1],
                    pitch: row[2],
                    headDiameter: row[3],
                    headHeight: row[4],
                    socketAcrossFlats: row[5],
                    socketDepth: row[6]
                }
            };
        });
    }

    function countersunkSizes(rows) {
        return socketSizes(rows);
    }

    function carriageSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                threadBase: row[6],
                values: {
                    diameter: row[1],
                    pitch: row[2],
                    headDiameter: row[3],
                    headHeight: row[4],
                    neckAcrossFlats: row[5],
                    neckHeight: row[7]
                }
            };
        });
    }

    function studSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: row[1],
                    pitch: row[2]
                }
            };
        });
    }

    function nutSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: row[1],
                    pitch: row[2],
                    acrossFlats: row[3],
                    nutHeight: row[4]
                }
            };
        });
    }

    function asmeBoltSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                threadBase: inchValue(row[5]),
                values: {
                    diameter: inchValue(row[1]),
                    pitch: inchValue(1 / row[2]),
                    acrossFlats: inchValue(row[3]),
                    headHeight: inchValue(row[4])
                }
            };
        });
    }

    function asmeNutSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: inchValue(row[1]),
                    pitch: inchValue(1 / row[2]),
                    acrossFlats: inchValue(row[3]),
                    nutHeight: inchValue(row[4])
                }
            };
        });
    }

    /* ISO 4014 / 4017 hexagon head dimensions (mm). */
    var ISO_BOLT_SIZES = boltSizes([
        ["M1.6", 1.6, 0.35, 3.2, 1.1],
        ["M2", 2, 0.4, 4, 1.4],
        ["M2.5", 2.5, 0.45, 5, 1.7],
        ["M3", 3, 0.5, 5.5, 2],
        ["M3.5", 3.5, 0.6, 6, 2.4],
        ["M4", 4, 0.7, 7, 2.8],
        ["M5", 5, 0.8, 8, 3.5],
        ["M6", 6, 1, 10, 4],
        ["M7", 7, 1, 11, 4.8],
        ["M8", 8, 1.25, 13, 5.3],
        ["M10", 10, 1.5, 16, 6.4],
        ["M12", 12, 1.75, 18, 7.5],
        ["M14", 14, 2, 21, 8.8],
        ["M16", 16, 2, 24, 10],
        ["M18", 18, 2.5, 27, 11.5],
        ["M20", 20, 2.5, 30, 12.5],
        ["M22", 22, 2.5, 34, 14],
        ["M24", 24, 3, 36, 15],
        ["M27", 27, 3, 41, 17],
        ["M30", 30, 3.5, 46, 18.7],
        ["M33", 33, 3.5, 50, 21],
        ["M36", 36, 4, 55, 22.5],
        ["M39", 39, 4, 60, 25],
        ["M42", 42, 4.5, 65, 26],
        ["M45", 45, 4.5, 70, 28],
        ["M48", 48, 5, 75, 30],
        ["M52", 52, 5, 80, 33],
        ["M56", 56, 5.5, 85, 35],
        ["M60", 60, 5.5, 90, 38],
        ["M64", 64, 6, 95, 40]
    ]);

    /* ISO 4762 socket head cap screws (mm): d, P, dk, k, socket s, t. */
    var ISO_4762_SIZES = socketSizes([
        ["M1.6", 1.6, 0.35, 3, 1.6, 1.5, 0.7],
        ["M2", 2, 0.4, 3.8, 2, 1.5, 1],
        ["M2.5", 2.5, 0.45, 4.5, 2.5, 2, 1.1],
        ["M3", 3, 0.5, 5.5, 3, 2.5, 1.3],
        ["M4", 4, 0.7, 7, 4, 3, 2],
        ["M5", 5, 0.8, 8.5, 5, 4, 2.5],
        ["M6", 6, 1, 10, 6, 5, 3],
        ["M8", 8, 1.25, 13, 8, 6, 4],
        ["M10", 10, 1.5, 16, 10, 8, 5],
        ["M12", 12, 1.75, 18, 12, 10, 6],
        ["M14", 14, 2, 21, 14, 12, 7],
        ["M16", 16, 2, 24, 16, 14, 8],
        ["M20", 20, 2.5, 30, 20, 17, 10],
        ["M24", 24, 3, 36, 24, 19, 12],
        ["M30", 30, 3.5, 45, 30, 22, 15.5],
        ["M36", 36, 4, 54, 36, 27, 19],
        ["M42", 42, 4.5, 63, 42, 32, 24],
        ["M48", 48, 5, 72, 48, 36, 28],
        ["M56", 56, 5.5, 84, 56, 41, 34],
        ["M64", 64, 6, 96, 64, 46, 38]
    ]);

    /* ISO 10642 countersunk socket screws (mm). */
    var ISO_10642_SIZES = countersunkSizes([
        ["M2", 2, 0.4, 4.7, 1.35, 1.3, 0.75],
        ["M2.5", 2.5, 0.45, 5.88, 1.69, 1.5, 1],
        ["M3", 3, 0.5, 6.72, 1.86, 2, 1.1],
        ["M4", 4, 0.7, 8.96, 2.48, 2.5, 1.5],
        ["M5", 5, 0.8, 11.2, 3.1, 3, 1.9],
        ["M6", 6, 1, 13.44, 3.72, 4, 2.2],
        ["M8", 8, 1.25, 17.92, 4.96, 5, 3],
        ["M10", 10, 1.5, 22.4, 6.2, 6, 3.6],
        ["M12", 12, 1.75, 26.88, 7.44, 8, 4.3],
        ["M14", 14, 2, 30.8, 8.4, 10, 4.5],
        ["M16", 16, 2, 33.6, 8.8, 10, 4.8],
        ["M20", 20, 2.5, 40.32, 10.16, 12, 5.6]
    ]);

    /* DIN 7991 countersunk socket screws (mm). */
    var DIN_7991_SIZES = countersunkSizes([
        ["M3", 3, 0.5, 6, 1.7, 2, 0.95],
        ["M4", 4, 0.7, 8, 2.3, 2.5, 1.5],
        ["M5", 5, 0.8, 10, 2.8, 3, 2.05],
        ["M6", 6, 1, 12, 3.3, 4, 2.25],
        ["M8", 8, 1.25, 16, 4.4, 5, 3.2],
        ["M10", 10, 1.5, 20, 5.5, 6, 4.1],
        ["M12", 12, 1.75, 24, 6.5, 8, 4.3],
        ["M14", 14, 2, 27, 7, 10, 4.5],
        ["M16", 16, 2, 30, 7.5, 10, 5],
        ["M18", 18, 2.5, 33, 8, 12, 5.2],
        ["M20", 20, 2.5, 36, 8.5, 12, 5.6]
    ]);

    /* DIN 603 carriage bolts (mm): d, P, dk, k, square a, f, b at L<=125. */
    var DIN_603_SIZES = carriageSizes([
        ["M5", 5, 0.8, 13.55, 3.3, 5.48, 16, 4.1],
        ["M6", 6, 1, 16.55, 3.88, 6.48, 18, 4.6],
        ["M8", 8, 1.25, 20.65, 4.88, 8.58, 22, 5.6],
        ["M10", 10, 1.5, 24.65, 5.38, 10.58, 26, 6.6],
        ["M12", 12, 1.75, 30.65, 6.95, 12.7, 30, 8.75],
        ["M16", 16, 2, 38.8, 8.95, 16.7, 38, 12.9],
        ["M20", 20, 2.5, 46.8, 11.05, 20.84, 46, 15.9]
    ]);

    /* DIN 976-1 and DIN 938 sizes use the metric coarse thread only. */
    var METRIC_STUD_SIZES = studSizes([
        ["M2", 2, 0.4],
        ["M2.5", 2.5, 0.45],
        ["M3", 3, 0.5],
        ["M4", 4, 0.7],
        ["M5", 5, 0.8],
        ["M6", 6, 1],
        ["M8", 8, 1.25],
        ["M10", 10, 1.5],
        ["M12", 12, 1.75],
        ["M14", 14, 2],
        ["M16", 16, 2],
        ["M18", 18, 2.5],
        ["M20", 20, 2.5],
        ["M22", 22, 2.5],
        ["M24", 24, 3],
        ["M27", 27, 3],
        ["M30", 30, 3.5],
        ["M33", 33, 3.5],
        ["M36", 36, 4],
        ["M39", 39, 4],
        ["M42", 42, 4.5],
        ["M45", 45, 4.5],
        ["M48", 48, 5],
        ["M52", 52, 5],
        ["M56", 56, 5.5],
        ["M60", 60, 5.5],
        ["M64", 64, 6]
    ]);

    /* ISO 4032 hexagon regular nuts (style 1). */
    var ISO_4032_SIZES = nutSizes([
        ["M1.6", 1.6, 0.35, 3.2, 1.3],
        ["M2", 2, 0.4, 4, 1.6],
        ["M2.5", 2.5, 0.45, 5, 2],
        ["M3", 3, 0.5, 5.5, 2.4],
        ["M3.5", 3.5, 0.6, 6, 2.8],
        ["M4", 4, 0.7, 7, 3.2],
        ["M5", 5, 0.8, 8, 4.7],
        ["M6", 6, 1, 10, 5.2],
        ["M7", 7, 1, 11, 6.5],
        ["M8", 8, 1.25, 13, 6.8],
        ["M10", 10, 1.5, 16, 8.4],
        ["M12", 12, 1.75, 18, 10.8],
        ["M14", 14, 2, 21, 12.8],
        ["M16", 16, 2, 24, 14.8],
        ["M18", 18, 2.5, 27, 15.8],
        ["M20", 20, 2.5, 30, 18],
        ["M22", 22, 2.5, 34, 19.4],
        ["M24", 24, 3, 36, 21.5],
        ["M27", 27, 3, 41, 23.8],
        ["M30", 30, 3.5, 46, 25.6],
        ["M33", 33, 3.5, 50, 28.7],
        ["M36", 36, 4, 55, 31],
        ["M39", 39, 4, 60, 33.4],
        ["M42", 42, 4.5, 65, 34],
        ["M45", 45, 4.5, 70, 36],
        ["M48", 48, 5, 75, 38],
        ["M52", 52, 5, 80, 42],
        ["M56", 56, 5.5, 85, 45],
        ["M60", 60, 5.5, 90, 48],
        ["M64", 64, 6, 95, 51]
    ]);

    /* ISO 4033 hexagon high nuts (style 2). */
    var ISO_4033_SIZES = nutSizes([
        ["M5", 5, 0.8, 8, 5.1],
        ["M6", 6, 1, 10, 5.7],
        ["M7", 7, 1, 11, 7.2],
        ["M8", 8, 1.25, 13, 7.5],
        ["M10", 10, 1.5, 16, 9.3],
        ["M12", 12, 1.75, 18, 12],
        ["M14", 14, 2, 21, 14.1],
        ["M16", 16, 2, 24, 16.4],
        ["M18", 18, 2.5, 27, 17.6],
        ["M20", 20, 2.5, 30, 20.3],
        ["M22", 22, 2.5, 34, 21.8],
        ["M24", 24, 3, 36, 23.9],
        ["M27", 27, 3, 41, 26.7],
        ["M30", 30, 3.5, 46, 28.6],
        ["M33", 33, 3.5, 50, 32.5],
        ["M36", 36, 4, 55, 34.7],
        ["M39", 39, 4, 60, 37.5]
    ]);

    /* ISO 4035 hexagon thin nuts (jam nuts). */
    var ISO_4035_SIZES = nutSizes([
        ["M5", 5, 0.8, 8, 2.7],
        ["M6", 6, 1, 10, 3.2],
        ["M7", 7, 1, 11, 3.7],
        ["M8", 8, 1.25, 13, 4],
        ["M10", 10, 1.5, 16, 5],
        ["M12", 12, 1.75, 18, 6],
        ["M14", 14, 2, 21, 7],
        ["M16", 16, 2, 24, 8],
        ["M18", 18, 2.5, 27, 9],
        ["M20", 20, 2.5, 30, 10],
        ["M22", 22, 2.5, 34, 11],
        ["M24", 24, 3, 36, 12],
        ["M27", 27, 3, 41, 13.5],
        ["M30", 30, 3.5, 46, 15],
        ["M33", 33, 3.5, 50, 16.5],
        ["M36", 36, 4, 55, 18],
        ["M39", 39, 4, 60, 19.5]
    ]);

    /* ISO 7040 nylon insert lock nuts (height includes the collar). */
    var ISO_7040_SIZES = nutSizes([
        ["M3", 3, 0.5, 5.5, 4.8],
        ["M4", 4, 0.7, 7, 6.5],
        ["M5", 5, 0.8, 8, 6.95],
        ["M6", 6, 1, 10, 8],
        ["M7", 7, 1, 11, 9.2],
        ["M8", 8, 1.25, 13, 9.5],
        ["M10", 10, 1.5, 16, 11.9],
        ["M12", 12, 1.75, 18, 14.9],
        ["M14", 14, 2, 21, 17],
        ["M16", 16, 2, 24, 19.1],
        ["M18", 18, 2.5, 27, 21.2],
        ["M20", 20, 2.5, 30, 23],
        ["M22", 22, 2.5, 34, 25],
        ["M24", 24, 3, 36, 27.1],
        ["M27", 27, 3, 41, 29.9],
        ["M30", 30, 3.5, 46, 32.6],
        ["M33", 33, 3.5, 50, 35.7],
        ["M36", 36, 4, 55, 38.9],
        ["M39", 39, 4, 60, 41.9]
    ]);

    /* DIN 557 square nuts, product grade C. The current edition (2026-02)
       covers M5–M16; the width across flats follows ISO 272, so M10 is 16 mm
       and M12 is 18 mm (the 17/19 mm widths older catalogues print are the
       obsolescent variants the standard keeps only as an alternative). */
    var DIN_557_SIZES = nutSizes([
        ["M5", 5, 0.8, 8, 4],
        ["M6", 6, 1, 10, 5],
        ["M8", 8, 1.25, 13, 6.5],
        ["M10", 10, 1.5, 16, 8],
        ["M12", 12, 1.75, 18, 10],
        ["M16", 16, 2, 24, 13]
    ]);

    /* ASME B18.2.2-2022 hex jam nuts (thin hex nuts, table 1.1.1-5), inch.
       Thickness is the maximum of the table. */
    var ASME_JAM_NUT_SIZES = asmeNutSizes([
        ["1/4-20 UNC", 0.25, 20, 0.4375, 0.163],
        ["5/16-18 UNC", 0.3125, 18, 0.5, 0.195],
        ["3/8-16 UNC", 0.375, 16, 0.5625, 0.227],
        ["7/16-14 UNC", 0.4375, 14, 0.6875, 0.26],
        ["1/2-13 UNC", 0.5, 13, 0.75, 0.323],
        ["9/16-12 UNC", 0.5625, 12, 0.875, 0.324],
        ["5/8-11 UNC", 0.625, 11, 0.9375, 0.387],
        ["3/4-10 UNC", 0.75, 10, 1.125, 0.446],
        ["7/8-9 UNC", 0.875, 9, 1.3125, 0.51],
        ["1-8 UNC", 1, 8, 1.5, 0.575]
    ]);

    /* ASME B18.2.2-2022 square nuts (table 1.1.1-3), inch. The table has no
       9/16 in entry, so none is offered here. */
    var ASME_SQUARE_NUT_SIZES = asmeNutSizes([
        ["1/4-20 UNC", 0.25, 20, 0.4375, 0.235],
        ["5/16-18 UNC", 0.3125, 18, 0.5625, 0.283],
        ["3/8-16 UNC", 0.375, 16, 0.625, 0.346],
        ["7/16-14 UNC", 0.4375, 14, 0.75, 0.394],
        ["1/2-13 UNC", 0.5, 13, 0.8125, 0.458],
        ["5/8-11 UNC", 0.625, 11, 1, 0.569],
        ["3/4-10 UNC", 0.75, 10, 1.125, 0.68],
        ["7/8-9 UNC", 0.875, 9, 1.3125, 0.792],
        ["1-8 UNC", 1, 8, 1.5, 0.903]
    ]);

    /* ASME B18.16.6-2017 (R2022) style NE nylon insert lock nuts, inch. */
    var ASME_NYLON_NUT_SIZES = asmeNutSizes([
        ["1/4-20 UNC", 0.25, 20, 0.439, 0.328],
        ["5/16-18 UNC", 0.3125, 18, 0.502, 0.359],
        ["3/8-16 UNC", 0.375, 16, 0.564, 0.468],
        ["7/16-14 UNC", 0.4375, 14, 0.627, 0.468],
        ["1/2-13 UNC", 0.5, 13, 0.752, 0.609],
        ["9/16-12 UNC", 0.5625, 12, 0.877, 0.656],
        ["5/8-11 UNC", 0.625, 11, 0.94, 0.765],
        ["3/4-10 UNC", 0.75, 10, 1.064, 0.89],
        ["7/8-9 UNC", 0.875, 9, 1.252, 0.999],
        ["1-8 UNC", 1, 8, 1.44, 1.078]
    ]);

    /* GOST 5915-70 hexagon nuts, product grade B (mm). The tabulated rows are
       the standard's preferred diameters; M14, M18, M22, M27, M33 and M39
       are listed as non-preferred and were not transcribed. */
    var GOST_5915_SIZES = nutSizes([
        ["M5", 5, 0.8, 8, 4.7],
        ["M6", 6, 1, 10, 5.2],
        ["M8", 8, 1.25, 13, 6.8],
        ["M10", 10, 1.5, 16, 8.4],
        ["M12", 12, 1.75, 18, 10.8],
        ["M16", 16, 2, 24, 14.8],
        ["M20", 20, 2.5, 30, 18],
        ["M24", 24, 3, 36, 21.5],
        ["M30", 30, 3.5, 46, 25.6],
        ["M36", 36, 4, 55, 31],
        ["M42", 42, 4.5, 65, 34],
        ["M48", 48, 5, 75, 38]
    ]);

    /* GOST 5916-70 hexagon thin nuts, product grade B (mm). */
    var GOST_5916_SIZES = nutSizes([
        ["M5", 5, 0.8, 8, 2.7],
        ["M6", 6, 1, 10, 3.2],
        ["M8", 8, 1.25, 13, 4],
        ["M10", 10, 1.5, 16, 5],
        ["M12", 12, 1.75, 18, 6],
        ["M16", 16, 2, 24, 8],
        ["M20", 20, 2.5, 30, 10],
        ["M24", 24, 3, 36, 12],
        ["M30", 30, 3.5, 46, 15],
        ["M36", 36, 4, 55, 18],
        ["M42", 42, 4.5, 65, 21],
        ["M48", 48, 5, 75, 24]
    ]);

    /* GB/T 39-1988 square nuts, product grade C (mm), M3–M24. Height is the
       maximum of the table. */
    var GB_SQUARE_NUT_SIZES = nutSizes([
        ["M3", 3, 0.5, 5.5, 2.4],
        ["M4", 4, 0.7, 7, 3.2],
        ["M5", 5, 0.8, 8, 4],
        ["M6", 6, 1, 10, 5],
        ["M8", 8, 1.25, 13, 6.5],
        ["M10", 10, 1.5, 16, 8],
        ["M12", 12, 1.75, 18, 10],
        ["M14", 14, 2, 21, 11],
        ["M16", 16, 2, 24, 13],
        ["M18", 18, 2.5, 27, 15],
        ["M20", 20, 2.5, 30, 16],
        ["M22", 22, 2.5, 34, 18],
        ["M24", 24, 3, 36, 19]
    ]);

    /* GB/T 6172.1-2016 thin nuts (mm). The standard runs M1.6–M64; these are
       the rows whose width across flats and height are both verified. */
    var GB_6172_1_SIZES = nutSizes([
        ["M1.6", 1.6, 0.35, 3.2, 1],
        ["M2", 2, 0.4, 4, 1.2],
        ["M2.5", 2.5, 0.45, 5, 1.6],
        ["M3", 3, 0.5, 5.5, 1.8],
        ["M4", 4, 0.7, 7, 2.2],
        ["M5", 5, 0.8, 8, 2.7],
        ["M6", 6, 1, 10, 3.2],
        ["M8", 8, 1.25, 13, 4],
        ["M10", 10, 1.5, 16, 5],
        ["M12", 12, 1.75, 18, 6],
        ["M16", 16, 2, 24, 8],
        ["M20", 20, 2.5, 30, 10],
        ["M24", 24, 3, 36, 12],
        ["M30", 30, 3.5, 46, 15],
        ["M36", 36, 4, 55, 18]
    ]);

    /* GB/T 6170-2015 is modified from ISO 4032:2012 and repeats its table, so
       it offers the same M1.6–M64 series the ISO table carries. GB/T 6175-2016
       (style 2) stops at M36, GB/T 6172.1-2016 starts at M1.6 (above). */
    var GB_6170_SIZES = ISO_4032_SIZES;
    var GB_6175_SIZES = ISO_4033_SIZES.filter(function (size) {
        return size.values.diameter <= 36;
    });
    var GOST_ISO_4033_SIZES = GB_6175_SIZES;

    /* IS 1364 (Part 4):2025 and JIS B 1181:2014 thin nuts repeat the ISO
       4035:2023 table; both are tabulated here over its verified M5–M39
       range. */
    var IS_THIN_NUT_SIZES = ISO_4035_SIZES;
    var JIS_THIN_NUT_SIZES = ISO_4035_SIZES;

    /* ASME B18.2.1 hex cap screws (inch -> mm on load). */
    var ASME_BOLT_SIZES = asmeBoltSizes([
        ["1/4-20 UNC", 0.25, 20, 0.4375, 0.163, 0.75],
        ["5/16-18 UNC", 0.3125, 18, 0.5, 0.211, 0.875],
        ["3/8-16 UNC", 0.375, 16, 0.5625, 0.243, 1],
        ["7/16-14 UNC", 0.4375, 14, 0.625, 0.291, 1.125],
        ["1/2-13 UNC", 0.5, 13, 0.75, 0.323, 1.25],
        ["9/16-12 UNC", 0.5625, 12, 0.8125, 0.371, 1.375],
        ["5/8-11 UNC", 0.625, 11, 0.9375, 0.403, 1.5],
        ["3/4-10 UNC", 0.75, 10, 1.125, 0.483, 1.75],
        ["7/8-9 UNC", 0.875, 9, 1.3125, 0.563, 2],
        ["1-8 UNC", 1, 8, 1.5, 0.627, 2.25]
    ]);

    /* ASME B18.2.2 hex nuts (inch, maximum thickness). */
    var ASME_NUT_SIZES = asmeNutSizes([
        ["1/4-20 UNC", 0.25, 20, 0.4375, 0.226],
        ["5/16-18 UNC", 0.3125, 18, 0.5, 0.273],
        ["3/8-16 UNC", 0.375, 16, 0.5625, 0.337],
        ["7/16-14 UNC", 0.4375, 14, 0.6875, 0.385],
        ["1/2-13 UNC", 0.5, 13, 0.75, 0.448],
        ["9/16-12 UNC", 0.5625, 12, 0.875, 0.496],
        ["5/8-11 UNC", 0.625, 11, 0.9375, 0.559],
        ["3/4-10 UNC", 0.75, 10, 1.125, 0.665],
        ["7/8-9 UNC", 0.875, 9, 1.3125, 0.776],
        ["1-8 UNC", 1, 8, 1.5, 0.887]
    ]);

    /* ASME B18.2.2 heavy hex nuts. */
    var ASME_HEAVY_NUT_SIZES = asmeNutSizes([
        ["1/4-20 UNC", 0.25, 20, 0.5, 0.25],
        ["5/16-18 UNC", 0.3125, 18, 0.5625, 0.314],
        ["3/8-16 UNC", 0.375, 16, 0.6875, 0.377],
        ["7/16-14 UNC", 0.4375, 14, 0.75, 0.441],
        ["1/2-13 UNC", 0.5, 13, 0.875, 0.504],
        ["9/16-12 UNC", 0.5625, 12, 0.9375, 0.568],
        ["5/8-11 UNC", 0.625, 11, 1.0625, 0.631],
        ["3/4-10 UNC", 0.75, 10, 1.25, 0.758],
        ["7/8-9 UNC", 0.875, 9, 1.4375, 0.885],
        ["1-8 UNC", 1, 8, 1.625, 1.012]
    ]);

    function customStandard() {
        return {
            id: "custom",
            name: "Custom dimensions",
            family: "custom",
            metric: false,
            inch: false,
            sizes: [],
            title: "User-defined fastener dimensions",
            edition: "Not a published standard",
            published: "",
            source: "User input",
            verification: "not-applicable",
            verificationNote: "Values are entered by the user and are not presented as standard data."
        };
    }

    /* ==================================================
       DEFAULT NOMINAL LENGTH
       The default is a catalogue length for the selected product family and
       nominal diameter, never one fixed value for every size. Each table
       below is taken from the length series of the governing standard:

         hex       ISO 4014 / ISO 4017 hexagon head bolts and screws
                   (DIN 931 / DIN 933, IS 1364 Part 1 and 2, BS EN ISO 4014
                   and 4017, DIN EN ISO, JIS B 1180 all adopt this series)
         socket    ISO 4762 / DIN 912 hexagon socket head cap screws
         csk       ISO 10642 / DIN 7991 countersunk socket screws
         carriage  DIN 603 carriage bolts
         stud      DIN 976-1 fully threaded studs
         stud-de   DIN 938 double end studs
         inch      ASME B18.2.1 hex cap screws, keyed by the inch diameter
                   converted to millimetres (1/4 in to 1 in)

       The chosen value is a normally stocked length of roughly three to five
       diameters for screws and bolts, and a proportionally longer length for
       studs, so the head, shank and thread read correctly in the drawing.
       The user can always type another length; this only sets the initial
       value when a size is opened.
    ================================================== */
    var DEFAULT_LENGTH_TABLE = {
        hex: {
            1.6: 8, 2: 10, 2.5: 12, 3: 16, 3.5: 16, 4: 20, 5: 25, 6: 30,
            7: 35, 8: 40, 10: 50, 12: 60, 14: 70, 16: 80, 18: 90, 20: 100,
            22: 110, 24: 120, 27: 130, 30: 150, 33: 160, 36: 180, 39: 190,
            42: 200, 45: 220, 48: 240, 52: 250, 56: 260, 60: 280, 64: 300
        },
        socket: {
            1.6: 6, 2: 8, 2.5: 10, 3: 12, 4: 16, 5: 20, 6: 25, 8: 30,
            10: 40, 12: 50, 14: 60, 16: 60, 20: 80, 24: 90, 30: 100,
            36: 120, 42: 130, 48: 140, 56: 160, 64: 180
        },
        csk: {
            2: 6, 2.5: 8, 3: 10, 4: 12, 5: 16, 6: 20, 8: 25, 10: 30,
            12: 35, 14: 40, 16: 45, 18: 50, 20: 60
        },
        carriage: {
            5: 25, 6: 30, 8: 40, 10: 50, 12: 60, 16: 80, 20: 100
        },
        stud: {
            2: 50, 2.5: 50, 3: 60, 4: 60, 5: 80, 6: 80, 8: 100, 10: 120,
            12: 150, 14: 160, 16: 180, 18: 200, 20: 220, 22: 240, 24: 250,
            27: 280, 30: 300, 33: 320, 36: 350, 39: 380, 42: 400, 45: 420,
            48: 450, 52: 480, 56: 500, 60: 550, 64: 600
        },
        "stud-de": {
            2: 40, 2.5: 40, 3: 50, 4: 50, 5: 60, 6: 70, 8: 80, 10: 100,
            12: 120, 14: 140, 16: 150, 18: 170, 20: 180, 22: 200, 24: 220,
            27: 240, 30: 250, 33: 280, 36: 300, 39: 320, 42: 350, 45: 380,
            48: 400, 52: 420, 56: 450, 60: 480, 64: 500
        },
        inch: {
            6.35: 25.4, 7.94: 31.75, 9.53: 38.1, 11.11: 44.45, 12.7: 50.8,
            14.29: 57.15, 15.88: 63.5, 19.05: 76.2, 22.23: 88.9, 25.4: 101.6
        }
    };

    /* Preferred nominal length series (ISO 888 / ISO 4017), used only as a
       last resort for a diameter that is not in the tables above. */
    var PREFERRED_LENGTH_STEPS = [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25,
        30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120, 130, 140,
        150, 160, 170, 180, 190, 200, 220, 240, 250, 260, 280, 300, 320, 350,
        400, 450, 500, 550, 600];

    /* Nearest tabulated length for a diameter, or null when the diameter is
       not a tabulated size (a manually typed value). */
    function tableLength(table, diameterMM) {
        var keys = Object.keys(table);
        var best = null;

        for (var i = 0; i < keys.length; i += 1) {
            var key = Number(keys[i]);

            if (best === null || Math.abs(key - diameterMM) < Math.abs(best - diameterMM)) {
                best = key;
            }
        }

        if (best === null || Math.abs(best - diameterMM) > 0.2) {
            return null;
        }

        return table[best];
    }

    /* Rounds a computed length up to the next preferred series value. */
    function snapToPreferredLength(value) {
        for (var i = 0; i < PREFERRED_LENGTH_STEPS.length; i += 1) {
            if (PREFERRED_LENGTH_STEPS[i] >= value) {
                return PREFERRED_LENGTH_STEPS[i];
            }
        }

        return Math.ceil(value / 50) * 50;
    }

    function lengthFamily(product) {
        if (product.key === "threaded-rod") {
            return "rod";
        }

        if (product.category === "studs") {
            return product.key === "stud-de" ? "stud-de" : "stud";
        }

        if (product.drawing === "socket") {
            return "socket";
        }

        if (product.drawing === "countersunk") {
            return "csk";
        }

        if (product.drawing === "carriage") {
            return "carriage";
        }

        return "hex";
    }

    /* A half-thread bolt needs a plain shank next to the head. Walk up the
       preferred series until the ISO thread length b leaves at least one
       diameter of unthreaded shank. */
    function ensurePlainShank(length, diameter) {
        var candidate = snapToPreferredLength(length);

        for (var i = 0; i < 12; i += 1) {
            if (isoThreadLength(candidate, diameter) + diameter <= candidate) {
                return candidate;
            }

            candidate = snapToPreferredLength(candidate + 0.1);
        }

        return candidate;
    }

    function defaultLengthForProduct(product, diameterMM, standard) {
        if (!product || product.fields.indexOf("length") === -1) {
            return null;
        }

        if (product.key === "threaded-rod") {
            return product.defaultLength || 1000;
        }

        var d = Number(diameterMM);

        if (!isFinite(d) || d <= 0) {
            return product.defaultLength || 100;
        }

        var family = lengthFamily(product);
        var imperial = Boolean(standard && standard.inch);
        var studProduct = family === "stud" || family === "stud-de";
        var length = imperial && !studProduct
            ? tableLength(DEFAULT_LENGTH_TABLE.inch, d)
            : null;

        /* A stud is long for its diameter and the inch stud tables are written
           in whole inches, so an inch stud starts at the next whole inch near
           20 d instead of at a bolt's under-head length. */
        if (length === null && imperial && studProduct) {
            length = Math.max(2, Math.round(d * 20 / 25.4)) * 25.4;
        }

        if (length === null) {
            length = tableLength(DEFAULT_LENGTH_TABLE[family], d);
        }

        if (length === null) {
            /* Manually typed diameter: keep the same proportions as the
               catalogue default (about 4 d for bolts and screws, 3 d for
               socket and countersunk screws, 20 d for studs). */
            var ratio = family === "stud" || family === "stud-de" ? 20
                : (family === "socket" || family === "csk" ? 3 : 4);

            length = snapToPreferredLength(d * ratio);
        }

        if (product.key === "hex-ht") {
            length = ensurePlainShank(length, d);
        }

        return Math.round(length * 100) / 100;
    }

    function applyDefaultLengthForCurrentSize() {
        var product = currentProduct();
        var size = currentSize();
        var d = size && size.values ? size.values.diameter : fieldMM("diameter", 0);
        var length = defaultLengthForProduct(product, d, currentStandard());

        if (length !== null) {
            setFieldValue("length", length);
            delete state.touched.length;

            /* The length-dependent thread length must follow the new default.
               Without this second pass, switching from a full-thread product
               (no b field) to a half-thread product left b empty because the
               first pass ran before the default length was known. */
            applyThreadLengths();
        }
    }

    /* ==================================================
       INTERNATIONAL STANDARD FAMILIES
       Each product carries only the standards that apply to it. The family is
       kept separately so changing from bolts to studs or nuts can select the
       corresponding product standard without reusing another product's number.
    ================================================== */
    var STANDARD_FAMILIES = {
        iso: {
            label: "ISO",
            country: "International",
            organization: "International Organization for Standardization (ISO)"
        },
        asme: {
            label: "ASME",
            country: "United States",
            organization: "American Society of Mechanical Engineers (ASME)"
        },
        is: {
            label: "IS",
            country: "India",
            organization: "Bureau of Indian Standards (BIS)"
        },
        bs: {
            label: "BS / EN ISO",
            country: "United Kingdom",
            organization: "British Standards Institution (BSI)"
        },
        din: {
            label: "DIN",
            country: "Germany",
            organization: "Deutsches Institut für Normung (DIN)"
        },
        une: {
            label: "UNE / EN ISO",
            country: "Spain",
            organization: "Asociación Española de Normalización (UNE)"
        },
        nf: {
            label: "NF / EN ISO",
            country: "France",
            organization: "Association Française de Normalisation (AFNOR)"
        },
        jis: {
            label: "JIS",
            country: "Japan",
            organization: "Japanese Industrial Standards Committee (JISC) / Japanese Standards Association (JSA)"
        },
        gb: {
            label: "GB/T",
            country: "China",
            organization: "Standardization Administration of China (SAC / SAMR)"
        },
        gost: {
            label: "GOST",
            country: "Russia",
            organization: "Euro-Asian Council for Standardization, Metrology and Certification (EASC)"
        },
        abnt: {
            label: "ABNT NBR",
            country: "Brazil",
            organization: "Associação Brasileira de Normas Técnicas (ABNT)"
        },
        saso: {
            label: "SASO / GSO",
            country: "Saudi Arabia / Gulf Cooperation Council",
            organization: "Saudi Standards, Metrology and Quality Organization (SASO) / Gulf Standardization Organization (GSO)"
        },
        custom: {
            label: "Custom",
            country: "—",
            organization: "User-defined"
        }
    };

    var VERIFICATION_LABELS = {
        "verified-official": "Official document preview verified",
        "verified-adoption": "Official adoption record verified",
        "verified-partial": "Edition and relationship verified; full text not inspected",
        "existing": "Existing project data; not re-verified in this task",
        "not-applicable": "Not applicable"
    };

    function makeStandard(family, id, name, sizes, title, edition, published, source,
        verification, verificationNote, extra) {
        var standard = {
            id: id,
            name: name,
            sizes: sizes,
            family: family,
            metric: family !== "asme",
            inch: family === "asme",
            title: title,
            edition: edition,
            published: published,
            source: source,
            verification: verification,
            verificationNote: verificationNote || "",
            /* Whether the standard specifies the product itself or only its
               head geometry; every other standard specifies its product. */
            applicability: "direct"
        };

        if (extra) {
            Object.keys(extra).forEach(function (key) {
                standard[key] = extra[key];
            });
        }

        return standard;
    }

    function sizesWithout(sizes, labels) {
        return sizes.filter(function (size) {
            return labels.indexOf(size.label) === -1;
        });
    }

    function sizesInRange(sizes, min, max) {
        return sizes.filter(function (size) {
            var diameter = size.values.diameter;
            return diameter >= min && diameter <= max;
        });
    }

    /* DIN 938 covers M3 to M52; DIN 976-1 covers the wider M2 to M64 range. */
    var DIN_938_SIZES = sizesInRange(METRIC_STUD_SIZES, 3, 52);

    /* ISO 4017:2014 / ISO 4014:2011 did not contain M7; it was added in the
       2022 editions. GSO ISO 4017:2015 and JIS B 1180:2014 therefore use this
       table without M7. */
    var ISO_4017_2014_SIZES = sizesWithout(ISO_BOLT_SIZES, ["M7"]);

    /* ISO 4032:2023, IS 1364 (Part 3):2026 and GSO ISO 4032:2024 all have a
       main-table scope of M5 to M39. The existing ISO table still contains the
       historical sizes from the older edition and is deliberately unchanged. */
    var ISO_4032_2023_SIZES = sizesInRange(ISO_4032_SIZES, 5, 39);
    var IS_NUT_SIZES = ISO_4032_2023_SIZES;
    var GSO_NUT_SIZES = ISO_4032_2023_SIZES;

    /* JIS B 1181:2014 has the same M1.6 to M64 size range as the ISO table,
       but its table gives M7 and M8 heights of 5.5 and 6.5, not the ISO
       values. M7 is a non-preferred JIS size and must stay available. */
    var JIS_NUT_SIZES = ISO_4032_SIZES.map(function (size) {
        if (size.label !== "M7" && size.label !== "M8") {
            return size;
        }

        var values = {};
        Object.keys(size.values).forEach(function (key) {
            values[key] = size.values[key];
        });
        values.nutHeight = size.label === "M7" ? 5.5 : 6.5;

        return { label: size.label, values: values };
    });

    /* ==================================================
       HEXAGON HEAD BOLT STANDARD REGISTRY

       One record per national standards body, keyed by the family id the
       interface already uses, and inside it one record per product form:

         full  hexagon head screw, threaded over its whole length (ISO 4017)
         half  hexagon head bolt, threaded over the thread length b (ISO 4014)
         head  the same head geometry, used by the unthreaded blank

       ISO 4014 and ISO 4017 publish the same head table (d, P, s, e, k) and
       every adopter below republishes that table unchanged, so a family shares
       one verified size list between its bolt standards. That is the only
       sharing: a product form the family does not publish simply has no entry
       and never borrows another product's dimensions.

       applicability  "direct"        the standard specifies this product
                      "head-geometry" the standard specifies the head only
       sizes          the verified size table of that standard
    ================================================== */

    var ASME_B18_2_1 = {
        id: "asme-b18-2-1",
        name: "ASME B18.2.1 (inch)",
        sizes: ASME_BOLT_SIZES,
        title: "Square, Hex, Heavy Hex, and Askew Head Bolts and Hex, Heavy Hex, Hex Flange, Lobed Head, and Lag Screws (Inch Series) — hex cap screws",
        edition: "ASME B18.2.1-2012 (R2021)",
        published: "2012, reaffirmed 2021",
        source: "ASME standards catalogue, ASME B18.2.1-2012 (R2021); https://www.asme.org/codes-standards",
        verification: "verified-official",
        note: "Current edition and 2021 reaffirmation verified in the ASME catalogue; hex cap screw dimensions cross-checked against two independent reproductions of Table 6. The calculator carries the UNC series 1/4 to 1 in."
    };

    var JIS_B_1180 = {
        id: "jis-b-1180",
        name: "JIS B 1180:2014",
        sizes: ISO_4017_2014_SIZES,
        title: "Hexagon head bolts and hexagon head screws",
        edition: "JIS B 1180:2014",
        published: "2014-04-21",
        source: "JIS B 1180:2014 body text (publicly accessible copy); https://kikakurui.com/b1/B1180-2014-01.html",
        verification: "verified-partial",
        note: "Body tables correspond to ISO 4014:2011 and ISO 4017:2011; M7 is omitted because it was added after the 2014 edition (JIS carries M7 only in Annex JA). The JSA paid text was not accessed."
    };

    var HEX_STANDARD_REGISTRY = {
        iso: {
            full: {
                id: "iso-4017",
                name: "ISO 4017 (metric)",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head screws — Product grades A and B",
                edition: "ISO 4017:2022, sixth edition",
                published: "2022-06-28",
                source: "ISO preview; https://cdn.standards.iteh.ai/samples/72585/1179998ddd594550a909d6e13c416f3e/ISO-4017-2022.pdf",
                verification: "verified-official",
                note: "Official ISO preview inspected; M7 was added in the 2022 edition."
            },
            half: {
                id: "iso-4014",
                name: "ISO 4014 (metric)",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head bolts — Product grades A and B",
                edition: "ISO 4014:2022, fifth edition",
                published: "2022-06-28",
                source: "ISO preview; https://cdn.standards.iteh.ai/samples/72579/81f2b1e966b440d7a25f6734e508ea48/ISO-4014-2022.pdf",
                verification: "verified-official",
                note: "Official ISO preview inspected; M7 was added in the 2022 edition."
            },
            head: {
                id: "iso-4014-4017-head",
                name: "ISO 4014 / 4017 head (metric)"
            }
        },
        asme: {
            full: ASME_B18_2_1,
            half: ASME_B18_2_1,
            head: {
                id: "asme-b18-2-1-head",
                name: "ASME B18.2.1 head (inch)"
            }
        },
        is: {
            full: {
                id: "is-1364-2",
                name: "IS 1364 (Part 2):2023",
                sizes: ISO_BOLT_SIZES,
                title: "Hexagon head bolts, screws and nuts of product grades A and B — Part 2: Hexagon head screws (Size range M1.6 to M64)",
                edition: "2023 edition (sixth revision)",
                published: "2023",
                source: "BIS Standards India, IS 1364 (Part 2):2023; https://standards.bis.gov.in/",
                verification: "verified-adoption",
                note: "Identical adoption of ISO 4017:2022 verified from the BIS record and gazette notification."
            },
            half: {
                id: "is-1364-1",
                name: "IS 1364 (Part 1):2023",
                sizes: ISO_BOLT_SIZES,
                title: "Hexagon head bolts, screws and nuts of product grades A and B — Part 1: Hexagon head bolts (Size range M1.6 to M64)",
                edition: "2023 edition (sixth revision)",
                published: "2023",
                source: "BIS Standards India, IS 1364 (Part 1):2023; https://standards.bis.gov.in/",
                verification: "verified-adoption",
                note: "Identical adoption of ISO 4014:2022 verified from the BIS record."
            },
            head: {
                id: "is-1364-head",
                name: "IS 1364 (Part 1/2):2023 head (metric)"
            }
        },
        bs: {
            full: {
                id: "bs-en-iso-4017",
                name: "BS EN ISO 4017:2022",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head screws — Product grades A and B",
                edition: "BS EN ISO 4017:2022",
                published: "2022",
                source: "BSI/ANSI preview, BS EN ISO 4017:2022; https://webstore.ansi.org/preview-pages/BSI/preview_30351936.pdf",
                verification: "verified-official",
                note: "Identical UK adoption of ISO 4017:2022; BSI foreword and ISO text inspected."
            },
            half: {
                id: "bs-en-iso-4014",
                name: "BS EN ISO 4014:2022",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head bolts — Product grades A and B",
                edition: "BS EN ISO 4014:2022",
                published: "2022",
                source: "BSI/ANSI preview, BS EN ISO 4014:2022; https://webstore.ansi.org/preview-pages/BSI/preview_30351924.pdf",
                verification: "verified-official",
                note: "Identical UK adoption of ISO 4014:2022; BSI foreword and ISO text inspected."
            },
            head: {
                id: "bs-en-iso-4014-4017-head",
                name: "BS EN ISO 4014/4017:2022 head (metric)"
            }
        },
        din: {
            full: {
                id: "din-en-iso-4017",
                name: "DIN EN ISO 4017:2022-10",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head screws — Product grades A and B (ISO 4017:2022)",
                edition: "DIN EN ISO 4017:2022-10",
                published: "2022-10",
                source: "DIN Media catalogue, DIN EN ISO 4017:2022-10; https://www.dinmedia.de/",
                verification: "verified-adoption",
                note: "Identical German adoption of ISO 4017:2022; DIN Media record verified."
            },
            half: {
                id: "din-en-iso-4014",
                name: "DIN EN ISO 4014:2022-10",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head bolts — Product grades A and B (ISO 4014:2022)",
                edition: "DIN EN ISO 4014:2022-10",
                published: "2022-10",
                source: "DIN Media catalogue, DIN EN ISO 4014:2022-10; https://www.dinmedia.de/en/standard/din-en-iso-4014/342492300",
                verification: "verified-adoption",
                note: "Identical German adoption of ISO 4014:2022; DIN Media record verified."
            },
            head: {
                id: "din-en-iso-4014-4017-head",
                name: "DIN EN ISO 4014/4017:2022-10 head (metric)"
            }
        },
        une: {
            full: {
                id: "une-en-iso-4017",
                name: "UNE-EN ISO 4017:2023",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head screws — Product grades A and B (ISO 4017:2022)",
                edition: "UNE-EN ISO 4017:2023",
                published: "2023",
                source: "AENOR UNE catalogue; http://tienda.aenor.com/p/norma-une-en-iso-4017-2023-n0071076",
                verification: "verified-adoption",
                note: "Identical Spanish adoption of ISO 4017:2022; UNE catalogue record verified."
            },
            half: {
                id: "une-en-iso-4014",
                name: "UNE-EN ISO 4014:2023",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head bolts — Product grades A and B (ISO 4014:2022)",
                edition: "UNE-EN ISO 4014:2023",
                published: "2023",
                source: "AENOR UNE catalogue; http://tienda.aenor.com/p/norma-une-en-iso-4014-2023-n0071073",
                verification: "verified-adoption",
                note: "Identical Spanish adoption of ISO 4014:2022; UNE catalogue record verified."
            },
            head: {
                id: "une-en-iso-4014-4017-head",
                name: "UNE-EN ISO 4014/4017:2023 head (metric)"
            }
        },
        nf: {
            full: {
                id: "nf-en-iso-4017",
                name: "NF EN ISO 4017:2022",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head screws — Product grades A and B (ISO 4017:2022)",
                edition: "NF EN ISO 4017:2022",
                published: "2022",
                source: "AFNOR catalogue, NF EN ISO 4017:2022; https://www.boutique.afnor.org/",
                verification: "verified-adoption",
                note: "Identical French adoption of ISO 4017:2022; AFNOR catalogue record verified."
            },
            half: {
                id: "nf-en-iso-4014",
                name: "NF EN ISO 4014:2022",
                sizes: ISO_BOLT_SIZES,
                title: "Fasteners — Hexagon head bolts — Product grades A and B (ISO 4014:2022)",
                edition: "NF EN ISO 4014:2022",
                published: "2022",
                source: "AFNOR catalogue, NF EN ISO 4014:2022; https://www.boutique.afnor.org/",
                verification: "verified-adoption",
                note: "Identical French adoption of ISO 4014:2022; AFNOR catalogue record verified."
            },
            head: {
                id: "nf-en-iso-4014-4017-head",
                name: "NF EN ISO 4014/4017:2022 head (metric)"
            }
        },
        jis: {
            full: JIS_B_1180,
            half: JIS_B_1180,
            head: {
                id: "jis-b-1180-head",
                name: "JIS B 1180:2014 head (metric)"
            }
        },
        saso: {
            full: {
                id: "gso-iso-4017",
                name: "GSO ISO 4017:2015",
                sizes: ISO_4017_2014_SIZES,
                title: "Fasteners — Hexagon head screws — Product grades A and B (ISO 4017:2014)",
                edition: "GSO ISO 4017:2015",
                published: "2015-09-03",
                source: "GSO standards store; https://dgsm.gso.org.sa/store/standards/GSO:690107?lang=en",
                verification: "verified-adoption",
                note: "Current GSO edition and ISO 4017:2014 adoption verified; dimensions use the adopted ISO table, which has no M7."
            },
            half: {
                id: "gso-iso-4014",
                name: "GSO ISO 4014:2015",
                sizes: ISO_4017_2014_SIZES,
                title: "Fasteners — Hexagon head bolts — Product grades A and B (ISO 4014:2011)",
                edition: "GSO ISO 4014:2015",
                published: "2015-09-03",
                source: "GSO standards store; https://dgsm.gso.org.sa/store/standards/GSO:690085?lang=en",
                verification: "verified-adoption",
                note: "Current GSO edition and ISO 4014:2011 adoption verified; dimensions use the adopted ISO table, which has no M7."
            },
            head: {
                id: "gso-iso-4014-4017-head",
                name: "GSO ISO 4014/4017:2015 head (metric)"
            }
        }
    };

    var HEX_STANDARD_ORDER = ["iso", "asme", "is", "bs", "din", "une", "nf", "jis", "saso"];

    var HEX_BLANK_NOTE = "No published standard defines an unthreaded hexagon head blank, " +
        "so this standard supplies the head dimensions (s, e, k) only.";

    /* The standards a hexagon head product offers, built from the registry so
       one body's edition, source and size table cannot drift between the three
       product forms. */
    function hexStandards(kind) {
        var standards = HEX_STANDARD_ORDER.map(function (family) {
            var entry = HEX_STANDARD_REGISTRY[family];
            var record = entry[kind] || entry.head;
            /* The blank borrows the edition, source and size table of the
               bolt standard of that family, never its own sparser record. */
            var bolt = kind === "head" ? entry.half : record;
            var headOnly = kind === "head";

            return makeStandard(family, record.id, record.name,
                record.sizes || bolt.sizes,
                headOnly ? bolt.title : record.title,
                headOnly ? bolt.edition : record.edition,
                headOnly ? bolt.published : record.published,
                headOnly ? bolt.source : record.source,
                headOnly ? bolt.verification : record.verification,
                headOnly ? HEX_BLANK_NOTE : record.note,
                {
                    applicability: headOnly ? "head-geometry" : "direct",
                    threadRule: family === "asme" ? "asme" : "iso4014"
                });
        });

        standards.push(customStandard());

        return standards;
    }

    /* ==================================================
       STUD STANDARD REGISTRY
       One record per published product standard, filed by the body that
       publishes it and by the product forms it really specifies. The three
       stud products are built from this registry, so an edition, a source
       and a size table cannot drift between them.

       Scope rules applied here:
       * only product DIMENSIONAL standards are listed. ISO 898-1, ISO 3506-1,
         ASTM A193/A193M/A320 and IS 1367 are mechanical-property or material
         specifications: they are never presented as a stud dimension standard;
       * ISO has no dimensional stud product standard, so there is no ISO
         record. A switch to the ISO family therefore falls back to Custom with
         an explanation instead of borrowing a bolt standard;
       * a standard appears only under the form it defines: a continuous
         thread standard never appears under Double End Stud, and a double end
         standard never appears under Fully Threaded Stud;
       * inch sizes use the inch labels and inch pitches of the ASME tables
         already in the project (1/4 in to 1 in); larger ASME diameters exist
         in B18.31.2 but are not carried by this project's inch table.
    ================================================== */

    /* ISO 261 coarse pitches for every diameter the stud standards list. Each
       standard below is built from this one map, so one thread size can never
       carry two different coarse pitches. */
    var STUD_COARSE_PITCH = {
        2: 0.4, 2.5: 0.45, 3: 0.5, 3.5: 0.6, 4: 0.7, 5: 0.8, 6: 1,
        7: 1, 8: 1.25, 10: 1.5, 12: 1.75, 14: 2, 16: 2, 18: 2.5,
        20: 2.5, 22: 2.5, 24: 3, 27: 3, 30: 3.5, 33: 3.5, 36: 4,
        39: 4, 42: 4.5, 45: 4.5, 48: 5, 52: 5, 56: 5.5, 60: 5.5,
        64: 6, 68: 6, 72: 6, 76: 6, 80: 6, 85: 6, 90: 6, 95: 6, 100: 6
    };

    /* Coarse sizes first, then the fine pitches the standard itself lists as
       separate diameter/pitch combinations. The fine label carries the pitch
       (M10×1.25), so the dropdown never hides which thread is selected. */
    function studMetricSizes(diameters, finePairs) {
        var sizes = diameters.map(function (diameter) {
            return {
                label: "M" + diameter,
                threadSeries: "coarse",
                values: { diameter: diameter, pitch: STUD_COARSE_PITCH[diameter] }
            };
        });

        (finePairs || []).forEach(function (pair) {
            sizes.push({
                label: "M" + pair[0] + "×" + pair[1],
                threadSeries: "fine",
                values: { diameter: pair[0], pitch: pair[1] }
            });
        });

        return sizes;
    }

    /* The inch table already in the project, trimmed to the stud diameters
       and stripped of the hex-head values a stud does not have. */
    var ASME_STUD_SIZES = ASME_BOLT_SIZES.filter(function (size) {
        return size.values.diameter <= 25.4 + 0.01;
    }).map(function (size) {
        return {
            label: size.label,
            threadSeries: "UNC",
            values: { diameter: size.values.diameter, pitch: size.values.pitch }
        };
    });

    /* DIN 976-1 Table 1 fine threads (M8×1 to M72×6). */
    var STUD_FINE_DIN_976 = [
        [8, 1], [10, 1.25], [10, 1], [12, 1.5], [12, 1.25], [14, 1.5],
        [16, 1.5], [18, 1.5], [20, 1.5], [22, 1.5], [24, 2], [27, 2],
        [30, 2], [33, 2], [36, 3], [39, 3], [42, 3], [45, 3], [48, 3],
        [52, 3], [56, 4], [60, 4], [64, 4], [68, 4], [72, 6]
    ];

    /* DIN 938 and DIN 939 fine threads (M8×1 to M52×3). */
    var STUD_FINE_DIN_938 = [
        [8, 1], [10, 1.25], [10, 1], [12, 1.5], [12, 1.25], [14, 1.5],
        [16, 1.5], [18, 1.5], [20, 1.5], [22, 1.5], [24, 2], [27, 2],
        [30, 2], [33, 2], [36, 3], [39, 3], [42, 3], [45, 3], [48, 3],
        [52, 3]
    ];

    /* DIN 940 fine threads (M8×1 to M24×2). */
    var STUD_FINE_DIN_940 = [
        [8, 1], [10, 1.25], [10, 1], [12, 1.5], [12, 1.25], [14, 1.5],
        [16, 1.5], [18, 1.5], [20, 1.5], [22, 1.5], [24, 2]
    ];

    var STUD_STANDARD_REGISTRY = [
        /* ---------------- Germany (DIN) ---------------- */
        {
            family: "din",
            id: "din-976-1",
            name: "DIN 976-1:2016-09",
            title: "Fasteners — Stud bolts — Part 1: Metric thread",
            edition: "2016-09",
            published: "2016-09",
            status: "Current",
            forms: ["ft", "rod"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24,
                    27, 30, 33, 36, 39, 42, 45, 48, 52, 56, 60, 64, 68, 72],
                STUD_FINE_DIN_976),
            source: "DIN Media, DIN 976-1:2016-09, 12 pp., DOI 10.31030/2538659; " +
                "https://www.dinmedia.de/en/standard/din-976-1/257277286",
            verification: "verified-official",
            note: "Metric coarse M2–M72, 30 sizes; M3.5, M14, M18, M22, M27, " +
                "M33, M39, M45, M52, M60 and M68 are bracketed non-preferred " +
                "sizes. Fine threads M8×1 to M72×6 follow the coarse sizes. " +
                "Replaces DIN 976-1:2002-12."
        },
        {
            family: "din",
            id: "din-938",
            name: "DIN 938:2025-08",
            title: "Fasteners — Studs — Metal end ≈ 1d",
            edition: "2025-08",
            published: "2025-08",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33,
                    36, 39, 42, 45, 48, 52],
                STUD_FINE_DIN_938),
            bmRule: "din938",
            source: "DIN Media, DIN 938:2025-08, 15 pp., DOI 10.31030/3625233; " +
                "https://www.dinmedia.de/de/norm/din-938/392482848",
            verification: "verified-official",
            note: "Steel and stainless steel studs, product grade A, metal end " +
                "≈ 1d: M3–M52 coarse and M8×1 to M52×3 fine. The tap-end length " +
                "is 1d with the standard's exceptions for M27, M33, M36 and M39 " +
                "(25, 32, 35 and 38 mm). Replaces DIN 938:2012-12."
        },
        {
            family: "din",
            id: "din-939",
            name: "DIN 939:2025-08",
            title: "Fasteners — Studs — Metal end ≈ 1.25d",
            edition: "2025-08",
            published: "2025-08",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33, 36,
                    39, 42, 45, 48, 52],
                STUD_FINE_DIN_938),
            bmRule: "factor",
            bmFactor: 1.25,
            source: "DIN Media, DIN 939:2025-08, 15 pp.; " +
                "https://www.dinmedia.de/en/standard/din-939/392483495",
            verification: "verified-official",
            note: "Product grade A, metal end ≈ 1.25d: M4–M52 coarse and M8×1 " +
                "to M52×3 fine (tables M4–M24 and M27–M52). Replaces " +
                "DIN 939:1995-02."
        },
        {
            family: "din",
            id: "din-940",
            name: "DIN 940:2025-08",
            title: "Fasteners — Studs — Metal end ≈ 2.5d",
            edition: "2025-08",
            published: "2025-08",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
                STUD_FINE_DIN_940),
            bmRule: "factor",
            bmFactor: 2.5,
            source: "DIN, DIN 940:2025-08, current edition; " +
                "https://www.din.de/de/mitwirken/normenausschuesse/fmv/veroeffentlichungen/wdc-beuth:din21:392484462",
            verification: "verified-official",
            note: "Steel and stainless steel studs, product grade A, metal end " +
                "≈ 2.5d, mainly for light-metal tapped holes: M4–M24 coarse and " +
                "M8×1 to M24×2 fine. Replaces DIN 940:2010-07; the 2024-09 draft " +
                "was withdrawn and superseded by this edition."
        },

        /* ---------------- United States (ASME) ---------------- */
        {
            family: "asme",
            id: "asme-b18-31-1m",
            name: "ASME B18.31.1M-2008 (R2021)",
            title: "Metric Continuous and Double-End Studs",
            edition: "2008 (reaffirmed 2021)",
            published: "2008",
            status: "Current (stabilized maintenance)",
            forms: ["ft", "de"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 30, 36, 42,
                    48, 56, 64, 72, 80, 90, 100]),
            bmRule: "factor",
            bmFactor: 1.5,
            metric: true,
            inch: false,
            source: "ASME, B18.31.1M-2008 (R2021), current; " +
                "https://www.asme.org/codes-standards/find-codes-standards/metric-continuous-and-double-end-studs",
            verification: "verified-official",
            note: "Metric series recognised as an American National Standard: " +
                "continuous thread, double end clamping type and double end tap " +
                "end type, reduced or full body. The tap end of this standard is " +
                "≈ 1.5d. Diameter list M2–M100 as tabulated; ANSI sizes."
        },
        {
            family: "asme",
            id: "asme-b18-31-2",
            name: "ASME B18.31.2-2014 (R2019)",
            title: "Continuous Thread Stud, Double-End Stud, and Flange " +
                "Bolting Stud (Stud Bolt) (Inch Series)",
            edition: "2014 (reaffirmed 2019)",
            published: "2014",
            status: "Current",
            forms: ["ft", "de"],
            sizes: ASME_STUD_SIZES,
            bmRule: "asme-inch",
            inch: true,
            metric: false,
            source: "ASME, B18.31.2-2014 (R2019), current; " +
                "https://www.asme.org/codes-standards/find-codes-standards/b18-31-2-continuous-thread-stud-double-end-stud-flange-bolting-stud",
            verification: "verified-partial",
            note: "Inch series: continuous thread stud, flange stud (stud bolt) " +
                "and double end clamping type, 1/4 in to 4 in in the standard. " +
                "This project's inch table carries 1/4 in to 1 in. Flange stud " +
                "length is measured from the first full thread to the first full " +
                "thread; the double end nut-end thread length follows the " +
                "standard's B table for the length bands."
        },
        {
            family: "asme",
            id: "asme-b18-31-3",
            name: "ASME B18.31.3-2014 (R2025)",
            title: "Threaded Rods (Inch Series)",
            edition: "2014 (reaffirmed 2025)",
            published: "2014",
            status: "Current",
            forms: ["rod"],
            sizes: ASME_STUD_SIZES,
            inch: true,
            metric: false,
            source: "ASME, B18.31.3-2014 (R2025), current; " +
                "https://www.asme.org/codes-standards/find-codes-standards/threaded-rods-inch-series",
            verification: "verified-partial",
            note: "Inch threaded rods: UNC No.4–4 in, UNF No.4–1 1/2 in, 8 UN " +
                "1 1/8–4 in, Acme 1/4–5 in. This project's inch table carries " +
                "1/4 in to 1 in UNC."
        },

        /* ---------------- India (BIS) ---------------- */
        {
            family: "is",
            id: "is-1862",
            name: "IS 1862:1975 (Reaffirmed 2021)",
            title: "Specification for Studs",
            edition: "1975 (second revision), reaffirmed 2021",
            published: "1975",
            status: "Active",
            forms: ["de"],
            sizes: studMetricSizes(
                [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33,
                    36, 39],
                [[8, 1], [10, 1.25]]),
            bmRule: "factor",
            bmFactor: 1,
            source: "BIS e-sale catalogue, IS 1862:1975 (reaffirmed 2021), " +
                "status Active; https://standardsbis.bsbedge.com/BIS_searchstandard.aspx?Standard_Number=IS%201862&id=0",
            verification: "verified-adoption",
            note: "Indian stud standard, 3–39 mm, types A (b1 ≈ 1d, steel), " +
                "B (b1 ≈ 1.5d, cast iron) and C (b1 ≈ 2d, aluminium alloys), " +
                "grades Precision and Black; fine pitches M8×1 and M10×1.25 are " +
                "tabulated. Type A is the default here: set b1 to 1.5d or 2d " +
                "for types B and C. Mechanical properties come from IS 1367 " +
                "(Part 3):2017 (ISO 898-1), which is not a dimension standard."
        },

        /* ---------------- United Kingdom (BSI) ---------------- */
        {
            family: "bs",
            id: "bs-4439",
            name: "BS 4439:1969",
            title: "Specification for screwed studs for general purposes — " +
                "Metric series",
            edition: "1969 (reviewed and confirmed 2012)",
            published: "1969",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33,
                    36, 39]),
            bmRule: "factor",
            bmFactor: 1,
            source: "BSI Knowledge, BS 4439:1969, current, 28 pp.; " +
                "https://knowledge.bsigroup.com/products/specification-for-screwed-studs-for-general-purposes-metric-series",
            verification: "verified-partial",
            note: "British metric stud product standard, 3–39 mm, dimensions " +
                "and tolerances with mechanical properties for carbon and alloy " +
                "steel studs. The full text is paywalled: the metric diameter " +
                "range is verified, the individual b1 values are not, so the " +
                "default tap-end length is 1d and stays editable."
        },

        /* ---------------- France (AFNOR) ---------------- */
        {
            family: "nf",
            id: "nf-e25-135",
            name: "NF E25-135:1986",
            title: "Fasteners — Studs — Product grades A and B",
            edition: "1986-12",
            published: "1986-12",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]),
            bmRule: "factor",
            bmFactor: 1.5,
            source: "AFNOR, NF E25-135 (December 1986), current; " +
                "https://www.boutique.afnor.org/en-gb/standard/nf-e25135/fasteners-studs-product-grades-a-and-b/fa034397/6928",
            verification: "verified-partial",
            note: "French stud standard: asymmetric studs, ISO metric thread " +
                "M5–M24, normal or reduced shank, product grades A and B, " +
                "engagement length 1.5d as the main case with 1d, 1.25d and 2d " +
                "also listed. Replaces NF E27-241 (1964)."
        },

        /* ---------------- Japan (JIS) ---------------- */
        {
            family: "jis",
            id: "jis-b-1173",
            name: "JIS B 1173:2010 (Amendment 1:2015)",
            title: "Studs",
            edition: "2010, Amendment 1:2015, reaffirmed 2025-06-20",
            published: "2010-09-21",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [4, 5, 6, 8, 10, 12, 14, 16, 18, 20],
                [[8, 1], [10, 1.25], [12, 1.25], [14, 1.5], [16, 1.5],
                    [18, 1.5], [20, 1.5]]),
            bmRule: "factor",
            bmFactor: 1.25,
            source: "JSA, JIS B 1173:2010 + Amendment 1:2015, reaffirmed " +
                "2025-06-20; https://store.accuristech.com/standards/jsa-jis-b-1173?product_id=1782767",
            verification: "verified-partial",
            note: "Japanese studs (植込みボルト): steel studs threaded at both " +
                "ends, coarse M4–M20 and fine M8×1 to M20×1.5, nut-end thread " +
                "6g. Engagement classes: 1種 ≈ 1.25d (default here), 2種 ≈ 1.5d, " +
                "3種 ≈ 2d; set b1 accordingly for classes 2 and 3. The tables " +
                "are images in the official preview, so the diameter list is " +
                "recorded from the standard's scope and manufacturer tables."
        },

        /* ---------------- China (GB/T) ---------------- */
        {
            family: "gb",
            id: "gb-897",
            name: "GB/T 897-1988",
            title: "Double end studs — bm = 1d",
            edition: "1988",
            published: "1988",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39,
                    42, 45, 48]),
            bmRule: "factor",
            bmFactor: 1,
            source: "SAMR national standards service, GB/T 897-1988, current; " +
                "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D77F84D3A7E05397BE0A0AB82A",
            verification: "verified-adoption",
            note: "Chinese double end stud, bm = 1d: M5–M48."
        },
        {
            family: "gb",
            id: "gb-898",
            name: "GB/T 898-1988",
            title: "Double end studs — bm = 1.25d",
            edition: "1988",
            published: "1988",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39,
                    42, 45, 48]),
            bmRule: "factor",
            bmFactor: 1.25,
            source: "SAMR national standards service, GB/T 898-1988, current; " +
                "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=C04446D9466CF35CCC49AAB9A3847B97",
            verification: "verified-adoption",
            note: "Chinese double end stud, bm = 1.25d: M5–M48."
        },
        {
            family: "gb",
            id: "gb-899",
            name: "GB/T 899-1988",
            title: "Double end studs — bm = 1.5d",
            edition: "1988",
            published: "1988",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27,
                    30, 33, 36, 39, 42, 45, 48]),
            bmRule: "factor",
            bmFactor: 1.5,
            source: "SAMR national standards service, GB/T 899-1988, current; " +
                "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D79B92D3A7E05397BE0A0AB82A",
            verification: "verified-adoption",
            note: "Chinese double end stud, bm = 1.5d: M2–M48."
        },
        {
            family: "gb",
            id: "gb-900",
            name: "GB/T 900-1988",
            title: "Double end studs — bm = 2d",
            edition: "1988",
            published: "1988",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27,
                    30, 33, 36, 39, 42, 45, 48]),
            bmRule: "factor",
            bmFactor: 2,
            source: "SAMR national standards service, GB/T 900-1988, current; " +
                "https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D79B92D3A7E05397BE0A0AB82A",
            verification: "verified-adoption",
            note: "Chinese double end stud, bm = 2d: M2–M48."
        },
        {
            family: "gb",
            id: "gb-901",
            name: "GB/T 901-1988",
            title: "Double end studs (clamping type) — Product grade B",
            edition: "1988",
            published: "1988",
            status: "Current",
            forms: ["de"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27,
                    30, 33, 36, 39, 42, 45, 48, 52, 56]),
            bmRule: "equal",
            source: "SAMR national standards service, GB/T 901-1988, current; " +
                "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=C493B3427B140391EF8761657318ECEA",
            verification: "verified-adoption",
            note: "Chinese equal-length (clamping type) double end stud, product " +
                "grade B: M2–M56. Both ends carry the same thread length; this " +
                "calculator derives it from the ISO 2d+6 band rule because the " +
                "GB/T 901 thread-length column was not inspected."
        },
        {
            family: "gb",
            id: "gb-15389",
            name: "GB/T 15389-2025",
            title: "Fasteners — Threaded rods",
            edition: "2025",
            published: "2025-10-05, in force 2026-02-01",
            status: "Current (in force from 2026-02-01)",
            forms: ["ft", "rod"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24,
                    27, 30, 33, 36, 39, 42, 45, 48, 52, 56, 60, 64, 68]),
            source: "SAMR national standards service, GB/T 15389-2025; " +
                "https://std.samr.gov.cn/gb/search/gbDetailed?id=40B74A27FC13BD79E06397BE0A0AB048",
            verification: "verified-official",
            note: "Chinese threaded rod (螺杆): coarse M2–M68 here, fine " +
                "M8×1 to M72×6 in the standard. Replaces GB/T 15389-1994."
        },

        /* ---------------- Russia (GOST) ---------------- */
        {
            family: "gost",
            id: "gost-22032",
            name: "GOST 22032-76",
            title: "Studs with threaded end of 1d — Product grade B — " +
                "Construction and dimensions",
            edition: "1976, reissue 2011 with Amendments 1–4",
            published: "1976",
            status: "In force",
            forms: ["de"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27,
                    30, 33, 36, 39, 42, 45, 48]),
            bmRule: "factor",
            bmFactor: 1,
            source: "GOST 22032-76, reissue 2011, official text; " +
                "https://docs.cntd.ru/document/1200020975",
            verification: "verified-official",
            note: "Russian stud, class B, engagement end 1d: nominal diameter " +
                "2–48 mm; Table 1 diameters 2, 2.5, 3, 4, 5, 6, 8, 10, 12, " +
                "(14), 16, (18), 20, (22), 24, (27), 30, (33), 36, (39), 42, " +
                "(45), 48 (bracketed sizes are non-preferred). Class A twin: " +
                "GOST 22033-76."
        },
        {
            family: "gost",
            id: "gost-22034",
            name: "GOST 22034-76",
            title: "Studs with threaded end of 1.25d — Product grade B — " +
                "Construction and dimensions",
            edition: "1976, with amendments",
            published: "1976",
            status: "In force",
            forms: ["de"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27,
                    30, 33, 36, 39, 42, 45, 48]),
            bmRule: "factor",
            bmFactor: 1.25,
            source: "GOST 22034-76, class B stud series; " +
                "https://docs.cntd.ru/document/1200020975",
            verification: "verified-partial",
            note: "Russian stud, class B, engagement end 1.25d, nominal " +
                "diameter 2–48 mm on the GOST 22032 Table 1 diameter series. " +
                "Class A twin: GOST 22035-76."
        },
        {
            family: "gost",
            id: "gost-22036",
            name: "GOST 22036-76",
            title: "Studs with threaded end of 1.6d — Product grade B — " +
                "Construction and dimensions",
            edition: "1976, with amendments",
            published: "1976",
            status: "In force",
            forms: ["de"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27,
                    30, 33, 36, 39, 42, 45, 48]),
            bmRule: "factor",
            bmFactor: 1.6,
            source: "GOST 22036-76, class B stud series; " +
                "https://docs.cntd.ru/document/1200020975",
            verification: "verified-partial",
            note: "Russian stud, class B, engagement end 1.6d, nominal " +
                "diameter 2–48 mm. Class A twin: GOST 22037-76."
        },
        {
            family: "gost",
            id: "gost-22038",
            name: "GOST 22038-76",
            title: "Studs with threaded end of 2d — Product grade B — " +
                "Construction and dimensions",
            edition: "1976, with amendments",
            published: "1976",
            status: "In force",
            forms: ["de"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27,
                    30, 33, 36, 39, 42, 45, 48]),
            bmRule: "factor",
            bmFactor: 2,
            source: "GOST 22038-76, class B stud series; " +
                "https://docs.cntd.ru/document/1200020975",
            verification: "verified-partial",
            note: "Russian stud, class B, engagement end 2d, nominal diameter " +
                "2–48 mm. Class A twin: GOST 22039-76."
        },
        {
            family: "gost",
            id: "gost-22040",
            name: "GOST 22040-76",
            title: "Studs with threaded end of 2.5d — Product grade B — " +
                "Construction and dimensions",
            edition: "1976, with amendments",
            published: "1976",
            status: "In force",
            forms: ["de"],
            sizes: studMetricSizes(
                [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27,
                    30, 33, 36, 39, 42, 45, 48]),
            bmRule: "factor",
            bmFactor: 2.5,
            source: "GOST 22040-76, class B stud series; " +
                "https://docs.cntd.ru/document/1200020975",
            verification: "verified-partial",
            note: "Russian stud, class B, engagement end 2.5d, nominal " +
                "diameter 2–48 mm. Class A twin: GOST 22041-76."
        }
    ];

    var STUD_STANDARD_ORDER = ["din", "asme", "is", "bs", "nf", "jis",
        "gb", "gost"];

    /* The standards a stud product offers, in body order, plus Custom. The
       product form decides which records appear, so a continuous thread
       standard is never offered for a double end stud. */
    function studStandards(form) {
        var standards = [];

        STUD_STANDARD_ORDER.forEach(function (family) {
            STUD_STANDARD_REGISTRY.forEach(function (record) {
                if (record.family !== family || record.forms.indexOf(form) === -1) {
                    return;
                }

                standards.push(makeStandard(record.family, record.id, record.name,
                    record.sizes, record.title, record.edition, record.published,
                    record.source, record.verification, record.note, {
                        applicability: "direct",
                        bmRule: record.bmRule || null,
                        bmFactor: record.bmFactor || null,
                        standardStatus: record.status,
                        country: STANDARD_FAMILIES[record.family].country,
                        metric: record.metric !== undefined
                            ? record.metric : record.family !== "asme",
                        inch: record.inch !== undefined
                            ? record.inch : record.family === "asme"
                    }));
            });
        });

        standards.push(customStandard());

        return standards;
    }

    /* ==================================================
       NUT STANDARD REGISTRY
       One record per published standard. `forms` is the product-type
       mapping: a hexagon regular nut standard appears only under Hex Nut, a
       thin nut standard only under Hex Jam Nut, a square nut standard only
       under Square Nut and a non-metallic insert standard only under the lock
       nut. Nothing is copied from one form to another.
    ================================================== */
    var NUT_STANDARD_REGISTRY = [
        /* ---------------- International (ISO) ---------------- */
        {
            family: "iso",
            id: "iso-4032",
            name: "ISO 4032:2023",
            title: "Fasteners — Hexagon regular nuts (style 1) — Product grades A and B",
            edition: "ISO 4032:2023, fifth edition",
            published: "2023-08",
            status: "Current; supersedes ISO 4032:2012",
            forms: ["hex"],
            sizes: ISO_4032_SIZES,
            source: "ISO preview; https://cdn.standards.iteh.ai/sist-preview/75016/5b1f83bd2dc44fc199973e9957a75086/ISO-4032-2023.pdf",
            verification: "verified-official",
            note: "Official ISO preview tables inspected. The 2023 edition covers " +
                "M5–M39; the rows outside that scope (M1.6–M4 and M42–M64) are " +
                "retained from ISO 4032:2012, the edition they were verified against."
        },
        {
            family: "iso",
            id: "iso-4033",
            name: "ISO 4033:2023",
            title: "Fasteners — Hexagon high nuts (style 2) — Product grades A and B",
            edition: "ISO 4033:2023, fourth edition",
            published: "2023-08",
            status: "Current; supersedes ISO 4033:2012",
            forms: ["heavy"],
            sizes: ISO_4033_SIZES,
            source: "ISO preview; https://cdn.standards.iteh.ai/samples/75017/21ca4d24cb0e44508a8a7d279a500372/ISO-4033-2023.pdf",
            verification: "verified-official",
            note: "Official ISO preview tables 1 and 2 inspected; M5–M39 table " +
                "completed, including M7, M22, M27, M33 and M39, which the 2023 " +
                "edition added."
        },
        {
            family: "iso",
            id: "iso-4035",
            name: "ISO 4035:2023",
            title: "Fasteners — Hexagon thin nuts (style 0) — Product grades A and B",
            edition: "ISO 4035:2023, fifth edition",
            published: "2023-08",
            status: "Current; supersedes ISO 4035:2012",
            forms: ["jam"],
            sizes: ISO_4035_SIZES,
            source: "ISO preview; https://cdn.standards.iteh.ai/samples/75019/bdc8627c7e5e456593a9c1cca4e051ab/ISO-4035-2023.pdf",
            verification: "verified-official",
            note: "Official ISO preview tables 1 and 2 inspected; M5–M39 table " +
                "completed. The standard itself runs M1.6–M64, with Annex A for " +
                "the sizes outside the main table; those rows are not tabulated " +
                "here. A thin nut carries a reduced loadability."
        },
        {
            family: "iso",
            id: "iso-7040",
            name: "ISO 7040:2025",
            title: "Fasteners — Prevailing torque hexagon nuts — Regular nuts " +
                "(with non-metallic insert)",
            edition: "ISO 7040:2025, fourth edition",
            published: "2025-06",
            status: "Current; supersedes ISO 7040:2012",
            forms: ["nyloc"],
            sizes: ISO_7040_SIZES,
            source: "ISO catalogue and published dimension table; https://www.iso.org/standard/86033.html",
            verification: "verified-partial",
            note: "Scope M3–M39 and dimensions checked against the published " +
                "ISO 7040:2025 table; paid full text not inspected. M3–M39 rows " +
                "completed."
        },

        /* ---------------- Germany (DIN) ---------------- */
        {
            family: "din",
            id: "din-en-iso-4032",
            name: "DIN EN ISO 4032:2023-12",
            title: "Fasteners — Hexagon regular nuts (style 1) — Product grades A " +
                "and B (ISO 4032:2023)",
            edition: "DIN EN ISO 4032:2023-12",
            published: "2023-12",
            status: "Current; replaces DIN EN ISO 4032:2013-04",
            forms: ["hex"],
            sizes: ISO_4032_2023_SIZES,
            source: "DIN Media catalogue; https://www.dinmedia.de/en/standard/din-en-iso-4032/372666481",
            verification: "verified-adoption",
            note: "Identical German adoption of ISO 4032:2023; DIN Media record verified."
        },
        {
            family: "din",
            id: "din-en-iso-4033",
            name: "DIN EN ISO 4033:2023-12",
            title: "Fasteners — Hexagon high nuts (style 2) — Product grades A and B " +
                "(ISO 4033:2023)",
            edition: "DIN EN ISO 4033:2023-12",
            published: "2023-12",
            status: "Current; replaces DIN EN ISO 4033:2013-04",
            forms: ["heavy"],
            sizes: ISO_4033_SIZES,
            source: "DIN Media catalogue; https://www.dinmedia.de/en/standard/din-en-iso-4033/372988604",
            verification: "verified-adoption",
            note: "Identical German adoption of ISO 4033:2023."
        },
        {
            family: "din",
            id: "din-en-iso-4035",
            name: "DIN EN ISO 4035:2023-12",
            title: "Fasteners — Hexagon thin nuts (style 0) — Product grades A and B " +
                "(ISO 4035:2023)",
            edition: "DIN EN ISO 4035:2023-12",
            published: "2023-12",
            status: "Current; replaces DIN EN ISO 4035:2013-04",
            forms: ["jam"],
            sizes: ISO_4035_SIZES,
            source: "DIN Media catalogue; https://www.dinmedia.de/de/norm/din-en-iso-4035/372988631",
            verification: "verified-adoption",
            note: "Identical German adoption of ISO 4035:2023. The withdrawn " +
                "DIN 439-2 is not offered; this EN ISO text is its replacement."
        },
        {
            family: "din",
            id: "din-en-iso-7040",
            name: "DIN EN ISO 7040:2025-09",
            title: "Fasteners — Prevailing torque hexagon nuts — Regular nuts " +
                "(with non-metallic insert) (ISO 7040:2025)",
            edition: "DIN EN ISO 7040:2025-09",
            published: "2025-09",
            status: "Current; replaces DIN EN ISO 7040:2013-04",
            forms: ["nyloc"],
            sizes: ISO_7040_SIZES,
            source: "DIN Media catalogue; https://www.dinmedia.de/en/standard/din-en-iso-7040/393702427",
            verification: "verified-adoption",
            note: "Identical German adoption of ISO 7040:2025. DIN 982 and DIN 985 " +
                "are withdrawn (1998) and are not offered; their replacements are " +
                "this standard and DIN EN ISO 10511 for the low form."
        },
        {
            family: "din",
            id: "din-557",
            name: "DIN 557:2026-02",
            title: "Verbindungselemente — Vierkantmuttern — Produktklasse C",
            edition: "DIN 557:2026-02",
            published: "2026-02",
            status: "Current; replaces DIN 557:1994-01",
            forms: ["square"],
            sizes: DIN_557_SIZES,
            source: "DIN 557:2026-02, current edition (DIN Media / Beuth); table " +
                "values from the DIN 557:1994-01 product grade C table, " +
                "https://www.fasten.it/en/norms/norm/din_557",
            verification: "verified-partial",
            note: "The 2026-02 edition is current and covers M5–M16; its text was " +
                "not accessible, so the M5–M16 widths and heights shown are the " +
                "1994-01 table's, at the ISO 272 widths (M10 = 16 mm, M12 = 18 mm; " +
                "the 17/19 mm widths are the standard's obsolescent alternative)."
        },

        /* ---------------- United Kingdom (BSI) ---------------- */
        {
            family: "bs",
            id: "bs-en-iso-4032",
            name: "BS EN ISO 4032:2023",
            title: "Fasteners — Hexagon regular nuts (style 1) — Product grades A and B",
            edition: "BS EN ISO 4032:2023",
            published: "2023",
            status: "Current; supersedes BS EN ISO 4032:2012",
            forms: ["hex"],
            sizes: ISO_4032_2023_SIZES,
            source: "BSI/ANSI preview, BS EN ISO 4032:2023; https://webstore.ansi.org/preview-pages/BSI/preview_30429046.pdf",
            verification: "verified-official",
            note: "Identical UK adoption of ISO 4032:2023; BSI foreword and ISO text inspected."
        },
        {
            family: "bs",
            id: "bs-en-iso-4033",
            name: "BS EN ISO 4033:2023",
            title: "Fasteners — Hexagon high nuts (style 2) — Product grades A and B",
            edition: "BS EN ISO 4033:2023",
            published: "2023-09-30",
            status: "Current; supersedes BS EN ISO 4033:2012",
            forms: ["heavy"],
            sizes: ISO_4033_SIZES,
            source: "BSI publication record; https://webstore.ansi.org/preview-pages/BSI/preview_30429050.pdf",
            verification: "verified-adoption",
            note: "Identical UK adoption of ISO 4033:2023; BSI published 30 September 2023."
        },
        {
            family: "bs",
            id: "bs-en-iso-4035",
            name: "BS EN ISO 4035:2023",
            title: "Fasteners — Hexagon thin nuts (style 0) — Product grades A and B",
            edition: "BS EN ISO 4035:2023",
            published: "2023",
            status: "Current; supersedes BS EN ISO 4035:2012",
            forms: ["jam"],
            sizes: ISO_4035_SIZES,
            source: "EN ISO 4035:2023 (CEN) and BSI adoption list; " +
                "https://cdn.standards.iteh.ai/samples/72877/37d005a068a4496baa01e951053e8829/SIST-EN-ISO-4035-2023.pdf",
            verification: "verified-adoption",
            note: "Identical UK adoption of ISO 4035:2023."
        },
        {
            family: "bs",
            id: "bs-en-iso-7040",
            name: "BS EN ISO 7040:2025",
            title: "Fasteners — Prevailing torque hexagon nuts — Regular nuts " +
                "(with non-metallic insert)",
            edition: "BS EN ISO 7040:2025",
            published: "2025-06-30",
            status: "Current; supersedes BS EN ISO 7040:2012",
            forms: ["nyloc"],
            sizes: ISO_7040_SIZES,
            source: "BSI publication record; https://webstore.ansi.org/standards/bsi/bseniso70402025",
            verification: "verified-adoption",
            note: "Identical UK adoption of ISO 7040:2025."
        },

        /* ---------------- France (AFNOR) ---------------- */
        {
            family: "nf",
            id: "nf-en-iso-4032",
            name: "NF EN ISO 4032:2023-08",
            title: "Fasteners — Hexagon regular nuts (style 1) — Product grades A " +
                "and B (ISO 4032:2023)",
            edition: "NF EN ISO 4032:2023-08",
            published: "2023-08",
            status: "Current; replaces NF EN ISO 4032:2013",
            forms: ["hex"],
            sizes: ISO_4032_2023_SIZES,
            source: "AFNOR catalogue; https://www.boutique.afnor.org/fr-fr/norme/nf-en-iso-4032/ecrous-hexagonaux-normaux-style-1-grades-a-et-b/fa178166/40865",
            verification: "verified-adoption",
            note: "Identical French adoption of ISO 4032:2023; AFNOR catalogue record verified."
        },
        {
            family: "nf",
            id: "nf-en-iso-4033",
            name: "NF EN ISO 4033:2023-09",
            title: "Fasteners — Hexagon high nuts (style 2) — Product grades A and " +
                "B (ISO 4033:2023)",
            edition: "NF EN ISO 4033:2023-09",
            published: "2023-09",
            status: "Current; replaces NF EN ISO 4033:2013",
            forms: ["heavy"],
            sizes: ISO_4033_SIZES,
            source: "AFNOR catalogue; https://www.boutique.afnor.org/en-gb/standard/nf-en-iso-4033/fasteners-hexagon-high-nuts-style-2/fa201569/351362",
            verification: "verified-adoption",
            note: "Identical French adoption of ISO 4033:2023."
        },
        {
            family: "nf",
            id: "nf-en-iso-4035",
            name: "NF EN ISO 4035:2023-09",
            title: "Fasteners — Hexagon thin nuts (style 0) — Product grades A and " +
                "B (ISO 4035:2023)",
            edition: "NF EN ISO 4035:2023-09",
            published: "2023-09-06",
            status: "Current; replaces NF EN ISO 4035:2013",
            forms: ["jam"],
            sizes: ISO_4035_SIZES,
            source: "AFNOR catalogue; https://tienda.aenor.com/p/norma-afnor-nf-en-iso-4035-fa201570",
            verification: "verified-adoption",
            note: "Identical French adoption of ISO 4035:2023."
        },

        /* ---------------- Spain (UNE) ---------------- */
        {
            family: "une",
            id: "une-en-iso-4032",
            name: "UNE-EN ISO 4032:2024",
            title: "Fasteners — Hexagon regular nuts (style 1) — Product grades A " +
                "and B (ISO 4032:2023)",
            edition: "UNE-EN ISO 4032:2024",
            published: "2024-03-20",
            status: "In force (vigente); annuls UNE-EN ISO 4032:2013",
            forms: ["hex"],
            sizes: ISO_4032_2023_SIZES,
            source: "UNE catalogue; https://www.normadoc.com/products/une-en-iso-4032-2024-esn0072680-28654",
            verification: "verified-adoption",
            note: "Identical Spanish adoption of ISO 4032:2023."
        },
        {
            family: "une",
            id: "une-en-iso-4033",
            name: "UNE-EN ISO 4033:2024",
            title: "Fasteners — Hexagon high nuts (style 2) — Product grades A and " +
                "B (ISO 4033:2023)",
            edition: "UNE-EN ISO 4033:2024",
            published: "2024-04-10",
            status: "In force (vigente); annuls UNE-EN ISO 4033:2013",
            forms: ["heavy"],
            sizes: ISO_4033_SIZES,
            source: "UNE catalogue; https://www.une.org/encuentra-tu-norma/busca-tu-norma/norma?c=N0072761",
            verification: "verified-adoption",
            note: "Identical Spanish adoption of ISO 4033:2023."
        },
        {
            family: "une",
            id: "une-en-iso-4035",
            name: "UNE-EN ISO 4035:2024",
            title: "Fasteners — Hexagon thin nuts (style 0) — Product grades A and " +
                "B (ISO 4035:2023)",
            edition: "UNE-EN ISO 4035:2024",
            published: "2024-04-10",
            status: "In force (vigente); annuls UNE-EN ISO 4035:2013",
            forms: ["jam"],
            sizes: ISO_4035_SIZES,
            source: "UNE catalogue; https://www.une.org/encuentra-tu-norma/busca-tu-norma/norma?c=N0072762",
            verification: "verified-adoption",
            note: "Identical Spanish adoption of ISO 4035:2023."
        },

        /* ---------------- India (BIS) ---------------- */
        {
            family: "is",
            id: "is-1364-3",
            name: "IS 1364 (Part 3):2026",
            title: "Hexagon head bolts, screws and nuts of product grades A and B — " +
                "Part 3: Hexagon nuts, style 1 (Size range M5 to M39)",
            edition: "2026 edition (sixth revision)",
            published: "2026",
            status: "Current; replaces IS 1364 (Part 3):2018",
            forms: ["hex"],
            sizes: IS_NUT_SIZES,
            source: "BIS Standards India, IS 1364 (Part 3):2026; gazette notification https://egazette.gov.in/WriteReadData/2026/270336.pdf",
            verification: "verified-adoption",
            note: "Identical adoption of ISO 4032:2023 verified from the BIS record " +
                "and gazette notification; scope M5–M39."
        },
        {
            family: "is",
            id: "is-1364-4",
            name: "IS 1364 (Part 4):2025",
            title: "Hexagon head bolts, screws and nuts of product grades A and B — " +
                "Part 4: Hexagon nuts, style 0 (Size range M1.6 to M64)",
            edition: "2025 edition (fifth revision)",
            published: "2025",
            status: "Current; replaces IS 1364 (Part 4):2003",
            forms: ["jam"],
            sizes: IS_THIN_NUT_SIZES,
            source: "BIS Standards India, IS 1364 (Part 4):2025; " +
                "https://standards.bis.gov.in/website/standard-details",
            verification: "verified-adoption",
            note: "Identical adoption of ISO 4035:2023, verified from the BIS record; " +
                "the M5–M39 rows of that table are tabulated here."
        },

        /* ---------------- United States (ASME) ---------------- */
        {
            family: "asme",
            id: "asme-b18-2-2",
            name: "ASME B18.2.2-2022",
            title: "Nuts for General Applications: Machine Screw Nuts; and Hex, " +
                "Square, Hex Flange, and Coupling Nuts (Inch Series) — regular hex nuts",
            edition: "ASME B18.2.2-2022 (revision of B18.2.2-2015)",
            published: "2022-03-11",
            status: "Current",
            forms: ["hex"],
            sizes: ASME_NUT_SIZES,
            source: "ASME B18.2.2-2022, table 1.1.1-5; " +
                "https://www.asme.org/codes-standards/find-codes-standards/b18-2-2-nuts-general-applications-machine-screw-nuts-hex-square-hex-flange-coupling-nuts",
            verification: "verified-partial",
            note: "Inch series; the table runs 1/4–4 in and this project carries " +
                "1/4–1 in UNC. Thickness is the table maximum. Values read from the " +
                "standard text; ASME's free preview contains front matter only."
        },
        {
            family: "asme",
            id: "asme-b18-2-2-heavy",
            name: "ASME B18.2.2-2022 heavy",
            title: "Nuts for General Applications (Inch Series) — heavy hex nuts",
            edition: "ASME B18.2.2-2022, table 1.1.1-11",
            published: "2022-03-11",
            status: "Current",
            forms: ["heavy"],
            sizes: ASME_HEAVY_NUT_SIZES,
            source: "ASME B18.2.2-2022, table 1.1.1-11; " +
                "https://www.asme.org/codes-standards/find-codes-standards/b18-2-2-nuts-general-applications-machine-screw-nuts-hex-square-hex-flange-coupling-nuts",
            verification: "verified-partial",
            note: "Heavy hex series 1/4–4 in in the standard; 1/4–1 in UNC carried " +
                "here, thickness at the table maximum."
        },
        {
            family: "asme",
            id: "asme-b18-2-2-jam",
            name: "ASME B18.2.2-2022 jam",
            title: "Nuts for General Applications (Inch Series) — hex jam nuts",
            edition: "ASME B18.2.2-2022, table 1.1.1-5",
            published: "2022-03-11",
            status: "Current",
            forms: ["jam"],
            sizes: ASME_JAM_NUT_SIZES,
            source: "ASME B18.2.2-2022, table 1.1.1-5 (hex and hex jam nuts); " +
                "https://www.asme.org/codes-standards/find-codes-standards/b18-2-2-nuts-general-applications-machine-screw-nuts-hex-square-hex-flange-coupling-nuts",
            verification: "verified-partial",
            note: "Hex jam nuts share the regular hex table; 1/4–1 in UNC carried, " +
                "thickness at the table maximum."
        },
        {
            family: "asme",
            id: "asme-b18-2-2-square",
            name: "ASME B18.2.2-2022 square",
            title: "Nuts for General Applications (Inch Series) — square nuts",
            edition: "ASME B18.2.2-2022, table 1.1.1-3",
            published: "2022-03-11",
            status: "Current",
            forms: ["square"],
            sizes: ASME_SQUARE_NUT_SIZES,
            source: "ASME B18.2.2-2022, table 1.1.1-3; " +
                "https://www.asme.org/codes-standards/find-codes-standards/b18-2-2-nuts-general-applications-machine-screw-nuts-hex-square-hex-flange-coupling-nuts",
            verification: "verified-partial",
            note: "Square nuts 1/4–1 in UNC carried. The table has no 9/16 in size, " +
                "so the dropdown has none either. Thickness at the table maximum."
        },
        {
            family: "asme",
            id: "asme-b18-16-6",
            name: "ASME B18.16.6-2017 (R2022)",
            title: "Prevailing Torque Locknuts (Inch Series) — style NE, nylon insert",
            edition: "ASME B18.16.6-2017, reaffirmed 2022",
            published: "2017 (R2022)",
            status: "Current (stabilized maintenance)",
            forms: ["nyloc"],
            sizes: ASME_NYLON_NUT_SIZES,
            source: "ASME B18.16.6-2017 (R2022), table 3; " +
                "https://www.asme.org/codes-standards/find-codes-standards/b18-16-6-prevailing-torque-locknuts",
            verification: "verified-partial",
            note: "Style NE (regular hex, nylon insert) runs 1/4–1 1/2 in in the " +
                "standard; 1/4–1 in UNC carried here. Width across flats is the " +
                "table maximum and height the maximum overall thickness."
        },

        /* ---------------- Japan (JIS) ---------------- */
        {
            family: "jis",
            id: "jis-b-1181",
            name: "JIS B 1181:2014",
            title: "Hexagon nuts and hexagon thin nuts",
            edition: "JIS B 1181:2014",
            published: "2014-04-21 (reaffirmed 2019-10-21)",
            status: "Current",
            forms: ["hex"],
            sizes: JIS_NUT_SIZES,
            source: "JIS B 1181:2014 body text; https://kikakurui.com/b1/B1181-2014-01.html",
            verification: "verified-partial",
            note: "Style 1 table of the body text checked against the publicly " +
                "accessible JIS B 1181:2014 text: M1.6–M64 with M7 as a " +
                "non-preferred size and M7/M8 heights of 5.5/6.5 mm. The JSA paid " +
                "text was not accessed."
        },
        {
            family: "jis",
            id: "jis-b-1181-thin",
            name: "JIS B 1181:2014 thin",
            title: "Hexagon nuts and hexagon thin nuts — style 0, chamfered both faces",
            edition: "JIS B 1181:2014, tables 22–23",
            published: "2014-04-21 (reaffirmed 2019-10-21)",
            status: "Current",
            forms: ["jam"],
            sizes: JIS_THIN_NUT_SIZES,
            source: "JIS B 1181:2014, tables 22–23; https://kikakurui.com/b1/B1181-2014-01.html",
            verification: "verified-partial",
            note: "Style 0 thin nut table (M5–M39) transcribed and cross-checked " +
                "against ISO 4035, whose values it repeats. The unchamfered style 0 " +
                "of the same standard stops at M10 and is not offered here."
        },

        /* ---------------- China (GB/T) ---------------- */
        {
            family: "gb",
            id: "gb-t-6170",
            name: "GB/T 6170-2015",
            title: "1型六角螺母 (Hexagon nuts, style 1)",
            edition: "GB/T 6170-2015 (effective 2016-04-01)",
            published: "2015-12-31",
            status: "Current; replaced GB/T 6170-2000",
            forms: ["hex"],
            sizes: GB_6170_SIZES,
            source: "SAMR national standards platform, GB/T 6170-2015; " +
                "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=BDDE5AF77AC2FBC2D194289F10C69A4B",
            verification: "verified-adoption",
            note: "Modified adoption (MOD) of ISO 4032:2012: M1.6–M64, so the " +
                "dimension table is the ISO 4032 table used here. The SAMR record " +
                "confirms edition and adoption; the Chinese text is not published " +
                "for reading because the ISO copyright applies."
        },
        {
            family: "gb",
            id: "gb-t-6172-1",
            name: "GB/T 6172.1-2016",
            title: "六角薄螺母 (Hexagon thin nuts, chamfered)",
            edition: "GB/T 6172.1-2016 (effective 2016-06-01)",
            published: "2016-02-24",
            status: "Current; replaced GB/T 6172.1-2000",
            forms: ["jam"],
            sizes: GB_6172_1_SIZES,
            source: "SAMR national standards platform, GB/T 6172.1-2016; " +
                "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=C269E83E64AF269E397B516573363313",
            verification: "verified-partial",
            note: "Modified adoption (MOD) of ISO 4035:2012, M1.6–M64. The rows " +
                "listed are the sizes whose width across flats and height are both " +
                "verified; the non-preferred diameters between them follow the " +
                "standard's bracketed series and are not tabulated here."
        },
        {
            family: "gb",
            id: "gb-t-6175",
            name: "GB/T 6175-2016",
            title: "2型六角螺母 (Hexagon nuts, style 2)",
            edition: "GB/T 6175-2016 (effective 2016-06-01)",
            published: "2016-02-24",
            status: "Current; replaced GB/T 6175-2000",
            forms: ["heavy"],
            sizes: GB_6175_SIZES,
            source: "SAMR national standards platform, GB/T 6175-2016; " +
                "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=4F0AA03559DD37897D02B7B877ADBF14",
            verification: "verified-adoption",
            note: "Modified adoption (MOD) of ISO 4033:2012, M5–M36; the dimension " +
                "table repeats the ISO 4033 table used here, restricted to the " +
                "standard's M5–M36 scope."
        },
        {
            family: "gb",
            id: "gb-t-39",
            name: "GB/T 39-1988",
            title: "方螺母 C 级 (Square nuts, product grade C)",
            edition: "GB/T 39-1988",
            published: "1988",
            status: "Current national standard; replaced GB 39-1976",
            forms: ["square"],
            sizes: GB_SQUARE_NUT_SIZES,
            source: "GB/T 39-1988 dimension table (M3–M24, grades 4 and 5); " +
                "https://www.164580.com/standard_751.html",
            verification: "verified-partial",
            note: "China's own square nut standard, M3–M24 product grade C. The " +
                "SAMR status record could not be retrieved and the text is not " +
                "published for reading, so the table is taken from consistent " +
                "reproductions; treat the values as high confidence, not primary."
        },

        /* ---------------- Russia (GOST) ---------------- */
        {
            family: "gost",
            id: "gost-5915-70",
            name: "GOST 5915-70",
            title: "Гайки шестигранные класса точности B — Конструкция и размеры",
            edition: "GOST 5915-70, Standartinform edition 2010 with amendments 2–7",
            published: "1970 (edition 2010)",
            status: "In force (interstate); GOST ISO 4032-2014 is the Russian " +
                "replacement for general supply since 2017",
            forms: ["hex"],
            sizes: GOST_5915_SIZES,
            source: "GOST 5915-70 official text; https://docs.cntd.ru/document/1200004293",
            verification: "verified-partial",
            note: "Product grade B, preferred diameters M5–M48. Application in " +
                "Russia ceased on 01.01.2017 for general products and was restored " +
                "from 01.01.2020 for state defence orders only; GOST ISO 4032-2014 " +
                "is the general replacement. Исполнения 1, 2 and 3 differ in " +
                "chamfer and collar, not in s or m."
        },
        {
            family: "gost",
            id: "gost-5916-70",
            name: "GOST 5916-70",
            title: "Гайки шестигранные низкие класса точности B — Конструкция и размеры",
            edition: "GOST 5916-70, Standartinform edition 2010 with amendments 2–7",
            published: "1970 (edition 2010)",
            status: "In force (interstate); GOST ISO 4035-2014 is the Russian " +
                "replacement for general supply since 2017",
            forms: ["jam"],
            sizes: GOST_5916_SIZES,
            source: "GOST 5916-70 official text; http://docs.cntd.ru/document/1200021004",
            verification: "verified-partial",
            note: "Hexagon thin nuts, product grade B, M5–M48. The standard's " +
                "English title says lock nuts, but the product is a reduced height " +
                "nut (гайка низкая)."
        },
        {
            family: "gost",
            id: "gost-iso-4033-2014",
            name: "GOST ISO 4033-2014",
            title: "Гайки шестигранные высокие (тип 2). Классы точности A и B",
            edition: "GOST ISO 4033-2014",
            published: "2014 (in force in Russia since 2017-01-01)",
            status: "In force",
            forms: ["heavy"],
            sizes: GOST_ISO_4033_SIZES,
            source: "GOST ISO 4033-2014 text, table 1; " +
                "https://files.stroyinf.ru/Data2/1/4293762/4293762248.pdf",
            verification: "verified-adoption",
            note: "Identical adoption of ISO 4033:2012, M5–M36. GOST 5927-70 is " +
                "not the high nut standard — it is the grade A version of the " +
                "normal nut — so it is not offered under this product."
        },

        /* ---------------- Gulf (GSO) ---------------- */
        {
            family: "saso",
            id: "gso-iso-4032",
            name: "GSO ISO 4032:2024",
            title: "Fasteners — Hexagon regular nuts (style 1) — Product grades A " +
                "and B (ISO 4032:2023)",
            edition: "GSO ISO 4032:2024",
            published: "2024",
            status: "Current",
            forms: ["hex"],
            sizes: GSO_NUT_SIZES,
            source: "GSO standards store; https://eservices.gso.org.sa/store/standards/GSO:926777/GSO%20ISO%204032:2024?lang=en",
            verification: "verified-adoption",
            note: "Identical GSO adoption of ISO 4032:2023 verified; scope M5–M39."
        },
        {
            family: "saso",
            id: "gso-iso-7040",
            name: "GSO ISO 7040:2026",
            title: "Fasteners — Prevailing torque hexagon nuts — Regular nuts " +
                "(with non-metallic insert)",
            edition: "GSO ISO 7040:2026",
            published: "2026-09-17",
            status: "Current",
            forms: ["nyloc"],
            sizes: ISO_7040_SIZES,
            source: "GSO standards store, GSO ISO 7040:2026; " +
                "https://eservices.gso.org.sa/store/standards/GSO:1171747/GSO%20ISO%207040:2026?lang=en",
            verification: "verified-adoption",
            note: "Identical GSO adoption of ISO 7040:2025, approved 17 September 2026."
        }
    ];

    /* Standards are listed by body order, the international standard first
       and the national adoptions after it, so the dropdown reads as a
       catalogue rather than alphabetically. */
    var NUT_STANDARD_ORDER = ["iso", "din", "bs", "nf", "une", "is",
        "asme", "jis", "gb", "gost", "saso"];

    /* The standards a nut product offers, plus Custom. The product form
       decides which records appear. */
    function nutStandards(form) {
        var standards = [];

        NUT_STANDARD_ORDER.forEach(function (family) {
            NUT_STANDARD_REGISTRY.forEach(function (record) {
                if (record.family !== family || record.forms.indexOf(form) === -1) {
                    return;
                }

                standards.push(makeStandard(record.family, record.id, record.name,
                    record.sizes, record.title, record.edition, record.published,
                    record.source, record.verification, record.note, {
                        applicability: "direct",
                        standardStatus: record.status,
                        country: STANDARD_FAMILIES[record.family].country,
                        metric: record.family !== "asme",
                        inch: record.family === "asme"
                    }));
            });
        });

        standards.push(customStandard());

        return standards;
    }

    /* ==================================================
       PRODUCT CATALOGUE
       fields       inputs shown for the product
       drawing      which engineering drawing to draw
       defaultSize  size selected when the product opens
       defaultLength length in mm used for the first view
    ================================================== */
    var PRODUCTS = {
        "hex-ft": {
            name: "Hex Bolt, Full Thread",
            shortName: "Hex Bolt (FT)",
            category: "bolts",
            drawing: "hex",
            fields: ["diameter", "pitch", "length", "acrossFlats", "headHeight"],
            defaultSize: "M10",
            defaultLength: 50,
            standards: hexStandards("full")
        },
        "hex-ht": {
            name: "Hex Bolt, Half Thread",
            shortName: "Hex Bolt (HT)",
            category: "bolts",
            drawing: "hex",
            fields: ["diameter", "pitch", "length", "threadLength", "acrossFlats", "headHeight"],
            defaultSize: "M10",
            defaultLength: 50,
            standards: hexStandards("half")
        },
        "hex-blank": {
            name: "Hex Bolt Blank",
            shortName: "Hex Bolt Blank",
            category: "bolts",
            drawing: "blank",
            fields: ["diameter", "length", "acrossFlats", "headHeight"],
            defaultSize: "M12",
            defaultLength: 60,
            standards: hexStandards("head")
        },
        "socket-head": {
            name: "Socket Head Cap Screw",
            shortName: "Socket Head Cap Screw",
            category: "bolts",
            drawing: "socket",
            fields: ["diameter", "pitch", "length", "threadLength", "headDiameter",
                "headHeight", "socketAcrossFlats", "socketDepth"],
            defaultSize: "M10",
            defaultLength: 40,
            standards: [
                { id: "iso-4762", name: "ISO 4762 (metric)", sizes: ISO_4762_SIZES, metric: true },
                { id: "din-912", name: "DIN 912 (metric)", sizes: ISO_4762_SIZES, metric: true },
                customStandard()
            ]
        },
        "countersunk": {
            name: "Countersunk Socket Screw",
            shortName: "Countersunk Screw",
            category: "bolts",
            drawing: "countersunk",
            fields: ["diameter", "pitch", "length", "threadLength", "headDiameter",
                "headHeight", "socketAcrossFlats", "socketDepth"],
            defaultSize: "M10",
            defaultLength: 30,
            standards: [
                { id: "iso-10642", name: "ISO 10642 (metric)", sizes: ISO_10642_SIZES, metric: true },
                { id: "din-7991", name: "DIN 7991 (metric)", sizes: DIN_7991_SIZES, metric: true },
                customStandard()
            ]
        },
        "carriage": {
            name: "Carriage Bolt",
            shortName: "Carriage Bolt",
            category: "bolts",
            drawing: "carriage",
            fields: ["diameter", "pitch", "length", "threadLength", "headDiameter",
                "headHeight", "neckAcrossFlats", "neckHeight"],
            defaultSize: "M10",
            defaultLength: 100,
            standards: [
                { id: "din-603", name: "DIN 603 (metric)", sizes: DIN_603_SIZES, metric: true },
                customStandard()
            ]
        },
        "stud-ft": {
            name: "Fully Threaded Stud",
            shortName: "Fully Threaded Stud",
            category: "studs",
            drawing: "stud",
            fields: ["diameter", "pitch", "length"],
            defaultSize: "M12",
            defaultLength: 150,
            standards: studStandards("ft")
        },
        "stud-de": {
            name: "Double End Stud",
            shortName: "Double End Stud",
            category: "studs",
            drawing: "stud-de",
            fields: ["diameter", "pitch", "length", "threadLength", "threadLength2"],
            defaultSize: "M12",
            defaultLength: 120,
            standards: studStandards("de")
        },
        "threaded-rod": {
            name: "Threaded Rod",
            shortName: "Threaded Rod",
            category: "studs",
            drawing: "stud",
            fields: ["diameter", "pitch", "length"],
            defaultSize: "M12",
            defaultLength: 1000,
            standards: studStandards("rod")
        },
        "hex-nut": {
            name: "Hex Nut",
            shortName: "Hex Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M12",
            standards: nutStandards("hex")
        },
        "heavy-hex-nut": {
            name: "Heavy Hex Nut",
            shortName: "Heavy Hex Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M20",
            standards: nutStandards("heavy")
        },
        "jam-nut": {
            name: "Hex Jam Nut",
            shortName: "Hex Jam Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M12",
            standards: nutStandards("jam")
        },
        "square-nut": {
            name: "Square Nut",
            shortName: "Square Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M12",
            standards: nutStandards("square")
        },
        "lock-nut": {
            name: "Nylon Insert Lock Nut",
            shortName: "Lock Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M12",
            standards: nutStandards("nyloc")
        }
    };

    /* The original ISO tables are the ones already used by the calculator.
       Their official edition records are attached here without changing the
       dimensions. Other existing tables keep the generic preservation note. */
    var EXISTING_STANDARD_META = {
        "iso-4762": {
            title: "Hexagon socket head cap screws",
            edition: "ISO 4762:2004, fourth edition",
            published: "2004-03",
            source: "ISO preview; https://cdn.standards.iteh.ai/samples/34460/06335046afaf46fb8e84d91a3eda001d/ISO-4762-2004.pdf",
            verification: "verified-official",
            verificationNote: "Official ISO preview Table 1 inspected; sizes M1.6–M64 and reference thread lengths verified."
        },
        "iso-10642": {
            title: "Hexagon socket countersunk head screws with reduced loadability",
            edition: "ISO 10642:2026, fourth edition",
            published: "2026-03",
            source: "ISO catalogue; https://www.iso.org/standard/90795.html",
            verification: "verified-partial",
            verificationNote: "Scope M2–M20 and dimension table checked for every size (dk, k, s, t, b); paid full text not inspected."
        },
        "din-912": {
            title: "Hexagon socket head cap screws (withdrawn, replaced by DIN EN ISO 4762)",
            edition: "DIN 912 (superseded by DIN EN ISO 4762:2004)",
            published: "",
            source: "Identical to ISO 4762:2004; https://lz-engineering.com/engineering-center/iso-4762",
            verification: "verified-official",
            verificationNote: "DIN 912 shares the 20 sizes and dimensions of ISO 4762:2004; every row cross-checked against the ISO 4762 table."
        },
        "din-7991": {
            title: "Hexagon socket countersunk head screws (withdrawn, replaced by ISO 10642)",
            edition: "DIN 7991 (superseded by ISO 10642)",
            published: "",
            source: "DIN 7991 and ISO 10642 execution tables; https://www.dueemmesidol.it/wp-content/plugins/dueemme-metric-catalog/assets/iso-10642-en-rev4.pdf",
            verification: "verified-partial",
            verificationNote: "All 11 sizes checked for dk, k, s and t; socket depth agrees with published tables except M4, given here as 1.50 mm against 1.55 mm in one table."
        },
        "din-603": {
            title: "Round head square neck bolts (carriage bolts)",
            edition: "DIN 603:2017-05",
            published: "",
            source: "DIN 603 Table 1; https://www.westfieldfasteners.co.uk/Standards/ScrewBolt-CrgBlt-M.pdf",
            verification: "verified-official",
            verificationNote: "Table 1 checked for all seven sizes M5–M20: dk, k, v, f, ds and the b length steps agree."
        },
        "din-938": {
            title: "Studs — Metal end approximately 1 d",
            edition: "DIN 938:2025-08",
            published: "2025-08",
            source: "DIN Media; https://www.dinmedia.de/en/standard/din-938/392482848",
            verification: "verified-partial",
            verificationNote: "Scope M3–M52 and b1/b2 table checked against DIN 938 published data; paid full text not inspected."
        }
    };

    /* Existing tables keep their original objects; only the family and the
       traceability fields are filled in here. */
    Object.keys(PRODUCTS).forEach(function (key) {
        PRODUCTS[key].standards.forEach(function (standard) {
            var override = EXISTING_STANDARD_META[standard.id];

            if (override) {
                Object.keys(override).forEach(function (field) {
                    standard[field] = override[field];
                });
            }

            if (!standard.family) {
                if (standard.id.indexOf("asme-") === 0) {
                    standard.family = "asme";
                } else if (standard.id.indexOf("din-") === 0) {
                    standard.family = "din";
                } else if (standard.id === "custom") {
                    standard.family = "custom";
                } else {
                    standard.family = "iso";
                }
            }

            if (!standard.metric && !standard.inch) {
                standard.metric = standard.family !== "asme";
            }

            if (!standard.title) {
                standard.title = "Existing calculator dimension table";
                standard.edition = "Existing project data";
                standard.published = "";
                standard.source = "Existing nut-bolt.js table";
                standard.verification = "existing";
                standard.verificationNote = "Preserved from the existing calculator; not re-verified in this task.";
            }
        });
    });

    /* Remember the catalogue key on each product, so the drawing and the
       calculation can recognise the product they are working on. */
    Object.keys(PRODUCTS).forEach(function (key) {
        PRODUCTS[key].key = key;
    });

    /* ==================================================
       PAGE STATE
    ================================================== */
    var state = {
        category: "bolts",
        productKey: "hex-ft",
        standardId: "iso-4017",
        familyId: "iso",
        familyFallback: false,
        sizeLabel: "M10",
        /* The site-wide MM / INCHES choice, read before the page is drawn so
           the switch never has to move after it appears. */
        unit: window.MWUnitSwitch ? MWUnitSwitch.unit : "mm",
        touched: {},
        /* The exact millimetre value behind each input. Unit changes are
           converted from here, so repeated switches never drift. */
        mmValues: {}
    };

    var lastProductByCategory = {};
    /* The standard family each category resolved to, so the first visit to a
       category opens its own first verified standard instead of inheriting a
       family it does not publish. */
    var lastFamilyByCategory = {};
    var isCalculating = false;

    /* ==================================================
       SMALL HELPERS
    ================================================== */
    function currentProduct() {
        return PRODUCTS[state.productKey];
    }

    function currentStandard() {
        var standards = currentProduct().standards;
        var found = standards[0];

        standards.forEach(function (standard) {
            if (standard.id === state.standardId) {
                found = standard;
            }
        });

        return found;
    }

    function currentSize() {
        var standard = currentStandard();

        if (!standard.sizes.length) {
            return null;
        }

        var found = null;

        standard.sizes.forEach(function (size) {
            if (size.label === state.sizeLabel) {
                found = size;
            }
        });

        return found || standard.sizes[0];
    }

    function unitLabel() {
        return state.unit === "in" ? "in" : "mm";
    }

    function mmFactor() {
        return state.unit === "in" ? INCH : 1;
    }

    function fieldInput(key) {
        return document.getElementById("field-" + key);
    }

    function readFieldMM(key) {
        var input = fieldInput(key);

        if (!input || input.value.trim() === "") {
            return NaN;
        }

        var raw = String(input.value || "").trim();
        var value = window.MWNumber ? MWNumber.parse(raw) : Number(raw);

        return isFinite(value) ? value * mmFactor() : NaN;
    }

    function formatInputNumber(value) {
        if (!isFinite(value)) {
            return "";
        }

        /* Inches need four decimals to keep a millimetre value exact; three
           are enough for millimetres themselves. */
        var rounded = Number(value.toFixed(state.unit === "in" ? 4 : 3));

        return String(rounded);
    }

    function setFieldValue(key, mmValue) {
        var input = fieldInput(key);

        if (!input || !isFinite(mmValue)) {
            return;
        }

        var canonical = formatInputNumber(mmValue / mmFactor());
        if (window.MWNumber && input.classList &&
            (input.classList.contains("nk-field") || input.classList.contains("mw-num-field"))) {
            input.setAttribute("data-nk-raw", canonical);
            input.value = MWNumber.localizeNumericString(canonical);
            /* The display was just localized using the current language, so
               record that language. Deleting the marker made a later switch
               interpret the old locale's decimal separator as grouping. */
            input.__mwLang = typeof MWNumber.currentLanguage === "function"
                ? MWNumber.currentLanguage()
                : "en";
        } else {
            input.value = canonical;
        }
        state.mmValues[key] = mmValue;
    }

    /* Remembers the physical value of a field the user has just typed in. */
    function rememberMMValue(key) {
        var input = fieldInput(key);
        var raw = input ? String(input.value || "").trim() : "";
        var value = input
            ? (window.MWNumber && typeof MWNumber.parseInput === "function"
                ? MWNumber.parseInput(input)
                : (window.MWNumber ? MWNumber.parse(raw) : Number(raw)))
            : NaN;

        if (input && raw !== "" && isFinite(value) && value > 0) {
            state.mmValues[key] = value * mmFactor();
        } else {
            delete state.mmValues[key];
        }
    }

    function formatNumber(value, decimals) {
        if (!isFinite(value)) {
            return "0";
        }
        if (window.MWNumber) {
            return MWNumber.formatNumber(value, decimals === undefined ? 2 : decimals);
        }
        return value.toLocaleString("en-IN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function weightDecimals(value) {
        return Math.abs(value) < 0.1 ? 4 : 3;
    }

    function formatKg(value) {
        return formatNumber(value, weightDecimals(value)) + " kg";
    }

    function formatLbs(value) {
        return formatNumber(value, weightDecimals(value)) + " lbs";
    }

    /* A value in mm, shown in the unit currently on screen. */
    function formatDimension(mmValue) {
        if (!isFinite(mmValue) || mmValue <= 0) {
            return "—";
        }

        var value = state.unit === "in" ? mmValue / INCH : mmValue;
        var decimals = state.unit === "in" ? 3 : (value < 10 ? 2 : 1);

        return formatNumber(value, decimals) + " " + unitLabel();
    }

    function clearError() {
        errorBox.textContent = "";
    }

    function showError(message, input) {
        errorBox.textContent = message;

        if (input) {
            input.classList.add("invalid");
            input.setAttribute("aria-invalid", "true");
            input.focus();
        }
    }

    function clearInvalid() {
        document.querySelectorAll(".invalid").forEach(function (element) {
            element.classList.remove("invalid");
            element.removeAttribute("aria-invalid");
        });
    }

    function hideResults() {
        results.classList.remove("visible");
    }

    function clearResultState() {
        hideResults();
        clearError();
        clearInvalid();
    }

    /* ==================================================
       STANDARD THREAD LENGTHS
       The bolt standards fix the thread length from the
       diameter and the overall length.
    ================================================== */
    function isoThreadLength(length, diameter) {
        if (length <= 125) {
            return 2 * diameter + 6;
        }

        if (length <= 200) {
            return 2 * diameter + 12;
        }

        return 2 * diameter + 25;
    }

    /* ISO 4762, DIN 912 and ISO 10642 publish a reference thread length b per
       diameter instead of the ISO 4014 length-band rule. Short screws are
       threaded to the head, so the result is still capped at the overall
       length. DIN 7991 uses the 2d+6 band rule and is handled separately. */
    var SOCKET_THREAD_BASE = {
        1.6: 15, 2: 16, 2.5: 17, 3: 18, 4: 20, 5: 22, 6: 24, 8: 28,
        10: 32, 12: 36, 14: 40, 16: 44, 20: 52, 24: 60, 30: 72,
        36: 84, 42: 96, 48: 108, 56: 124, 64: 140
    };

    function asmeThreadLength(size, length) {
        if (!size) {
            return length;
        }

        /* A tiny tolerance keeps a length of exactly 6 in on the shorter rule. */
        var extra = length > 6 * INCH + 0.000001 ? 0.25 * INCH : 0;

        return Math.min(size.threadBase + extra, length);
    }

    /* DIN 938 metal-end thread is nominally 1 d, with four standard
       exceptions. The nut-end length follows the same 2d+6 / 2d+12 / 2d+25
       rule as DIN 938, based on the nominal length l = overall length - b1. */
    function din938MetalEnd(diameter) {
        var exceptions = { 27: 25, 33: 32, 36: 35, 39: 38 };

        return exceptions[diameter] || diameter;
    }

    function din938NutEnd(overallLength, diameter) {
        var nominalLength = Math.max(overallLength - din938MetalEnd(diameter), 0);

        return isoThreadLength(nominalLength, diameter);
    }

    /* ASME B18.31.2 double end stud: minimum full thread length at each end,
       tabulated by size and by the nominal length band (L ≤ 10 in,
       10 < L ≤ 16 in, L > 16 in). Values in inches as published. */
    var ASME_STUD_NUT_END = {
        "1/4-20 UNC": [0.75, 1, 1.5],
        "5/16-18 UNC": [0.875, 1.125, 1.625],
        "3/8-16 UNC": [1, 1.25, 1.75],
        "7/16-14 UNC": [1.125, 1.375, 1.875],
        "1/2-13 UNC": [1.25, 1.5, 2],
        "9/16-12 UNC": [1.375, 1.625, 2.125],
        "5/8-11 UNC": [1.5, 1.75, 2.25],
        "3/4-10 UNC": [1.75, 2, 2.5],
        "7/8-9 UNC": [2, 2.25, 2.75],
        "1-8 UNC": [2.25, 2.5, 3]
    };

    function asmeStudNutEnd(sizeLabel, overallLength) {
        var row = ASME_STUD_NUT_END[sizeLabel];

        if (!row) {
            return null;
        }

        var inches = overallLength / INCH;
        var column = inches <= 10.000001 ? 0 : (inches <= 16.000001 ? 1 : 2);

        return row[column] * INCH;
    }

    /* The engagement rule of a standard, in words, for the note under the
       form. */
    function studEngagementText(standard) {
        var rule = standard.bmRule || "din938";

        if (rule === "asme-inch") {
            return "the nut-end table of ASME B18.31.2 for the length band";
        }

        if (rule === "din938") {
            return "1d, with the DIN 938 exceptions for M27, M33, M36 and M39";
        }

        if (rule === "equal") {
            return "equal thread lengths at both ends";
        }

        return (standard.bmFactor || 1) + "d";
    }

    /* The two thread lengths of a double end stud, from the rule of the
       selected standard. `equal` marks the clamping type, whose two ends are
       threaded to the same length. */
    function studEndDefaults(standard, overallLength, diameter) {
        var rule = standard.bmRule || "din938";
        var tap;

        if (rule === "asme-inch") {
            var inches = asmeStudNutEnd(state.sizeLabel, overallLength);
            /* A diameter outside the tabulated band falls back to the ISO
               2d+6 length rule rather than to an invented inch value. */
            var asmeLength = inches === null
                ? Math.min(isoThreadLength(overallLength, diameter), overallLength)
                : Math.min(inches, overallLength);

            return { b1: asmeLength, b2: asmeLength, equal: true };
        }

        if (rule === "din938") {
            tap = din938MetalEnd(diameter);
        } else if (rule === "equal") {
            tap = Math.min(isoThreadLength(overallLength, diameter),
                overallLength / 2);
        } else {
            tap = (standard.bmFactor || 1) * diameter;
        }

        tap = Math.min(tap, overallLength);

        return {
            b1: tap,
            b2: Math.min(isoThreadLength(Math.max(overallLength - tap, 0), diameter),
                Math.max(overallLength - tap, 0)),
            equal: rule === "equal"
        };
    }

    function din603ThreadLength(size, length) {
        if (!size) {
            return length;
        }

        var extra = length > 200 ? 19 : (length > 125 ? 6 : 0);

        return Math.min(size.threadBase + extra, length);
    }

    /* Recalculates thread length after the length, size or diameter changed.
       A field the user has typed in is never overwritten. */
    function applyThreadLengths() {
        var product = currentProduct();
        var standard = currentStandard();
        var size = currentSize();
        var length = readFieldMM("length");

        /* With custom dimensions every value, including the thread length, is
           typed by the user, so nothing is filled in automatically. */
        if (!standard.sizes.length) {
            return;
        }

        if (!isFinite(length) || length <= 0) {
            return;
        }

        if (product.key === "hex-ht" && !state.touched.threadLength) {
            var b = null;

            if (standard.inch) {
                b = asmeThreadLength(size, length);
            } else if (standard.metric) {
                b = isoThreadLength(length, readFieldMM("diameter"));
            } else {
                b = length * 0.6;
            }

            setFieldValue("threadLength", Math.min(b, length));
        }

        if ((product.key === "socket-head" || product.key === "countersunk") &&
            !state.touched.threadLength) {
            var screwDiameter = readFieldMM("diameter");
            var screwThread = length;
            var fixedBaseTable = standard.id === "iso-4762" ||
                standard.id === "din-912" || standard.id === "iso-10642";

            if (fixedBaseTable) {
                /* ISO 10642 M2 and M2.5 are fully threaded; the other sizes
                   use the reference b value for the diameter. */
                screwThread = standard.id === "iso-10642" && screwDiameter < 3
                    ? length
                    : (SOCKET_THREAD_BASE[screwDiameter] || length);
            } else if (standard.metric) {
                screwThread = isoThreadLength(length, screwDiameter);
            }

            setFieldValue("threadLength", Math.min(screwThread, length));
        }

        if (product.key === "carriage" && !state.touched.threadLength) {
            var carriageThread = standard.metric
                ? din603ThreadLength(size, length)
                : length;

            setFieldValue("threadLength", Math.min(carriageThread, length));
        }

        if (product.key === "stud-de") {
            /* The metal (tap) end and the nut end follow the selected
               standard: 1d with the DIN 938 exceptions, 1.25d, 1.6d, 2d or
               2.5d, the ASME B18.31.2 B table, or the equal ends of a clamping
               type stud. */
            var diameter = readFieldMM("diameter");
            var ends = studEndDefaults(standard, length, diameter);
            var firstLength = state.touched.threadLength
                ? readFieldMM("threadLength") : Math.min(ends.b1, length);

            if (!state.touched.threadLength) {
                setFieldValue("threadLength", firstLength);
            }

            if (!state.touched.threadLength2) {
                var remaining = isFinite(firstLength)
                    ? Math.max(length - firstLength, 0) : length;
                var second = ends.equal ? firstLength : ends.b2;

                setFieldValue("threadLength2", Math.min(second, remaining));
            }
        }
    }

    /* ==================================================
       UNIT NOTE AND PLACEHOLDERS
       The selected unit reaches assistive technology through #unitNote;
       dimension labels use engineering names and symbols only, and drawing
       callouts keep their units.
    ================================================== */
    function updateFieldLabels() {
        if (unitNote) {
            unitNote.textContent = state.unit === "in"
                ? "All dimensions are in inches. Internal calculation is performed in millimetres."
                : "All dimensions are in millimetres.";
        }

        document.querySelectorAll("[data-field]").forEach(function (input) {
            var key = input.dataset.field;
            input.placeholder = "Enter " + fieldLabel(key).toLowerCase();
        });

        quantity.placeholder = "Enter quantity";
    }

    function fieldLabel(key) {
        var field = FIELD_DEFS[key] || { label: key, symbol: "" };

        if (key === "length") {
            if (state.productKey === "stud-ft" || state.productKey === "stud-de" ||
                state.productKey === "threaded-rod") {
                /* A stud is measured end to end, and "Overall Length" is the
                   wording every language dictionary already carries. */
                return "Overall Length (" + field.symbol + ")";
            }

            if (state.productKey === "countersunk" || state.productKey === "socket-head") {
                return "Screw Length (" + field.symbol + ")";
            }

            return "Bolt Length (" + field.symbol + ")";
        }

        /* A double-end stud threads two ends, so the first length is b1 in the
           drawing and here, not the single b of a bolt. */
        if (key === "threadLength" && state.productKey === "stud-de") {
            return "Thread Length (b1)";
        }

        return field.label + " (" + field.symbol + ")";
    }

    function updateUnitButtons() {
        mmBtn.classList.toggle("active", state.unit === "mm");
        inchBtn.classList.toggle("active", state.unit === "in");
        mmBtn.setAttribute("aria-pressed", state.unit === "mm" ? "true" : "false");
        inchBtn.setAttribute("aria-pressed", state.unit === "in" ? "true" : "false");
    }

    /* ==================================================
       DIMENSION INPUTS
    ================================================== */
    function fieldHint(key) {
        if (key !== "length") {
            return FIELD_DEFS[key].hint;
        }

        if (state.productKey === "stud-de") {
            return "Overall length including the metal end; DIN 938 nominal l excludes it";
        }

        if (state.productKey === "stud-ft" || state.productKey === "threaded-rod") {
            return "Overall end-to-end length";
        }

        if (state.productKey === "countersunk") {
            return "Measured over the countersunk head to the end";
        }

        if (state.productKey === "socket-head") {
            return "Measured under the head to the end";
        }

        return FIELD_DEFS.length.hint;
    }

    function buildFields() {
        var product = currentProduct();

        dimensionFields.innerHTML = product.fields.map(function (key, index) {
            var field = FIELD_DEFS[key];
            var hint = index === product.fields.length - 1 ? "done" : "next";

            return '<div class="field">' +
                '<label for="field-' + key + '">' + fieldLabel(key) + '</label>' +
                '<input type="number" id="field-' + key + '" data-field="' + key + '"' +
                ' min="0" step="any" inputmode="decimal" enterkeyhint="' + hint + '"' +
                ' autocomplete="off" placeholder="Enter ' + fieldLabel(key).toLowerCase() + '">' +
                '<span class="field-hint">' + fieldHint(key) + '</span>' +
                '</div>';
        }).join("");

        updateFieldLabels();
    }

    /* ==================================================
       PRODUCT / STANDARD / SIZE SELECTION
    ================================================== */
    function populateProductSelect(preferredKey) {
        var keys = Object.keys(PRODUCTS).filter(function (key) {
            return PRODUCTS[key].category === state.category;
        });

        productSelect.innerHTML = keys.map(function (key) {
            return '<option value="' + key + '">' + PRODUCTS[key].name + '</option>';
        }).join("");

        var key = preferredKey && keys.indexOf(preferredKey) !== -1
            ? preferredKey
            : keys[0];

        productSelect.value = key;
        loadProduct(key);
    }

    function loadProduct(key) {
        var product = PRODUCTS[key];

        if (!product) {
            return;
        }

        state.productKey = key;
        state.touched = {};
        state.mmValues = {};
        lastProductByCategory[product.category] = key;

        standardSelect.innerHTML = product.standards.map(function (standard) {
            return '<option value="' + standard.id + '">' + standard.name + '</option>';
        }).join("");

        /* Keep the selected standard family across product changes. If this
           product has no verified standard in that family, fall back to Custom
           with an explicit notice instead of reusing a different product's
           standard number. */
        var resolvedFamily = lastFamilyByCategory[product.category];
        var desiredFamily = state.familyId || resolvedFamily || "iso";
        var selected = product.standards.filter(function (standard) {
            return standard.family === desiredFamily;
        })[0];
        var fallback = false;

        /* First visit to this category: open its own first verified standard
           (for studs, DIN 976-1 or DIN 938) rather than reporting a family
           this category was never expected to publish. */
        if (!selected && !resolvedFamily) {
            selected = product.standards[0];
            desiredFamily = selected ? selected.family : desiredFamily;
        }

        if (!selected && desiredFamily !== "custom") {
            selected = product.standards.filter(function (standard) {
                return standard.family === "custom";
            })[0];
            fallback = Boolean(selected);
        }

        if (!selected) {
            selected = product.standards[0];
            fallback = false;
        }

        state.standardId = selected.id;
        state.familyFallback = fallback;

        if (!fallback) {
            state.familyId = selected.family;
            lastFamilyByCategory[product.category] = selected.family;
        }

        standardSelect.value = state.standardId;

        buildFields();

        populateSizes();
        clearResultState();
        refreshNotes();

        /* The length is not part of the size tables. Prefer 100 mm where
           sensible for the selected diameter, otherwise pick a proportional
           default. Manual/custom products fall back to the product default. */
        if (product.fields.indexOf("length") !== -1 && !currentSize()) {
            setFieldValue("length", defaultLengthForProduct(product, fieldMM("diameter", 0), currentStandard()) || product.defaultLength || 100);
        }

        renderDrawing();
    }

    /* ==================================================
       BOLT SIZE SELECT
       populateSizes() below is the single source of truth: it fills the
       native dropdown from the selected standard's size table, so every
       preset, drawing and calculation keeps its existing behaviour.
    ================================================== */
    function populateSizes() {
        var product = currentProduct();
        var standard = currentStandard();

        if (!standard.sizes.length) {
            sizeSelect.innerHTML = '<option value="">Manual entry</option>';
            sizeSelect.disabled = true;
            state.sizeLabel = "";
            if (product.fields.indexOf("length") !== -1) {
                setFieldValue("length", defaultLengthForProduct(product, fieldMM("diameter", 0), currentStandard()) || product.defaultLength || 100);
            }
            refreshNotes();
            renderDrawing();
            return;
        }

        sizeSelect.disabled = false;
        sizeSelect.innerHTML = standard.sizes.map(function (size) {
            return '<option value="' + size.label + '">' + size.label + '</option>';
        }).join("");

        var wanted = product.defaultSize;
        var exists = standard.sizes.some(function (size) {
            return size.label === state.sizeLabel;
        });

        if (state.sizeLabel && exists) {
            wanted = state.sizeLabel;
        } else if (!standard.sizes.some(function (size) { return size.label === wanted; })) {
            /* The metric default does not exist in an inch table: use 1/2". */
            var half = standard.sizes.filter(function (size) {
                return size.label.indexOf("1/2-13") === 0;
            });

            wanted = half.length ? half[0].label : standard.sizes[0].label;
        }

        sizeSelect.value = wanted;
        state.sizeLabel = wanted;
        applyPreset(currentSize());
        applyDefaultLengthForCurrentSize();
        renderDrawing();
        refreshNotes();
    }

    function applyPreset(size) {
        if (!size) {
            return;
        }

        Object.keys(size.values).forEach(function (key) {
            setFieldValue(key, size.values[key]);
        });

        state.touched = {};
        applyThreadLengths();
    }

    /* ==================================================
       ENGINEERING DRAWINGS
       Every product gets a set of orthographic SVG views. A bolt type is
       drawn once from its fixed reference size (see FIXED BOLT REFERENCE
       IMAGES), so its picture never changes with the selected size; nuts and
       studs are still scaled from the actual millimetre inputs. Callouts keep
       their units; the input section shows the selected unit only once.
    ================================================== */
    function coord(value) {
        return Number(value).toFixed(1);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function fieldMM(key, fallback) {
        var value = readFieldMM(key);
        return isFinite(value) && value > 0 ? value : fallback;
    }

    function acrossCornersMM() {
        var s = fieldMM("acrossFlats", 16);
        return s / Math.cos(Math.PI / 6);
    }

    function pitchMM() {
        return fieldMM("pitch", 1.5);
    }

    function formatPitch(mm) {
        if (state.unit === "in") {
            var inch = mm / INCH;
            var tpi = inch > 0 ? 1 / inch : NaN;

            return formatNumber(inch, 4) + " in (" + formatNumber(tpi, 0) + " TPI)";
        }

        return formatDimension(mm);
    }

    function unitWord() {
        return tr(state.unit === "in" ? "inches" : "millimetres");
    }

    /* Text this page composes itself (standard metadata, notes, drawing
       description) cannot be looked up as one dictionary entry, so each piece
       is translated here. Missing entries fall back to the English source. */
    function tr(text) {
        if (!text) {
            return text;
        }
        try {
            if (window.MW_I18N && typeof MW_I18N.t === "function") {
                var translated = MW_I18N.t(text);
                if (translated && translated !== text) {
                    return translated;
                }
            }
        } catch (error) {}
        return text;
    }

    /* Dictionary templates keep each language's word order: the sentence is
       looked up with its placeholders, then the values are inserted. */
    function tf(text, values) {
        var template = null;

        try {
            if (window.MW_I18N && typeof MW_I18N.template === "function") {
                template = MW_I18N.template(text);
            }
        } catch (error) {}

        return String(template || tr(text)).replace(/\{(\w+)\}/g, function (whole, key) {
            return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : whole;
        });
    }

    /* Edition statements mix a fixed designation that must stay verbatim
       ("ISO 4017:2022") with descriptive words that belong in the reader's
       language ("sixth edition", "reaffirmed 2021"). Only the descriptive
       part is replaced, in place, so the designation is never altered. */
    var ORDINAL_WORDS = {
        first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
        seventh: 7, eighth: 8, ninth: 9, tenth: 10
    };

    function ordinalNumber(word) {
        var key = String(word || "").toLowerCase();
        return ORDINAL_WORDS[key] || "";
    }

    function localizeEdition(text) {
        var value = String(text || "");
        if (!value) {
            return value;
        }

        value = value.replace(/\((first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) revision\)/gi, function (whole, word) {
            var n = ordinalNumber(word);
            return n ? tf("({n} revision)", { n: n }) : whole;
        });
        value = value.replace(/,\s*(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) edition\b/gi, function (whole, word) {
            var n = ordinalNumber(word);
            return n ? tf(", {n} edition", { n: n }) : whole;
        });
        value = value.replace(/\b(\d{4}) edition\b/g, function (whole, year) {
            return tf("{year} edition", { year: year });
        });
        value = value.replace(/\((reaffirmed|affirmed)\s+(\d{4}(?:-\d{2}-\d{2})?)\)/gi, function (whole, word, date) {
            return tf("(reaffirmed {date})", { date: date });
        });
        value = value.replace(/,\s*reaffirmed\s+(\d{4}(?:-\d{2}-\d{2})?)/gi, function (whole, date) {
            return tf(", reaffirmed {date}", { date: date });
        });
        value = value.replace(/\(effective\s+(\d{4}-\d{2}-\d{2})\)/gi, function (whole, date) {
            return tf("(effective {date})", { date: date });
        });
        value = value.replace(/\(revision of ([^)]+)\)/gi, function (whole, code) {
            return tf("(revision of {code})", { code: code });
        });
        value = value.replace(/\(superseded by ([^)]+)\)/gi, function (whole, code) {
            return tf("(superseded by {code})", { code: code });
        });
        value = value.replace(/,\s*reissue\s+(\d{4})/gi, function (whole, year) {
            return tf(", reissue {year}", { year: year });
        });
        value = value.replace(/,\s*with Amendments?\s+([0-9\u2013,\-\s]+)$/i, function (whole, list) {
            return tf(", with amendments {list}", { list: list.trim() });
        });
        value = value.replace(/,\s*with Amendments?$/i, function () {
            return tf(", with amendments", { list: "" });
        });
        value = value.replace(/\(reviewed and confirmed (\d{4})\)/gi, function (whole, year) {
            return tf("(reviewed and confirmed {year})", { year: year });
        });
        value = value.replace(/\bNot a published standard\b/gi, function () {
            return tr("Not a published standard");
        });

        return value;
    }

    /* The citation starts with a description of the document, followed by its
       address: "ISO preview; https://…". Only the description is translated. */
    function localizeSource(text) {
        var value = String(text || "");

        return value.replace(/^ISO preview\b/, function () {
            return tr("ISO preview");
        });
    }

    /* Publication status of the chosen standard: "Current; replaces DIN 557:1994-01"
       is a fixed phrase plus a designation, so the phrase is translated and the
       designation is passed through untouched. */
    function localizeStatus(text) {
        var value = String(text || "");
        if (!value) {
            return value;
        }

        var match = value.match(/^Current \(in force from ([^)]+)\)$/);
        if (match) {
            return tf("Current (in force from {date})", { date: match[1] });
        }

        match = value.match(/^Current national standard; replaced (.+)$/);
        if (match) {
            return tf("Current national standard; replaced {code}", { code: match[1] });
        }

        match = value.match(/^Current; (replaces|replaced|supersedes) (.+)$/);
        if (match) {
            var verbs = {
                replaces: "Current; replaces {code}",
                replaced: "Current; replaced {code}",
                supersedes: "Current; supersedes {code}"
            };
            return tf(verbs[match[1]], { code: match[2] });
        }

        match = value.match(/^In force \(vigente\); annuls (.+)$/);
        if (match) {
            return tf("In force; annuls {code}", { code: match[1] });
        }

        return tr(value);
    }

    /* Millimetre-only label used by the older single-view drawings. The
       orthographic sheet labels follow the selected display unit. */
    function formatMMOnly(mmValue) {
        if (!isFinite(mmValue) || mmValue <= 0) {
            return "—";
        }

        return formatNumber(mmValue, mmValue < 10 ? 2 : 1) + " mm";
    }

    /* The dimension name in the selected language: 对边宽, 头部高度, लंबाई,
       Altura de la cabeza ... English keeps the symbols the standard prints. */
    function symbolName(symbol) {
        var tech = window.MWTechnicalLang;
        return tech && tech.label ? (tech.label(symbol) || symbol) : symbol;
    }

    function caption(id) {
        var tech = window.MWTechnicalLang;
        return tech && tech.caption ? (tech.caption(id, null) || "") : "";
    }

    function dimTextMM(key, symbol) {
        var field = FIELD_DEFS[key];
        var label = symbolName(symbol || (field ? field.symbol : key));

        /* Across corners is derived from the width across flats, not typed. */
        if (key === "acrossCorners") {
            return label + " = " + formatMMOnly(acrossCornersMM());
        }

        var mm = readFieldMM(key);

        if (!isFinite(mm) || mm <= 0) {
            return label + " = —";
        }

        return label + " = " + formatMMOnly(mm);
    }

    function dimText(key, symbol) {
        var field = FIELD_DEFS[key];
        var label = symbolName(symbol || (field ? field.symbol : key));

        if (key === "acrossCorners") {
            return symbolName("e") + " = " + formatDimension(acrossCornersMM());
        }

        if (key === "pitch") {
            var pitchValue = readFieldMM("pitch");

            /* An empty manual field is reported as missing, never replaced by
               an invented pitch in the drawing label. */
            return symbolName("P") + " = " + (isFinite(pitchValue) && pitchValue > 0
                ? formatPitch(pitchValue) : "—");
        }

        var mm = readFieldMM(key);

        if (!isFinite(mm) || mm <= 0) {
            return label + " = —";
        }

        return label + " = " + formatDimension(mm);
    }

    function lineMarkup(cls, x1, y1, x2, y2, extra) {
        return '<line class="' + cls + '" x1="' + coord(x1) + '" y1="' + coord(y1) +
            '" x2="' + coord(x2) + '" y2="' + coord(y2) + '"' + (extra || "") + '/>';
    }

    function polygonMarkup(cls, points, extra) {
        return '<polygon class="' + cls + '" points="' + points + '"' + (extra || "") + '/>';
    }

    function circleMarkup(cls, cx, cy, r, extra) {
        return '<circle class="' + cls + '" cx="' + coord(cx) + '" cy="' + coord(cy) +
            '" r="' + coord(r) + '"' + (extra || "") + '/>';
    }

    function pathMarkup(cls, d, extra) {
        return '<path class="' + cls + '" d="' + d + '"' + (extra || "") + '/>';
    }

    function labelMarkup(key, x, y, anchor, symbol, rotate, overrideText, mmOnly) {
        var transform = rotate ? ' transform="rotate(-90 ' + coord(x) + " " + coord(y) + ')"' : "";
        var text = overrideText || (mmOnly ? dimTextMM(key, symbol) : dimText(key, symbol));

        return '<text class="fastener-label" x="' + coord(x) + '" y="' + coord(y) +
            '" text-anchor="' + (anchor || "middle") + '" data-dim="' + key +
            '" data-symbol="' + (symbol || "") + '"' +
            (mmOnly ? ' data-unit-mode="mm"' : '') + transform + '>' + text + '</text>';
    }

    function dimH(x1, x2, y, key, options) {
        var opts = options || {};
        var fromY = opts.fromY === undefined ? null :
            (Array.isArray(opts.fromY) ? opts.fromY : [opts.fromY, opts.fromY]);
        var extensions = "";

        if (fromY) {
            extensions = lineMarkup("fastener-ext", x1, fromY[0], x1, y + 6) +
                lineMarkup("fastener-ext", x2, fromY[1], x2, y + 6);
        }

        return extensions +
            lineMarkup("fastener-dim", x1, y, x2, y,
                ' marker-start="url(#' + opts.arrow + ')" marker-end="url(#' + opts.arrow + ')"') +
            labelMarkup(key, (x1 + x2) / 2, y + (opts.labelBelow ? 19 : -9),
                "middle", opts.symbol, false, null, opts.mmOnly);
    }

    function dimV(y1, y2, x, key, options) {
        var opts = options || {};
        var side = opts.side || "right";
        var mid = (y1 + y2) / 2;
        var fromX = opts.fromX === undefined ? null :
            (Array.isArray(opts.fromX) ? opts.fromX : [opts.fromX, opts.fromX]);
        var pastX = x + (side === "left" ? -6 : 6);
        var pad = opts.labelPad === undefined ? 9 : opts.labelPad;
        var extensions = "";

        if (fromX) {
            extensions = lineMarkup("fastener-ext", fromX[0], y1, pastX, y1) +
                lineMarkup("fastener-ext", fromX[1], y2, pastX, y2);
        }

        return extensions +
            lineMarkup("fastener-dim", x, y1, x, y2,
                ' marker-start="url(#' + opts.arrow + ')" marker-end="url(#' + opts.arrow + ')"') +
            labelMarkup(key, x + (side === "left" ? -pad : pad), mid, "middle",
                opts.symbol, true, null, opts.mmOnly);
    }

    function leaderMarkup(x1, y1, x2, y2, key, symbol, overrideText, mmOnly) {
        var anchor = x2 >= x1 ? "start" : "end";
        var textX = x2 + (anchor === "start" ? 7 : -7);

        return circleMarkup("fastener-point", x1, y1, 2.4) +
            lineMarkup("fastener-ext", x1, y1, x2, y2) +
            labelMarkup(key, textX, y2 + 4, anchor, symbol, false, overrideText, mmOnly);
    }

    function defsMarkup(prefix) {
        return '<defs>' +
            '<marker id="' + prefix + 'Arrow" markerWidth="8" markerHeight="8" refX="5" refY="4"' +
            ' orient="auto-start-reverse" markerUnits="userSpaceOnUse">' +
            '<path class="fastener-arrow" d="M0 1 L5 4 L0 7"/></marker>' +
            '<pattern id="' + prefix + 'Hatch" width="7" height="7" patternUnits="userSpaceOnUse"' +
            ' patternTransform="rotate(45)">' +
            '<line x1="0" y1="0" x2="0" y2="7" class="fastener-hatch"/></pattern>' +
            '</defs>';
    }

    function centreLine(x1, x2, y) {
        return lineMarkup("fastener-centre", x1, y, x2, y);
    }

    function verticalCentre(x, y1, y2) {
        return lineMarkup("fastener-centre", x, y1, x, y2);
    }

    function noteMarkup(text, x, y, anchor) {
        return '<text class="fastener-note" x="' + coord(x) + '" y="' + coord(y) +
            '" text-anchor="' + (anchor || "start") + '">' + text + '</text>';
    }

    /* ==================================================
       ENGINEERING DRAWING SHEET START
       One sheet per product: the FRONT VIEW plus the SIDE VIEW for bolts,
       screws, studs and nuts.

       The drawing language is the one every other calculator on the site
       uses: #24383d outlines on an #eaf5f4 face, #087f7b dimensions with solid
       arrowheads, #9fc4c1 centre and hidden lines, FRONT VIEW / SIDE VIEW
       captions.

       Geometry is built from the millimetre values in the form, never from
       illustration constants: each view uses one millimetre scale, so an M6
       and an M30 keep their true proportions. A front view may use a larger
       scale for readability, but no scale note is printed on the sheet.

       Annotation rule: a dimension is only drawn where its witness lines reach
       the real feature, and every label is collision checked against the part
       outlines, the other labels and the sheet margins before it is placed.
    ================================================== */

    var SHEET = { width: 760, height: 424 };
    /* Clear space between the frame and the two views. A large size shrinks to
       fit inside this margin instead of running into the border. */
    var SHEET_MARGIN = 56;
    var AREA = { top: 62, bottom: 350 };
    var AXIS_Y = 198;
    var CAPTION_Y = 372;
    var LABEL_SIZE = 17;
    var COS30 = Math.cos(Math.PI / 6);
    var TAN30 = Math.tan(Math.PI / 6);

    /* ==================================================
       ANNOTATION LAYOUT
       Every label reserves a box. A candidate position is accepted only when
       it clears the part keep-out boxes, the boxes already taken and the sheet
       margins, so the placement adapts to the size of the product instead of
       relying on coordinates that only suit one size.
    ================================================== */

    var layout = { labels: [], keep: [] };

    function layoutReset() {
        layout = { labels: [], keep: [] };

        /* Captions are part of the sheet, so no dimension label may enter
           their band. Seeding it here keeps every view's annotations clear
           of the FRONT VIEW / SIDE VIEW text below the drawing. */
        layoutKeep(20, CAPTION_Y - 18, SHEET.width - 20, CAPTION_Y + 8);
    }

    function layoutKeep(x1, y1, x2, y2) {
        layout.keep.push({
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            w: Math.abs(x2 - x1),
            h: Math.abs(y2 - y1)
        });
    }

    /* Advance widths close enough to Arial for collision checking. */
    function textWidth(text, size) {
        var narrow = "ilI.,:;'|!jtfr()[]/- ";
        var wide = "mwMW@%";
        var total = 0;
        var i;
        var ch;

        for (i = 0; i < text.length; i += 1) {
            ch = text.charAt(i);

            if (narrow.indexOf(ch) >= 0) {
                total += 0.32;
            } else if (wide.indexOf(ch) >= 0) {
                total += 0.88;
            } else if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) {
                total += 0.66;
            } else {
                total += 0.56;
            }
        }

        return total * size;
    }

    function labelBox(text, x, y, anchor, rotate) {
        var width = textWidth(text, LABEL_SIZE);

        if (rotate) {
            /* rotate(-90) puts the ascender side left of the baseline. */
            return {
                x: x - LABEL_SIZE * 0.8,
                y: y - width / 2,
                w: LABEL_SIZE,
                h: width
            };
        }

        return {
            x: anchor === "middle" ? x - width / 2 : (anchor === "end" ? x - width : x),
            y: y - LABEL_SIZE * 0.82,
            w: width,
            h: LABEL_SIZE
        };
    }

    function boxesOverlap(a, b, pad) {
        return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad &&
            a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
    }

    function boxFits(box) {
        var i;

        if (box.x < 16 || box.x + box.w > SHEET.width - 16) {
            return false;
        }

        if (box.y < 46 || box.y + box.h > SHEET.height - 8) {
            return false;
        }

        for (i = 0; i < layout.labels.length; i += 1) {
            if (boxesOverlap(box, layout.labels[i], 3)) {
                return false;
            }
        }

        for (i = 0; i < layout.keep.length; i += 1) {
            if (boxesOverlap(box, layout.keep[i], 2)) {
                return false;
            }
        }

        return true;
    }

    function svgLabel(text, x, y, anchor, rotate, key, symbol) {
        var attrs = key
            ? ' data-dim="' + key + '" data-symbol="' + (symbol || "") + '"'
            : "";
        var transform = rotate
            ? ' transform="rotate(-90 ' + coord(x) + " " + coord(y) + ')"'
            : "";

        return '<text class="fastener-label" x="' + coord(x) + '" y="' + coord(y) +
            '" text-anchor="' + (anchor || "middle") + '"' + attrs + transform + ">" +
            text + "</text>";
    }

    function placeText(text, candidates, key, symbol) {
        var chosen = null;
        var box = null;
        var i;

        for (i = 0; i < candidates.length; i += 1) {
            box = labelBox(text, candidates[i].x, candidates[i].y,
                candidates[i].anchor, candidates[i].rotate);

            if (boxFits(box)) {
                chosen = candidates[i];
                break;
            }
        }

        if (!chosen) {
            chosen = candidates[0];
            box = labelBox(text, chosen.x, chosen.y, chosen.anchor, chosen.rotate);
        }

        layout.labels.push(box);

        return svgLabel(text, chosen.x, chosen.y, chosen.anchor, chosen.rotate, key, symbol);
    }

    /* ==================================================
       SVG PRIMITIVES
    ================================================== */

    function svgLine(cls, x1, y1, x2, y2) {
        return '<line class="' + cls + '" x1="' + coord(x1) + '" y1="' + coord(y1) +
            '" x2="' + coord(x2) + '" y2="' + coord(y2) + '"/>';
    }

    function svgPath(cls, d) {
        return '<path class="' + cls + '" d="' + d + '"/>';
    }

    function svgCircle(cls, cx, cy, r) {
        return '<circle class="' + cls + '" cx="' + coord(cx) + '" cy="' + coord(cy) +
            '" r="' + coord(Math.max(r, 0.5)) + '"/>';
    }

    function svgPolygon(cls, points) {
        return '<polygon class="' + cls + '" points="' + points + '"/>';
    }

    function boxPath(x1, y1, x2, y2) {
        return "M" + coord(x1) + " " + coord(y1) +
            " H" + coord(x2) + " V" + coord(y2) + " H" + coord(x1) + " Z";
    }

    function svgBox(cls, x1, y1, x2, y2) {
        return svgPath(cls, boxPath(x1, y1, x2, y2));
    }

    function svgText(cls, text, x, y, anchor) {
        return '<text class="' + cls + '" x="' + coord(x) + '" y="' + coord(y) +
            '" text-anchor="' + (anchor || "start") + '">' + text + "</text>";
    }

    /* Solid arrowhead, 9 px long, 5.8 px wide, tip exactly on the target. */
    function svgArrow(x, y, angleDeg) {
        var a = angleDeg * Math.PI / 180;
        var bx = x - 9 * Math.cos(a);
        var by = y - 9 * Math.sin(a);
        var nx = 2.9 * Math.sin(a);
        var ny = -2.9 * Math.cos(a);

        return svgPath("fastener-arrow-head",
            "M" + coord(x) + " " + coord(y) +
            " L" + coord(bx + nx) + " " + coord(by + ny) +
            " L" + coord(bx - nx) + " " + coord(by - ny) + " Z");
    }

    /* ==================================================
       DIMENSION PRIMITIVES
    ================================================== */

    /* Horizontal dimension between x1 and x2 at the line y.
       `from` holds the witness points [x, y] on the real geometry.
       Drafting conventions: the dimension line sits clear of the part, the
       text sits clear of the line, extension lines stop just past the line,
       and short spans use outside arrows so the two heads never merge. */
    function dimH(o) {
        var x1 = Math.min(o.x1, o.x2);
        var x2 = Math.max(o.x1, o.x2);
        var y = o.y;
        var below = o.side === "below";
        var text = dimText(o.key, o.symbol);
        var out = [];
        var tight = (x2 - x1) < 52;
        var mid = (x1 + x2) / 2;
        var textY = below ? y + 20 : y - 10;

        (o.from || []).forEach(function (f) {
            var dir = y >= f[1] ? 1 : -1;
            var start = f[1] + dir * 3;
            var end = y + dir * 6;

            if (Math.abs(end - start) > 0.5) {
                out.push(svgLine("fastener-ext", f[0], start, f[0], end));
            }
        });

        if (!tight) {
            out.push(svgLine("fastener-dim", x1, y, x2, y));
            out.push(svgArrow(x1, y, 180));
            out.push(svgArrow(x2, y, 0));
        } else {
            out.push(svgLine("fastener-dim", x1 - 26, y, x2 + 26, y));
            out.push(svgArrow(x1, y, 0));
            out.push(svgArrow(x2, y, 180));
        }

        out.push(placeText(text, [
            { x: mid, y: textY, anchor: "middle" },
            { x: mid, y: below ? textY + 20 : textY - 20, anchor: "middle" },
            { x: mid, y: below ? y - 10 : y + 20, anchor: "middle" },
            { x: x2 + 8, y: textY, anchor: "start" },
            { x: x1 - 8, y: textY, anchor: "end" },
            { x: mid, y: below ? textY + 40 : textY - 40, anchor: "middle" }
        ], o.key, o.symbol));

        return out.join("");
    }

    /* Vertical dimension between y1 and y2 at the line x. The label stays
       rotated and is offset far enough that its halo never covers the line. */
    function dimV(o) {
        var y1 = Math.min(o.y1, o.y2);
        var y2 = Math.max(o.y1, o.y2);
        var x = o.x;
        var side = o.side === "left" ? -1 : 1;
        var text = dimText(o.key, o.symbol);
        var out = [];
        var tight = (y2 - y1) < 54;
        var mid = (y1 + y2) / 2;

        (o.from || []).forEach(function (f) {
            var dir = x >= f[0] ? 1 : -1;

            out.push(svgLine("fastener-ext", f[0] + dir * 3, f[1],
                x + dir * 6, f[1]));
        });

        if (!tight) {
            out.push(svgLine("fastener-dim", x, y1, x, y2));
            out.push(svgArrow(x, y1, -90));
            out.push(svgArrow(x, y2, 90));
        } else {
            out.push(svgLine("fastener-dim", x, y1 - 22, x, y2 + 22));
            out.push(svgArrow(x, y1, 90));
            out.push(svgArrow(x, y2, -90));
        }

        out.push(placeText(text, [
            { x: x + side * 22, y: mid, anchor: "middle", rotate: true },
            { x: x - side * 22, y: mid, anchor: "middle", rotate: true },
            { x: x + side * 41, y: mid, anchor: "middle", rotate: true },
            { x: x - side * 41, y: mid, anchor: "middle", rotate: true }
        ], o.key, o.symbol));

        return out.join("");
    }

    /* Leader note: a short shoulder under the text, then a straight run to the
       feature with an arrowhead on the feature. */
    function leaderNote(o) {
        var text = o.text || dimText(o.key, o.symbol);
        var target = o.to;
        var chosen = null;
        var box = null;
        var i;
        var startX;
        var startY;
        var elbow;
        var angle;

        var dy;
        var dyTry = [0, 26, 52, -26, 78, -52];

        for (i = 0; i < o.cands.length && !chosen; i += 1) {
            for (dy = 0; dy < dyTry.length; dy += 1) {
                box = labelBox(text, o.cands[i].x, o.cands[i].y + dyTry[dy], o.cands[i].anchor);
                if (boxFits(box)) {
                    chosen = {
                        x: o.cands[i].x,
                        y: o.cands[i].y + dyTry[dy],
                        anchor: o.cands[i].anchor
                    };
                    break;
                }
            }
        }

        if (!chosen) {
            chosen = o.cands[0];
            box = labelBox(text, chosen.x, chosen.y, chosen.anchor);
        }

        /* The leader must not dive through its own text: if the target sits
           under the label, slide the label clear of it. */
        if (target[0] > box.x - 12 && target[0] < box.x + box.w + 12) {
            var flipRight = labelBox(text, target[0] + 18, chosen.y, "start");
            var flipLeft = labelBox(text, target[0] - 18, chosen.y, "end");

            if (boxFits(flipRight)) {
                box = flipRight;
                chosen = { x: target[0] + 18, y: chosen.y, anchor: "start" };
            } else if (boxFits(flipLeft)) {
                box = flipLeft;
                chosen = { x: target[0] - 18, y: chosen.y, anchor: "end" };
            } else {
                var away = target[0] <= box.x + box.w / 2 ? -1 : 1;
                var slide = away * (box.w * 0.72 + 28);
                var moved = labelBox(text, chosen.x + slide, chosen.y, chosen.anchor);

                if (boxFits(moved)) {
                    box = moved;
                    chosen = { x: chosen.x + slide, y: chosen.y, anchor: chosen.anchor };
                }
            }
        }

        layout.labels.push(box);
        /* The shoulder leaves the text at mid-cap height, never under it, then
           runs out horizontally before turning toward the feature. */
        startY = chosen.y - LABEL_SIZE * 0.32;
        startX = target[0] < box.x + box.w / 2 ? box.x - 3 : box.x + box.w + 3;
        elbow = startX + (target[0] < startX ? -14 : 14);
        angle = Math.atan2(target[1] - startY, target[0] - elbow) * 180 / Math.PI;

        return svgPath("fastener-dim", "M" + coord(startX) + " " + coord(startY) +
                " H" + coord(elbow) + " L" + coord(target[0]) + " " + coord(target[1])) +
            svgArrow(target[0], target[1], angle) +
            svgLabel(text, chosen.x, chosen.y, chosen.anchor, false, o.key, o.symbol);
    }

    /* ==================================================
       SHEET CHROME
    ================================================== */

    function sheetDefs() {
        return "<defs></defs>";
    }

    function sheetChrome() {
        return '<rect class="fastener-frame" x="10" y="10" width="740" height="404"/>' +
            svgText("fastener-note", currentStandard().name, 24, 32, "start") +
            svgText("fastener-note",
                state.unit === "in" ? "DIMENSIONS IN INCHES" : "DIMENSIONS IN MM",
                736, 32, "end") +
            svgLine("fastener-rule", 24, 42, 736, 42);
    }

    function viewCaption(text, x) {
        /* Keep every caption inside the frame, even on the longest sheet. */
        var width = textWidth(text, 13) + text.length * 1.2;
        var half = width / 2 + 16;
        var cx = Math.max(half, Math.min(SHEET.width - half, x));

        return svgText("fastener-view-title", text, cx, CAPTION_Y, "middle");
    }

    /* The sheet carries exactly two view labels. Both are emitted here so no
       product, scale or standard can reintroduce captions or scale notes. */
    function viewCaptions(frontX, sideX) {
        return viewCaption("FRONT VIEW", frontX) +
            viewCaption("SIDE VIEW", sideX);
    }

    /* Centre the two views on the sheet by their drawn geometry. The room a
       view needs depends on its size, its dimensions and the standard in use,
       so a fixed left origin drifts as soon as any of those change; measuring
       the finished drawing is the only way the pair stays centred for every
       size, product and unit. */
    /* Where the drawing actually paints, in sheet units. Rotated dimension
       labels measure differently in their own space, so the extent comes from
       the rendered boxes scaled back to the sheet. */
    function sheetInkSpan(svg, drawing) {
        var svgRect = svg.getBoundingClientRect();
        var scale = svgRect.width / SHEET.width;
        var minX = Infinity;
        var maxX = -Infinity;
        var painted = drawing.querySelectorAll("*") || [];
        var j;
        var rect;

        if (scale > 0) {
            for (j = 0; j < painted.length; j += 1) {
                if (!painted[j].getBoundingClientRect) {
                    continue;
                }

                /* Centre lines are dash-dot aids that overhang the parts by
                   different amounts on each view, so the pair is balanced on
                   what the eye reads as the drawing. */
                if ((painted[j].getAttribute("class") || "").indexOf("fastener-centre") >= 0) {
                    continue;
                }

                rect = painted[j].getBoundingClientRect();

                if (rect.width <= 0 && rect.height <= 0) {
                    continue;
                }

                minX = Math.min(minX, (rect.left - svgRect.left) / scale);
                maxX = Math.max(maxX, (rect.right - svgRect.left) / scale);
            }
        }

        if (!isFinite(minX) || maxX - minX < 1) {
            var box = drawing.getBBox();
            var shift = drawing.__sheetShift || 0;

            minX = box.x + shift;
            maxX = box.x + box.width + shift;
        }

        if (!isFinite(minX) || maxX - minX < 1) {
            return null;
        }

        return { minX: minX, maxX: maxX };
    }

    function centreSheet() {
        var svg = diagramViews && diagramViews.querySelector
            ? diagramViews.querySelector("svg")
            : null;

        if (!svg || !svg.getBBox || !document.createElementNS) {
            return;
        }

        var drawing = svg.__sheetDrawing;
        var captions = svg.__sheetCaptions || [];

        if (!drawing || drawing.parentNode !== svg) {
            drawing = document.createElementNS("http://www.w3.org/2000/svg", "g");
            drawing.setAttribute("class", "fastener-sheet-body");
            drawing.__sheetShift = 0;
            captions = [];

            var nodes = Array.prototype.slice.call(svg.childNodes);
            var i;
            var node;
            var cls;

            for (i = 0; i < nodes.length; i += 1) {
                node = nodes[i];

                if (node.nodeType !== 1) {
                    continue;
                }

                cls = node.getAttribute("class") || "";

                if (cls === "fastener-frame" || cls === "fastener-rule") {
                    continue;
                }

                if (cls.indexOf("fastener-view-title") >= 0) {
                    captions.push(node);
                    continue;
                }

                /* The standard name and the unit note are sheet chrome: they
                   stay on the frame, while a leader note inside the drawing
                   moves with the views. */
                if (cls.indexOf("fastener-note") >= 0 &&
                        parseFloat(node.getAttribute("y")) < AREA.top - 8) {
                    continue;
                }

                drawing.appendChild(node);
            }

            if (!drawing.childNodes.length) {
                return;
            }

            svg.appendChild(drawing);
            svg.__sheetDrawing = drawing;
            svg.__sheetCaptions = captions;
        }

        var span = sheetInkSpan(svg, drawing);

        if (!span) {
            return;
        }

        /* Measure again after layout settles, so the second call only applies
           the drift left by late font metrics instead of shifting twice. */
        var current = drawing.__sheetShift || 0;
        var baseMin = span.minX - current;
        var baseMax = span.maxX - current;
        var target = SHEET.width / 2 - (baseMin + baseMax) / 2;

        /* A drawing wider than the sheet would only be cropped by centring. */
        target = Math.max(18 - baseMin,
            Math.min(SHEET.width - 18 - baseMax, target));

        var delta = target - current;

        if (Math.abs(delta) < 0.05) {
            return;
        }

        drawing.__sheetShift = target;
        drawing.setAttribute("transform", "translate(" + coord(target) + " 0)");

        captions.forEach(function (title) {
            var x = parseFloat(title.getAttribute("x"));

            if (isFinite(x)) {
                title.setAttribute("x", coord(x + delta));
            }
        });
    }

    function sheetSvg(ariaLabel, content, extraClass) {
        return '<svg class="fastener-drawing fastener-drawing--mono' +
            (extraClass ? " " + extraClass : "") +
            '" viewBox="0 0 ' + SHEET.width + " " + SHEET.height +
            '" role="img" aria-label="' + ariaLabel + '">' +
            sheetDefs() + content + "</svg>";
    }

    /* ==================================================
       SHARED GEOMETRY
    ================================================== */

    /* A hexagon drawn across corners keeps a corner on the vertical axis and
       puts two flats left and right, so the width across flats reads
       horizontally in the view and the elevation is across corners. */
    function hexPoints(cx, cy, radius) {
        var points = [];
        var i;
        var a;

        for (i = 0; i < 6; i += 1) {
            a = Math.PI / 3 * i + Math.PI / 6;
            points.push(coord(cx + radius * Math.cos(a)) + "," +
                coord(cy + radius * Math.sin(a)));
        }

        return points.join(" ");
    }

    function centreCross(cx, cy, radius) {
        return svgLine("fastener-centre", cx - radius - 14, cy, cx + radius + 14, cy) +
            svgLine("fastener-centre", cx, cy - radius - 14, cx, cy + radius + 14);
    }

    /* Thread root lines of an external thread, drawn inside the crest outline
       per the simplified ISO representation. */
    function threadRootH(x1, x2, cy, rootPx) {
        if (x2 - x1 < 2) {
            return "";
        }

        return svgLine("fastener-thin", x1, cy - rootPx, x2, cy - rootPx) +
            svgLine("fastener-thin", x1, cy + rootPx, x2, cy + rootPx);
    }

    function minorDiameter(d, pitch) {
        return Math.max(d - 1.0825 * pitch, d * 0.55);
    }

    /* ==================================================
       FIXED BOLT REFERENCE IMAGES
       Each bolt type is drawn once, from one tabulated sample size, so its
       illustration is a fixed reference: the shape, the scale and every
       proportion stay exactly the same when the metric size changes. Only the
       dimension labels, which read the fields, are rewritten for the size the
       visitor selected.

       The sample is taken from the product's own metric size table (the first
       standard every bolt product lists) and from that table's catalogue
       length, so no dimension in the picture is invented.
    ================================================== */
    /* A carriage bolt and a socket head cap screw are dimensioned from the
       figures the visitor entered, so their sheets are rebuilt on every change
       and are not listed here. */
    var FIXED_REFERENCE_DRAWINGS = ["countersunk"];

    function fixedReferenceDrawing(product) {
        return Boolean(product && FIXED_REFERENCE_DRAWINGS.indexOf(product.key) !== -1);
    }

    /* The product's first standard that carries a size table. */
    function referenceStandard(product) {
        var standards = product && product.standards ? product.standards : [];

        for (var i = 0; i < standards.length; i += 1) {
            if (standards[i].sizes && standards[i].sizes.length) {
                return standards[i];
            }
        }

        return null;
    }

    function referenceSize(product, standard, preferredLabel) {
        if (!standard) {
            return null;
        }

        var sizes = standard.sizes;
        var target = preferredLabel || product.defaultSize;
        var chosen = null;
        var i;

        for (i = 0; i < sizes.length; i += 1) {
            if (sizes[i].label === target) {
                chosen = sizes[i];
                break;
            }
        }

        if (!chosen) {
            /* No catalogued default: the size closest to M10 keeps every
               feature of the picture readable. */
            chosen = sizes[0];

            for (i = 1; i < sizes.length; i += 1) {
                if (Math.abs(sizes[i].values.diameter - 10) <
                    Math.abs(chosen.values.diameter - 10)) {
                    chosen = sizes[i];
                }
            }
        }

        return chosen;
    }

    /* The thread length the reference picture draws, using the same standard
       rules the fields follow. */
    function referenceThreadLength(product, size, diameter, length) {
        if (!size) {
            return length;
        }

        if (product.key === "hex-ht") {
            return Math.min(isoThreadLength(length, diameter), length);
        }

        if (product.key === "socket-head" || product.key === "countersunk") {
            if (product.key === "countersunk" && diameter < 3) {
                return length;
            }

            return Math.min(SOCKET_THREAD_BASE[diameter] || length, length);
        }

        if (product.key === "carriage") {
            return Math.min(din603ThreadLength(size, length), length);
        }

        return length;
    }

    /* The length each stud picture is drawn at. These are entries of the ISO
       888 preferred length series the calculator already carries; they only
       decide how large the illustration is, never a dimension value. A stud
       type's own picture therefore stays readable (a 1 m threaded rod drawn
       whole on a 760 px sheet would collapse to a hairline) and no two stud
       types share one image. */
    var STUD_REFERENCE_LENGTH = {
        "stud-ft": 100,
        "stud-de": 100,
        "threaded-rod": 200
    };

    /* The reference picture of a stud: its catalogue sample size and the
       length above. */
    function fixedStudGeometry(product) {
        var standard = referenceStandard(product);
        var size = referenceSize(product, standard);
        var values = size && size.values ? size.values : {};
        var diameter = Math.max(Number(values.diameter) || 12, 0.5);
        var pitch = Math.max(Number(values.pitch) || 1.75, 0.05);
        var catalogueLength = defaultLengthForProduct(product, diameter, standard);
        var length = Math.max(STUD_REFERENCE_LENGTH[product.key] ||
            catalogueLength || product.defaultLength || 150, 1);
        var doubleEnded = product.key === "stud-de";
        var b1 = doubleEnded
            ? Math.min(din938MetalEnd(diameter), length)
            : length;
        var b2 = doubleEnded
            ? Math.min(din938NutEnd(length, diameter), Math.max(length - b1, 0))
            : 0;

        return {
            diameter: diameter,
            pitch: pitch,
            length: length,
            threadLength: b1,
            threadLength2: b2
        };
    }

    function fixedBoltGeometry(product) {
        var standard = referenceStandard(product);
        var size = referenceSize(product, standard);
        var values = size && size.values ? size.values : {};
        var diameter = Math.max(Number(values.diameter) || 10, 0.5);
        var pitch = Math.max(Number(values.pitch) || 1.5, 0.05);
        var catalogueLength = defaultLengthForProduct(product, diameter, standard);
        var length = Math.max(catalogueLength || product.defaultLength || 50, 1);
        var headHeight = Math.max(Number(values.headHeight) || diameter * 0.7, 0.5);

        return {
            diameter: diameter,
            pitch: pitch,
            length: length,
            acrossFlats: Math.max(Number(values.acrossFlats) || diameter * 1.6, 0.5),
            headHeight: headHeight,
            headDiameter: Math.max(Number(values.headDiameter) || diameter * 1.6, 0.5),
            socketAcrossFlats: Math.max(Number(values.socketAcrossFlats) || diameter * 0.6, 0.3),
            socketDepth: Math.max(Number(values.socketDepth) || headHeight * 0.5, 0.2),
            neckAcrossFlats: Math.max(Number(values.neckAcrossFlats) || diameter * 1.05, 0.5),
            neckHeight: Math.max(Number(values.neckHeight) || diameter * 0.5, 0.2),
            threadLength: referenceThreadLength(product, size, diameter, length)
        };
    }

    /* ==================================================
       HEXAGON SOCKET HEAD CAP SCREW SHEET
       DIN 912 / ISO 4762.

       One engine, driven by the figures in the form:

       * the view on the head is the circle dk with the true hexagon socket
         (across flats s) centred in it, plus its centre lines;
       * the elevation is the cylindrical head of height k, the socket of depth
         t hidden inside it, the shank and the ISO 60 degree thread at the
         selected pitch, so the thread is drawn where it really is;
       * a screw shorter than the standard reference thread length b is drawn
         fully threaded and carries no second b dimension, because b would only
         repeat L. A longer screw is drawn with its plain shank and its thread
         length dimensioned from the runout to the tip;
       * L always runs from the bearing face under the head to the tip, so the
         head height is never included.
    ================================================== */

    function socketSheet(product) {
        var ref = fixedBoltGeometry(product);
        var d = fieldMM("diameter", ref.diameter);
        var pitch = fieldMM("pitch", ref.pitch);
        var length = Math.max(fieldMM("length", ref.length), 1);
        var headDiameter = Math.max(fieldMM("headDiameter", ref.headDiameter), d * 0.5);
        var headHeight = Math.max(fieldMM("headHeight", ref.headHeight), 0.2);
        var socketWidth = Math.max(fieldMM("socketAcrossFlats", ref.socketAcrossFlats), 0.2);
        var socketDepth = clamp(fieldMM("socketDepth", ref.socketDepth),
            0.2, headHeight);
        var threadLength = clamp(fieldMM("threadLength", ref.threadLength),
            0.5, length);
        var fullyThreaded = threadLength >= length - 0.01;

        var margin = 24;
        var frontPad = 58;      /* dk dimension and its label, left of the circle */
        var sPad = 140;         /* s dimension tail and its label, right of it */
        var sidePad = 74;       /* d dimension and its label, right of the tip */
        var topBand = 46;       /* k dimension above the head */
        var bottomBand = fullyThreaded ? 66 : 102;
        var topLimit = 58;
        var bottomLimit = 350;

        /* L runs from the bearing face, so the head adds its own height to the
           length of the elevation. Both go into the fit, otherwise the d
           dimension at the tip is pushed off the sheet. */
        var axialLength = headHeight + length;
        var room = (bottomLimit - topLimit) - topBand - bottomBand;
        var scale = Math.min(
            (SHEET.width - 2 * margin - frontPad - sPad - sidePad) /
                Math.max(headDiameter + axialLength, 1),
            room / Math.max(headDiameter, 1),
            12
        );

        scale = Math.max(scale, 0.8);

        var s = scale;
        var frontRadius = headDiameter / 2 * s;
        var contentW = frontPad + headDiameter * s + sPad +
            axialLength * s + sidePad;
        var leftOrigin = Math.max(margin, (SHEET.width - contentW) / 2);
        var frontCx = leftOrigin + frontPad + frontRadius;
        var headLeft = frontCx + frontRadius + sPad;
        var underHead = headLeft + headHeight * s;
        var endX = underHead + length * s;

        var viewH = headDiameter * s;
        var viewTop = topLimit + topBand + (room - viewH) / 2;
        var viewBottom = viewTop + viewH;
        var axisY = viewTop + viewH / 2;
        var shankR = d / 2 * s;
        var top = axisY - shankR;
        var bottom = axisY + shankR;
        var socketHalf = socketWidth / 2 * s;
        var hexR = socketWidth / COS30 / 2 * s;
        var chamfer = Math.min(0.1 * d * s, 8);
        var rootPx = Math.max(minorDiameter(d, pitch) / 2 * s, shankR * 0.5);
        var threadEnd = endX - chamfer;
        var threadStart = fullyThreaded
            ? underHead
            : Math.max(underHead, endX - threadLength * s);
        var pitchPx = Math.max(pitch * s, 1);

        var kRow = viewTop - 28;
        var bRow = viewBottom + 26;
        var lRow = viewBottom + (fullyThreaded ? 32 : 68);
        var dkX = frontCx - frontRadius - 26;
        var sDimY = axisY + hexR * 0.5 + 16;
        var sRight = frontCx + frontRadius + 12;
        var dX = endX + 28;
        var pRow = top - 16;
        var crestFlat = 0.125 * pitchPx;
        var threadSpan = Math.max(threadEnd - threadStart, pitchPx * 2);
        var pitchIndex = Math.max(1, Math.floor(threadSpan / pitchPx * 0.55));
        var pX1 = threadStart + pitchIndex * pitchPx + crestFlat / 2;
        var pX2 = pX1 + pitchPx;
        var parts = [];

        if (pX2 > threadEnd - 2) {
            pX2 = threadEnd - 2;
            pX1 = pX2 - pitchPx;
        }

        function hDim(x1, x2, y, key, cands) {
            var tight = (x2 - x1) < 26;

            return svgLine("fastener-dim", tight ? x1 - 26 : x1, y,
                    tight ? x2 + 26 : x2, y) +
                svgArrow(x1, y, tight ? 0 : 180) +
                svgArrow(x2, y, tight ? 180 : 0) +
                placeText(dimText(key), cands, key);
        }

        function vDim(y1, y2, x, key, cands) {
            var tight = (y2 - y1) < 26;

            return svgLine("fastener-dim", x, tight ? y1 - 26 : y1, x,
                    tight ? y2 + 26 : y2) +
                svgArrow(x, y1, tight ? 90 : -90) +
                svgArrow(x, y2, tight ? -90 : 90) +
                placeText(dimText(key), cands, key);
        }

        layoutReset();

        /* ---------------- top view: the head seen on its face ---------- */

        parts.push(svgCircle("fastener-part", frontCx, axisY, frontRadius));
        parts.push(svgPolygon("fastener-part-line",
            hexPoints(frontCx, axisY, hexR)));
        parts.push(centreCross(frontCx, axisY, frontRadius));
        layoutKeep(frontCx - frontRadius, viewTop, frontCx + frontRadius, viewBottom);

        /* ---------------- side view: head, socket, shank, thread ------- */

        parts.push(svgBox("fastener-part", headLeft, viewTop, underHead, viewBottom));
        parts.push(svgPath("fastener-hidden",
            boxPath(headLeft, axisY - socketHalf, headLeft + socketDepth * s,
                axisY + socketHalf)));

        var topEdge = studThreadEdge(threadStart, threadEnd, axisY, shankR,
            rootPx, pitchPx, -1);
        var bottomEdge = studThreadEdge(threadStart, threadEnd, axisY, shankR,
            rootPx, pitchPx, 1);
        var outline = "M" + coord(underHead) + " " + coord(top) +
            " H" + coord(threadStart);
        var i;

        for (i = 1; i < topEdge.length; i += 1) {
            outline += " L" + coord(topEdge[i][0]) + " " + coord(topEdge[i][1]);
        }

        outline += " L" + coord(endX) + " " + coord(top + chamfer) +
            " L" + coord(endX) + " " + coord(bottom - chamfer) +
            " L" + coord(threadEnd) + " " + coord(bottom);

        for (i = 1; i < bottomEdge.length; i += 1) {
            var point = bottomEdge[bottomEdge.length - 1 - i];

            outline += " L" + coord(point[0]) + " " + coord(point[1]);
        }

        outline += " H" + coord(underHead) + " Z";
        parts.push(svgPath("fastener-part", outline));

        if (!fullyThreaded) {
            /* Thread runout: the boundary between the plain shank and the
               thread, drawn only where that boundary really exists. */
            parts.push(svgLine("fastener-part", threadStart, top,
                threadStart, bottom));
        }

        parts.push(svgLine("fastener-centre", headLeft - 16, axisY,
            endX + 16, axisY));
        layoutKeep(headLeft, viewTop, underHead, viewBottom);
        layoutKeep(underHead, top, endX, bottom);

        /* ---------------- dk: across the head, top view ---------------- */

        parts.push(svgLine("fastener-ext", frontCx - 5, viewTop, dkX - 7, viewTop));
        parts.push(svgLine("fastener-ext", frontCx - 6, viewBottom, dkX - 7, viewBottom));
        parts.push(vDim(viewTop, viewBottom, dkX, "headDiameter", [
            { x: dkX - 18, y: (viewTop + viewBottom) / 2, anchor: "middle", rotate: true },
            { x: dkX - 36, y: (viewTop + viewBottom) / 2, anchor: "middle", rotate: true }
        ]));

        /* ---------------- s: across the socket flats, top view --------- */

        parts.push(svgLine("fastener-ext", frontCx - socketHalf,
            axisY + hexR * 0.5 + 3, frontCx - socketHalf, sDimY - 6));
        parts.push(svgLine("fastener-ext", frontCx + socketHalf,
            axisY + hexR * 0.5 + 3, frontCx + socketHalf, sDimY - 6));
        parts.push(svgLine("fastener-dim", frontCx - socketHalf, sDimY,
            sRight, sDimY));
        parts.push(svgArrow(frontCx - socketHalf, sDimY, 180));
        parts.push(svgArrow(frontCx + socketHalf, sDimY, 0));
        parts.push(placeText(dimText("socketAcrossFlats"), [
            { x: sRight + 8, y: sDimY + 5, anchor: "start" },
            { x: sRight + 8, y: sDimY - 13, anchor: "start" }
        ], "socketAcrossFlats"));

        /* ---------------- k: head height, above the head ---------------- */

        parts.push(svgLine("fastener-ext", headLeft, viewTop - 4,
            headLeft, kRow - 6));
        parts.push(svgLine("fastener-ext", underHead, viewTop - 4,
            underHead, kRow - 6));
        /* The head height is a short dimension, so its value sits above the
           dimension line: that leaves the whole band between the head and the
           thread free for the pitch note. */
        parts.push(hDim(headLeft, underHead, kRow, "headHeight", [
            { x: (headLeft + underHead) / 2, y: kRow - 10, anchor: "middle" },
            { x: underHead + 15, y: kRow + 5, anchor: "start" },
            { x: headLeft - 15, y: kRow + 5, anchor: "end" }
        ]));

        /* ---------------- b: threaded length, only when partial ------ */

        if (!fullyThreaded) {
            parts.push(svgLine("fastener-ext", threadStart, bottom + 4,
                threadStart, bRow + 6));
            parts.push(svgLine("fastener-ext", endX, bottom - chamfer + 4,
                endX, bRow + 6));
            parts.push(hDim(threadStart, endX, bRow, "threadLength", [
                { x: (threadStart + endX) / 2, y: bRow + 19, anchor: "middle" },
                { x: (threadStart + endX) / 2, y: bRow + 38, anchor: "middle" }
            ]));
        }

        /* ---------------- L: bearing face to tip ------------------------ */

        parts.push(svgLine("fastener-ext", underHead, viewBottom + 4,
            underHead, lRow + 6));
        parts.push(svgLine("fastener-ext", endX, bottom - chamfer + 4,
            endX, lRow + 6));
        parts.push(hDim(underHead, endX, lRow, "length", [
            { x: (underHead + endX) / 2, y: lRow + 19, anchor: "middle" },
            { x: (underHead + endX) / 2, y: lRow + 38, anchor: "middle" }
        ]));

        /* ---------------- d: across the thread --------------------------- */

        parts.push(svgLine("fastener-ext", threadEnd + 1, top, dX + 7, top));
        parts.push(svgLine("fastener-ext", threadEnd + 1, bottom, dX + 7, bottom));
        parts.push(vDim(top, bottom, dX, "diameter", [
            { x: dX + 18, y: (top + bottom) / 2, anchor: "middle", rotate: true },
            { x: dX + 36, y: (top + bottom) / 2, anchor: "middle", rotate: true }
        ]));

        /* ---------------- P: between two consecutive crests ------------- */

        parts.push(svgLine("fastener-ext", pX1, top, pX1, pRow + 6));
        parts.push(svgLine("fastener-ext", pX2, top, pX2, pRow + 6));
        parts.push(svgLine("fastener-dim", pX1 - 26, pRow, pX2 + 26, pRow));
        parts.push(svgArrow(pX1, pRow, 0));
        parts.push(svgArrow(pX2, pRow, 180));
        parts.push(placeText(dimText("pitch"), [
            { x: (pX1 + pX2) / 2 - 10, y: pRow - 10, anchor: "middle" },
            { x: (pX1 + pX2) / 2 - 10, y: pRow - 32, anchor: "middle" },
            { x: pX2 + 30, y: pRow - 10, anchor: "start" },
            { x: pX1 - 30, y: pRow - 10, anchor: "end" }
        ], "pitch"));

        /* ---------------- t: socket depth, from the top face ------------ */

        parts.push(leaderNote({
            to: [headLeft + socketDepth * s, axisY + socketHalf],
            key: "socketDepth",
            cands: [
                { x: headLeft - 12, y: viewBottom + 22, anchor: "end" },
                { x: headLeft - 12, y: viewBottom + 46, anchor: "end" },
                { x: headLeft - 12, y: viewTop - 28, anchor: "end" }
            ]
        }));

        var content = sheetChrome() + parts.join("") +
            viewCaption("TOP VIEW", frontCx) +
            viewCaption("SIDE VIEW", (underHead + endX) / 2);

        return {
            svg: sheetSvg(product.name +
                ", top view and side view, dimensions in " + unitWord(), content),
            caption: String(tr(product.name)).trim() + " — " +
                String(tr("top view and side view, dimensions in")).trim() + " " + unitWord()
        };
    }

    /* ==================================================
       CARRIAGE BOLT SHEET
       DIN 603 / ISO 8677.

       The drawing is built from the same millimetre values the weight formula
       integrates, so the picture and the mass always describe one bolt:

       * the head is the spherical cap of the volume formula - base diameter
         dk, height k, crown radius R = (r² + k²) / (2k) - not an arbitrary
         ellipse, so the silhouette and the integrated volume agree;
       * the square neck is a real prism of side v and height f, drawn as a
         visible square in the view on the head and as a shoulder in the side
         view, where it is slightly wider than the shank just as the standard
         requires (v > d);
       * the thread is the true ISO 60 degree form at the selected pitch, so
         adjacent crests exist and P can be dimensioned between two of them;
       * L is measured from the bearing face under the head to the tip and
         therefore includes the neck and the thread, never the head height;
       * dimensions are chained (k and f share one witness line at the bearing
         face), all labels sit outside the part, and no two dimension lines
         share a row.
    ================================================== */

    function carriageSheet(product) {
        /* The picture is drawn from the figures in the form, in millimetres, so
           the silhouette and the labels always describe the same bolt. A field
           that is empty or unusable falls back to the catalogued sample of the
           selected standard. */
        var ref = fixedBoltGeometry(product);
        var d = fieldMM("diameter", ref.diameter);
        var pitch = fieldMM("pitch", ref.pitch);
        var length = Math.max(fieldMM("length", ref.length), 1);
        var headDiameter = Math.max(fieldMM("headDiameter", ref.headDiameter), d * 0.5);
        var headHeight = Math.max(fieldMM("headHeight", ref.headHeight), 0.2);
        var neckWidth = Math.max(fieldMM("neckAcrossFlats", ref.neckAcrossFlats), 0.2);
        var neckHeight = Math.max(fieldMM("neckHeight", ref.neckHeight), 0.2);
        var threadLength = clamp(fieldMM("threadLength", ref.threadLength),
            0.5, length);

        /* A neck taller than the bolt cannot be drawn; the drawing keeps its
           own proportions and the fields keep the values the visitor typed. */
        if (neckHeight > length - 0.5) {
            neckHeight = Math.max(length - 0.5, 0.2);
        }

        /* Sheet zones. The head block reserves the dk dimension on its left
           and the v dimension, with its value outside the circle, on its
           right; the side view reserves the chained k/f band above and the
           b/L band below. */
        var margin = 24;
        var frontPad = 58;
        var vPad = 140;
        var sidePad = 74;
        var topBand = 68;
        var bottomBand = 90;
        var topLimit = 58;
        var bottomLimit = 350;

        /* L runs from the bearing face, so the head adds its own height to
           the length of the elevation; both are part of the fit. */
        var axialLength = headHeight + length;
        var room = (bottomLimit - topLimit) - topBand - bottomBand;
        var scale = Math.min(
            (SHEET.width - 2 * margin - frontPad - vPad - sidePad) /
                Math.max(headDiameter + axialLength, 1),
            room / Math.max(headDiameter, 1),
            12
        );

        scale = Math.max(scale, 0.8);

        var s = scale;
        var frontRadius = headDiameter / 2 * s;
        var contentW = frontPad + headDiameter * s + vPad +
            axialLength * s + sidePad;
        var leftOrigin = Math.max(margin, (SHEET.width - contentW) / 2);
        var frontCx = leftOrigin + frontPad + frontRadius;
        var headLeft = frontCx + frontRadius + vPad;
        var underHead = headLeft + headHeight * s;
        var shankStart = underHead + neckHeight * s;
        var endX = underHead + length * s;

        var viewH = headDiameter * s;
        var viewTop = topLimit + topBand + (room - viewH) / 2;
        var viewBottom = viewTop + viewH;
        var axisY = viewTop + viewH / 2;
        var shankR = d / 2 * s;
        var top = axisY - shankR;
        var bottom = axisY + shankR;
        var neckHalf = neckWidth / 2 * s;
        var chamfer = Math.min(0.1 * d * s, 8);
        var rootPx = Math.max(minorDiameter(d, pitch) / 2 * s, shankR * 0.5);
        var threadEnd = endX - chamfer;
        var threadStart = Math.max(shankStart, endX - threadLength * s);
        var pitchPx = Math.max(pitch * s, 1);

        /* Crown radius of the head, the same sphere the mass formula uses. */
        var crownMM = (Math.pow(headDiameter / 2, 2) + headHeight * headHeight) /
            (2 * headHeight);
        if (!isFinite(crownMM) || crownMM < headDiameter / 2) {
            crownMM = headDiameter / 2;
        }
        var crownPx = crownMM * s;

        var kRow = viewTop - 54;
        var fRow = viewTop - 26;
        var bRow = viewBottom + 26;
        var lRow = viewBottom + 64;
        var dkX = frontCx - frontRadius - 26;
        var vDimY = axisY + neckHalf + 18;
        var vRight = frontCx + frontRadius + 12;
        var dX = endX + 28;
        var pRow = top - 16;
        var crestFlat = 0.125 * pitchPx;
        var pitchSpan = Math.max(threadEnd - threadStart, pitchPx * 2);
        var pitchIndex = Math.max(1,
            Math.floor(pitchSpan / pitchPx * 0.55));
        var pX1 = threadStart + pitchIndex * pitchPx + crestFlat / 2;
        var pX2 = pX1 + pitchPx;
        var parts = [];

        if (pX2 > threadEnd - 2) {
            pX2 = threadEnd - 2;
            pX1 = pX2 - pitchPx;
        }

        function hDim(x1, x2, y, key, cands) {
            var tight = (x2 - x1) < 26;

            return svgLine("fastener-dim", tight ? x1 - 26 : x1, y,
                    tight ? x2 + 26 : x2, y) +
                svgArrow(x1, y, tight ? 0 : 180) +
                svgArrow(x2, y, tight ? 180 : 0) +
                placeText(dimText(key), cands, key);
        }

        function vDim(y1, y2, x, key, cands) {
            var tight = (y2 - y1) < 26;

            return svgLine("fastener-dim", x, tight ? y1 - 26 : y1, x,
                    tight ? y2 + 26 : y2) +
                svgArrow(x, y1, tight ? 90 : -90) +
                svgArrow(x, y2, tight ? -90 : 90) +
                placeText(dimText(key), cands, key);
        }

        layoutReset();

        /* ---------------- front view: head seen on top ---------------- */

        parts.push(svgCircle("fastener-part", frontCx, axisY, frontRadius));
        /* The square neck lies under the dome, but it is the feature the
           wrench and the timber see, so it is drawn as a visible edge inside
           the head circle rather than as a dashed hidden outline. */
        parts.push(svgBox("fastener-part-line", frontCx - neckHalf,
            axisY - neckHalf, frontCx + neckHalf, axisY + neckHalf));
        parts.push(centreCross(frontCx, axisY, frontRadius));
        layoutKeep(frontCx - frontRadius, viewTop, frontCx + frontRadius, viewBottom);

        /* ---------------- side view: dome, neck, shank, thread -------- */

        parts.push(svgPath("fastener-part",
            "M" + coord(underHead) + " " + coord(viewTop) +
            " A" + coord(crownPx) + " " + coord(crownPx) + " 0 0 0 " +
            coord(underHead) + " " + coord(viewBottom) + " Z"));

        parts.push(svgBox("fastener-part", underHead, axisY - neckHalf,
            shankStart, axisY + neckHalf));

        var topEdge = studThreadEdge(threadStart, threadEnd, axisY, shankR,
            rootPx, pitchPx, -1);
        var bottomEdge = studThreadEdge(threadStart, threadEnd, axisY, shankR,
            rootPx, pitchPx, 1);
        var outline = "M" + coord(shankStart) + " " + coord(top) +
            " H" + coord(threadStart);
        var i;

        for (i = 1; i < topEdge.length; i += 1) {
            outline += " L" + coord(topEdge[i][0]) + " " + coord(topEdge[i][1]);
        }

        outline += " L" + coord(endX) + " " + coord(top + chamfer) +
            " L" + coord(endX) + " " + coord(bottom - chamfer) +
            " L" + coord(threadEnd) + " " + coord(bottom);

        for (i = 1; i < bottomEdge.length; i += 1) {
            var point = bottomEdge[bottomEdge.length - 1 - i];

            outline += " L" + coord(point[0]) + " " + coord(point[1]);
        }

        outline += " H" + coord(shankStart) + " Z";
        parts.push(svgPath("fastener-part", outline));

        /* Thread runout: the boundary between the plain shank and the thread. */
        parts.push(svgLine("fastener-part", threadStart, top, threadStart, bottom));
        parts.push(svgLine("fastener-centre", headLeft - 16, axisY,
            endX + 16, axisY));

        layoutKeep(headLeft, viewTop, underHead, viewBottom);
        layoutKeep(underHead, Math.min(top, axisY - neckHalf), endX,
            Math.max(bottom, axisY + neckHalf));

        /* ---------------- dk: across the head, front view --------------- */

        parts.push(svgLine("fastener-ext", frontCx - 5, viewTop, dkX - 7, viewTop));
        parts.push(svgLine("fastener-ext", frontCx - 6, viewBottom, dkX - 7, viewBottom));
        parts.push(vDim(viewTop, viewBottom, dkX, "headDiameter", [
            { x: dkX - 18, y: (viewTop + viewBottom) / 2, anchor: "middle", rotate: true },
            { x: dkX - 36, y: (viewTop + viewBottom) / 2, anchor: "middle", rotate: true }
        ]));

        /* ---------------- v: across the square neck flats --------------- */

        parts.push(svgLine("fastener-ext", frontCx - neckHalf, axisY + neckHalf + 3,
            frontCx - neckHalf, vDimY - 6));
        parts.push(svgLine("fastener-ext", frontCx + neckHalf, axisY + neckHalf + 3,
            frontCx + neckHalf, vDimY - 6));
        parts.push(svgLine("fastener-dim", frontCx - neckHalf, vDimY,
            vRight, vDimY));
        parts.push(svgArrow(frontCx - neckHalf, vDimY, 180));
        parts.push(svgArrow(frontCx + neckHalf, vDimY, 0));
        parts.push(placeText(dimText("neckAcrossFlats"), [
            { x: vRight + 8, y: vDimY + 5, anchor: "start" },
            { x: vRight + 8, y: vDimY - 13, anchor: "start" }
        ], "neckAcrossFlats"));

        /* ---------------- k and f: chained at the bearing face ---------- */

        parts.push(svgLine("fastener-ext", headLeft, axisY - 4, headLeft, kRow - 6));
        parts.push(svgLine("fastener-ext", underHead, viewTop - 4, underHead, kRow - 6));
        parts.push(hDim(headLeft, underHead, kRow, "headHeight", [
            { x: underHead + 15, y: kRow + 5, anchor: "start" },
            { x: headLeft - 15, y: kRow + 5, anchor: "end" },
            { x: (headLeft + underHead) / 2, y: kRow - 11, anchor: "middle" }
        ]));

        /* Chained with k at the bearing face: one witness line serves both
           dimensions, and it starts at the top of that face so it never runs
           along the outline. */
        parts.push(svgLine("fastener-ext", underHead, viewTop - 4,
            underHead, fRow - 6));
        parts.push(svgLine("fastener-ext", shankStart, axisY - neckHalf - 4,
            shankStart, fRow - 6));
        parts.push(hDim(underHead, shankStart, fRow, "neckHeight", [
            { x: shankStart + 15, y: fRow + 5, anchor: "start" },
            { x: underHead - 15, y: fRow + 5, anchor: "end" },
            { x: (underHead + shankStart) / 2, y: fRow - 11, anchor: "middle" }
        ]));

        /* ---------------- b: threaded length, runout to tip ------------- */

        parts.push(svgLine("fastener-ext", threadStart, bottom + 4,
            threadStart, bRow + 6));
        parts.push(svgLine("fastener-ext", endX, bottom - chamfer + 4,
            endX, bRow + 6));
        parts.push(hDim(threadStart, endX, bRow, "threadLength", [
            { x: (threadStart + endX) / 2, y: bRow + 19, anchor: "middle" },
            { x: (threadStart + endX) / 2, y: bRow + 38, anchor: "middle" }
        ]));

        /* ---------------- L: bearing face to tip ------------------------ */

        parts.push(svgLine("fastener-ext", underHead, viewBottom + 4,
            underHead, lRow + 6));
        parts.push(svgLine("fastener-ext", endX, bottom - chamfer + 4,
            endX, lRow + 6));
        parts.push(hDim(underHead, endX, lRow, "length", [
            { x: (underHead + endX) / 2, y: lRow + 19, anchor: "middle" },
            { x: (underHead + endX) / 2, y: lRow + 38, anchor: "middle" }
        ]));

        /* ---------------- d: across the thread -------------------------- */

        /* The witness lines leave the thread where its crest ends, so they
           never double the crest line itself. */
        parts.push(svgLine("fastener-ext", threadEnd + 1, top, dX + 7, top));
        parts.push(svgLine("fastener-ext", threadEnd + 1, bottom, dX + 7, bottom));
        parts.push(vDim(top, bottom, dX, "diameter", [
            { x: dX + 18, y: (top + bottom) / 2, anchor: "middle", rotate: true },
            { x: dX + 36, y: (top + bottom) / 2, anchor: "middle", rotate: true }
        ]));

        /* ---------------- P: between two consecutive crests ------------- */

        parts.push(svgLine("fastener-ext", pX1, top, pX1, pRow + 6));
        parts.push(svgLine("fastener-ext", pX2, top, pX2, pRow + 6));
        parts.push(svgLine("fastener-dim", pX1 - 26, pRow, pX2 + 26, pRow));
        parts.push(svgArrow(pX1, pRow, 0));
        parts.push(svgArrow(pX2, pRow, 180));
        /* The value is wider than the space between two crests, so it is set
           beside the dimension line, far enough left of the d dimension to
           keep its rotated label clear. */
        parts.push(placeText(dimText("pitch"), [
            { x: (pX1 + pX2) / 2 - 10, y: pRow - 10, anchor: "middle" },
            { x: (pX1 + pX2) / 2 - 10, y: pRow - 32, anchor: "middle" },
            { x: pX2 + 30, y: pRow - 10, anchor: "start" },
            { x: pX1 - 30, y: pRow - 10, anchor: "end" }
        ], "pitch"));

        var content = sheetChrome() + parts.join("") +
            viewCaptions(frontCx, (underHead + endX) / 2);

        return {
            svg: sheetSvg(product.name +
                ", front view and side view, dimensions in " + unitWord(), content),
            caption: String(tr(product.name)).trim() + " — " +
                String(tr("front view and side view, dimensions in")).trim() + " " + unitWord()
        };
    }

    /* ==================================================
       COUNTERSUNK SOCKET SCREW SHEET
       DIN 7991 / ISO 10642.

       The part itself is the same 90 degree countersunk head, shank and
       thread drawn everywhere else; what changes here is only how it is
       annotated. The layout is built from the real feature positions:

       * both views share one millimetre scale, so the front circle and the
         side elevation are the same head and the pair reads as one
         orthographic drawing;
       * every dimension owns its own band - dk to the left of the front view,
         k above the head, b and L below the shank, d at the tip - so no two
         dimension lines ever share a row;
       * the three leader notes (s, t, P) sit in the free space above the
         socket, below the head and above the shank, well clear of the
         countersunk profile and of each other;
       * witness lines start with the customary gap from the outline and run
         just past their dimension line, and every arrowhead is the same
         solid head with its tip exactly on the reference point.
    ================================================== */

    function countersunkSheet(product) {
        var geo = fixedBoltGeometry(product);
        var d = geo.diameter;
        var pitch = geo.pitch;
        var length = Math.max(geo.length, 1);
        var headHeight = geo.headHeight;
        var headDiameter = geo.headDiameter;
        var socketWidth = geo.socketAcrossFlats;
        var socketDepth = geo.socketDepth;
        var threadLength = clamp(geo.threadLength, 0.5, length);

        /* Sheet zones. Each annotation band is reserved before the geometry is
           scaled, so no dimension can be pushed off the sheet or into another
           dimension when the screw size changes. */
        var margin = 24;
        var frontPad = 58;      /* dk dimension and its label, left of the circle */
        var gap = 54;           /* clear space between the two views */
        var sidePad = 78;       /* d dimension and its label, right of the tip */
        var topBand = 46;       /* k dimension above the head */
        var bottomBand = 92;    /* b and L dimensions below the shank */
        var topLimit = 58;
        var bottomLimit = 350;

        var room = (bottomLimit - topLimit) - topBand - bottomBand;
        var scale = Math.min(
            (SHEET.width - 2 * margin - frontPad - gap - sidePad) /
                Math.max(headDiameter + length, 1),
            room / Math.max(headDiameter, 1),
            7
        );

        scale = Math.max(scale, 0.8);

        var s = scale;
        var frontRadius = headDiameter / 2 * s;
        var contentW = frontPad + headDiameter * s + gap + length * s + sidePad;
        var leftOrigin = Math.max(margin, (SHEET.width - contentW) / 2);
        var frontCx = leftOrigin + frontPad + frontRadius;
        var headLeft = frontCx + frontRadius + gap;
        var underHead = headLeft + headHeight * s;
        var endX = headLeft + length * s;

        var viewH = headDiameter * s;
        var viewTop = topLimit + topBand + (room - viewH) / 2;
        var viewBottom = viewTop + viewH;
        var axisY = viewTop + viewH / 2;
        var shankRadius = d / 2 * s;
        var top = axisY - shankRadius;
        var bottom = axisY + shankRadius;
        var chamfer = Math.min(0.1 * d * s, 8);
        var rootPx = Math.max(minorDiameter(d, pitch) / 2 * s, shankRadius * 0.5);
        var socketHalf = socketWidth / 2 * s;
        var socketDepthPx = socketDepth * s;
        var socketHex = socketWidth / COS30 / 2 * s;
        var threadStart = Math.max(underHead, endX - threadLength * s);
        var hasThreadLength = threadLength < length - 0.01;
        var threadEnd = endX - chamfer;
        var pitchX = threadStart +
            Math.max(threadEnd - threadStart, 1) * 0.45;

        var kRow = viewTop - 28;
        var bRow = viewBottom + 26;
        var lRow = viewBottom + 68;
        var dkX = frontCx - frontRadius - 26;
        var dX = endX + 32;
        var parts = [];

        /* A dimension shorter than two arrowheads is drawn with its arrows
           outside the extension lines, exactly as a draughtsman would. */
        function hDim(x1, x2, y, key, cands) {
            var tight = (x2 - x1) < 26;

            return svgLine("fastener-dim", tight ? x1 - 26 : x1, y,
                    tight ? x2 + 26 : x2, y) +
                svgArrow(x1, y, tight ? 0 : 180) +
                svgArrow(x2, y, tight ? 180 : 0) +
                placeText(dimText(key), cands, key);
        }

        function vDim(y1, y2, x, key, cands) {
            var tight = (y2 - y1) < 26;

            return svgLine("fastener-dim", x, tight ? y1 - 26 : y1, x,
                    tight ? y2 + 26 : y2) +
                svgArrow(x, y1, tight ? 90 : -90) +
                svgArrow(x, y2, tight ? -90 : 90) +
                placeText(dimText(key), cands, key);
        }

        layoutReset();

        /* ---------------- front view: geometry ---------------- */

        parts.push(svgCircle("fastener-part", frontCx, axisY, frontRadius));
        parts.push(svgPolygon("fastener-part-line",
            hexPoints(frontCx, axisY, socketHex)));
        parts.push(centreCross(frontCx, axisY, frontRadius));
        layoutKeep(frontCx - frontRadius, viewTop, frontCx + frontRadius, viewBottom);

        /* ---------------- side view: geometry ---------------- */

        /* 90 degree countersunk head: the full head diameter at the top face,
           the shank diameter where the cone meets the shank. */
        parts.push(svgPath("fastener-part",
            "M" + coord(headLeft) + " " + coord(viewTop) +
            " L" + coord(underHead) + " " + coord(top) +
            " L" + coord(underHead) + " " + coord(bottom) +
            " L" + coord(headLeft) + " " + coord(viewBottom) + " Z"));

        /* Hexagon socket, hidden inside the head. */
        parts.push(svgPath("fastener-hidden",
            boxPath(headLeft, axisY - socketHalf, headLeft + socketDepthPx,
                axisY + socketHalf)));

        parts.push(svgPath("fastener-part",
            "M" + coord(underHead) + " " + coord(top) +
            " H" + coord(threadEnd) +
            " L" + coord(endX) + " " + coord(top + chamfer) +
            " V" + coord(bottom - chamfer) +
            " L" + coord(threadEnd) + " " + coord(bottom) +
            " H" + coord(underHead) + " Z"));

        parts.push(threadRootH(threadStart, threadEnd, axisY, rootPx));

        if (threadStart > underHead + 1) {
            parts.push(svgLine("fastener-part", threadStart, top,
                threadStart, bottom));
        }

        parts.push(svgLine("fastener-centre", headLeft - 16, axisY,
            endX + 16, axisY));

        layoutKeep(headLeft, viewTop, underHead, viewBottom);
        layoutKeep(underHead, top, endX, bottom);

        /* ---------------- front view: dk ---------------- */

        parts.push(svgLine("fastener-ext", frontCx - 5, viewTop, dkX - 7, viewTop));
        parts.push(svgLine("fastener-ext", frontCx - 6, viewBottom, dkX - 7, viewBottom));
        parts.push(vDim(viewTop, viewBottom, dkX, "headDiameter", [
            { x: dkX - 18, y: (viewTop + viewBottom) / 2, anchor: "middle", rotate: true },
            { x: dkX - 36, y: (viewTop + viewBottom) / 2, anchor: "middle", rotate: true }
        ]));

        /* ---------------- front view: s, leader to a socket corner ------- */

        parts.push(leaderNote({
            to: [frontCx + socketHex * Math.cos(-Math.PI / 6),
                axisY + socketHex * Math.sin(-Math.PI / 6)],
            key: "socketAcrossFlats",
            /* The label sits above the circle and to the left of its centre,
               so the leader can reach the socket corner without crossing the
               vertical centre line or running into the k dimension band of
               the side view. */
            cands: [
                { x: frontCx - 68, y: viewTop - 22, anchor: "middle" },
                { x: frontCx - 68, y: viewTop - 46, anchor: "middle" },
                { x: frontCx - 30, y: viewTop - 46, anchor: "middle" },
                { x: frontCx - 30, y: viewTop - 22, anchor: "middle" }
            ]
        }));

        /* ---------------- side view: k above the head ---------------- */

        parts.push(svgLine("fastener-ext", headLeft, viewTop - 4,
            headLeft, kRow - 6));
        parts.push(svgLine("fastener-ext", underHead, top - 4,
            underHead, kRow - 6));
        parts.push(hDim(headLeft, underHead, kRow, "headHeight", [
            { x: underHead + 15, y: kRow + 5, anchor: "start" },
            { x: headLeft - 15, y: kRow + 5, anchor: "end" },
            { x: (headLeft + underHead) / 2, y: kRow - 11, anchor: "middle" }
        ]));

        /* ---------------- side view: b under the threaded end ------------- */

        if (hasThreadLength) {
            parts.push(svgLine("fastener-ext", threadStart, bottom + 4,
                threadStart, bRow + 6));
            parts.push(svgLine("fastener-ext", endX, bottom - chamfer + 4,
                endX, bRow + 6));
            parts.push(hDim(threadStart, endX, bRow, "threadLength", [
                { x: (threadStart + endX) / 2, y: bRow + 19, anchor: "middle" },
                { x: (threadStart + endX) / 2, y: bRow + 38, anchor: "middle" }
            ]));
        }

        /* ---------------- side view: L below the screw ---------------- */

        parts.push(svgLine("fastener-ext", headLeft, viewBottom + 4,
            headLeft, lRow + 6));
        parts.push(svgLine("fastener-ext", endX, bottom - chamfer + 4,
            endX, lRow + 6));
        parts.push(hDim(headLeft, endX, lRow, "length", [
            { x: (headLeft + endX) / 2, y: lRow + 19, anchor: "middle" },
            { x: (headLeft + endX) / 2, y: lRow + 38, anchor: "middle" }
        ]));

        /* ---------------- side view: d at the tip ---------------- */

        parts.push(svgLine("fastener-ext", threadEnd - 2, top, dX + 7, top));
        parts.push(svgLine("fastener-ext", threadEnd - 2, bottom, dX + 7, bottom));
        parts.push(vDim(top, bottom, dX, "diameter", [
            { x: dX + 18, y: (top + bottom) / 2, anchor: "middle", rotate: true },
            { x: dX + 36, y: (top + bottom) / 2, anchor: "middle", rotate: true }
        ]));

        /* ---------------- side view: t, leader into the socket ----------- */

        parts.push(leaderNote({
            to: [headLeft + socketDepthPx, axisY + socketHalf],
            key: "socketDepth",
            cands: [
                { x: headLeft - 12, y: viewBottom + 22, anchor: "end" },
                { x: headLeft - 12, y: viewBottom + 46, anchor: "end" },
                { x: headLeft - 12, y: viewTop - 28, anchor: "end" }
            ]
        }));

        /* ---------------- side view: P, leader to the thread -------------- */

        parts.push(leaderNote({
            to: [pitchX, axisY - rootPx],
            key: "pitch",
            cands: [
                { x: pitchX, y: top - 26, anchor: "middle" },
                { x: pitchX + 34, y: top - 26, anchor: "start" },
                { x: pitchX - 34, y: top - 26, anchor: "end" },
                { x: pitchX, y: top - 50, anchor: "middle" }
            ]
        }));

        var content = sheetChrome() + parts.join("") +
            viewCaptions(frontCx, (headLeft + endX) / 2);

        return {
            svg: sheetSvg(product.name +
                ", front view and side view, dimensions in " + unitWord(), content),
            caption: String(tr(product.name)).trim() + " — " +
                String(tr("front view and side view, dimensions in")).trim() + " " + unitWord()
        };
    }

    /* ==================================================
       BOLTS, SCREWS AND HEX HEAD BLANKS
    ================================================== */

    function boltSheet(product) {
        /* Countersunk socket screws and carriage bolts carry their own
           annotation layout; every other head form keeps the shared one
           below. */
        if (product.drawing === "countersunk") {
            return countersunkSheet(product);
        }

        if (product.drawing === "carriage") {
            return carriageSheet(product);
        }

        if (product.drawing === "socket") {
            return socketSheet(product);
        }

        /* A hexagon head bolt is drawn from the form itself. The selected
           standard and size fill those fields, so the sheet carries the
           geometry of the selected standard: BS EN ISO 4014 M10 x 50 draws
           d 10, s 16, k 6.4 and b 26, while the same figures from another
           adopter draw exactly what that table specifies. The reference
           geometry only covers an empty or unreadable field. */
        var ref = fixedBoltGeometry(product);

        var d = Math.max(fieldMM("diameter", ref.diameter), 0.5);
        var pitch = Math.max(fieldMM("pitch", ref.pitch), 0.05);
        var length = Math.max(fieldMM("length", ref.length), 1);
        var acrossFlats = Math.max(fieldMM("acrossFlats", ref.acrossFlats), d * 0.5);
        var headHeight = Math.max(fieldMM("headHeight", ref.headHeight), 0.2);
        var headDiameter = Math.max(ref.headDiameter, d);
        var socketWidth = ref.socketAcrossFlats;
        var socketDepth = ref.socketDepth;
        var neckWidth = ref.neckAcrossFlats;
        var neckHeight = ref.neckHeight;

        var hexHead = product.drawing === "hex" || product.drawing === "blank";
        var countersunk = product.drawing === "countersunk";
        var socketHead = product.drawing === "socket" || countersunk;
        var carriage = product.drawing === "carriage";
        var threaded = product.drawing !== "blank";
        /* Hex heads dimension s under the front view; every other head form
           carries a vertical diameter dimension on its right side. */
        var frontDimOnRight = !hexHead;
        var hasThreadLength = product.fields.indexOf("threadLength") >= 0;
        var threadLength = threaded
            ? (hasThreadLength
                ? clamp(fieldMM("threadLength", ref.threadLength), 0.5, length)
                : length)
            : 0;

        var corners = acrossFlats / COS30;
        /* The head silhouette is the same in both views: across corners for a
           hexagon, the head diameter for every round head. */
        var frontExtent = hexHead ? corners : headDiameter;
        var sideHeight = frontExtent;
        /* ISO 10642 measures the screw length over the head: the head is part
           of L. Every other product measures from the bearing face. */
        var axisLength = countersunk ? length : headHeight + length;

        var maxFrontSc = Math.min(
            (SHEET.width * 0.34 - 44) / Math.max(frontExtent, 1),
            (AREA.bottom - AREA.top - 106) / Math.max(frontExtent, sideHeight, 1),
            12.5
        );
        var maxSideSc = Math.min(
            (SHEET.width * 0.62 - 90) / Math.max(axisLength, 1),
            (AREA.bottom - AREA.top - 106) / Math.max(sideHeight, d, 1),
            12.5
        );
        var sl = Math.max(0.25, Math.min(maxSideSc, maxFrontSc));
        /* The end view never shrinks below a readable size on a long bolt.
           Its larger scale is not described on the drawing. */
        var sc = Math.max(0.25, Math.min(maxFrontSc,
            Math.max(sl * 1.35, 100 / Math.max(frontExtent, 1))));
        if (d * sl >= 22) {
            sc = sl;
        }

        var frontRadius = frontExtent / 2 * sc;
        /* The right pad reserves room for a front-view diameter dimension and
           its rotated label, so it can never reach the head of the side view. */
        var frontPad = frontDimOnRight ? 96 : 26;
        /* The box hugs its own drawing plus that pad. An inflated minimum width
           would leave the front view floating in dead space beside the side
           view, which is what made the pair look off centre. */
        var frontBoxWidth = frontRadius * 2 + frontPad;
        var sidePadLeft = 42;
        /* The right pad reserves room for the diameter dimension at the shank
           end: dimension line, arrow and rotated label. */
        var sidePadRight = 88;
        var sideContentW = axisLength * sl + sidePadLeft + sidePadRight;
        var gap = 32;
        var totalW = frontBoxWidth + gap + sideContentW;
        var maxTotal = SHEET.width - 2 * SHEET_MARGIN;
        if (totalW > maxTotal) {
            var squeeze = maxTotal / totalW;
            sl *= squeeze;
            sc *= squeeze;
            frontRadius = frontExtent / 2 * sc;
            frontBoxWidth = frontRadius * 2 + frontPad;
            sideContentW = axisLength * sl + sidePadLeft + sidePadRight;
            totalW = frontBoxWidth + gap + sideContentW;
        }

        var leftOrigin = Math.max(SHEET_MARGIN, (SHEET.width - totalW) / 2);
        var frontBox = { left: leftOrigin, right: leftOrigin + frontBoxWidth };
        var sideBox = { left: frontBox.right + gap, right: frontBox.right + gap + sideContentW };
        var frontMid = (frontBox.left + frontBox.right) / 2;
        var sideMid = (sideBox.left + sideBox.right) / 2;

        var spanLeft = sideBox.left + sidePadLeft;
        var spanRight = sideBox.right - sidePadRight;
        var sideDrawW = axisLength * sl;
        var headLeft = spanLeft + Math.max(0, (spanRight - spanLeft - sideDrawW) / 2);

        var headW = headHeight * sl;
        var underHead = headLeft + headW;
        var endX = countersunk ? headLeft + length * sl : underHead + length * sl;
        /* The side caption follows the real silhouette, not the padded box
           that reserves room for dimension arrows. */
        var sideDrawMid = (headLeft + endX) / 2;
        var frontRadiusPx = d / 2 * sc;
        var sideRadius = d / 2 * sl;
        var top = AXIS_Y - sideRadius;
        var bottom = AXIS_Y + sideRadius;
        var chamfer = Math.min(0.1 * d * sl, 8);
        var rootPx = Math.max(minorDiameter(d, pitch) / 2 * sl, sideRadius * 0.5);
        var viewTop = AXIS_Y - sideHeight / 2 * sl;
        var viewBottom = AXIS_Y + sideHeight / 2 * sl;
        var rowTop = Math.max(viewTop - 34, AREA.top + 30);
        var rowBottom = Math.min(viewBottom + 40, AREA.bottom - 44);
        var rowBottom2 = Math.min(rowBottom + 28, AREA.bottom - 30);
        var parts = [];
        var frontCx = frontMid;
        var frontTop = AXIS_Y - frontRadius;
        var frontBottom = AXIS_Y + frontRadius;
        var headChamferRadialMM = Math.min(d * 0.1, sideHeight * 0.18);
        var headChamferAxialMM = Math.min(headChamferRadialMM / TAN30,
            headHeight * 0.42);
        headChamferRadialMM = headChamferAxialMM * TAN30;
        var headChamferAxialPx = headChamferAxialMM * sl;
        var headChamferRadialPx = headChamferRadialMM * sl;
        var headChamferFrontPx = headChamferRadialMM * sc;
        var headFlatStart = headLeft + Math.min(headW * 0.45,
            (sideHeight / 2 - acrossFlats / 2) / TAN30 * sl);
        var flatWitnessY = AXIS_Y + corners / 4 * sc;
        var threadStart = threaded
            ? Math.max(underHead, endX - threadLength * sl)
            : endX;
        void frontBox;
        void sideBox;

        layoutReset();

        /* ---------------- front view (seen on the head) ---------------- */

        /* ---------------- front view (seen on the head) ---------------- */

        if (hexHead) {
            parts.push(svgPolygon("fastener-part",
                hexPoints(frontCx, AXIS_Y, frontRadius)));
            /* The top chamfer leaves a circular face inside the hexagon. It
               must stay inside the across-flats width, otherwise the circle
               cuts through the flats and the head reads as a second hexagon. */
            var frontChamferR = Math.min(
                frontRadius - headChamferFrontPx,
                acrossFlats / 2 * sc - Math.max(0.6, 0.05 * acrossFlats * sc)
            );
            parts.push(svgCircle("fastener-thin", frontCx, AXIS_Y,
                Math.max(frontChamferR, 0.5)));
            parts.push(svgCircle("fastener-hidden", frontCx, AXIS_Y, frontRadiusPx));
        } else {
            parts.push(svgCircle("fastener-part", frontCx, AXIS_Y, frontRadius));

            if (socketHead) {
                parts.push(svgPolygon("fastener-part-line",
                    hexPoints(frontCx, AXIS_Y, socketWidth / COS30 / 2 * sc)));
            }

            if (carriage) {
                parts.push(svgPath("fastener-hidden",
                    boxPath(frontCx - neckWidth / 2 * sc, AXIS_Y - neckWidth / 2 * sc,
                        frontCx + neckWidth / 2 * sc, AXIS_Y + neckWidth / 2 * sc)));
            }
        }

        parts.push(centreCross(frontCx, AXIS_Y, frontRadius));
        layoutKeep(frontCx - frontRadius, frontTop, frontCx + frontRadius, frontBottom);

        /* ---------------- side view ---------------- */

        if (hexHead) {
            /* Bearing face is square; the top face is reduced by the 30 degree
               chamfer, so the elevation reads as a real hex head, not a block. */
            parts.push(svgPath("fastener-part",
                "M" + coord(underHead) + " " + coord(viewTop) +
                " H" + coord(headLeft + headChamferAxialPx) +
                " L" + coord(headLeft) + " " + coord(viewTop + headChamferRadialPx) +
                " V" + coord(viewBottom - headChamferRadialPx) +
                " L" + coord(headLeft + headChamferAxialPx) + " " + coord(viewBottom) +
                " H" + coord(underHead) + " Z"));
            parts.push(svgLine("fastener-part-line", headFlatStart,
                AXIS_Y - acrossFlats / 2 * sl, underHead, AXIS_Y - acrossFlats / 2 * sl));
            parts.push(svgLine("fastener-part-line", headFlatStart,
                AXIS_Y + acrossFlats / 2 * sl, underHead, AXIS_Y + acrossFlats / 2 * sl));
            parts.push(svgLine("fastener-thin", headLeft,
                viewTop + headChamferRadialPx, headLeft,
                viewBottom - headChamferRadialPx));
        } else if (countersunk) {
            parts.push(svgPath("fastener-part",
                "M" + coord(headLeft) + " " + coord(viewTop) +
                " L" + coord(underHead) + " " + coord(top) +
                " L" + coord(underHead) + " " + coord(bottom) +
                " L" + coord(headLeft) + " " + coord(viewBottom) + " Z"));

            /* Socket depth, hidden inside the head. */
            parts.push(svgPath("fastener-hidden",
                boxPath(headLeft, AXIS_Y - socketWidth / 2 * sl,
                    headLeft + socketDepth * sl, AXIS_Y + socketWidth / 2 * sl)));
        } else if (carriage) {
            /* Half-ellipse dome: crown on the axis, edges meeting the bearing
               face square, exactly like a DIN 603 head. */
            parts.push(svgPath("fastener-part",
                "M" + coord(underHead) + " " + coord(viewTop) +
                " A" + coord(headW) + " " + coord(sideHeight / 2 * sl) +
                " 0 0 0 " + coord(underHead) + " " + coord(viewBottom) + " Z"));
        } else {
            parts.push(svgBox("fastener-part", headLeft, viewTop, underHead, viewBottom));
            parts.push(svgPath("fastener-hidden",
                boxPath(headLeft, AXIS_Y - socketWidth / 2 * sl,
                    headLeft + socketDepth * sl, AXIS_Y + socketWidth / 2 * sl)));
        }

        var shankStart = carriage ? underHead + neckHeight * sl : underHead;

        if (carriage) {
            parts.push(svgBox("fastener-part", underHead,
                AXIS_Y - neckWidth / 2 * sl, shankStart,
                AXIS_Y + neckWidth / 2 * sl));
        }

        parts.push(svgPath("fastener-part",
            "M" + coord(shankStart) + " " + coord(top) +
            " H" + coord(endX - chamfer) +
            " L" + coord(endX) + " " + coord(top + chamfer) +
            " V" + coord(bottom - chamfer) +
            " L" + coord(endX - chamfer) + " " + coord(bottom) +
            " H" + coord(shankStart) + " Z"));

        if (threaded) {
            parts.push(threadRootH(threadStart, endX - chamfer, AXIS_Y, rootPx));

            if (threadStart > underHead + 1) {
                parts.push(svgLine("fastener-part", threadStart, top,
                    threadStart, bottom));
            }
        }

        parts.push(svgLine("fastener-centre", headLeft - 16, AXIS_Y, endX + 16, AXIS_Y));
        layoutKeep(headLeft, Math.min(viewTop, top), endX,
            Math.max(viewBottom, bottom));

        /* ---------------- front view dimensions ---------------- */

        if (hexHead) {
            parts.push(dimH({
                x1: frontCx - acrossFlats / 2 * sc,
                x2: frontCx + acrossFlats / 2 * sc,
                y: frontBottom + 32,
                side: "below",
                from: [
                    [frontCx - acrossFlats / 2 * sc, flatWitnessY],
                    [frontCx + acrossFlats / 2 * sc, flatWitnessY]
                ],
                key: "acrossFlats"
            }));
        } else {
            parts.push(dimV({
                y1: frontTop,
                y2: frontBottom,
                x: frontCx + frontRadius + 30,
                side: "right",
                from: [
                    [frontCx + frontRadius - 1, frontTop],
                    [frontCx + frontRadius - 1, frontBottom]
                ],
                key: "headDiameter"
            }));
        }

        if (socketHead) {
            var socketRadius = socketWidth / COS30 / 2 * sc;

            parts.push(leaderNote({
                to: [frontCx + socketRadius * 0.75, AXIS_Y - socketRadius * 0.43],
                key: "socketAcrossFlats",
                /* Under the end view keeps the socket note away from the head
                   height dimension over the side view. */
                cands: [
                    { x: frontCx, y: frontBottom + 44, anchor: "middle" },
                    { x: frontCx - 6, y: frontTop - 34, anchor: "middle" },
                    { x: frontCx + frontRadius - 10, y: frontTop - 34, anchor: "middle" }
                ]
            }));
        }

        if (carriage) {
            parts.push(leaderNote({
                to: [frontCx + neckWidth / 2 * sc, AXIS_Y + neckWidth / 2 * sc],
                key: "neckAcrossFlats",
                cands: [
                    { x: frontCx - 6, y: frontTop - 34, anchor: "middle" },
                    { x: frontCx + frontRadius - 10, y: frontTop - 34, anchor: "middle" },
                    { x: frontCx, y: frontBottom + 40, anchor: "middle" }
                ]
            }));
        }

        /* ---------------- side view dimensions ---------------- */

        parts.push(dimH({
            x1: headLeft,
            x2: underHead,
            y: rowTop,
            from: [
                [headLeft, carriage ? AXIS_Y : Math.min(viewTop, top)],
                [underHead, Math.min(viewTop, top)]
            ],
            key: "headHeight"
        }));

        if (carriage) {
            parts.push(leaderNote({
                to: [shankStart, AXIS_Y + neckWidth / 2 * sl],
                key: "neckHeight",
                cands: [
                    { x: shankStart + 26, y: rowBottom, anchor: "start" },
                    { x: shankStart + 26, y: rowBottom2, anchor: "start" },
                    { x: underHead + 34, y: rowBottom, anchor: "start" }
                ]
            }));
        }

        if (threaded && hasThreadLength && threadLength < length - 0.01) {
            parts.push(dimH({
                x1: threadStart,
                x2: endX,
                y: rowTop,
                from: [
                    [threadStart, top],
                    [endX, top + chamfer]
                ],
                key: "threadLength"
            }));
        }

        if (threaded) {
            var pitchX = threadStart + (endX - chamfer - threadStart) * 0.45;

            /* A socket screw also carries a socket-depth note under its head, so
               the pitch note moves out to the end of the shank. */
            parts.push(leaderNote({
                to: [pitchX, AXIS_Y + rootPx],
                key: "pitch",
                cands: socketHead
                    ? [
                        { x: pitchX - 30, y: rowBottom, anchor: "end" },
                        { x: pitchX + 30, y: rowBottom, anchor: "start" },
                        { x: pitchX, y: rowBottom + 26, anchor: "middle" }
                    ]
                    : [
                        { x: pitchX - 30, y: rowBottom, anchor: "end" },
                        { x: pitchX + 30, y: rowBottom, anchor: "start" },
                        { x: (threadStart + endX) / 2, y: rowBottom, anchor: "middle" }
                    ]
            }));
        }

        parts.push(dimH({
            x1: countersunk ? headLeft : underHead,
            x2: endX,
            y: rowBottom2,
            side: "below",
            from: [
                [countersunk ? headLeft : underHead, Math.max(viewBottom, bottom)],
                [endX, bottom - chamfer]
            ],
            key: "length"
        }));

        parts.push(dimV({
            y1: top,
            y2: bottom,
            x: endX + 34,
            side: "right",
            from: [
                [endX - chamfer - 2, top],
                [endX - chamfer - 2, bottom]
            ],
            key: "diameter"
        }));

        if (socketHead) {
            parts.push(leaderNote({
                to: [headLeft + socketDepth * sl, AXIS_Y - socketWidth / 2 * sl],
                key: "socketDepth",
                cands: [
                    { x: headLeft + 16, y: rowBottom, anchor: "start" },
                    { x: headLeft - 16, y: rowBottom, anchor: "end" },
                    { x: headLeft + headW + 20, y: rowBottom, anchor: "start" },
                    { x: headLeft - 16, y: rowBottom2, anchor: "end" }
                ]
            }));
        }

        var content = sheetChrome() + parts.join("") +
            viewCaptions(frontCx, sideDrawMid);

        return {
            svg: sheetSvg(product.name +
                ", front view and side view, dimensions in " + unitWord(), content),
            caption: String(tr(product.name)).trim() + " — " +
                String(tr("front view and side view, dimensions in")).trim() + " " + unitWord()
        };
    }

    /* ==================================================
       STUDS AND THREADED RODS
       A stud is an externally threaded bar, so the sheet is drawn the way a
       drafting office draws one:

       * both orthographic views share ONE millimetre scale, so the front
         circle and the side elevation are the same rod;
       * the thread is a real 60 degree ISO form (crest flat P/8, root flat
         P/4, flank 0.3126 P) laid out at the reference pitch, so the crest and
         root diameters are the standard ones rather than an illustration;
       * the stud is always drawn as ONE complete piece from end to end. There
         is no break, no cut section and no interrupted geometry, so the scale
         is chosen to fit the whole reference length on the sheet.

       The sheet is drawn from the figures in the form at one true scale, so a
       change of size, pitch or length redraws the stud instead of rescaling a
       fixed picture. Thread form that is only a few pixels wide at the length
       scale is repeated in DETAIL A, where the basic profile is read.
    ================================================== */

    /* Axial proportions of the ISO metric thread form, as fractions of the
       pitch. The thread depth is d - d1 = 1.0825 P, so a 60 degree flank runs
       0.3126 P along the axis and the root flat closes the remaining 0.25 P. */
    var STUD_CREST = 0.125;
    var STUD_ROOT = 0.25;
    var STUD_FLANK = 0.3126;
    /* Depth of the basic profile: 5H/8 with H = 0.866 P. */
    var STUD_DEPTH = 0.541;

    function studPolyline(points) {
        var d = "";
        var i;

        if (!points.length) {
            return "";
        }

        d = "M" + coord(points[0][0]) + " " + coord(points[0][1]);

        for (i = 1; i < points.length; i += 1) {
            d += " L" + coord(points[i][0]) + " " + coord(points[i][1]);
        }

        return d;
    }

    /* One contour of a threaded length, from xa to xb, above the axis for
       side -1 and below it for side +1. Repeated crest flats, 60 degree
       flanks and root flats at the real pitch, so the rod reads as a thread
       instead of a plain bar. */
    function studThreadEdge(xa, xb, cy, radius, rootR, pitchPx, side) {
        var crest = STUD_CREST * pitchPx;
        var flank = STUD_FLANK * pitchPx;
        var root = STUD_ROOT * pitchPx;
        var peak = cy + side * radius;
        var valley = cy + side * rootR;
        var points = [[xa, peak]];
        var x = xa;

        while (x < xb - 0.05) {
            x = Math.min(x + crest, xb);
            points.push([x, peak]);
            x = Math.min(x + flank, xb);
            points.push([x, valley]);
            x = Math.min(x + root, xb);
            points.push([x, valley]);
            x = Math.min(x + flank, xb);
            points.push([x, peak]);
        }

        /* A contour cut in the middle of a flank comes back to the crest so
           the piece always ends on the major diameter. */
        if (points[points.length - 1][1] !== peak) {
            points.push([xb, peak]);
        }

        return points;
    }

    /* Thin three-quarter circle at the root diameter: the conventional end
       view of an external thread, with the gap in the lower right quadrant. */
    function studRootArc(cx, cy, r) {
        var gap = Math.PI / 3;
        var start = Math.PI * 0.42 + gap / 2;
        var end = start + Math.PI * 2 - gap;
        var x1 = cx + r * Math.cos(start);
        var y1 = cy + r * Math.sin(start);
        var x2 = cx + r * Math.cos(end);
        var y2 = cy + r * Math.sin(end);

        return "M" + coord(x1) + " " + coord(y1) +
            " A" + coord(r) + " " + coord(r) + " 0 1 1 " + coord(x2) + " " + coord(y2);
    }

    /* One piece of rod between xa and xb. A real end carries its 45 degree
       chamfer and end face; an interior seam, where the next piece of the same
       stud continues (thread to plain shank to thread), gets no face at all,
       so the two pieces always read as one continuous rod.

       `threaded` lays the repeated thread form over the piece, `rootLines`
       draws the thin root diameter line instead of the full profile where the
       pitch would be too dense to read. */
    function studRodPiece(o) {
        var xa = o.xa;
        var xb = o.xb;
        var cy = o.cy;
        var radius = o.radius;
        var rootR = o.rootR;
        var pitchPx = o.pitchPx;
        var chamferStart = Math.min(o.chamferStart || 0, (xb - xa) * 0.22);
        var chamferEnd = Math.min(o.chamferEnd || 0, (xb - xa) * 0.22);
        var topStart = xa + chamferStart;
        var topEnd = xb - chamferEnd;
        var detailed = o.threaded && o.detailed && (topEnd - topStart) >= pitchPx * 1.2;
        var top;
        var bottom;
        var line = "";
        var i;
        var ring;

        if (detailed) {
            top = studThreadEdge(topStart, topEnd, cy, radius, rootR, pitchPx, -1);
            bottom = studThreadEdge(topStart, topEnd, cy, radius, rootR, pitchPx, 1);
        } else {
            top = [[topStart, cy - radius], [topEnd, cy - radius]];
            bottom = [[topStart, cy + radius], [topEnd, cy + radius]];
        }

        /* Left end face and the two chamfers that run to the crest lines. */
        if (chamferStart > 0.3) {
            line += "M" + coord(xa) + " " + coord(cy + radius - chamferStart) +
                " L" + coord(xa) + " " + coord(cy - radius + chamferStart) +
                " L" + coord(xa + chamferStart) + " " + coord(cy - radius);
        } else {
            line += "M" + coord(xa) + " " + coord(cy - radius);
        }

        for (i = 1; i < top.length; i += 1) {
            line += " L" + coord(top[i][0]) + " " + coord(top[i][1]);
        }

        /* Right end: chamfer and face only where the rod really ends. */
        if (chamferEnd > 0.3) {
            line += " L" + coord(xb - chamferEnd) + " " + coord(cy - radius) +
                " L" + coord(xb) + " " + coord(cy - radius + chamferEnd) +
                " L" + coord(xb) + " " + coord(cy + radius - chamferEnd) +
                " L" + coord(xb - chamferEnd) + " " + coord(cy + radius);
        }

        if (chamferEnd <= 0.3) {
            line += " M" + coord(xb) + " " + coord(cy + radius);
        }

        for (i = bottom.length - 1; i >= 0; i -= 1) {
            line += " L" + coord(bottom[i][0]) + " " + coord(bottom[i][1]);
        }

        if (chamferStart > 0.3) {
            line += " L" + coord(xa) + " " + coord(cy + radius - chamferStart);
        }

        ring = top.concat(bottom.slice().reverse());

        return {
            fill: studPolyline(ring) + " Z",
            line: line,
            root: (o.threaded && !detailed)
                ? svgLine("fastener-thin", xa, cy - rootR, xb, cy - rootR) +
                    svgLine("fastener-thin", xa, cy + rootR, xb, cy + rootR)
                : ""
        };
    }

    /* ==================================================
       THREADED ROD / CONTINUOUS STUD SHEET
       A continuous rod is routinely supplied by the metre. Drawing its whole
       length at one true scale turns an M12 into a hairline, so this product
       alone uses the standard drafting convention of a broken view: the two
       drawn ends carry the real ISO thread form at a readable scale, while
       the L dimension still reports the entered overall length. The visible
       diameter grows with the selected size, and P and d are dimensioned from
       the same figures the calculator uses. No other stud product takes this
       path.
    ================================================== */

    /* Conventional zig-zag sever line at an omitted length of rod. */
    function threadedRodBreak(x, y1, y2) {
        var d = "M" + coord(x) + " " + coord(y1);
        var steps = 4;
        var dy = (y2 - y1) / steps;
        var i;

        for (i = 1; i <= steps; i += 1) {
            d += " L" + coord(x + (i % 2 ? 8 : -8)) +
                " " + coord(y1 + dy * i);
        }

        return svgPath("fastener-part fastener-outline", d);
    }

    function threadedRodSheet(product) {
        var ref = fixedStudGeometry(product);

        var d = Math.max(fieldMM("diameter", ref.diameter), 0.3);
        var pitch = clamp(fieldMM("pitch", ref.pitch), 0.05, d);
        var length = Math.max(fieldMM("length", ref.length), 1);

        var narrowSheet = diagramViews.clientWidth > 0 &&
            diagramViews.clientWidth < 520;
        var savedLabelSize = LABEL_SIZE;

        if (narrowSheet) {
            LABEL_SIZE = 26;
        }

        /* Readable scale from the diameter alone, never compressed by a long
           overall length. M6, M12, M16, M20 and M24 keep growing visibly
           thicker while every turn still has room to show crest and root. */
        var radius = clamp(16 + 1.9 * d, 24, 62);
        var sc = radius / (d / 2);
        var pitchPx = pitch * sc;
        var rootRadius = Math.max(radius - STUD_DEPTH * pitchPx, radius * 0.62);
        var detailed = pitchPx >= 4.5 && radius - rootRadius >= 1.2;
        var chamfer = clamp(Math.min(pitchPx * 0.65, radius * 0.32), 1.2, 8);

        var cy = 172;
        var top = cy - radius;
        var bottom = cy + radius;

        /* Front and side boxes fill the sheet. The drawn side span still grows
           with the entered length, but on a compressed logarithmic scale so a
           1 m and a 10 m rod both stay readable inside the same frame. */
        var frontWidth = 210;
        var boxGap = 28;
        var sideWidth = SHEET.width - 2 * SHEET_MARGIN - frontWidth - boxGap;
        var leftOrigin = Math.max(SHEET_MARGIN,
            (SHEET.width - frontWidth - boxGap - sideWidth) / 2);
        var frontBox = { left: leftOrigin, right: leftOrigin + frontWidth };
        var sideBox = {
            left: frontBox.right + boxGap,
            right: frontBox.right + boxGap + sideWidth
        };
        var frontCx = (frontBox.left + frontBox.right) / 2;
        var sideMid = (sideBox.left + sideBox.right) / 2;
        var maxSpan = sideWidth - 68;
        var spanRatio = clamp(0.72 + 0.28 * Math.log(length / 100) / Math.log(100),
            0.72, 1);
        var span = maxSpan * spanRatio;
        var sideLeft = sideMid - span / 2;
        var sideRight = sideMid + span / 2;
        var mid = (sideLeft + sideRight) / 2;
        var breakGap = clamp(span * 0.2, 56, 92);
        var breakLeft = mid - breakGap / 2;
        var breakRight = mid + breakGap / 2;

        var parts = [];

        layoutReset();

        /* ---------------- front view: the rod seen end on ---------------- */

        parts.push(svgCircle("fastener-part", frontCx, cy, radius));
        parts.push(svgPath("fastener-thin", studRootArc(frontCx, cy, rootRadius)));

        var frontExt = Math.max(12, radius * 0.3);

        parts.push(svgLine("fastener-centre",
            frontCx - radius - frontExt, cy, frontCx + radius + frontExt, cy));
        parts.push(svgLine("fastener-centre",
            frontCx, cy - radius - frontExt, frontCx, cy + radius + frontExt));
        layoutKeep(frontCx - radius, top, frontCx + radius, bottom);

        /* ---------------- detail A: readable ISO thread form ---------------- */

        var detailTurn = clamp(pitchPx * 3.2, 38, 54);
        var detailDepth = STUD_DEPTH * detailTurn;
        var detailY = bottom + 58;
        var detailXa = frontCx - 1.5 * detailTurn;
        var detailXb = detailXa + 3 * detailTurn;
        var detailProfile = studThreadEdge(detailXa, detailXb, detailY, 0,
            detailDepth, detailTurn, 1);

        parts.push(svgPath("fastener-part fastener-outline",
            studPolyline(detailProfile)));
        parts.push(svgLine("fastener-thin", detailXa - 8, detailY,
            detailXb + 8, detailY));
        parts.push(svgText("fastener-note", caption("detailA") || "DETAIL A · 60°", frontCx,
            detailY + detailDepth + 20, "middle"));
        layoutKeep(detailXa - 10, detailY - 4, detailXb + 10,
            detailY + detailDepth + 4);

        var detailCrest = detailXa + STUD_CREST * detailTurn / 2;

        parts.push(dimH({
            x1: detailCrest,
            x2: detailCrest + detailTurn,
            y: detailY - 16,
            from: [
                [detailCrest, detailY - 2],
                [detailCrest + detailTurn, detailY - 2]
            ],
            key: "pitch",
            symbol: "P"
        }));

        /* ---------------- side view: the fully threaded rod ---------------- */

        var leftPiece = studRodPiece({
            xa: sideLeft,
            xb: breakLeft,
            cy: cy,
            radius: radius,
            rootR: rootRadius,
            pitchPx: pitchPx,
            threaded: true,
            detailed: detailed,
            chamferStart: chamfer,
            chamferEnd: 0
        });
        var rightPiece = studRodPiece({
            xa: breakRight,
            xb: sideRight,
            cy: cy,
            radius: radius,
            rootR: rootRadius,
            pitchPx: pitchPx,
            threaded: true,
            detailed: detailed,
            chamferStart: 0,
            chamferEnd: chamfer
        });

        [leftPiece, rightPiece].forEach(function (piece) {
            parts.push(svgPath("fastener-fill", piece.fill));
            parts.push(svgPath("fastener-part fastener-outline", piece.line));

            if (piece.root) {
                parts.push(piece.root);
            }
        });

        parts.push(threadedRodBreak(breakLeft, top, bottom));
        parts.push(threadedRodBreak(breakRight, top, bottom));
        parts.push(svgLine("fastener-centre", sideLeft - 18, cy,
            sideRight + 18, cy));
        layoutKeep(sideLeft, top, sideRight, bottom);

        /* ---------------- dimensions ---------------- */

        /* d, across the crest circle of the front view. */
        parts.push(dimV({
            y1: top,
            y2: bottom,
            x: frontCx + radius + 28,
            side: "right",
            from: [
                [frontCx + radius, top],
                [frontCx + radius, bottom]
            ],
            key: "diameter",
            symbol: "d"
        }));

        /* P, between two adjacent crests of the drawn thread. */
        var pitchX1 = sideLeft + 2 * pitchPx;
        var pitchX2 = pitchX1 + pitchPx;

        parts.push(dimH({
            x1: pitchX1,
            x2: pitchX2,
            y: top - 28,
            from: [[pitchX1, top], [pitchX2, top]],
            key: "pitch",
            symbol: "P"
        }));

        /* L, end to end, from the entered length even though the middle of the
           long rod is omitted from the picture. */
        parts.push(dimH({
            x1: sideLeft,
            x2: sideRight,
            y: bottom + 66,
            side: "below",
            from: [[sideLeft, bottom + 2], [sideRight, bottom + 2]],
            key: "length"
        }));

        var content = sheetChrome() + parts.join("") +
            viewCaptions(frontCx, (sideLeft + sideRight) / 2);

        LABEL_SIZE = savedLabelSize;

        return {
            svg: sheetSvg(product.name +
                ", front view and side view, dimensions in " + unitWord(),
                content, "fastener-drawing--rod" +
                    (narrowSheet ? " fastener-drawing--narrow" : "")),
            caption: String(tr(product.name)).trim() + " — " +
                String(tr("front view and side view, dimensions in")).trim() + " " + unitWord()
        };
    }

    function studSheet(product) {
        /* Studs are drawn from the figures in the form, at the selected size,
           pitch and length. A stud is one straight rod, so a true-scale
           elevation is possible at every size: the scale is chosen from the
           actual length and pitch, and no proportion is distorted. A very
           long rod (a 1 m threaded rod) simply becomes a long thin rod, which
           is what it looks like on a real sheet. */
        var ref = fixedStudGeometry(product);

        var d = Math.max(fieldMM("diameter", ref.diameter), 0.3);
        var pitch = clamp(fieldMM("pitch", ref.pitch), 0.05, d);
        var length = Math.max(fieldMM("length", ref.length), 1);
        var doubleEnded = product.key === "stud-de";
        var b1 = doubleEnded
            ? clamp(fieldMM("threadLength", ref.threadLength), 0, length)
            : length;
        var b2 = doubleEnded
            ? clamp(fieldMM("threadLength2", ref.threadLength2), 0,
                Math.max(length - b1, 0))
            : 0;
        var minorD = minorDiameter(d, pitch);

        /* On a phone the sheet shrinks with the card, so the authored label
           size would print at about seven pixels. The stud sheet carries few
           labels, so it is laid out with a larger label size while the sheet is
           narrow: the collision boxes grow with the text, so nothing overlaps,
           and the class puts the same size on the rendered labels. */
        var narrowSheet = diagramViews.clientWidth > 0 &&
            diagramViews.clientWidth < 520;
        var savedLabelSize = LABEL_SIZE;

        if (narrowSheet) {
            LABEL_SIZE = 26;
        }

        /* ---------------- one scale for both views ---------------- */

        /* The crest spacing decides the scale: a thread is only readable when
           roughly eleven pixels separate two crests, and both views use that
           same millimetre scale so the front circle and the side elevation
           stay one and the same rod. The sheet height caps it for a large
           diameter, and a dense pitch falls back to the simplified root
           lines instead of turning into a black band. */
        /* The rod must leave room for the rows the sheet really draws: the
           pitch row and the overall length below it, and the two thread
           length rows above a double end stud. */
        var rowsBelow = 70;
        var rowsAbove = 6 + (doubleEnded ? 30 : 0);
        var heightBudget = 2 * Math.min(
            Math.max(60, AREA.bottom - 2 - rowsBelow - AXIS_Y),
            Math.max(60, AXIS_Y - AREA.top - rowsAbove)
        );
        var sc = clamp(Math.min(12.5 / pitch, heightBudget / d), 0.25, 30);
        var boxGap = 40;
        var maxTotal = SHEET.width - 2 * SHEET_MARGIN;

        /* Widths follow from the scale, so measure the sheet with the scale
           before committing to it. */
        function framing(scale) {
            var frontW = Math.max(d * scale + 108, 150);
            var sideW = Math.max(240, maxTotal - frontW - boxGap);
            return { front: frontW, side: sideW, avail: Math.max(150, sideW - 56) };
        }

        /* The complete stud is drawn in one piece, so the scale has to fit the
           whole reference length into the side box: no break, no cut section,
           nothing interrupted. Two passes are enough, because the boxes only
           grow while the scale shrinks. */
        sc = Math.min(sc, framing(sc).avail / length);
        sc = Math.min(sc, framing(sc).avail / length);
        /* A rod longer than a metre lowers the floor with it, so the elevation
           can never run past the edge of its box. */
        sc = Math.max(Math.min(0.25, framing(sc).avail / length), sc);

        var radius = d / 2 * sc;
        var rootPx = minorD / 2 * sc;
        var pitchPx = pitch * sc;
        var detailed = pitchPx >= 3.6 && (radius - rootPx) >= 1.1;

        /* A thread line that would print closer than a pixel to the crest line
           is still drawn just inside it, so a 1 m rod reads as threaded
           instead of as a plain bar. Only the drawn indication is widened; no
           dimension and no weight uses it. */
        if (radius - rootPx < 1.1) {
            rootPx = Math.max(radius * 0.55, radius - 1.1);
        }

        var chamferPx = clamp(Math.min(pitchPx, radius * 0.38), 0.8, 9);

        /* ---------------- the two boxes ---------------- */

        var frame = framing(sc);
        var frontBoxWidth = frame.front;
        var sideBoxWidth = frame.side;

        var totalW = frontBoxWidth + boxGap + sideBoxWidth;
        var leftOrigin = Math.max(SHEET_MARGIN, (SHEET.width - totalW) / 2);
        var frontBox = { left: leftOrigin, right: leftOrigin + frontBoxWidth };
        var sideBox = {
            left: frontBox.right + boxGap,
            right: frontBox.right + boxGap + sideBoxWidth
        };
        var frontCx = (frontBox.left + frontBox.right) / 2;

        /* ---------------- the rod, end to end ---------------- */

        var spanW = length * sc;
        var leftX = sideBox.left + Math.max(18, (sideBoxWidth - spanW) / 2);
        var endX = leftX + spanW;

        var top = AXIS_Y - radius;
        var bottom = AXIS_Y + radius;

        var parts = [];

        layoutReset();

        /* ---------------- front view: the rod seen end on ---------------- */

        parts.push(svgCircle("fastener-part", frontCx, AXIS_Y, radius));
        parts.push(svgPath("fastener-thin", studRootArc(frontCx, AXIS_Y, rootPx)));

        var frontExt = Math.max(10, radius * 0.25);

        parts.push(svgLine("fastener-centre",
            frontCx - radius - frontExt, AXIS_Y, frontCx + radius + frontExt, AXIS_Y));
        parts.push(svgLine("fastener-centre",
            frontCx, AXIS_Y - radius - frontExt, frontCx, AXIS_Y + radius + frontExt));
        layoutKeep(frontCx - radius, AXIS_Y - radius, frontCx + radius, AXIS_Y + radius);

        /* ---------------- detail A: the thread form ---------------- */

        /* At the scale of a 150 mm stud one M12 turn is about four pixels
           wide, so the profile cannot be read on the elevation. The basic
           thread profile is therefore repeated at a readable scale in DETAIL
           A: three turns of the ISO 68-1 form (crest flat P/8, root flat P/4,
           60 degree flanks) drawn at the real pitch of the selected thread,
           which is the only place where two adjacent crests are far enough
           apart to carry the P dimension.

           The profile is proportional to the pitch alone, so it is drawn as a
           profile figure and not as a section of the rod: no diameter is
           magnified, only the turn. */
        var detailTurn = 34;
        var detailDepth = STUD_DEPTH * detailTurn;
        var detailCrestY = Math.min(AREA.bottom - 58,
            AXIS_Y + radius + 58 + detailDepth);
        var detailXa = frontCx - 1.5 * detailTurn;
        var detailXb = detailXa + 3 * detailTurn;
        var detailProfile = studThreadEdge(detailXa, detailXb, detailCrestY, 0,
            detailDepth, detailTurn, 1);

        parts.push(svgPath("fastener-part fastener-outline",
            studPolyline(detailProfile)));
        parts.push(svgLine("fastener-thin", detailXa - 8, detailCrestY,
            detailXb + 8, detailCrestY));
        parts.push(svgText("fastener-note", caption("detailA") || "DETAIL A · 60°", frontCx,
            detailCrestY + detailDepth + 20, "middle"));

        var detailCrest1 = detailXa + STUD_CREST * detailTurn / 2;

        parts.push(dimH({
            x1: detailCrest1,
            x2: detailCrest1 + detailTurn,
            y: detailCrestY - 16,
            from: [
                [detailCrest1, detailCrestY - 2],
                [detailCrest1 + detailTurn, detailCrestY - 2]
            ],
            key: "pitch"
        }));

        /* ---------------- side view: the threaded rod ---------------- */

        /* The thread pattern of each piece: a full-thread rod is threaded over
           its whole length, a double end stud only over b1 and b2. */
        var threadRanges = doubleEnded && b2 > 0
            ? [[0, Math.min(b1, length)], [Math.max(0, length - b2), length]]
            : [[0, length]];

        var segs = [{ x1: leftX, mm0: 0, mm1: length, capStart: chamferPx, capEnd: chamferPx }];

        segs.forEach(function (seg) {
            var cuts = [seg.mm0, seg.mm1];

            threadRanges.forEach(function (range) {
                if (range[0] > seg.mm0 && range[0] < seg.mm1) {
                    cuts.push(range[0]);
                }
                if (range[1] > seg.mm0 && range[1] < seg.mm1) {
                    cuts.push(range[1]);
                }
            });

            cuts.sort(function (a, b) { return a - b; });

            for (var i = 0; i < cuts.length - 1; i += 1) {
                var a = cuts[i];
                var b = cuts[i + 1];

                if (b - a < 1e-6) {
                    continue;
                }

                var mid = (a + b) / 2;
                var threaded = threadRanges.some(function (range) {
                    return mid >= range[0] && mid <= range[1];
                });
                var xa = seg.x1 + (a - seg.mm0) * sc;
                var xb = seg.x1 + (b - seg.mm0) * sc;

                if (xb - xa < 1) {
                    continue;
                }

                var piece = studRodPiece({
                    xa: xa,
                    xb: xb,
                    cy: AXIS_Y,
                    radius: radius,
                    rootR: rootPx,
                    pitchPx: pitchPx,
                    threaded: threaded,
                    detailed: detailed,
                    chamferStart: i === 0 ? seg.capStart : 0,
                    chamferEnd: i === cuts.length - 2 ? seg.capEnd : 0
                });

                parts.push(svgPath("fastener-fill", piece.fill));
                parts.push(svgPath("fastener-part fastener-outline", piece.line));

                if (piece.root) {
                    parts.push(piece.root);
                }
            }
        });

        parts.push(svgLine("fastener-centre", leftX - 18, AXIS_Y, endX + 18, AXIS_Y));
        layoutKeep(leftX, top, endX, bottom);

        /* ---------------- dimensions ---------------- */

        /* d, the nominal thread diameter, measured across the end view. The
           extension lines leave the two points where the dimension is taken,
           on the crest circle itself, not from the centre of the view. */
        parts.push(dimV({
            y1: AXIS_Y - radius,
            y2: AXIS_Y + radius,
            x: frontCx + radius + 24,
            side: "right",
            from: [
                [frontCx + radius, AXIS_Y - radius],
                [frontCx + radius, AXIS_Y + radius]
            ],
            key: "diameter"
        }));

        /* b1 and b2: the threaded length at each end of a double end stud.
           Both ends are drawn whole, so each is dimensioned straight across
           the rod. */
        if (doubleEnded) {
            var b1Shown = Math.min(b1, length);
            var b1Y = top - 18;

            parts.push(dimH({
                x1: leftX,
                x2: leftX + b1Shown * sc,
                y: b1Y,
                from: [
                    [leftX, top],
                    [leftX + b1Shown * sc, top]
                ],
                key: "threadLength",
                symbol: "b1"
            }));

            var b2Shown = Math.min(b2, length);
            var b2From = endX - b2Shown * sc;

            parts.push(dimH({
                x1: b2From,
                x2: endX,
                y: b1Y,
                from: [
                    [b2From, top],
                    [endX, top]
                ],
                key: "threadLength2",
                symbol: "b2"
            }));
        }

        /* L, the overall stud length, always end to end. */
        var lengthY = bottom + 66;

        parts.push(dimH({
            x1: leftX,
            x2: endX,
            y: lengthY,
            side: "below",
            from: [
                [leftX, bottom + 2],
                [endX, bottom + 2]
            ],
            key: "length"
        }));


        var content = sheetChrome() + parts.join("") +
            viewCaptions(frontCx, (leftX + endX) / 2);

        LABEL_SIZE = savedLabelSize;

        return {
            svg: sheetSvg(product.name +
                ", front view and side view, dimensions in " + unitWord(),
                content, narrowSheet ? "fastener-drawing--narrow" : ""),
            caption: String(tr(product.name)).trim() + " — " +
                String(tr("front view and side view, dimensions in")).trim() + " " + unitWord()
        };
    }

    /* ==================================================
       NUTS - FRONT VIEW AND SIDE VIEW
       The front view shows the nut face with its bore. The side view is a
       side elevation: the outer silhouette is the across-flats body with
       standard 30 degree chamfers, and the internal threaded hole is shown
       with hidden dashed lines (no section, no hatching).

       Every nut type is drawn from the figures in the form at the selected
       size, so the two views carry the real proportions of the standard in
       use and only one of them is ever the same: no nut type borrows another
       type's picture.
    ================================================== */

    function nutSheet(product) {
        /* The nut is drawn from the figures in the form, at the selected size,
           so the picture carries the proportions of the standard in use: a
           style 2 nut is visibly taller and wider than a style 1 nut of the
           same thread, a jam nut is visibly thin, a square nut shows its
           square face. No fixed sample geometry is reused. */
        var d = Math.max(fieldMM("diameter", 10), 0.3);
        var pitch = clamp(fieldMM("pitch", 1.5), 0.05, d);
        var acrossFlats = Math.max(fieldMM("acrossFlats", 16), d);
        var height = Math.max(fieldMM("nutHeight", 8), 0.4);

        /* On a phone the sheet shrinks with the card, so the authored label
           size would print at about seven pixels. The nut sheet carries few
           labels, so it is laid out with a larger label size while the sheet
           is narrow: the collision boxes grow with the text, so nothing
           overlaps, and the class puts the same size on the rendered labels. */
        var narrowSheet = diagramViews.clientWidth > 0 &&
            diagramViews.clientWidth < 520;
        var savedLabelSize = LABEL_SIZE;

        if (narrowSheet) {
            LABEL_SIZE = 26;
        }

        var square = product.key === "square-nut";
        var nylon = product.key === "lock-nut";
        var corners = square ? acrossFlats * Math.SQRT2 : acrossFlats / COS30;
        var minorD = minorDiameter(d, pitch);

        var maxFrontSc = Math.min(
            (SHEET.width * 0.38 - 76) / Math.max(corners, 1),
            (AREA.bottom - AREA.top - 104) / Math.max(corners, 1),
            12.5
        );
        /* The side elevation must leave room below it for DETAIL A and its
           pitch dimension, so its height budget is the smaller one. */
        var maxSideSc = Math.min(
            (SHEET.width * 0.52 - 96) / Math.max(corners, 1),
            (AREA.bottom - AREA.top - 190) / Math.max(height, 1),
            12.5
        );
        var sc = Math.max(0.25, Math.min(maxFrontSc, maxSideSc));

        var frontExtent = corners;
        var frontPad = 76;
        /* Each box hugs its own drawing plus the pad its dimensions need. */
        var frontBoxWidth = frontExtent * sc + frontPad;
        var sidePad = 96;
        /* The side elevation is the projection across the corners, so the
           silhouette is e wide (never just the across-flats span). */
        var sideContentW = corners * sc + sidePad;
        var gap = 28;
        var totalW = frontBoxWidth + gap + sideContentW;
        var maxTotal = SHEET.width - 2 * SHEET_MARGIN;
        if (totalW > maxTotal) {
            var squeeze = maxTotal / totalW;
            sc *= squeeze;
            frontBoxWidth = frontExtent * sc + frontPad;
            sideContentW = corners * sc + sidePad;
            totalW = frontBoxWidth + gap + sideContentW;
        }

        var leftOrigin = Math.max(SHEET_MARGIN, (SHEET.width - totalW) / 2);
        var frontBox = { left: leftOrigin, right: leftOrigin + frontBoxWidth };
        var sideBox = { left: frontBox.right + gap, right: frontBox.right + gap + sideContentW };
        var frontMid = (frontBox.left + frontBox.right) / 2;
        var sideMid = (sideBox.left + sideBox.right) / 2;

        /* A hexagon stands on its corners (height = e); a square nut shows its
           square face, so its height is the width across flats. */
        var frontHalfY = (square ? acrossFlats : corners) / 2 * sc;
        var frontRadius = frontHalfY;
        var frontCx = frontMid;
        var frontTop = AXIS_Y - frontHalfY;
        var frontBottom = AXIS_Y + frontHalfY;
        var left = sideMid - corners / 2 * sc;
        var right = sideMid + corners / 2 * sc;
        var top = AXIS_Y - height / 2 * sc;
        var bottom = AXIS_Y + height / 2 * sc;
        var boreR = d / 2 * sc;
        var minorR = minorD / 2 * sc;
        /* A 30 degree countersink at both faces, sized to clear the thread
           major diameter. */
        var chamferTargetOpen = d / 2 + Math.max(0.12 * pitch, 0.15);
        var chamferAxialMM = Math.min(height * 0.22,
            (chamferTargetOpen - minorD / 2) / TAN30);
        var chamferRadialMM = chamferAxialMM * TAN30;
        var chamferPx = chamferAxialMM * sc;
        var chamferOpenR = (minorD / 2 + chamferRadialMM) * sc;

        var nylonInsertMM = Math.min(NYLON_INSERT_MM, Math.max(height - 0.2, 0));
        var insertBottom = nylon ? top + nylonInsertMM * sc : top;

        /* Outer chamfer: the end face is turned back to the inscribed circle
           (diameter across flats), so each corner is cut by (R - s/2)/tan30
           along the axis. It is limited so a jam nut stays recognisable. */
        var outerChamferMM = Math.min(
            (corners / 2 - acrossFlats / 2) * TAN30,
            height * 0.18
        );
        var outerDrop = Math.max(outerChamferMM * sc, 1.5);
        var nylonInnerR = Math.max(minorR * 0.82, 1);

        /* Chamfer boundary of one visible facet: the curve is highest in the
           middle of the facet and drops to the facet ends. */
        function chamferSegment(x1, x2, yValley, yPeak) {
            var cx = (x1 + x2) / 2;
            var cy = 2 * yPeak - yValley;

            return " Q" + coord(cx) + " " + coord(cy) + " " +
                coord(x2) + " " + coord(yValley);
        }

        var parts = [];

        layoutReset();

        /* ---------------- front view: the nut seen on its bearing face ---- */

        if (square) {
            parts.push(svgBox("fastener-part", frontCx - acrossFlats / 2 * sc, frontTop,
                frontCx + acrossFlats / 2 * sc, frontBottom));
        } else {
            parts.push(svgPolygon("fastener-part",
                hexPoints(frontCx, AXIS_Y, frontRadius)));
        }

        /* Bore: the end face is turned back to the inscribed circle, the hole
           carries the thread. */
        parts.push(svgCircle("fastener-thin", frontCx, AXIS_Y, acrossFlats / 2 * sc));

        /* Internal thread, simplified ISO convention: the drilled crest is the
           solid circle, the thread major diameter a thin three-quarter circle. */
        parts.push(svgCircle("fastener-void", frontCx, AXIS_Y, minorR));
        parts.push(svgCircle("fastener-part-line", frontCx, AXIS_Y, minorR));
        parts.push(svgPath("fastener-thin",
            "M" + coord(frontCx + boreR) + " " + coord(AXIS_Y) +
            " A" + coord(boreR) + " " + coord(boreR) + " 0 1 1 " +
            coord(frontCx) + " " + coord(AXIS_Y - boreR)));

        if (nylon) {
            /* The insert ring closes the bore inside the top of the nut, so it
               is hidden in this view. */
            parts.push(svgCircle("fastener-hidden-thin", frontCx, AXIS_Y, nylonInnerR));
        }

        parts.push(centreCross(frontCx, AXIS_Y, frontRadius));
        layoutKeep(frontCx - frontRadius, frontTop, frontCx + frontRadius, frontBottom);

        /* ---------------- side view: orthographic projection ---------------- */

        /* Projected across the corners, the body is e wide by m high. Four
           edges are visible: the two outer corners, and the two lines where
           the front flat meets the side flats. The 30 degree chamfer is a
           cone, so each visible facet shows it as a curve that touches the
           end face in the middle of the facet and falls away at its ends. */
        var sideChamferDrop = Math.min(outerDrop, (bottom - top) * 0.35);
        var flatHalf = (square ? acrossFlats / 2 : corners / 4) * sc;
        var edgeL = sideMid - flatHalf;
        var edgeR = sideMid + flatHalf;
        var bodyPath;

        if (square) {
            bodyPath = "M" + coord(left) + " " + coord(top + sideChamferDrop) +
                chamferSegment(left, right, top + sideChamferDrop, top) +
                " V" + coord(bottom - sideChamferDrop) +
                chamferSegment(right, left, bottom - sideChamferDrop, bottom) + " Z";
        } else {
            bodyPath = "M" + coord(left) + " " + coord(top + sideChamferDrop) +
                chamferSegment(left, edgeL, top + sideChamferDrop, top) +
                chamferSegment(edgeL, edgeR, top + sideChamferDrop, top) +
                chamferSegment(edgeR, right, top + sideChamferDrop, top) +
                " V" + coord(bottom - sideChamferDrop) +
                chamferSegment(right, edgeR, bottom - sideChamferDrop, bottom) +
                chamferSegment(edgeR, edgeL, bottom - sideChamferDrop, bottom) +
                chamferSegment(edgeL, left, bottom - sideChamferDrop, bottom) + " Z";
        }

        parts.push(svgPath("fastener-part", bodyPath));

        if (!square) {
            /* Visible edges between the front flat and the side flats. */
            parts.push(svgLine("fastener-part-line", edgeL, top + sideChamferDrop,
                edgeL, bottom - sideChamferDrop));
            parts.push(svgLine("fastener-part-line", edgeR, top + sideChamferDrop,
                edgeR, bottom - sideChamferDrop));
        }

        /* Hidden geometry of the bore. The thread crest (minor diameter) is the
           heavier dashed pair, the thread major diameter the lighter one; both
           stop where the face countersink begins. */
        parts.push(svgLine("fastener-hidden-thin", sideMid - boreR, top + chamferPx,
            sideMid - boreR, bottom - chamferPx));
        parts.push(svgLine("fastener-hidden-thin", sideMid + boreR, top + chamferPx,
            sideMid + boreR, bottom - chamferPx));
        parts.push(svgLine("fastener-hidden", sideMid - minorR, top + chamferPx,
            sideMid - minorR, bottom - chamferPx));
        parts.push(svgLine("fastener-hidden", sideMid + minorR, top + chamferPx,
            sideMid + minorR, bottom - chamferPx));

        /* The 30 degree countersink at each face, hidden behind the body. */
        parts.push(svgLine("fastener-hidden-thin",
            sideMid - minorR, top + chamferPx, sideMid - chamferOpenR, top));
        parts.push(svgLine("fastener-hidden-thin",
            sideMid + minorR, top + chamferPx, sideMid + chamferOpenR, top));
        parts.push(svgLine("fastener-hidden-thin",
            sideMid - minorR, bottom - chamferPx, sideMid - chamferOpenR, bottom));
        parts.push(svgLine("fastener-hidden-thin",
            sideMid + minorR, bottom - chamferPx, sideMid + chamferOpenR, bottom));

        if (nylon) {
            /* The insert ring closes the bore near the top face: its underside
               and its smaller bore are hidden, and stay inside the bore. */
            parts.push(svgLine("fastener-hidden-thin", sideMid - boreR, insertBottom,
                sideMid + boreR, insertBottom));
            parts.push(svgLine("fastener-hidden-thin", sideMid - nylonInnerR, top,
                sideMid - nylonInnerR, insertBottom));
            parts.push(svgLine("fastener-hidden-thin", sideMid + nylonInnerR, top,
                sideMid + nylonInnerR, insertBottom));
        }

        parts.push(svgLine("fastener-centre", sideMid, top - 18, sideMid, bottom + 18));

        layoutKeep(left, top, right, bottom);

        /* ---------------- dimensions ---------------- */

        /* e, the width across corners: on a hexagon standing on its corners
           that is the full height of the front view, so it gets its own line
           outside the body, clear of the s dimension below and of the bore
           leader above. A square nut has its corners on the diagonals, which
           this elevation does not measure. */
        if (!square) {
            parts.push(dimV({
                y1: frontTop,
                y2: frontBottom,
                x: frontCx + frontRadius + 26,
                side: "right",
                from: [
                    [frontCx, frontTop],
                    [frontCx, frontBottom]
                ],
                key: "acrossCorners"
            }));
        }

        /* s, the width across flats: dimension line clear below the body, its
           label above that line, between the nut and the line. */
        var flatWitnessY = square
            ? AXIS_Y + acrossFlats / 2 * sc
            : AXIS_Y + corners / 4 * sc;
        parts.push(dimH({
            x1: frontCx - acrossFlats / 2 * sc,
            x2: frontCx + acrossFlats / 2 * sc,
            y: frontBottom + 32,
            from: [
                [frontCx - acrossFlats / 2 * sc, flatWitnessY],
                [frontCx + acrossFlats / 2 * sc, flatWitnessY]
            ],
            key: "acrossFlats"
        }));

        var dLabelY = Math.max(frontTop - 34, 66);
        parts.push(leaderNote({
            to: [frontCx - boreR * 0.71, AXIS_Y - boreR * 0.71],
            key: "diameter",
            cands: [
                { x: frontCx, y: dLabelY, anchor: "middle" },
                { x: frontCx - frontRadius * 0.5, y: dLabelY, anchor: "middle" },
                { x: frontCx + frontRadius * 0.5, y: dLabelY, anchor: "middle" }
            ]
        }));

        /* ---------------- DETAIL A: the internal thread form -------------
           At the scale of a nut one turn is a few pixels wide, so the pitch
           cannot be dimensioned inside the side view. The thread form of
           ISO 68-1 (60 degree flanks, P/8 crest flat, P/4 root flat) is
           therefore repeated at a readable scale under the side view, drawn
           as the nut wall with the bore below it, and P is dimensioned there
           with its label above the dimension line. */
        var detailTurn = 34;
        var detailDepth = STUD_DEPTH * detailTurn;
        var detailWall = 12;
        var detailTopY = bottom + 34;
        var detailCrestY = detailTopY + detailWall + detailDepth;
        var detailXa = sideMid - 1.5 * detailTurn;
        var detailXb = detailXa + 3 * detailTurn;

        parts.push(svgPath("fastener-part",
            studPolyline(studThreadEdge(detailXa, detailXb, detailCrestY, 0,
                -detailDepth, detailTurn, 1))));
        parts.push(svgLine("fastener-part", detailXa, detailTopY,
            detailXb, detailTopY));
        parts.push(svgLine("fastener-part", detailXa, detailTopY,
            detailXa, detailCrestY));
        parts.push(svgLine("fastener-part", detailXb, detailTopY,
            detailXb, detailCrestY));
        parts.push(svgText("fastener-note", caption("detailA") || "DETAIL A · 60°", detailXb,
            detailTopY - 8, "end"));
        layoutKeep(detailXa - 6, detailTopY - 2, detailXb + 6, detailCrestY + 6);

        var detailCrest1 = detailXa + STUD_CREST * detailTurn / 2;

        parts.push(dimH({
            x1: detailCrest1,
            x2: detailCrest1 + detailTurn,
            y: detailCrestY + 28,
            from: [
                [detailCrest1, detailCrestY + 2],
                [detailCrest1 + detailTurn, detailCrestY + 2]
            ],
            key: "pitch"
        }));

        parts.push(dimV({
            y1: top,
            y2: bottom,
            x: right + 22,
            side: "right",
            from: [
                [right, top],
                [right, bottom]
            ],
            key: "nutHeight"
        }));

        var content = sheetChrome() + parts.join("") +
            viewCaptions(frontMid, sideMid);

        LABEL_SIZE = savedLabelSize;

        return {
            svg: sheetSvg(product.name +
                ", front view and side view, dimensions in " + unitWord(),
                content, narrowSheet ? "fastener-drawing--narrow" : ""),
            caption: String(tr(product.name)).trim() + " — " +
                String(tr("front view and side view, dimensions in")).trim() + " " + unitWord()
        };
    }

    /* ==================================================
       DRAWING DISPATCH
    ================================================== */

    /* On a phone the sheet keeps a readable minimum width and scrolls. Frame
       the two views symmetrically in that scroll window, not the whole sheet. */
    function centreDrawingScroll() {
        function place() {
            var overflow = diagramViews.scrollWidth - diagramViews.clientWidth;

            if (overflow <= 0) {
                return;
            }

            var svg = diagramViews.querySelector("svg");
            var titles = diagramViews.querySelectorAll(".fastener-view-title");

            if (svg && titles.length === 2) {
                var viewBoxWidth = svg.viewBox && svg.viewBox.baseVal
                    ? svg.viewBox.baseVal.width
                    : 760;
                var scale = svg.getBoundingClientRect().width / viewBoxWidth;
                var first = parseFloat(titles[0].getAttribute("x")) * scale;
                var second = parseFloat(titles[1].getAttribute("x")) * scale;
                var drawing = svg.__sheetDrawing;
                var span = drawing ? sheetInkSpan(svg, drawing) : null;
                var target = (first + second) / 2 - diagramViews.clientWidth / 2;

                /* When the whole sheet fits the window, frame the drawing
                   itself; a sheet wider than the window is framed between the
                   two view labels so both stay readable while it scrolls. */
                if (span && (span.maxX - span.minX) * scale <= diagramViews.clientWidth) {
                    target = (span.minX + span.maxX) / 2 * scale -
                        diagramViews.clientWidth / 2;
                }

                diagramViews.scrollLeft = target;
            } else {
                diagramViews.scrollLeft = overflow / 2;
            }
        }

        /* Reading the metrics lays the new sheet out, so the scroll window can
           be framed straight away; a frame later only repeats it for browsers
           whose metrics settle after the swap. */
        place();

        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(place);
        }
    }

    function renderDrawing() {
        var product = currentProduct();
        var fixed = fixedReferenceDrawing(product);
        /* The cached sheet also carries the standard name and the unit note in
           its chrome, so those join the key: a unit or standard switch repaints
           the same geometry with the right header instead of a stale one. */
        var standard = currentStandard();
        var fixedKey = fixed
            ? "fixed:" + product.key + ":" + (standard ? standard.id : "") + ":" + state.unit
            : null;

        /* Bolt types own one fixed reference image each. Once it is on the page
           the same SVG is kept - the picture is not rebuilt - and only the
           dimension labels are rewritten with the values of the selected size.
           Nuts and studs are drawn from the values in the form, so they are
           rebuilt on every change and never take this path. */
        if (fixedKey !== null && fixedKey === currentSheetKey) {
            updateDrawingLabels();
            return;
        }

        var sheet = product.category === "nuts"
            ? nutSheet(product)
            : (product.key === "threaded-rod"
                ? threadedRodSheet(product)
                : (product.category === "studs" ? studSheet(product) : boltSheet(product)));

        diagramViews.className = "diagram-views";
        diagramViews.setAttribute("data-i18n-skip", "");
        diagramViews.setAttribute("aria-label", sheet.caption);
        diagramViews.innerHTML = sheet.svg;
        currentSheetKey = fixedKey;
        centreSheet();
        centreDrawingScroll();

        /* Label widths only settle once the sheet has been laid out with the
           page face, so the centring is repeated after layout and fonts. */
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(function () {
                centreSheet();
                centreDrawingScroll();
            });
        }

        if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
            document.fonts.ready.then(function () {
                centreSheet();
            });
        }
    }

    function updateDrawingLabels() {
        diagramViews.querySelectorAll("[data-dim]").forEach(function (node) {
            var key = node.getAttribute("data-dim");
            var symbol = node.getAttribute("data-symbol") || null;
            var mmOnly = node.getAttribute("data-unit-mode") === "mm";

            node.textContent = mmOnly ? dimTextMM(key, symbol) : dimText(key, symbol);
        });

        /* The picture is unchanged, so its description only follows the
           selected display unit. */
        var product = currentProduct();

        diagramViews.setAttribute("aria-label", tr(product.name) + " — " +
            tr("front view and side view, dimensions in") + " " + unitWord());
    }

    /* ==================================================
       NOTES UNDER THE SELECTIONS
    ================================================== */
    function updateStandardMeta() {
        if (!standardMeta) {
            return;
        }

        var standard = currentStandard();
        var family = STANDARD_FAMILIES[standard.family] || STANDARD_FAMILIES.custom;

        if (state.familyFallback) {
            var requested = STANDARD_FAMILIES[state.familyId] || family;

            standardMeta.textContent = requested.label +
                " — no verified product standard is available for this product. " +
                "Custom dimensions are active; no unrelated standard has been substituted.";
            return;
        }

        if (standard.family === "custom") {
            standardMeta.textContent = "User-defined dimensions — no published standard claimed.";
            return;
        }

        var verification = VERIFICATION_LABELS[standard.verification] || standard.verification;
        var published = standard.published ? " (" + standard.published + ")" : "";
        var note = standard.verificationNote ? " — " + tr(standard.verificationNote) : "";
        var sizes = standard.sizes || [];
        var sizeRange = sizes.length
            ? sizes[0].label + " – " + sizes[sizes.length - 1].label +
                " (" + sizes.length + " " + tr("sizes") + ")"
            : tr("No tabulated sizes");
        /* A stud standard lists coarse sizes and then its fine diameter/pitch
           pairs. Reporting them as one span (M2 – M72×6) would hide the fine
           series, so both are named. */
        var coarseSizes = sizes.filter(function (size) {
            return size.threadSeries && size.threadSeries !== "fine";
        });
        var fineSizes = sizes.filter(function (size) {
            return size.threadSeries === "fine";
        });

        if (coarseSizes.length && fineSizes.length) {
            sizeRange = coarseSizes[0].label + " – " +
                coarseSizes[coarseSizes.length - 1].label + " " + tr("coarse") + ", " +
                fineSizes[0].label + " – " + fineSizes[fineSizes.length - 1].label +
                " " + tr("fine") + " (" + sizes.length + " " +
                tr("size/pitch combinations") + ")";
        }

        var system = tr(standard.inch ? "Inch series" : "Metric series");
        var country = standard.country ? tr(standard.country) + " · " : "";
        var status = standard.standardStatus
            ? " · " + tr("Status:") + " " + localizeStatus(standard.standardStatus) : "";
        var applicability = standard.applicability === "head-geometry"
            ? tr("Head geometry only — this standard does not specify the product")
            : tr("Directly applicable to this product");

        standardMeta.textContent = country + tr(family.organization) + " · " +
            tr(standard.title) + " · " + localizeEdition(standard.edition) + published + status + " · " +
            system + " · " + tr("Sizes:") + " " + sizeRange + " · " + applicability +
            " · " + tr("Source:") + " " + localizeSource(standard.source) +
            " · " + tr("Verification:") + " " + tr(verification) +
            (note ? " — " + tr(standard.verificationNote) : "");
    }

    function refreshNotes() {
        var product = currentProduct();
        var standard = currentStandard();

        if (state.familyFallback) {
            var requestedFamily = STANDARD_FAMILIES[state.familyId] || STANDARD_FAMILIES.custom;
            var category = product.category === "bolts" ? "bolt" :
                (product.category === "studs" ? "stud" : "nut");

            standardNote.textContent = tf("{family} has no verified {category} standard in this calculator. Custom dimensions are active so no unrelated standard is substituted; enter your dimensions or choose another standard family.", {
                family: requestedFamily.label,
                category: tr(category)
            });
        } else if (!standard.sizes.length) {
            standardNote.textContent = tr("Custom dimensions: type every dimension yourself.") + " " +
                tr("The drawing and the calculation update with your values.");
        } else if (standard.applicability === "head-geometry") {
            standardNote.textContent = tf("{name} size table, head geometry only: the blank is drawn with the s, e and k of this standard and a plain, unthreaded shank.", { name: standard.name });
        } else {
            standardNote.textContent = tf("{name} size table. Choosing a size fills in its standard dimensions; every filled value can still be edited.", { name: standard.name });
        }

        updateStandardMeta();

        var notes = [];

        if (product.key === "hex-ft") {
            notes.push("A fully threaded bolt carries thread over its whole length, " +
                "so no separate thread length is needed.");
        }

        if (product.key === "hex-ht") {
            notes.push("The thread length follows " + standard.name +
                " for the selected length. You can type your own value.");
        }

        if (product.key === "hex-blank") {
            notes.push("A hexagon head blank is the unthreaded preform a bolt is made " +
                "from: a hexagon head on a plain shank, no pitch and no thread length. " +
                "No published standard defines the blank itself, so the selected " +
                "standard supplies the head dimensions only.");
        }

        if (product.key === "socket-head" || product.key === "countersunk") {
            notes.push("Thread length follows the selected standard; " +
                "edit it if your part has a different threaded length.");
        }

        if (product.key === "carriage") {
            notes.push("Carriage bolt length is measured under the head to the end of the shank.");
        }

        if (product.key === "stud-de") {
            notes.push("Double end studs have thread at both ends and a plain shank in " +
                "the middle. " + standard.name + " engagement end: " +
                studEngagementText(standard) + "; the nut end follows the same " +
                "standard. Both lengths stay editable, and the shank is what is " +
                "left between them.");
        }

        if (product.key === "stud-ft" || product.key === "threaded-rod") {
            notes.push("Thread runs over the whole length, so the whole rod is " +
                "calculated with the thread profile and not as a plain cylinder.");
        }

        if (product.key === "lock-nut") {
            notes.push("The nylon collar of a lock nut is not metal; " +
                NYLON_INSERT_MM + " mm of its height is left out of the weight.");
        }

        if (product.category === "nuts") {
            notes.push("The bore is the average of the major and minor thread areas, " +
                "so the thread is counted once, not as a plain hole.");
        }

        dimensionNote.textContent = notes.join(" ");
    }

    /* ==================================================
       DENSITY DISPLAY
    ================================================== */
    function selectedMaterial() {
        return MATERIALS[materialSelect.value] || null;
    }

    function currentDensity() {
        if (materialSelect.value === "custom") {
            return window.MWNumber ? MWNumber.parse(customDensity.value) : (window.MWNumber ? MWNumber.parse(customDensity.value) : Number(customDensity.value));
        }

        var material = selectedMaterial();

        return material ? material.density : NaN;
    }

    function updateDensityDisplay() {
        if (materialSelect.value === "custom") {
            customDensityBox.classList.add("visible");
            var value = window.MWNumber ? MWNumber.parse(customDensity.value) : (window.MWNumber ? MWNumber.parse(customDensity.value) : Number(customDensity.value));

            densityInfo.textContent = isFinite(value) && value > 0
                ? "Custom — " + formatNumber(value, 2) + " g/cm³"
                : "Custom — enter a density";
            return;
        }

        customDensityBox.classList.remove("visible");
        var material = selectedMaterial();

        densityInfo.textContent = material
            ? material.name + " — " + formatNumber(material.density, 2) + " g/cm³"
            : "Enter a custom density";
    }

    /* ==================================================
       VALIDATION
    ================================================== */
    function readRequired(key, allowZero) {
        var input = fieldInput(key);
        var field = FIELD_DEFS[key];
        var raw = input.value.trim();

        if (raw === "") {
            showError(field.label + " is required. Please enter a value.", input);
            return null;
        }

        var value = window.MWNumber ? MWNumber.parse(raw) : Number(raw);

        if (!isFinite(value)) {
            showError(field.label + " must be a number.", input);
            return null;
        }

        if (value < 0 || (!allowZero && value === 0)) {
            showError(field.label + (allowZero
                ? " must be zero or greater."
                : " must be greater than zero."), input);
            return null;
        }

        return value;
    }

    function collectForm() {
        clearError();
        clearInvalid();

        var product = currentProduct();
        var values = {};
        var failed = false;
        var zeroThreadAllowed = ["carriage", "socket-head", "countersunk"]
            .indexOf(state.productKey) !== -1;

        product.fields.forEach(function (key) {
            if (failed) {
                return;
            }

            var value = readRequired(
                key,
                zeroThreadAllowed && key === "threadLength"
            );

            if (value === null) {
                failed = true;
                return;
            }

            values[key] = value;
        });

        if (failed) {
            return null;
        }

        var quantityValue = window.MWNumber ? MWNumber.parse(quantity.value) : (window.MWNumber ? MWNumber.parse(quantity.value) : Number(quantity.value));

        if (!isFinite(quantityValue) || !Number.isInteger(quantityValue) ||
            quantityValue < 1) {
            showError("Quantity must be a positive whole number.", quantity);
            return null;
        }

        if (quantityValue > 1000000) {
            showError("Quantity is too large. Enter 1,000,000 or less.", quantity);
            return null;
        }

        if (values.length !== undefined && values.threadLength !== undefined) {
            if (values.threadLength > values.length) {
                showError("Thread length cannot be longer than the overall length.",
                    fieldInput("threadLength"));
                return null;
            }
        }

        if (values.threadLength2 !== undefined && values.length !== undefined) {
            if (values.threadLength + values.threadLength2 > values.length) {
                showError("The two thread lengths together are longer than the stud.",
                    fieldInput("threadLength2"));
                return null;
            }
        }

        if (values.acrossFlats !== undefined && values.diameter !== undefined &&
            values.nutHeight !== undefined && values.acrossFlats <= values.diameter) {
            showError("Width across flats must be larger than the nominal diameter.",
                fieldInput("acrossFlats"));
            return null;
        }

        if (product.key === "lock-nut" && values.nutHeight <= NYLON_INSERT_MM) {
            showError("Nut height is too small for a nylon insert lock nut.",
                fieldInput("nutHeight"));
            return null;
        }

        if (values.headDiameter !== undefined && values.diameter !== undefined &&
            values.headDiameter <= values.diameter) {
            showError("Head diameter must be larger than the shank diameter.",
                fieldInput("headDiameter"));
            return null;
        }

        if (values.socketAcrossFlats !== undefined) {
            if (values.socketAcrossFlats >= values.headDiameter) {
                showError("The socket must be smaller than the head diameter.",
                    fieldInput("socketAcrossFlats"));
                return null;
            }

            if (values.socketDepth >= values.headHeight) {
                showError("The socket depth must be smaller than the head height.",
                    fieldInput("socketDepth"));
                return null;
            }
        }

        if (values.neckAcrossFlats !== undefined &&
            values.neckAcrossFlats <= values.diameter) {
            showError("The square neck must be larger than the shank diameter.",
                fieldInput("neckAcrossFlats"));
            return null;
        }

        var density = currentDensity();

        if (materialSelect.value === "custom" &&
            (!isFinite(density) || density <= 0)) {
            showError("Enter a custom density greater than zero.", customDensity);
            return null;
        }

        return {
            values: values,
            quantity: quantityValue,
            density: density,
            factor: mmFactor()
        };
    }

    /* ==================================================
       RESULTS
    ================================================== */
    /* One short line for the history table: standard, size and length. */
    function itemDetail(form) {
        var standard = currentStandard();
        var parts = [standard.name.replace(/\s*\(.*\)$/, "")];

        if (state.sizeLabel) {
            parts.push(state.sizeLabel);
        }

        if (form.values.length !== undefined) {
            parts.push("L " + formatDimension(form.values.length * form.factor));
        }

        return parts.join(" · ");
    }

    function renderResult(result, form) {
        var product = currentProduct();

        results.classList.add("visible");

        $("totalWeight").textContent = formatKg(result.totalWeight);
        $("totalPounds").textContent = formatLbs(result.totalPounds);
        $("unitWeightKg").textContent = formatKg(result.singleWeight);
        $("unitWeightLbs").textContent = formatLbs(result.singlePounds);
        $("resultQuantity").textContent = formatNumber(result.quantity, 0) + " pc";
        $("resultVolume").textContent = formatNumber(result.volumeMM3 / 1000, 2) + " cm³";
        $("resultStressArea").textContent = formatNumber(result.stressAreaMM2, 1) + " mm²";
        $("resultDensity").textContent = formatNumber(result.density, 2) + " g/cm³";

        /* The dimension line lists exactly the values that were calculated. */
        var dimensions = [currentStandard().name];

        product.fields.forEach(function (key) {
            var symbol = key === "threadLength2" ? "b2" : FIELD_DEFS[key].symbol;

            dimensions.push(symbol + " " + formatDimension(form.values[key] * form.factor));
        });

        dimensions.push(result.materialName || "Custom Material");
        dimensions.push("Quantity " + formatNumber(result.quantity, 0));

        $("resultDimensions").textContent = dimensions.join(" · ");

        /* Record for the shared history drawer. Values stay in the unit the
           user entered, with the same unit string the other pages supply. */
        var values = {};
        product.fields.forEach(function (key) {
            values[key] = form.values[key];
        });

        lastCalculation = {
            values: values,
            unit: state.unit,
            density: result.density,
            materialName: result.materialName ||
                (materialSelect.value === "custom" ? "Custom Material" : selectedMaterial().name),
            quantity: result.quantity,
            singleWeight: result.singleWeight,
            totalWeight: result.totalWeight
        };
    }

    /* ==================================================
       CALCULATE
    ================================================== */
    function calculate() {
        if (isCalculating) {
            return;
        }

        /* A failed or changed calculation must never feed the previous result
           into the shared history drawer. */
        lastCalculation = null;

        var form = collectForm();

        if (!form) {
            return;
        }

        var payload = {
            product: state.productKey,
            standard: state.standardId,
            size: state.sizeLabel,
            values: form.values,
            unit: state.unit,
            density: form.density,
            quantity: form.quantity,
            material: materialSelect.value
        };

        isCalculating = true;

        window.MWCalc.calculate("nut-bolt", payload).then(function (result) {
            renderResult(result, form);
        }).catch(function (error) {
            if (error && (error.cancelled || error.kind === "cancelled")) {
                return;
            }
            showError(error.message || "The calculation could not be completed.",
                error.field ? fieldInput(error.field) : null);
        }).finally(function () {
            isCalculating = false;
        });
    }

    /* ==================================================
       UNIT SWITCH
    ================================================== */
    function changeUnit(nextUnit) {
        if (nextUnit === state.unit) {
            return;
        }

        /* Only the unit changes: every field keeps exactly the number the
           user typed and that number is re-read in the newly selected unit
           (100 mm -> 100 in, never 3.937). The millimetre model behind the
           calculation is refreshed from what is on screen. */
        var hadResult = results.classList.contains("visible");

        state.unit = nextUnit;
        lastCalculation = null;

        document.querySelectorAll("[data-field]").forEach(function (input) {
            rememberMMValue(input.dataset.field);
        });

        updateUnitButtons();
        updateFieldLabels();
        renderDrawing();
        unitNote.textContent = nextUnit === "in"
            ? "All dimensions are in inches."
            : "All dimensions are in millimeters.";
        refreshNotes();
        clearInvalid();
        clearError();

        /* A visible result is refreshed with the same numbers; an invalid
           combination after the switch hides it instead of showing a stale
           figure from the previous unit. */
        hideResults();

        if (hadResult) {
            calculate();
        }
    }

    /* ==================================================
       RESET
    ================================================== */
    function resetForm() {
        /* A reset clears the entries but keeps the site-wide MM / INCHES unit,
           so the switch never moves back to MM here. */
        state.category = "bolts";
        state.familyId = "iso";
        state.familyFallback = false;
        state.touched = {};
        lastCalculation = null;

        categoryTabs.forEach(function (tab) {
            var active = tab.dataset.category === state.category;

            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
            tab.tabIndex = active ? 0 : -1;
            if (active && dimensionFields) {
                dimensionFields.setAttribute("aria-labelledby", tab.id);
            }
        });

        materialSelect.value = "carbon-steel";
        customDensity.value = "";
        quantity.value = "1";
        updateDensityDisplay();
        updateUnitButtons();

        populateProductSelect("hex-ft");
        clearResultState();
    }

    /* ==================================================
       EVENTS
    ================================================== */
    function setCategory(category) {
        state.category = category;

        categoryTabs.forEach(function (tab) {
            var active = tab.dataset.category === category;

            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
            tab.tabIndex = active ? 0 : -1;
            if (active && dimensionFields) {
                dimensionFields.setAttribute("aria-labelledby", tab.id);
            }
        });

        populateProductSelect(lastProductByCategory[category]);
    }

    function bindEvents() {
        categoryTabs.forEach(function (tab) {
            tab.addEventListener("click", function () {
                setCategory(tab.dataset.category);
            });

            tab.addEventListener("keydown", function (event) {
                var current = Array.prototype.indexOf.call(categoryTabs, tab);
                var next = current;

                if (event.key === "ArrowLeft") {
                    next = (current - 1 + categoryTabs.length) % categoryTabs.length;
                } else if (event.key === "ArrowRight") {
                    next = (current + 1) % categoryTabs.length;
                } else if (event.key === "Home") {
                    next = 0;
                } else if (event.key === "End") {
                    next = categoryTabs.length - 1;
                } else {
                    return;
                }

                event.preventDefault();
                var nextTab = categoryTabs[next];
                setCategory(nextTab.dataset.category);
                nextTab.focus();
            });
        });

        productSelect.addEventListener("change", function () {
            loadProduct(productSelect.value);
        });

        standardSelect.addEventListener("change", function () {
            state.standardId = standardSelect.value;
            state.familyFallback = false;
            state.familyId = currentStandard().family;
            lastFamilyByCategory[currentProduct().category] = state.familyId;
            /* Keep the current size when the new standard supports it;
               populateSizes() chooses a valid default when it does not. */
            populateSizes();
            clearResultState();
            refreshNotes();
            renderDrawing();
        });

        sizeSelect.addEventListener("change", function () {
            state.sizeLabel = sizeSelect.value;
            applyPreset(currentSize());
            applyDefaultLengthForCurrentSize();
            clearResultState();
            refreshNotes();
            renderDrawing();
        });

        dimensionFields.addEventListener("input", function (event) {
            var input = event.target.closest("[data-field]");

            if (!input) {
                return;
            }

            var key = input.dataset.field;

            /* The input event also fires for a programmatic value in some
               browsers; only a real visit to the field counts as touched. */
            if (event.isTrusted) {
                state.touched[key] = true;
            }

            /* The shown result described the previous value. This also covers
               the on-screen numeric keypad, whose input events are synthetic. */
            clearResultState();

            input.classList.remove("invalid");
            input.removeAttribute("aria-invalid");

            rememberMMValue(key);

            if (key === "length" || key === "diameter") {
                applyThreadLengths();
            }

            /* Geometry follows the typed values; labels follow the active unit. */
            renderDrawing();
        });

        mmBtn.addEventListener("click", function () {
            changeUnit("mm");
        });

        inchBtn.addEventListener("click", function () {
            changeUnit("in");
        });

        materialSelect.addEventListener("change", function () {
            updateDensityDisplay();

            if (materialSelect.value !== "custom") {
                customDensity.value = "";
            }

            clearResultState();
        });

        customDensity.addEventListener("input", function () {
            updateDensityDisplay();
            clearResultState();
        });
        quantity.addEventListener("input", function () {
            quantity.classList.remove("invalid");
            quantity.removeAttribute("aria-invalid");
            clearResultState();
        });

        calculateBtn.addEventListener("click", calculate);
        resetBtn.addEventListener("click", resetForm);

        var densityToggle = $("fastenerDensityToggle");
        if (densityToggle) {
            densityToggle.addEventListener("click", function () {
                var table = $("fastenerDensityTable");
                var expanded = densityToggle.getAttribute("aria-expanded") === "true";
                var nextExpanded = !expanded;
                var rows = table ? table.querySelectorAll(".density-extra") : [];

                densityToggle.setAttribute("aria-expanded", String(nextExpanded));
                densityToggle.classList.toggle("is-open", nextExpanded);

                rows.forEach(function (row) {
                    row.hidden = !nextExpanded;
                });
            });
        }

        window.addEventListener("resize", centreDrawingScroll);
    }

    /* ==================================================
       START
    ================================================== */
    function init() {
        bindEvents();
        updateUnitButtons();
        /* The note and the field hints belong to the saved unit, exactly as
           they would after a manual switch. */
        updateFieldLabels();
        updateDensityDisplay();
        populateProductSelect("hex-ft");
    }

    init();

    /* Shared history configuration. calculation-history.js is loaded after
       this script and uses the same button, drawer and storage as every other
       calculator page. */
    window.CALCULATOR_HISTORY_CONFIG = {
        calculatorName: "Nut & Bolt Weight Calculator",
        historyKey: "nut-bolt",
        shapeName: function () {
            return currentProduct().shortName + " · " +
                currentStandard().name.replace(/\s*\(.*\)$/, "") +
                (state.sizeLabel ? " · " + state.sizeLabel : "");
        },
        sizeLabels: false,
        dimensions: [
            { key: "diameter", label: "Nominal Diameter (d)" },
            { key: "pitch", label: "Thread Pitch (P)" },
            { key: "length", label: "Length (L)" },
            { key: "threadLength", label: "Thread Length (b)" },
            { key: "threadLength2", label: "Second Thread Length (b2)" },
            { key: "acrossFlats", label: "Width Across Flats (s)" },
            { key: "headHeight", label: "Head Height (k)" },
            { key: "headDiameter", label: "Head Diameter (dk)" },
            { key: "socketAcrossFlats", label: "Socket Width (s)" },
            { key: "socketDepth", label: "Socket Depth (t)" },
            { key: "neckAcrossFlats", label: "Square Neck Width (v)" },
            { key: "neckHeight", label: "Neck Height (f)" },
            { key: "nutHeight", label: "Nut Height (m)" }
        ],
        getCalculation: function () {
            return lastCalculation;
        }
    };

    /* The drawing prints the dimension names of the selected language. */
    window.addEventListener("mw:languagechange", function () {
        try { renderDrawing(); } catch (error) {}
        /* The standard block and the notes are composed at run time, so they
           follow the new language without another selection change. */
        try { refreshNotes(); } catch (error) {}
    });
})();
/* ==================================================
   NUT AND BOLT WEIGHT CALCULATOR END
================================================== */


/* Re-render localized numbers when website language changes. */
window.addEventListener("mw:languagechange", function () {
    /* Input localization listeners run before this one, so the fields are
       already in the new locale. Deferring with a timer caused an extra paint
       of the old numbers followed by a visible replacement. */
    try {
        if (typeof calculate === "function") {
            var hasResult = document.querySelector(".result-panel:not(.hidden), .results-panel:not(.hidden), [id*='result']:not(.hidden)");
            if (hasResult) { calculate(); }
        } else if (typeof calculateWeight === "function") {
            var r = calculateWeight();
            if (r && typeof r.then === "function") r.catch(function(){});
        }
    } catch (e) {}
});
