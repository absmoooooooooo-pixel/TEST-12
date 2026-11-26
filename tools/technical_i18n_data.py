#!/usr/bin/env python3
"""Central terminology for technical drawings, formulas and units.

The English page keeps conventional Latin engineering symbols. Languages that
do not conventionally use Latin initials get native short technical symbols.
The same symbol is used in the drawing, the field legend, the formula and the
worked example.
"""
from __future__ import annotations

LANGUAGES = ["mr", "hi", "en", "de", "es", "fr", "ja", "zh", "pt", "ar"]
NON_LATIN = {"mr", "hi", "ja", "zh", "ar"}

# English source symbol -> semantic key.  Covers every formula legend and
# drawing label in the 24 calculators.
PAGE_TOKENS: dict[str, dict[str, str]] = {
    "box-channel": {"W": "weight", "B": "outerWidth", "H": "outerHeight", "T": "thickness", "L": "length", "ρ": "density"},
    "c-channel": {"W": "weight", "B": "flangeWidth", "H": "overallHeight", "T": "flangeThickness", "T f": "flangeThickness", "Tf": "flangeThickness", "f": "flangeThickness", "T w": "webThickness", "Tw": "webThickness", "w": "webThickness", "L": "length", "ρ": "density"},
    "circular-plate": {"W": "weight", "D": "diameter", "T": "thickness", "ρ": "density"},
    "dish-ends": {"W": "weight", "A": "developedSurfaceArea", "ID": "insideDiameter", "R": "knuckleRadius", "SF": "straightFace", "H": "height", "T": "thickness", "ρ": "density"},
    "e-section": {"W": "weight", "B": "flangeWidth", "H": "overallHeight", "T": "flangeThickness", "T f": "flangeThickness", "Tf": "flangeThickness", "f": "flangeThickness", "T w": "webThickness", "Tw": "webThickness", "w": "webThickness", "L": "length", "ρ": "density"},
    "flange-plate": {"W": "weight", "OD": "outerDiameter", "ID": "innerDiameter", "T": "thickness", "N": "boltHoleCount", "HD": "boltHoleDiameter", "ØHD": "boltHoleDiameter", "PCD": "pitchCircleDiameter", "ρ": "density"},
    "hexagon-bar": {"W": "weight", "A": "acrossFlats", "L": "length", "ρ": "density"},
    "hexagonal-bar-with-round-hole": {"W": "weight", "A": "acrossFlats", "d": "holeDiameter", "L": "length", "ρ": "density"},
    "i-channel": {"W": "weight", "B": "flangeWidth", "H": "overallHeight", "T": "flangeThickness", "T f": "flangeThickness", "Tf": "flangeThickness", "f": "flangeThickness", "T w": "webThickness", "Tw": "webThickness", "w": "webThickness", "L": "length", "ρ": "density"},
    "l-channel": {"W": "weight", "B": "verticalLeg", "A": "horizontalLeg", "T": "thickness", "L": "length", "ρ": "density"},
    "nut-bolt": {"W": "weight", "V": "volume", "ρ": "density", "P": "pitch", "d": "nominalDiameter", "D": "nominalDiameter", "L": "length", "b": "threadLength", "b2": "threadLength2", "s": "acrossFlats", "k": "headHeight", "dk": "headDiameter", "t": "thickness", "v": "neckAcrossFlats", "f": "neckHeight", "m": "nutHeight", "e": "headAcrossFlats", "H": "height"},
    "pipe": {"W": "weight", "OD": "outerDiameter", "ID": "innerDiameter", "T": "thickness", "L": "length", "ρ": "density"},
    "plate": {"L": "length", "W": "width", "T": "thickness", "ρ": "density"},
    "round-bar": {"W": "weight", "D": "diameter", "L": "length", "ρ": "density"},
    "round-bar-with-hexagonal-hole": {"W": "weight", "D": "outerDiameter", "A": "acrossFlats", "L": "length", "ρ": "density"},
    "shell": {"W": "weight", "OD": "outerDiameter", "T": "shellThickness", "L": "length", "ρ": "density"},
    "solid-cone": {"W": "weight", "H": "height", "D": "baseDiameter", "r": "radius", "V": "volume", "ρ": "density"},
    "sphere-ball": {"W": "weight", "D": "diameter", "r": "radius", "ρ": "density"},
    "square-bar": {"W": "weight", "A": "width", "B": "height", "L": "length", "ρ": "density"},
    "t-channel": {"W": "weight", "B": "flangeWidth", "H": "overallHeight", "T": "flangeThickness", "T f": "flangeThickness", "Tf": "flangeThickness", "f": "flangeThickness", "T w": "webThickness", "Tw": "webThickness", "w": "webThickness", "L": "length", "ρ": "density"},
    "trapezium-bar": {"W": "weight", "A": "firstParallelSide", "B": "secondParallelSide", "H": "perpendicularHeight", "L": "length", "ρ": "density"},
    "trapezoidal-bar": {"W": "weight", "A": "firstParallelSide", "B": "secondParallelSide", "H": "perpendicularHeight", "L": "length", "ρ": "density"},
    "triangular-bar": {"W": "weight", "B": "base", "H": "perpendicularHeight", "L": "length", "ρ": "density"},
    "truncated-cone": {"W": "weight", "D": "largeEndDiameter", "d": "smallEndDiameter", "H": "height", "T": "plateThickness", "R": "radius", "r": "radius", "s": "slantHeight", "A": "lateralArea", "ρ": "density"},
}

