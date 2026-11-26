#!/usr/bin/env python3
"""Fill remaining user-facing translation gaps found by the site-wide audit.

Only source strings that are genuinely user-facing text are added. Engineering
notation, formulas, standard designations and drawing section labels stay in
their canonical English form, including where the old dictionaries had let a
few languages translate them.
"""
from __future__ import annotations

import json
from pathlib import Path

I18N = Path(__file__).resolve().parents[1] / "frontend" / "i18n"
LANGS = ["mr", "hi", "de", "es", "fr", "ja", "zh", "pt", "ar"]

# Home page category cards. The number is part of the source string.
CATEGORIES = {
    "Structural sections, 5 tools": {
        "mr": "संरचनात्मक प्रोफाइल, 5 साधने",
        "hi": "संरचनात्मक खंड, 5 उपकरण",
        "de": "Konstruktionsprofile, 5 Werkzeuge",
        "es": "Secciones estructurales, 5 herramientas",
        "fr": "Profils structuraux, 5 outils",
        "ja": "構造用断面, 5 ツール",
        "zh": "结构型钢, 5 个工具",
        "pt": "Seções estruturais, 5 ferramentas",
        "ar": "المقاطع الإنشائية، 5 أدوات",
    },
    "Hollow sections, 1 tools": {
        "mr": "पोकळ प्रोफाइल, 1 साधन",
        "hi": "खोखले खंड, 1 उपकरण",
        "de": "Hohlprofile, 1 Werkzeug",
        "es": "Secciones huecas, 1 herramienta",
        "fr": "Profils creux, 1 outil",
        "ja": "中空断面, 1 ツール",
        "zh": "空心型钢, 1 个工具",
        "pt": "Seções ocas, 1 ferramenta",
        "ar": "المقاطع المجوفة، 1 أداة",
    },
    "Solid bars & rods, 6 tools": {
        "mr": "घन बार व रॉड, 6 साधने",
        "hi": "ठोस बार और रॉड, 6 उपकरण",
        "de": "Massivstäbe und -stangen, 6 Werkzeuge",
        "es": "Barras macizas, 6 herramientas",
        "fr": "Barres pleines, 6 outils",
        "ja": "中実棒・丸棒, 6 ツール",
        "zh": "实心棒材, 6 个工具",
        "pt": "Barras maciças, 6 ferramentas",
        "ar": "القضبان الصلبة، 6 أدوات",
    },
    "Pipes & profiled bars, 4 tools": {
        "mr": "पाइप व प्रोफाइल बार, 4 साधने",
        "hi": "पाइप और प्रोफाइल बार, 4 उपकरण",
        "de": "Rohre und Profile, 4 Werkzeuge",
        "es": "Tuberías y perfiles, 4 herramientas",
        "fr": "Tuyaux et profilés, 4 outils",
        "ja": "パイプ・形鋼, 4 ツール",
        "zh": "管材与型材, 4 个工具",
        "pt": "Tubos e barras perfiladas, 4 ferramentas",
        "ar": "الأنابيب والقضبان الشكلية، 4 أدوات",
    },
    "Fasteners, 1 tools": {
        "mr": "फास्टनर, 1 साधन",
        "hi": "फास्टनर, 1 उपकरण",
        "de": "Befestigungselemente, 1 Werkzeug",
        "es": "Elementos de fijación, 1 herramienta",
        "fr": "Fixations, 1 outil",
        "ja": "締結部品, 1 ツール",
        "zh": "紧固件, 1 个工具",
        "pt": "Fixadores, 1 ferramenta",
        "ar": "المثبتات، 1 أداة",
    },
    "Plates & sheets, 3 tools": {
        "mr": "प्लेट व शीट, 3 साधने",
        "hi": "प्लेट और शीट, 3 उपकरण",
        "de": "Platten und Bleche, 3 Werkzeuge",
        "es": "Placas y chapas, 3 herramientas",
        "fr": "Plaques et tôles, 3 outils",
        "ja": "プレート・板材, 3 ツール",
        "zh": "板材, 3 个工具",
        "pt": "Chapas e placas, 3 ferramentas",
        "ar": "الصفائح والألواح، 3 أدوات",
    },
    "Spheres & balls, 1 tools": {
        "mr": "गोले व बॉल, 1 साधन",
        "hi": "गोले और बॉल, 1 उपकरण",
        "de": "Kugeln, 1 Werkzeug",
        "es": "Esferas y bolas, 1 herramienta",
        "fr": "Sphères et billes, 1 outil",
        "ja": "球体・ボール, 1 ツール",
        "zh": "球体, 1 个工具",
        "pt": "Esferas e bolas, 1 ferramenta",
        "ar": "الكريات والأكواب، 1 أداة",
    },
    "Cones & reducers, 2 tools": {
        "mr": "शंकू व रिड्यूसर, 2 साधने",
        "hi": "शंकु और रिड्यूसर, 2 उपकरण",
        "de": "Kegel und Reduzierstücke, 2 Werkzeuge",
        "es": "Conos y reductores, 2 herramientas",
        "fr": "Cônes et réducteurs, 2 outils",
        "ja": "円錐・レデューサ, 2 ツール",
        "zh": "圆锥与异径管, 2 个工具",
        "pt": "Cones e redutores, 2 ferramentas",
        "ar": "المخاريط والمخفضات، 2 أدوات",
    },
    "Vessel heads, 1 tools": {
        "mr": "व्हेसल हेड, 1 साधन",
        "hi": "वेसल हेड, 1 उपकरण",
        "de": "Behälterböden, 1 Werkzeug",
        "es": "Cabezas de recipiente, 1 herramienta",
        "fr": "Fonds de cuve, 1 outil",
        "ja": "容器鏡板, 1 ツール",
        "zh": "封头, 1 个工具",
        "pt": "Cabeças de vaso, 1 ferramenta",
        "ar": "رؤوس الأوعية، 1 أداة",
    },
}

