#!/usr/bin/env python3
"""Repair systemic multilingual-consistency defects in the source dictionaries.

Run before tools/build_i18n.py:

    python tools/fix_multilingual_consistency.py
    python tools/build_i18n.py

The script is deliberately conservative: it fixes identity overrides, engineering
notation, unit abbreviations and the complete Plate Calculator text set. It does
not invent new pages or change any calculator logic.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
I18N_DIR = PROJECT_ROOT / "frontend" / "i18n"


def load_languages() -> list[str]:
    data = json.loads((I18N_DIR / "languages.json").read_text(encoding="utf-8"))
    return [item["code"] for item in data["languages"] if item["code"] != "en"]


def dictionary_file(code: str):
    return I18N_DIR / code / f"{code}.json"


def load_dictionary(code: str) -> dict:
    return json.loads(dictionary_file(code).read_text(encoding="utf-8"))


def save_dictionary(code: str, data: dict) -> None:
    path = dictionary_file(code)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


# Engineering abbreviations are part of the English master. They are never
# translated, expanded or re-cased in any language.
CANONICAL_ABBREVIATIONS = {
    "mm": "mm",
    "MM": "MM",
    "kg": "kg",
    "KG": "kg",
    "lb": "lb",
    "pc": "pc",
    "pcs": "pcs",
    "g/cm³": "g/cm³",
    "kg/m³": "kg/m³",
}

CANONICAL_TECHNICAL_SHORT = {
    "mm": "MM",
    "in": "Inches",
    "kg": "kg",
    "lb": "lb",
    "g_cm3": "g/cm³",
    "kg_m3": "kg/m³",
}

CANONICAL_TECHNICAL_NAMES = {
    "mm": "Millimeter",
    "in": "Inch",
    "kg": "Kilogram",
    "lb": "Pound",
    "g_cm3": "Gram per cubic centimeter",
    "kg_m3": "Kilogram per cubic meter",
}

# Density and area-density abbreviations are engineering notation, not prose.
# Translations often replace "g/cm³" with native words or Arabic/Devanagari
# digits; every variant is restored to the exact English master notation.
CANONICAL_UNIT_PATTERNS = [
    # Clean up earlier partial replacements before matching slash expressions.
    (re.compile(r"g/cm³\s*(?:مكعب|متر مكعب)"), "g/cm³"),
    (re.compile(r"kg/m³\s*(?:مكعب|متر مكعب)"), "kg/m³"),
    (re.compile(r"kg/m\s*[、，,]\s*3"), "kg/m³"),
    (re.compile(r"(?:千克|公斤)\s*/\s*米\s*[、，,]\s*3"), "kg/m³"),
    (re.compile(r"(?<![A-Za-z])k\s*/\s*m\s*(?:³|3|٣)"), "kg/m³"),
    (re.compile(r"(?:किग्रा|किलो)\s*/\s*वर्ग\s*मीटर"), "kg/m³"),
    (re.compile(r"(?<![A-Za-z])kg\s*/\s*m\s*(?:²|2|٢)(?![0-9])", re.I), "kg/m²"),
    (re.compile(r"(?<![A-Za-z])kg\s*/\s*m\s*(?:³|3|٣)(?![0-9])", re.I), "kg/m³"),
    (re.compile(r"(?<![A-Za-z])g\s*/\s*cm\s*(?:³|3|٣)(?![0-9])", re.I), "g/cm³"),
    (re.compile(
        r"(?:किग्रा|किलोग्राम|किग्रॅ|किलो)\s*/\s*(?:वर्ग\s*)?(?:मीटर|मी\.?|मी|एम|m)\s*(?:²|2|٢)"), "kg/m²"),
    (re.compile(
        r"(?:किग्रा|किलोग्राम|किग्रॅ|किलो)\s*/\s*(?:मीटर|मी\.?|मी|एम|m|घन)\s*(?:³|3|٣)?"), "kg/m³"),
    (re.compile(r"(?:ग्राम|ग्रॅम|जी)\s*/\s*(?:सेमी|घन\s*(?:सेंटीमीटर|सेमी))\s*(?:³|3|٣)?"), "g/cm³"),
    (re.compile(
        r"(?:ب?ال)?(?:كجم|كغ|كيلوجرام|كيلوغرام|كيلو)\s*/\s*(?:م|متر)\s*(?:²|2|٢)"), "kg/m²"),
    (re.compile(
        r"(?:ب?ال)?(?:كجم|كغ|كيلوجرام|كيلوغرام|كيلو)\s*/\s*(?:م|متر)\s*(?:³|3|٣)?"), "kg/m³"),
    (re.compile(
        r"(?:ب?ال)?(?:جم|جرام|غرام|غم)\s*/\s*(?:م|متر)\s*(?:³|3|٣)"), "g/cm³"),
    (re.compile(
        r"(?:ب?ال)?(?:جم|جرام|غرام|غم)\s*/\s*(?:سم|سنتيمتر)(?:\s*مكعب)?\s*(?:³|3|٣)?"), "g/cm³"),
    (re.compile(r"(?:千克|公斤)\s*/\s*(?:平方米|米\s*(?:²|2))"), "kg/m²"),
    (re.compile(r"(?:千克|公斤)\s*/\s*(?:立方米|米\s*(?:³|3))"), "kg/m³"),
    (re.compile(r"(?<!千)克\s*/\s*(?:立方厘米|厘米\s*(?:³|3))"), "g/cm³"),
    (re.compile(r"キログラム\s*/\s*(?:平方メートル|m\s*(?:²|2))"), "kg/m²"),
    (re.compile(r"キログラム\s*/\s*(?:立方メートル|m\s*(?:³|3))"), "kg/m³"),
    (re.compile(r"グラム\s*/\s*(?:立方センチメートル|cm\s*(?:³|3))"), "g/cm³"),
]

# Plate Calculator strings that must keep the English symbols, numbers and unit
# notation exactly while translating only the descriptive words.
PLATE_TRANSLATIONS: dict[str, dict[str, str]] = {
    "Length (L)": {
        "mr": "लांबी (L)", "hi": "लंबाई (L)", "de": "Länge (L)", "es": "Longitud (L)",
        "fr": "Longueur (L)", "ja": "長さ (L)", "zh": "长度 (L)", "pt": "Comprimento (L)",
        "ar": "الطول (L)",
    },
    "Width (W)": {
        "mr": "रुंदी (W)", "hi": "चौड़ाई (W)", "de": "Breite (W)", "es": "Ancho (W)",
        "fr": "Largeur (W)", "ja": "幅 (W)", "zh": "宽度 (W)", "pt": "Largura (W)",
        "ar": "العرض (W)",
    },
    "Thickness (T)": {
        "mr": "जाडी (T)", "hi": "मोटाई (T)", "de": "Dicke (T)", "es": "Espesor (T)",
        "fr": "Épaisseur (T)", "ja": "厚さ (T)", "zh": "厚度 (T)", "pt": "Espessura (T)",
        "ar": "السماكة (T)",
    },
    "Weight (kg) = (L × W × T × ρ) / 10⁶": {
        "mr": "वजन (kg) = (L × W × T × ρ) / 10⁶",
        "hi": "वजन (kg) = (L × W × T × ρ) / 10⁶",
        "de": "Gewicht (kg) = (L × W × T × ρ) / 10⁶",
        "es": "Peso (kg) = (L × W × T × ρ) / 10⁶",
        "fr": "Poids (kg) = (L × W × T × ρ) / 10⁶",
        "ja": "重量 (kg) = (L × W × T × ρ) / 10⁶",
        "zh": "重量 (kg) = (L × W × T × ρ) / 10⁶",
        "pt": "Peso (kg) = (L × W × T × ρ) / 10⁶",
        "ar": "الوزن (kg) = (L × W × T × ρ) / 10⁶",
    },
    "L = Length (mm) · W = Width (mm) · T = Thickness (mm) · ρ = Density (g/cm³)": {
        "mr": "L = लांबी (mm) · W = रुंदी (mm) · T = जाडी (mm) · ρ = घनता (g/cm³)",
        "hi": "L = लंबाई (mm) · W = चौड़ाई (mm) · T = मोटाई (mm) · ρ = घनत्व (g/cm³)",
        "de": "L = Länge (mm) · W = Breite (mm) · T = Dicke (mm) · ρ = Dichte (g/cm³)",
        "es": "L = Longitud (mm) · W = Ancho (mm) · T = Espesor (mm) · ρ = Densidad (g/cm³)",
        "fr": "L = Longueur (mm) · W = Largeur (mm) · T = Épaisseur (mm) · ρ = Densité (g/cm³)",
        "ja": "L = 長さ (mm) · W = 幅 (mm) · T = 厚さ (mm) · ρ = 密度 (g/cm³)",
        "zh": "L = 长度 (mm) · W = 宽度 (mm) · T = 厚度 (mm) · ρ = 密度 (g/cm³)",
        "pt": "L = Comprimento (mm) · W = Largura (mm) · T = Espessura (mm) · ρ = Densidade (g/cm³)",
        "ar": "L = الطول (mm) · W = العرض (mm) · T = السماكة (mm) · ρ = الكثافة (g/cm³)",
    },
    "Material Density (ρ)": {
        "mr": "सामग्रीची घनता (ρ)", "hi": "सामग्री घनत्व (ρ)", "de": "Werkstoffdichte (ρ)",
        "es": "Densidad del material (ρ)", "fr": "Masse volumique du matériau (ρ)",
        "ja": "材料密度 (ρ)", "zh": "材料密度 (ρ)", "pt": "Densidade do material (ρ)",
        "ar": "كثافة المادة (ρ)",
    },
    "Material density (7.85 g/cm³) is multiplied in this step.": {
        "mr": "या चरणात सामग्रीची घनता (7.85 g/cm³) गुणाकार केली जाते.",
        "hi": "इस चरण में सामग्री घनत्व (7.85 g/cm³) को गुणा किया जाता है।",
        "de": "Die Materialdichte (7,85 g/cm³) wird in diesem Schritt multipliziert.",
        "es": "La densidad del material (7,85 g/cm³) se multiplica en este paso.",
        "fr": "La densité du matériau (7,85 g/cm³) est multipliée dans cette étape.",
        "ja": "このステップでは、材料密度 (7.85 g/cm³) を掛けます。",
        "zh": "在此步骤中乘以材料密度 (7.85 g/cm³)。",
        "pt": "A densidade do material (7,85 g/cm³) é multiplicada nesta etapa.",
        "ar": "تُضرب كثافة المادة (7.85 g/cm³) في هذه الخطوة.",
    },
    "Carbon Steel — 7.85 g/cm³": {
        "mr": "कार्बन स्टील — 7.85 g/cm³",
        "hi": "कार्बन स्टील — 7.85 g/cm³",
        "de": "Kohlenstoffstahl — 7,85 g/cm³",
        "es": "Acero al carbono — 7,85 g/cm³",
        "fr": "Acier au carbone — 7,85 g/cm³",
        "ja": "炭素鋼 — 7.85 g/cm³",
        "zh": "碳钢 — 7.85 g/cm³",
        "pt": "Aço carbono — 7,85 g/cm³",
        "ar": "الصلب الكربوني — 7.85 g/cm³",
    },
    "Custom Density — {value} g/cm³": {
        "mr": "सानुकूल घनता — {value} g/cm³",
        "hi": "कस्टम घनत्व — {value} g/cm³",
        "de": "Eigene Dichte — {value} g/cm³",
        "es": "Densidad personalizada — {value} g/cm³",
        "fr": "Masse volumique personnalisée — {value} g/cm³",
        "ja": "カスタム密度 — {value} g/cm³",
        "zh": "自定义密度 — {value} g/cm³",
        "pt": "Densidade personalizada — {value} g/cm³",
        "ar": "كثافة مخصصة — {value} g/cm³",
    },
    "Plate front view showing length L and width W": {
        "mr": "प्लेटचे समोरचे दृश्य, L लांबी व W रुंदी दर्शविते",
        "hi": "प्लेट का सामने का दृश्य, L लंबाई और W चौड़ाई दिखाता है",
        "de": "Vorderansicht der Platte mit Länge L und Breite W",
        "es": "Vista frontal de la placa que muestra la longitud L y el ancho W",
        "fr": "Vue avant de la plaque montrant la longueur L et la largeur W",
        "ja": "板の正面図。L が長さ、W が幅を示します",
        "zh": "板的正视图，显示长度 L 和宽度 W",
        "pt": "Vista frontal da placa mostrando o comprimento L e a largura W",
        "ar": "منظر أمامي للوحة يوضح الطول L والعرض W",
    },
    "Plate side view showing thickness T": {
        "mr": "प्लेटचे बाजूचे दृश्य, T जाडी दर्शविते",
        "hi": "प्लेट का पार्श्व दृश्य, T मोटाई दिखाता है",
        "de": "Seitenansicht der Platte mit Dicke T",
        "es": "Vista lateral de la placa que muestra el espesor T",
        "fr": "Vue latérale de la plaque montrant l'épaisseur T",
        "ja": "板の側面図。T が厚さを示します",
        "zh": "板的侧视图，显示厚度 T",
        "pt": "Vista lateral da placa mostrando a espessura T",
        "ar": "منظر جانبي للوحة يوضح السماكة T",
    },
    "plate front and side engineering views": {
        "mr": "प्लेटची समोर व बाजूची अभियांत्रिकी दृश्ये",
        "hi": "प्लेट के सामने और पार्श्व अभियांत्रिकी दृश्य",
        "de": "Platten-Vorder- und Seitenansicht",
        "es": "vistas de ingeniería frontal y lateral de la placa",
        "fr": "vues techniques de l'avant et du côté de la plaque",
        "ja": "板の正面および側面の工学図",
        "zh": "板的正面和侧面工程视图",
        "pt": "visualizações de engenharia frontal e lateral da placa",
        "ar": "مناظر هندسية أمامية وجانبية للوحة",
    },
    "Why does the weighbridge weight differ from the calculated figure?": {
        "mr": "वेईब्रिजचे वजन गणना केलेल्या आकृतीपेक्षा वेगळे का आहे?",
        "hi": "वेटब्रिज का वजन गणना किए गए आंकड़े से भिन्न क्यों होता है?",
        "de": "Warum weicht das Gewicht auf der Waage vom berechneten Wert ab?",
        "es": "¿Por qué el peso de la báscula puente difiere de la cifra calculada?",
        "fr": "Pourquoi le poids du pont-bascule diffère-t-il du chiffre calculé ?",
        "ja": "計量台の重量が計算値と異なるのはなぜですか？",
        "zh": "地磅重量为何与计算值不同？",
        "pt": "Por que o peso da balança difere do valor calculado?",
        "ar": "لماذا يختلف وزن الميزان عن الشكل المحسوب؟",
    },
    "What does a 2500 × 1250 × 10 mm plate weigh?": {
        "zh": "2500 × 1250 × 10 毫米板材的重量是多少？",
    },
    "What is the weight of a 4 ft × 8 ft plate, 10 mm thick?": {
        "zh": "厚 10 mm 的 4 ft × 8 ft 板材重量是多少？",
        "es": "¿Cuál es el peso de una placa de 4 ft × 8 ft y 10 mm de espesor?",
    },
    "What density should I use for MS, stainless steel and aluminium plate?": {
        "hi": "एमएस, स्टेनलेस स्टील और एल्यूमीनियम प्लेट के लिए मुझे किस घनत्व का उपयोग करना चाहिए?",
    },
    "Multiply length, width and thickness to get the volume, then multiply by the density. In millimetres the formula is L × W × T × ρ ÷ 10⁶, which with 7.85 g/cm³ for mild steel gives kilograms directly.": {
        "mr": "लांबी, रुंदी व जाडीचा गुणाकार करून आयतन मिळवा, नंतर घनतेने गुणा करा. मिलिमीटरमध्ये सूत्र L × W × T × ρ ÷ 10⁶ आहे; सौम्य स्टीलसाठी 7.85 g/cm³ सह ते थेट किलोग्राम देते.",
        "hi": "लंबाई, चौड़ाई और मोटाई को गुणा करके आयतन प्राप्त करें, फिर घनत्व से गुणा करें। मिलीमीटर में सूत्र L × W × T × ρ ÷ 10⁶ है, जो माइल्ड स्टील के लिए 7.85 g/cm³ के साथ सीधे किलोग्राम देता है।",
        "de": "Länge, Breite und Dicke multiplizieren, um das Volumen zu erhalten, und dann mit der Dichte multiplizieren. In Millimetern lautet die Formel L × W × T × ρ ÷ 10⁶; mit 7,85 g/cm³ für Weichstahl ergibt sie direkt Kilogramm.",
        "es": "Multiplique la longitud, el ancho y el grosor para obtener el volumen y luego multiplique por la densidad. En milímetros, la fórmula es L × W × T × ρ ÷ 10⁶, que con 7,85 g/cm³ para acero suave da kilogramos directamente.",
        "fr": "Multipliez la longueur, la largeur et l'épaisseur pour obtenir le volume, puis multipliez par la densité. En millimètres, la formule est L × W × T × ρ ÷ 10⁶, ce qui donne directement des kilogrammes avec 7,85 g/cm³ pour l'acier doux.",
        "ja": "長さ、幅、厚さを掛けて体積を求め、次に密度を掛けます。ミリメートルでは L × W × T × ρ ÷ 10⁶ となり、軟鋼の 7.85 g/cm³ ではキログラムが直接得られます。",
        "zh": "将长度、宽度和厚度相乘得到体积，再乘以密度。以毫米为单位，公式为 L × W × T × ρ ÷ 10⁶；低碳钢取 7.85 g/cm³ 时可直接得到千克。",
        "pt": "Multiplique comprimento, largura e espessura para obter o volume e depois multiplique pela densidade. Em milímetros, a fórmula é L × W × T × ρ ÷ 10⁶, que com 7,85 g/cm³ para aço-carbono dá quilogramas diretamente.",
        "ar": "اضرب الطول والعرض والسماكة للحصول على الحجم، ثم اضرب في الكثافة. بالملليمتر تكون الصيغة L × W × T × ρ ÷ 10⁶، ومع 7.85 g/cm³ للفولاذ الطري تعطي الكيلوغرامات مباشرة.",
    },
    "78.5 kg per m². Every millimetre of mild-steel thickness adds 7.85 kg/m², so a 6 mm plate is 47.1 kg/m² and a 20 mm plate is 157 kg/m².": {
        "mr": "प्रति m² 78.5 kg. सौम्य स्टीलच्या प्रत्येक मिलिमीटर जाडीमध्ये 7.85 kg/m² जोडले जाते, म्हणून 6 mm प्लेट 47.1 kg/m² आणि 20 mm प्लेट 157 kg/m² असते.",
        "hi": "प्रति m² 78.5 kg. माइल्ड स्टील की हर मिलीमीटर मोटाई 7.85 kg/m² जोड़ती है, इसलिए 6 mm प्लेट 47.1 kg/m² और 20 mm प्लेट 157 kg/m² होती है।",
        "de": "78,5 kg pro m². Jeder Millimeter Weichstahldicke fügt 7,85 kg/m² hinzu, daher wiegen 6 mm Platten 47,1 kg/m² und 20 mm Platten 157 kg/m².",
        "es": "78,5 kg por m². Cada milímetro de espesor de acero suave añade 7,85 kg/m², por lo que una placa de 6 mm pesa 47,1 kg/m² y una de 20 mm pesa 157 kg/m².",
        "fr": "78,5 kg par m². Chaque millimètre d'épaisseur d'acier doux ajoute 7,85 kg/m² ; une plaque de 6 mm pèse donc 47,1 kg/m² et une plaque de 20 mm pèse 157 kg/m².",
        "ja": "1 m² あたり 78.5 kg。軟鋼の厚さ 1 mm ごとに 7.85 kg/m² が加わるため、6 mm 板は 47.1 kg/m²、20 mm 板は 157 kg/m² です。",
        "zh": "每平方米 78.5 kg。低碳钢厚度每增加 1 毫米就增加 7.85 kg/m²，因此 6 毫米板为 47.1 kg/m²，20 毫米板为 157 kg/m²。",
        "pt": "78,5 kg por m². Cada milímetro de espessura de aço-carbono adiciona 7,85 kg/m²; uma chapa de 6 mm pesa 47,1 kg/m² e uma de 20 mm pesa 157 kg/m².",
        "ar": "78.5 kg لكل m². كل ملليمتر من سماكة الفولاذ الطري يضيف 7.85 kg/m²، لذلك تبلغ كتلة لوحة 6 mm نحو 47.1 kg/m² ولوحة 20 mm نحو 157 kg/m².",
    },
    "78.5 kg in mild steel, because the volume is 10,000,000 mm³ and the density is 7.85 g/cm³. In stainless steel at 8.00 g/cm³ the same plate weighs 80 kg.": {
        "mr": "सौम्य स्टीलमध्ये 78.5 kg, कारण आयतन 10,000,000 mm³ व घनता 7.85 g/cm³ आहे. 8.00 g/cm³ स्टेनलेस स्टीलमध्ये त्याच प्लेटचे वजन 80 kg असते.",
        "hi": "माइल्ड स्टील में 78.5 kg, क्योंकि आयतन 10,000,000 mm³ और घनत्व 7.85 g/cm³ है। 8.00 g/cm³ स्टेनलेस स्टील में उसी प्लेट का वजन 80 kg है।",
        "de": "78,5 kg aus Weichstahl, da das Volumen 10.000.000 mm³ und die Dichte 7,85 g/cm³ beträgt. Bei Edelstahl mit 8,00 g/cm³ wiegt dieselbe Platte 80 kg.",
        "es": "78,5 kg en acero suave, porque el volumen es de 10.000.000 mm³ y la densidad es de 7,85 g/cm³. En acero inoxidable a 8,00 g/cm³, la misma placa pesa 80 kg.",
        "fr": "78,5 kg en acier doux, car le volume est de 10 000 000 mm³ et la densité de 7,85 g/cm³. En acier inoxydable à 8,00 g/cm³, la même plaque pèse 80 kg.",
        "ja": "軟鋼では 78.5 kg です。体積が 10,000,000 mm³、密度が 7.85 g/cm³ だからです。密度 8.00 g/cm³ のステンレス鋼では同じ板が 80 kg になります。",
        "zh": "低碳钢中为 78.5 kg，因为体积为 10,000,000 mm³，密度为 7.85 g/cm³。在密度为 8.00 g/cm³ 的不锈钢中，同一块板重 80 kg。",
        "pt": "78,5 kg em aço-carbono, pois o volume é de 10.000.000 mm³ e a densidade é de 7,85 g/cm³. Em aço inoxidável a 8,00 g/cm³, a mesma chapa pesa 80 kg.",
        "ar": "78.5 kg من الفولاذ الطري، لأن الحجم 10,000,000 mm³ والكثافة 7.85 g/cm³. وفي الفولاذ المقاوم للصدأ بكثافة 8.00 g/cm³ يبلغ وزن اللوحة نفسها 80 kg.",
    },
    "The area is 1,385.6 mm², so the bar weighs about 10.88 kg per metre at 7.85 g/cm³. A 6 m length comes to roughly 65.3 kg.": {
        "mr": "क्षेत्रफळ 1,385.6 mm² आहे, त्यामुळे बारचे वजन 7.85 g/cm³ येथे प्रति मीटर सुमारे 10.88 kg आहे. 6 मीटर लांबीचे वजन सुमारे 65.3 kg आहे.",
    },
    "Convert the disc to its area with π × D² ÷ 4, then use 7.85 kg per m² for every millimetre of mild-steel thickness. A 10 mm plate is 78.5 kg/m² and a 500 mm disc covers 0.196 m².": {
        "hi": "डिस्क को π × व्यास² ÷ 4 से उसके क्षेत्रफल में बदलें, फिर माइल्ड-स्टील मोटाई के प्रत्येक मिलीमीटर के लिए 7.85 kg/m² का उपयोग करें। एक 10 mm प्लेट 78.5 kg/m² है और एक 500 mm डिस्क 0.196 m² क्षेत्र घेरती है।",
    },
    "About 245.3 kg in mild steel. This is a standard 8 × 4 ft sheet size, which covers 3.125 m² and therefore weighs 3.125 × 78.5 kg.": {
        "mr": "सौम्य स्टीलमध्ये सुमारे 245.3 kg. हा मानक 8 × 4 ft शीट आकार आहे, ज्याचे क्षेत्रफळ 3.125 m² आहे आणि म्हणून त्याचे वजन 3.125 × 78.5 kg आहे.",
        "hi": "माइल्ड स्टील में लगभग 245.3 kg। यह मानक 8 × 4 ft शीट आकार है, जिसका क्षेत्रफल 3.125 m² है और इसलिए वजन 3.125 × 78.5 kg है।",
        "de": "Etwa 245,3 kg aus Weichstahl. Dies ist eine Standardplatte von 8 × 4 ft, die 3,125 m² bedeckt und daher 3,125 × 78,5 kg wiegt.",
        "es": "Aproximadamente 245,3 kg en acero suave. Es un tamaño de chapa estándar de 8 × 4 ft, que cubre 3,125 m² y por tanto pesa 3,125 × 78,5 kg.",
        "fr": "Environ 245,3 kg en acier doux. Il s'agit d'une taille de tôle standard de 8 × 4 ft, qui couvre 3,125 m² et pèse donc 3,125 × 78,5 kg.",
        "ja": "軟鋼で約 245.3 kg。これは標準の 8 × 4 ft シートサイズで、面積 3.125 m² を覆うため、重量は 3.125 × 78.5 kg です。",
        "zh": "低碳钢中约为 245.3 kg。这是标准的 8 × 4 ft 板材尺寸，面积为 3.125 m²，因此重量为 3.125 × 78.5 kg。",
        "pt": "Cerca de 245,3 kg em aço-carbono. Este é um tamanho padrão de chapa de 8 × 4 ft, que cobre 3,125 m² e, portanto, pesa 3,125 × 78,5 kg.",
        "ar": "حوالي 245.3 kg من الفولاذ الطري. هذا هو حجم لوحة قياسي 8 × 4 ft، يغطي 3.125 m² وبالتالي يزن 3.125 × 78.5 kg.",
    },
    "About 233.7 kg, using 1220 × 2440 mm. If your supplier cuts 1250 × 2500 mm instead, the same thickness weighs 245.3 kg, so confirm the actual sheet size before ordering.": {
        "mr": "सुमारे 233.7 kg, 1220 × 2440 mm वापरून. जर पुरवठादार 1250 × 2500 mm कापतो, तर त्याच जाडीचे वजन 245.3 kg असते; ऑर्डर करण्यापूर्वी प्रत्यक्ष शीट आकार तपासा.",
        "hi": "1220 × 2440 mm का उपयोग करके लगभग 233.7 kg। यदि आपका आपूर्तिकर्ता 1250 × 2500 mm काटता है, तो उसी मोटाई का वजन 245.3 kg होगा; ऑर्डर करने से पहले वास्तविक शीट आकार सत्यापित करें।",
        "de": "Etwa 233,7 kg bei 1220 × 2440 mm. Schneidet der Lieferant 1250 × 2500 mm, wiegt dieselbe Dicke 245,3 kg. Bitte die tatsächliche Plattengröße vor der Bestellung bestätigen.",
        "es": "Aproximadamente 233,7 kg usando 1220 × 2440 mm. Si el proveedor corta 1250 × 2500 mm, el mismo espesor pesa 245,3 kg; confirme el tamaño real de la chapa antes de pedir.",
        "fr": "Environ 233,7 kg avec 1220 × 2440 mm. Si le fournisseur coupe 1250 × 2500 mm, la même épaisseur pèse 245,3 kg ; confirmez la taille réelle de la tôle avant de commander.",
        "ja": "1220 × 2440 mm の場合、約 233.7 kg です。供給者が 1250 × 2500 mm にカットする場合は同じ厚さで 245.3 kg となるため、発注前に実際のシートサイズを確認してください。",
        "zh": "按 1220 × 2440 mm 计算约为 233.7 kg。如果供应商改为切割 1250 × 2500 mm，相同厚度重 245.3 kg，因此订购前请确认实际板材尺寸。",
        "pt": "Cerca de 233,7 kg usando 1220 × 2440 mm. Se o fornecedor cortar 1250 × 2500 mm, a mesma espessura pesa 245,3 kg; confirme o tamanho real da chapa antes de pedir.",
        "ar": "حوالي 233.7 kg باستخدام 1220 × 2440 mm. إذا كان المورّد يقطع 1250 × 2500 mm، فإن نفس السماكة تزن 245.3 kg؛ لذا تحقق من الحجم الفعلي للوحة قبل الطلب.",
    },
    "Weight is directly proportional to thickness at constant area: twice the thickness is twice the weight. A 3 mm, 6 mm and 12 mm plate of one square metre weigh 23.6 kg, 47.1 kg and 94.2 kg.": {
        "mr": "स्थिर क्षेत्रफळावर वजन जाडीच्या थेट प्रमाणात असते: दुप्पट जाडी म्हणजे दुप्पट वजन. एका m² च्या 3 mm, 6 mm व 12 mm प्लेटचे वजन अनुक्रमे 23.6 kg, 47.1 kg व 94.2 kg असते.",
        "hi": "निश्चित क्षेत्रफल पर वजन मोटाई के सीधे आनुपातिक है: दोगुनी मोटाई, दोगुना वजन। 1 m² की 3 mm, 6 mm और 12 mm प्लेटों का वजन क्रमशः 23.6 kg, 47.1 kg और 94.2 kg है।",
        "de": "Bei konstanter Fläche ist das Gewicht direkt proportional zur Dicke: doppelte Dicke bedeutet doppeltes Gewicht. Platten von 3 mm, 6 mm und 12 mm wiegen pro Quadratmeter 23,6 kg, 47,1 kg und 94,2 kg.",
        "es": "A área constante, el peso es directamente proporcional al espesor: el doble de espesor da el doble de peso. Placas de 3 mm, 6 mm y 12 mm de un metro cuadrado pesan 23,6 kg, 47,1 kg y 94,2 kg.",
        "fr": "À surface constante, le poids est directement proportionnel à l'épaisseur : deux fois l'épaisseur donne deux fois le poids. Des plaques de 3 mm, 6 mm et 12 mm d'un mètre carré pèsent 23,6 kg, 47,1 kg et 94,2 kg.",
        "ja": "面積が一定なら重量は厚さに直接比例し、厚さが 2 倍なら重量も 2 倍です。1 m² の 3 mm、6 mm、12 mm 板はそれぞれ 23.6 kg、47.1 kg、94.2 kg です。",
        "zh": "面积一定时，重量与厚度成正比：厚度加倍，重量也加倍。1 m² 的 3 mm、6 mm 和 12 mm 板分别重 23.6 kg、47.1 kg 和 94.2 kg。",
        "pt": "Com área constante, o peso é diretamente proporcional à espessura: o dobro da espessura dá o dobro do peso. Chapas de 3 mm, 6 mm e 12 mm de um metro quadrado pesam 23,6 kg, 47,1 kg e 94,2 kg.",
        "ar": "عند ثبات المساحة، يتناسب الوزن طرديًا مع السماكة: ضعف السماكة يعطي ضعف الوزن. ألواح 3 mm و6 mm و12 mm بمساحة 1 m² تزن 23.6 kg و47.1 kg و94.2 kg على التوالي.",
    },
    "Mild and carbon steel 7.85 g/cm³, austenitic stainless steel 8.00 g/cm³ and aluminium 2.70 g/cm³. These are the values in the material list, and a custom density is entered in g/cm³.": {
        "mr": "सौम्य व कार्बन स्टील 7.85 g/cm³, ऑस्टेनिटिक स्टेनलेस स्टील 8.00 g/cm³ व ॲल्युमिनियम 2.70 g/cm³. हे सामग्री यादीतील मूल्ये आहेत; सानुकूल घनता g/cm³ मध्ये प्रविष्ट करा.",
        "hi": "माइल्ड तथा कार्बन स्टील 7.85 g/cm³, ऑस्टेनिटिक स्टेनलेस स्टील 8.00 g/cm³ और एल्यूमीनियम 2.70 g/cm³। ये सामग्री सूची के मान हैं; कस्टम घनत्व g/cm³ में दर्ज करें।",
        "de": "Weich- und Kohlenstoffstahl 7,85 g/cm³, austenitischer Edelstahl 8,00 g/cm³ und Aluminium 2,70 g/cm³. Dies sind die Werte in der Materialliste; eine benutzerdefinierte Dichte wird in g/cm³ eingegeben.",
        "es": "Acero suave y al carbono 7,85 g/cm³, acero inoxidable austenítico 8,00 g/cm³ y aluminio 2,70 g/cm³. Estos son los valores de la lista de materiales; una densidad personalizada se introduce en g/cm³.",
        "fr": "Acier doux et au carbone 7,85 g/cm³, acier inoxydable austénitique 8,00 g/cm³ et aluminium 2,70 g/cm³. Ce sont les valeurs de la liste des matériaux ; une densité personnalisée se saisit en g/cm³.",
        "ja": "軟鋼および炭素鋼は 7.85 g/cm³、オーステナイト系ステンレス鋼は 8.00 g/cm³、アルミニウムは 2.70 g/cm³ です。これらは材料一覧の値で、カスタム密度は g/cm³ で入力します。",
        "zh": "低碳钢和碳钢为 7.85 g/cm³，奥氏体不锈钢为 8.00 g/cm³，铝为 2.70 g/cm³。这些是材料列表中的值，自定义密度以 g/cm³ 输入。",
        "pt": "Aço-carbono e aço macio 7,85 g/cm³, aço inoxidável austenítico 8,00 g/cm³ e alumínio 2,70 g/cm³. Esses são os valores da lista de materiais; a densidade personalizada é inserida em g/cm³.",
        "ar": "الفولاذ الطري والكربون 7.85 g/cm³، والفولاذ المقاوم للصدأ الأوستنيتي 8.00 g/cm³، والألومنيوم 2.70 g/cm³. هذه قيم قائمة المواد، وتُدخل الكثافة المخصصة بوحدة g/cm³.",
    },
    "Divide the kilogram result by 1,000. The calculator also shows the total in metric tonnes under the main result, which is convenient for purchase orders and transport limits.": {
        "mr": "किलोग्राम निकाला 1,000 ने विभाजित करा. कॅल्क्युलेटर मुख्य निकालाखाली एकूण मेट्रिक टन देखील दर्शवतो, जे खरेदी ऑर्डर व वाहतूक मर्यादांसाठी सोयीस्कर आहे.",
        "hi": "किलोग्राम परिणाम को 1,000 से विभाजित करें। कैलकुलेटर मुख्य परिणाम के नीचे कुल मीट्रिक टन भी दिखाता है, जो खरीद ऑर्डर और परिवहन सीमा के लिए उपयोगी है।",
        "de": "Teilen Sie das Kilogramm-Ergebnis durch 1.000. Der Rechner zeigt unter dem Hauptergebnis auch die Gesamtsumme in metrischen Tonnen an, was für Bestellungen und Transportgrenzen praktisch ist.",
        "es": "Divida el resultado en kilogramos entre 1.000. La calculadora también muestra el total en toneladas métricas bajo el resultado principal, útil para pedidos de compra y límites de transporte.",
        "fr": "Divisez le résultat en kilogrammes par 1 000. La calculatrice affiche également le total en tonnes métriques sous le résultat principal, ce qui est pratique pour les bons de commande et les limites de transport.",
        "ja": "キログラムの結果を 1,000 で割ります。計算ツールは主な結果の下に合計をメートルトンでも表示し、発注書や輸送制限に便利です。",
        "zh": "将千克结果除以 1,000。计算器还会在主结果下方显示以公吨为单位的总量，便于采购订单和运输限制。",
        "pt": "Divida o resultado em quilogramas por 1.000. A calculadora também mostra o total em toneladas métricas abaixo do resultado principal, útil para pedidos de compra e limites de transporte.",
        "ar": "اقسم النتيجة بالكيلوغرام على 1,000. كما تعرض الحاسبة الإجمالي بالأطنان المترية أسفل النتيجة الرئيسية، وهو أمر مفيد لأوامر الشراء وحدود النقل.",
    },
    "No. Plate and sheet are thickness conventions for flat product; at equal dimensions and density the mass is identical. Only the thickness and the material change the weight.": {
        "mr": "नाही. प्लेट व शीट हे सपाट उत्पादासाठी जाडीचे प्रकार आहेत; समान परिमाण व घनतेत वस्तुमान सारखेच असते. फक्त जाडी व सामग्री वजन बदलतात.",
        "hi": "नहीं। प्लेट और शीट समतल उत्पाद के लिए मोटाई के रूप हैं; समान आयाम और घनत्व पर द्रव्यमान समान होता है। केवल मोटाई और सामग्री वजन बदलती हैं।",
        "de": "Nein. Platte und Blech sind Dickenbezeichnungen für Flachprodukte; bei gleichen Abmessungen und gleicher Dichte ist die Masse identisch. Nur Dicke und Werkstoff verändern das Gewicht.",
        "es": "No. La placa y la lámina son denominaciones de espesor para productos planos; con iguales dimensiones y densidad, la masa es idéntica. Solo el espesor y el material cambian el peso.",
        "fr": "Non. Les plaques et les tôles sont des désignations d'épaisseur pour les produits plats ; à dimensions et densité égales, la masse est identique. Seuls l'épaisseur et le matériau modifient le poids.",
        "ja": "いいえ。板とシートは平板製品の厚さの呼び方です。寸法と密度が同じなら質量は同じです。重量を変えるのは厚さと材料だけです。",
        "zh": "不是。板材和薄板只是平板产品的厚度称呼；在尺寸和密度相同时，质量相同。只有厚度和材料会改变重量。",
        "pt": "Não. Chapa e folha são designações de espessura para produtos planos; com dimensões e densidade iguais, a massa é idêntica. Apenas a espessura e o material alteram o peso.",
        "ar": "لا. اللوحة والصفيحة هما تسميتان للسماكة في المنتجات المسطحة؛ وعند تساوي الأبعاد والكثافة تكون الكتلة متطابقة. لا يغيّر الوزن إلا السماكة والمادة.",
    },
    "Rolled plate is supplied within a thickness tolerance, the density varies slightly by grade, and the actual dimensions may be a little over or under the nominal size. The calculated value is the theoretical mass, not a guaranteed shipping weight.": {
        "mr": "रोल केलेली प्लेट जाडीच्या सहनशीलतेमध्ये पुरवली जाते, घनता ग्रेडनुसार थोडी बदलते आणि प्रत्यक्ष परिमाणे नाममात्र आकारापेक्षा थोडी वाढली किंवा घटली असू शकतात. गणना केलेली किंमत सैद्धांतिक वस्तुमान आहे, हमी दिलेले शिपिंग वजन नाही.",
        "hi": "रोल्ड प्लेट मोटाई सहनशीलता के भीतर आपूर्ति की जाती है, घनत्व ग्रेड के अनुसार थोड़ा बदलता है और वास्तविक आयाम नाममात्र आकार से थोड़े अधिक या कम हो सकते हैं। गणना किया गया मान सैद्धांतिक द्रव्यमान है, गारंटीशुदा शिपिंग वजन नहीं।",
        "de": "Walzblech wird innerhalb einer Dickentoleranz geliefert, die Dichte variiert leicht je nach Sorte und die tatsächlichen Abmessungen können etwas über oder unter der Nenngröße liegen. Der berechnete Wert ist die theoretische Masse, kein garantiertes Versandgewicht.",
        "es": "La placa laminada se suministra dentro de una tolerancia de espesor, la densidad varía ligeramente según el grado y las dimensiones reales pueden estar un poco por encima o por debajo del tamaño nominal. El valor calculado es la masa teórica, no un peso de envío garantizado.",
        "fr": "La plaque laminée est fournie dans une tolérance d'épaisseur, la densité varie légèrement selon la nuance et les dimensions réelles peuvent être légèrement supérieures ou inférieures à la taille nominale. La valeur calculée est la masse théorique, et non un poids d'expédition garanti.",
        "ja": "圧延板は板厚公差内で供給され、密度はグレードによりわずかに異なり、実際の寸法は呼び寸法よりわずかに大きいまたは小さい場合があります。計算値は理論上の質量であり、出荷重量を保証するものではありません。",
        "zh": "轧制板的厚度在公差范围内，密度因牌号略有差异，实际尺寸可能略高于或低于标称尺寸。计算值是理论质量，并非保证的运输重量。",
        "pt": "A chapa laminada é fornecida dentro de uma tolerância de espessura, a densidade varia ligeiramente conforme o grau e as dimensões reais podem ficar um pouco acima ou abaixo do tamanho nominal. O valor calculado é a massa teórica, não um peso de envio garantido.",
        "ar": "يُورَّد اللوح المدرفل ضمن تفاوت مسموح في السماكة، وتختلف الكثافة قليلاً حسب الدرجة، وقد تكون الأبعاد الفعلية أكبر أو أصغر قليلاً من الحجم الاسمي. القيمة المحسوبة هي الكتلة النظرية، وليست وزن شحن مضمونًا.",
    },
}


def set_translation(dictionary: dict, key: str, value: str) -> bool:
    """Write into the dictionary group that already owns the key."""
    for section in ("strings", "terms", "templates"):
        if key in dictionary.get(section, {}):
            dictionary[section][key] = value
            return True
    dictionary.setdefault("strings", {})[key] = value
    return True


def set_template_translation(dictionary: dict, key: str, value: str) -> bool:
    """Write a composed string into the template section."""
    for section in ("templates", "strings"):
        if key in dictionary.get(section, {}):
            dictionary[section][key] = value
            return True
    dictionary.setdefault("templates", {})[key] = value
    return True


def canonicalize_text(text: str) -> str:
    for pattern, replacement in CANONICAL_UNIT_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def canonicalize_dictionary(data: dict) -> int:
    """Restore engineering unit abbreviations everywhere in the dictionary."""
    changes = 0

    def walk(node):
        nonlocal changes
        if isinstance(node, str):
            fixed = canonicalize_text(node)
            if fixed != node:
                changes += 1
            return fixed
        if isinstance(node, dict):
            return {key: walk(value) for key, value in node.items()}
        if isinstance(node, list):
            return [walk(value) for value in node]
        return node

    for section in ("strings", "terms", "templates", "technical"):
        if section in data:
            data[section] = walk(data[section])
    return changes


def main() -> int:
    languages = load_languages()
    changes = 0

    for code in languages:
        data = load_dictionary(code)
        terms = data.get("terms", {})
        strings = data.get("strings", {})

        # Identity strings must not shadow a real terms translation.
        for key, value in list(strings.items()):
            if value == key and isinstance(terms.get(key), str) and terms[key] != key:
                strings[key] = terms[key]
                changes += 1

        # Engineering abbreviations stay in the English master notation.
        for key, value in CANONICAL_ABBREVIATIONS.items():
            if key in strings and strings[key] != value:
                strings[key] = value
                changes += 1
            if key in terms and terms[key] != value and key == "KG":
                terms[key] = value
                changes += 1

        # Complete Plate Calculator translations.
        for key, translations in PLATE_TRANSLATIONS.items():
            if code in translations:
                value = translations[code].strip()
                setter = set_template_translation if "{" in key else set_translation
                if setter(data, key, value):
                    changes += 1

        # Restore canonical engineering notation in every translated string.
        changes += canonicalize_dictionary(data)

        # Canonical technical symbols and abbreviations in the source data too.
        technical = data.setdefault("technical", {})
        units = technical.setdefault("units", {})
        for unit_id, short in CANONICAL_TECHNICAL_SHORT.items():
            unit = units.setdefault(unit_id, {})
            if unit_id == "in":
                localized_inches = strings.get("Inches")
                short = localized_inches if localized_inches and localized_inches != "Inches" else short
            if unit.get("short") != short:
                unit["short"] = short
                changes += 1
            if not unit.get("name"):
                unit["name"] = CANONICAL_TECHNICAL_NAMES[unit_id]
                changes += 1

        save_dictionary(code, data)

    print(f"multilingual consistency fixes: {changes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