# Native short technical symbols.  English, German, Spanish, French and
# Portuguese keep their conventional Latin engineering initials.
SYMBOLS: dict[str, dict[str, str]] = {
    "en": {}, "de": {}, "es": {}, "fr": {}, "pt": {},
    "ja": {
        "weight": "重量", "volume": "体積", "density": "密度", "length": "長さ",
        "width": "幅", "thickness": "厚さ", "firstParallelSide": "第1平行辺",
        "secondParallelSide": "第2平行辺", "perpendicularHeight": "垂直高さ", "base": "底辺",
        "outerWidth": "外幅", "outerHeight": "外高", "flangeWidth": "フランジ幅",
        "overallHeight": "全高", "flangeThickness": "フランジ厚さ", "webThickness": "ウェブ厚さ",
        "verticalLeg": "縦脚", "horizontalLeg": "横脚", "acrossFlats": "二面幅",
        "holeDiameter": "穴径", "diameter": "直径", "outerDiameter": "外径",
        "innerDiameter": "内径", "shellThickness": "胴板厚さ", "boltHoleCount": "穴数",
        "boltHoleDiameter": "穴径", "pitchCircleDiameter": "ピッチ円直径",
        "developedSurfaceArea": "展開面積", "baseDiameter": "底面直径", "radius": "半径",
        "height": "高さ", "slantHeight": "母線長", "lateralArea": "側面積",
        "largeEndDiameter": "大端直径", "smallEndDiameter": "小端直径",
        "plateThickness": "板厚", "pitch": "ピッチ",
        "insideDiameter": "内径", "knuckleRadius": "クラウン半径",
        "straightFace": "直辺", "nominalDiameter": "呼び径",
        "threadLength": "ねじ長さ", "threadLength2": "ねじ長さ",
        "acrossFlats": "二面幅", "headHeight": "頭高さ", "headAcrossFlats": "頭部二面幅",
        "headDiameter": "頭径", "neckAcrossFlats": "首部二面幅",
        "neckHeight": "首部高さ", "nutHeight": "ナット高さ",
    },
    "zh": {
        "weight": "重量", "volume": "体积", "density": "密度", "length": "长",
        "width": "宽", "thickness": "厚", "firstParallelSide": "上底",
        "secondParallelSide": "下底", "perpendicularHeight": "高", "base": "底",
        "outerWidth": "外宽", "outerHeight": "外高", "flangeWidth": "翼缘宽",
        "overallHeight": "总高", "flangeThickness": "翼缘厚", "webThickness": "腹板厚",
        "verticalLeg": "竖边", "horizontalLeg": "横边", "acrossFlats": "对边宽",
        "holeDiameter": "孔径", "diameter": "直径", "outerDiameter": "外径",
        "innerDiameter": "内径", "shellThickness": "壳厚", "boltHoleCount": "孔数",
        "boltHoleDiameter": "孔径", "pitchCircleDiameter": "节圆直径",
        "developedSurfaceArea": "展开面积", "baseDiameter": "底径", "radius": "半径",
        "height": "高", "slantHeight": "母线长", "lateralArea": "侧面积",
        "largeEndDiameter": "大端直径", "smallEndDiameter": "小端直径",
        "plateThickness": "板厚", "pitch": "螺距",
        "insideDiameter": "内径", "knuckleRadius": "过渡半径",
        "straightFace": "直边", "nominalDiameter": "公称直径",
        "threadLength": "螺纹长度", "threadLength2": "螺纹长度",
        "acrossFlats": "对边宽", "headHeight": "头部高度", "headAcrossFlats": "头部对边宽",
        "headDiameter": "头部直径", "neckAcrossFlats": "颈部对边宽",
        "neckHeight": "颈部高度", "nutHeight": "螺母高度",
    },
    "ar": {
        "weight": "الوزن", "volume": "الحجم", "density": "الكثافة", "length": "الطول",
        "width": "العرض", "thickness": "السماكة", "firstParallelSide": "الضلع الأول",
        "secondParallelSide": "الضلع الثاني", "perpendicularHeight": "الارتفاع", "base": "القاعدة",
        "outerWidth": "العرض الخارجي", "outerHeight": "الارتفاع الخارجي",
        "flangeWidth": "عرض الشفة", "overallHeight": "الارتفاع الكلي",
        "flangeThickness": "سماكة الشفة", "webThickness": "سماكة الجذع",
        "verticalLeg": "الساق الرأسية", "horizontalLeg": "الساق الأفقية",
        "acrossFlats": "المسافة بين الوجهين", "holeDiameter": "قطر الثقب",
        "diameter": "القطر", "outerDiameter": "القطر الخارجي", "innerDiameter": "القطر الداخلي",
        "shellThickness": "سماكة القشرة", "boltHoleCount": "عدد الثقوب",
        "boltHoleDiameter": "قطر الثقب", "pitchCircleDiameter": "قطر دائرة الثقوب",
        "developedSurfaceArea": "مساحة السطح المطوّر", "baseDiameter": "قطر القاعدة",
        "radius": "نصف القطر", "height": "الارتفاع", "slantHeight": "طول المائل",
        "lateralArea": "المساحة الجانبية", "largeEndDiameter": "قطر الطرف الكبير",
        "smallEndDiameter": "قطر الطرف الصغير", "plateThickness": "سماكة اللوح",
        "pitch": "خطوة", "insideDiameter": "القطر الداخلي",
        "knuckleRadius": "نصف قطر الانتقال", "straightFace": "الوجه المستقيم",
        "nominalDiameter": "القطر الاسمي", "threadLength": "طول اللولب",
        "threadLength2": "طول اللولب", "acrossFlats": "المسافة بين الوجهين",
        "headHeight": "ارتفاع الرأس", "headDiameter": "قطر الرأس", "headAcrossFlats": "المسافة بين وجوه الرأس",
        "neckAcrossFlats": "المسافة بين وجوه الرقبة", "neckHeight": "ارتفاع الرقبة",
        "nutHeight": "ارتفاع الصمولة",
    },
    "hi": {
        "weight": "वजन", "volume": "आयतन", "density": "घनत्व", "length": "लंबाई",
        "width": "चौड़ाई", "thickness": "मोटाई", "firstParallelSide": "पहली समांतर भुजा",
        "secondParallelSide": "दूसरी समांतर भुजा", "perpendicularHeight": "लंबवत ऊँचाई",
        "base": "आधार", "outerWidth": "बाहरी चौड़ाई", "outerHeight": "बाहरी ऊँचाई",
        "flangeWidth": "फ्लेंज चौड़ाई", "overallHeight": "कुल ऊँचाई",
        "flangeThickness": "फ्लेंज मोटाई", "webThickness": "वेब मोटाई",
        "verticalLeg": "खड़ी भुजा", "horizontalLeg": "क्षैतिज भुजा",
        "acrossFlats": "फलक दूरी", "holeDiameter": "छेद व्यास", "diameter": "व्यास",
        "outerDiameter": "बाहरी व्यास", "innerDiameter": "आंतरिक व्यास",
        "shellThickness": "खोल मोटाई", "boltHoleCount": "छेद संख्या",
        "boltHoleDiameter": "बोल्ट छेद व्यास", "pitchCircleDiameter": "पिच वृत्त व्यास",
        "developedSurfaceArea": "विकसित सतह क्षेत्र", "baseDiameter": "आधार व्यास",
        "radius": "त्रिज्या", "height": "ऊँचाई", "slantHeight": "तिरछी ऊँचाई",
        "lateralArea": "पार्श्व क्षेत्रफल", "largeEndDiameter": "बड़ा सिरा व्यास",
        "smallEndDiameter": "छोटा सिरा व्यास", "plateThickness": "प्लेट मोटाई",
        "pitch": "पिच", "insideDiameter": "आंतरिक व्यास",
        "knuckleRadius": "नकली त्रिज्या", "straightFace": "सीधा फलक",
        "nominalDiameter": "नाममात्र व्यास", "threadLength": "धागा लंबाई",
        "threadLength2": "धागा लंबाई", "acrossFlats": "फलक दूरी",
        "headHeight": "सिर ऊँचाई", "headDiameter": "सिर व्यास", "headAcrossFlats": "सिर फलक दूरी",
        "neckAcrossFlats": "गर्दन फलक दूरी", "neckHeight": "गर्दन ऊँचाई",
        "nutHeight": "नट ऊँचाई",
    },
    "mr": {
        "weight": "वजन", "volume": "घनफळ", "density": "घनता", "length": "लांबी",
        "width": "रुंदी", "thickness": "जाडी", "firstParallelSide": "पहिली समांतर बाजू",
        "secondParallelSide": "दुसरी समांतर बाजू", "perpendicularHeight": "लंबवत उंची",
        "base": "पाया", "outerWidth": "बाहेरील रुंदी", "outerHeight": "बाहेरील उंची",
        "flangeWidth": "फ्लँज रुंदी", "overallHeight": "एकूण उंची",
        "flangeThickness": "फ्लँज जाडी", "webThickness": "वेब जाडी",
        "verticalLeg": "उभा पाय", "horizontalLeg": "आडवा पाय",
        "acrossFlats": "बाजूंतील अंतर", "holeDiameter": "छिद्र व्यास", "diameter": "व्यास",
        "outerDiameter": "बाहेरील व्यास", "innerDiameter": "आंतरिक व्यास",
        "shellThickness": "शेल जाडी", "boltHoleCount": "छिद्र संख्या",
        "boltHoleDiameter": "बोल्ट छिद्र व्यास", "pitchCircleDiameter": "पिच वर्तुळ व्यास",
        "developedSurfaceArea": "विकसित पृष्ठ क्षेत्रफळ", "baseDiameter": "पाया व्यास",
        "radius": "त्रिज्या", "height": "उंची", "slantHeight": "तिरकस उंची",
        "lateralArea": "बाजूचे क्षेत्रफळ", "largeEndDiameter": "मोठ्या टोकाचा व्यास",
        "smallEndDiameter": "लहान टोकाचा व्यास", "plateThickness": "प्लेट जाडी",
        "pitch": "पिच", "insideDiameter": "आंतरिक व्यास",
        "knuckleRadius": "संक्रमण त्रिज्या", "straightFace": "सरळ फलक",
        "nominalDiameter": "नाममात्र व्यास", "threadLength": "धागा लांबी",
        "threadLength2": "धागा लांबी", "acrossFlats": "बाजूंतील अंतर",
        "headHeight": "डोके उंची", "headDiameter": "डोके व्यास", "headAcrossFlats": "डोके बाजूंतील अंतर",
        "neckAcrossFlats": "मान बाजूंतील अंतर", "neckHeight": "मान उंची",
        "nutHeight": "नट उंची",
    },
}