# Dish-end FAQ and height note.
DISH = {
    "Why is the crown height equal to the knuckle radius R?": {
        "mr": "मुगुटीची उंची नकल त्रिज्या R च्या समान का असते?",
        "hi": "क्राउन ऊँचाई नकल त्रिज्या R के बराबर क्यों होती है?",
        "de": "Warum ist die Kronenhöhe gleich dem Krümmungsradius R?",
        "es": "¿Por qué la altura de la corona es igual al radio de la curva R?",
        "fr": "Pourquoi la hauteur de la calotte est-elle égale au rayon de raccordement R ?",
        "ja": "クラウン高さがノックル半径 R と等しいのはなぜですか。",
        "zh": "为什么冠高等于过渡半径 R？",
        "pt": "Por que a altura da coroa é igual ao raio de transição R?",
        "ar": "لماذا يكون ارتفاع التاج مساويًا لنصف قطر الانحناء R؟",
    },
    "Overall height (H) is measured from the outer crown to the bottom edge of the straight face, so H = crown depth (h) + SF; the H and SF fields stay in step.": {
        "mr": "एकूण उंची (H) बाहेरील मुगुटीपासून सरळ पृष्ठभागाच्या तळीन काठापर्यंत मोजली जाते, म्हणून H = मुगुटी खोली (h) + SF; H आणि SF ही क्षेत्रे एकमेकांशी जुळतात.",
        "hi": "कुल ऊँचाई (H) बाहरी क्राउन से सीधे फलक के निचले किनारे तक मापी जाती है, अतः H = क्राउन गहराई (h) + SF; H और SF फ़ील्ड एक-दूसरे के अनुरूप रहते हैं।",
        "de": "Die Gesamthöhe (H) wird von der äußeren Krone bis zur Unterkante des geraden Abschnitts gemessen, daher gilt H = Kronentiefe (h) + SF; die Felder H und SF bleiben synchron.",
        "es": "La altura total (H) se mide desde la corona exterior hasta el borde inferior de la cara recta, por lo que H = profundidad de la corona (h) + SF; los campos H y SF se mantienen sincronizados.",
        "fr": "La hauteur totale (H) est mesurée de la calotte extérieure au bord inférieur de la partie droite ; H = profondeur de calotte (h) + SF ; les champs H et SF restent synchronisés.",
        "ja": "全高 (H) は外側のクラウンから直線部の下端まで測定するため、H = クラウン深さ (h) + SF となり、H と SF の入力値は連動します。",
        "zh": "总高度 (H) 从外冠到直边底部测量，因此 H = 冠深 (h) + SF；H 与 SF 字段保持联动。",
        "pt": "A altura total (H) é medida da coroa externa até a borda inferior da face reta, portanto H = profundidade da coroa (h) + SF; os campos H e SF permanecem sincronizados.",
        "ar": "يُقاس الارتفاع الكلي (H) من التاج الخارجي إلى الحافة السفلية للوجه المستقيم، لذا H = عمق التاج (h) + SF؛ ويبقى الحقلان H و SF متزامنين.",
    },
}