# Visible unit names.  Short forms are used on the segmented toggles so the
# existing 136 px / 112 px controls keep their layout.
UNITS: dict[str, dict[str, dict[str, str]]] = {
    "en": {"mm": {"short": "MM", "name": "Millimeter"}, "in": {"short": "Inches", "name": "Inch"}, "kg": {"short": "kg", "name": "Kilogram"}, "lb": {"short": "lb", "name": "Pound"}, "g_cm3": {"short": "g/cm³", "name": "Gram per cubic centimeter"}, "kg_m3": {"short": "kg/m³", "name": "Kilogram per cubic meter"}},
    "de": {"mm": {"short": "mm", "name": "Millimeter"}, "in": {"short": "Zoll", "name": "Zoll"}, "kg": {"short": "kg", "name": "Kilogramm"}, "lb": {"short": "lb", "name": "Pfund"}, "g_cm3": {"short": "g/cm³", "name": "Gramm pro Kubikzentimeter"}, "kg_m3": {"short": "kg/m³", "name": "Kilogramm pro Kubikmeter"}},
    "es": {"mm": {"short": "mm", "name": "Milímetro"}, "in": {"short": "pulg.", "name": "Pulgada"}, "kg": {"short": "kg", "name": "Kilogramo"}, "lb": {"short": "lb", "name": "Libra"}, "g_cm3": {"short": "g/cm³", "name": "Gramo por centímetro cúbico"}, "kg_m3": {"short": "kg/m³", "name": "Kilogramo por metro cúbico"}},
    "fr": {"mm": {"short": "mm", "name": "Millimètre"}, "in": {"short": "pouce", "name": "Pouce"}, "kg": {"short": "kg", "name": "Kilogramme"}, "lb": {"short": "lb", "name": "Livre"}, "g_cm3": {"short": "g/cm³", "name": "Gramme par centimètre cube"}, "kg_m3": {"short": "kg/m³", "name": "Kilogramme par mètre cube"}},
    "pt": {"mm": {"short": "mm", "name": "Milímetro"}, "in": {"short": "pol.", "name": "Polegada"}, "kg": {"short": "kg", "name": "Quilograma"}, "lb": {"short": "lb", "name": "Libra"}, "g_cm3": {"short": "g/cm³", "name": "Grama por centímetro cúbico"}, "kg_m3": {"short": "kg/m³", "name": "Quilograma por metro cúbico"}},
    "ja": {"mm": {"short": "ミリ", "name": "ミリメートル"}, "in": {"short": "インチ", "name": "インチ"}, "kg": {"short": "kg", "name": "キログラム"}, "lb": {"short": "lb", "name": "ポンド"}, "g_cm3": {"short": "g/cm³", "name": "グラム/立方センチメートル"}, "kg_m3": {"short": "kg/m³", "name": "キログラム/立方メートル"}},
    "zh": {"mm": {"short": "毫米", "name": "毫米"}, "in": {"short": "英寸", "name": "英寸"}, "kg": {"short": "kg", "name": "千克"}, "lb": {"short": "lb", "name": "磅"}, "g_cm3": {"short": "g/cm³", "name": "克/立方厘米"}, "kg_m3": {"short": "kg/m³", "name": "千克/立方米"}},
    "ar": {"mm": {"short": "مم", "name": "مليمتر"}, "in": {"short": "بوصة", "name": "بوصة"}, "kg": {"short": "kg", "name": "كيلوغرام"}, "lb": {"short": "lb", "name": "رطل"}, "g_cm3": {"short": "g/cm³", "name": "غرام/سم³"}, "kg_m3": {"short": "kg/m³", "name": "كيلوغرام/م³"}},
    "hi": {"mm": {"short": "मिमी", "name": "मिलीमीटर"}, "in": {"short": "इंच", "name": "इंच"}, "kg": {"short": "kg", "name": "किलोग्राम"}, "lb": {"short": "lb", "name": "पाउंड"}, "g_cm3": {"short": "g/cm³", "name": "ग्राम/घन सेमी"}, "kg_m3": {"short": "kg/m³", "name": "किग्रा/घन मीटर"}},
    "mr": {"mm": {"short": "मिमी", "name": "मिलिमीटर"}, "in": {"short": "इंच", "name": "इंच"}, "kg": {"short": "kg", "name": "किलोग्राम"}, "lb": {"short": "lb", "name": "पाउंड"}, "g_cm3": {"short": "g/cm³", "name": "ग्रॅम/घन सेमी"}, "kg_m3": {"short": "kg/m³", "name": "किग्रॅ/घन मीटर"}},
}

# Extra keys added to every dictionary so no unit description is left behind.
UNIT_DICTIONARY_KEYS = {
    "Millimeter": lambda u: u["mm"]["name"],
    "Millimeters": lambda u: u["mm"]["name"],
    "Inch": lambda u: u["in"]["name"],
    "Inches": lambda u: u["in"]["short"],
    "Kilogram": lambda u: u["kg"]["name"],
    "Kilograms": lambda u: u["kg"]["name"],
    "Pound": lambda u: u["lb"]["name"],
    "Pounds": lambda u: u["lb"]["name"],
    "MM": lambda u: u["mm"]["short"],
    "KG": lambda u: u["kg"]["short"],
    "LB": lambda u: u["lb"]["short"],
    "g/cm³": lambda u: u["g_cm3"]["short"],
    "kg/m³": lambda u: u["kg_m3"]["short"],
    "Millimeter (mm)": lambda u: u["mm"]["name"] + " (mm)",
    "Inch (in)": lambda u: u["in"]["name"] + " (in)",
    "Kilogram (kg)": lambda u: u["kg"]["name"] + " (kg)",
    "Pound (lb)": lambda u: u["lb"]["name"] + " (lb)",
}


def technical_payload(code: str) -> dict:
    """Section embedded in every dictionary for the runtime drawing module."""
    return {
        "dimensions": SYMBOLS.get(code, {}),
        "units": UNITS.get(code, UNITS["en"]),
        "pageTokens": PAGE_TOKENS,
    }