# Per-language gaps left by the earlier dictionary pass.
GAPS = {
    "Which wall thickness should I use for a Schedule pipe?": {
        "de": "Welche Wandstärke sollte ich für ein Rohr nach Schedule verwenden?",
    },
    "Why are both flanges calculated at the full width B?": {
        "de": "Warum werden beide Flansche mit der vollen Breite B berechnet?",
    },
    "Why does a taller channel weigh more at the same thickness?": {
        "de": "Warum wiegt ein höherer Kanal bei gleicher Wandstärke mehr?",
    },
    "Why does the cut disc weigh slightly less than the calculated value?": {
        "de": "Warum wiegt die geschnittene Scheibe etwas weniger als der berechnete Wert?",
    },
    "Why is a cone one third of a cylinder with the same base and height?": {
        "de": "Warum ist ein Kegel ein Drittel eines Zylinders mit gleicher Grundfläche und Höhe?",
    },
    "Why are both kilograms and pounds shown?": {
        "de": "Warum werden sowohl Kilogramm als auch Pfund angezeigt?",
    },
    "Why can the calculated weight differ from a weighbridge?": {
        "de": "Warum kann das berechnete Gewicht von der Waage abweichen?",
    },
    "Variables:": {"es": "Símbolos utilizados:"},
    "Division": {"fr": "Nombre de divisions"},
    "Angle (°)": {"fr": "Valeur de l'angle (°)"},
    "Hexagon Bar": {"mr": "षटकोनी बार"},
    "hole": {"de": "Loch"},
    "Both use the same average-width formula. Trapezium is used here for the isosceles form with two equal sloping sides, while the trapezoidal bar page takes top and bottom widths for any trapezoid, including a right-angled one.": {
        "zh": "两者使用相同的平均宽度公式。此处采用等腰梯形（两条斜边相等），而梯形棒页面按上下宽度计算，适用于任意梯形（包括直角梯形）。",
    },
    "Hex Hole Across Flats (A)": {
        "de": "Sechskantloch über Flächen (A)",
        "es": "Agujero hexagonal entre caras (A)",
        "fr": "Trou hexagonal sur plats (A)",
        "pt": "Furo hexagonal entre faces (A)",
    },
    "Parallel Side (A)": {
        "de": "Parallele Seite (A)",
        "es": "Lado paralelo (A)",
        "fr": "Côté parallèle (A)",
        "pt": "Lado paralelo (A)",
    },
    "Parallel Side (B)": {
        "de": "Parallele Seite (B)",
        "es": "Lado paralelo (B)",
        "fr": "Côté parallèle (B)",
        "pt": "Lado paralelo (B)",
    },
    "Pitch Circle Diameter (PCD)": {
        "de": "Teilkreisdurchmesser (PCD)",
        "es": "Diámetro del círculo de paso (PCD)",
        "fr": "Diamètre du cercle primitif (PCD)",
        "pt": "Diâmetro do círculo primitivo (PCD)",
    },
    "Base (B)": {
        "es": "Base (B)",
        "fr": "Base (B)",
        "pt": "Base (B)",
    },
}

# Standards and drawing section labels are canonical notation. They must not
# be translated or expanded in any language, so an earlier translated entry is
# replaced with the exact English source.
OVERRIDE = {
    "ASME B18.2.1 (inch)",
    "SECTION A–A",
}

# A few old entries point at the wrong string entirely; replace them.
CORRECT = {
    "Hexagonal Bar With Round Hole": {
        "mr": "गोल छिद्रासह षटकोनी बार",
        "hi": "गोल छेद वाली षट्कोण बार",
    },
}

ALL = {}
for table in (CATEGORIES, DISH, GAPS):
    for source, values in table.items():
        ALL.setdefault(source, {}).update(values)
for source in OVERRIDE:
    ALL.setdefault(source, {}).update({lang: source for lang in LANGS})
for source, values in CORRECT.items():
    ALL.setdefault(source, {}).update(values)


def main() -> None:
    changed = 0
    for lang in LANGS:
        path = I18N / f"{lang}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        strings = data.setdefault("strings", {})
        for source, values in ALL.items():
            value = values.get(lang)
            if value is None:
                continue
            # An existing identity entry ("Source": "Source") is the same gap
            # as a missing entry: the runtime treats it as untranslated.
            forced = source in OVERRIDE or source in CORRECT
            if source in strings and strings[source] != source and not forced:
                continue
            if strings.get(source) == value:
                continue
            strings[source] = value
            changed += 1
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8", newline="\n",
        )
    print(f"site-wide translation fixes: {changed}")


if __name__ == "__main__":
    main()
