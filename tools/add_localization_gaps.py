#!/usr/bin/env python3
"""Fill confirmed localization gaps in every language dictionary.

    python tools/add_localization_gaps.py

Only missing/empty keys are added, except for the small set of names and
formula legends where an existing machine-style translation is replaced by a
natural, commonly used one. Calculation logic and identifiers are untouched.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from i18n_paths import language_codes, load_dictionary, dictionary_path  # noqa: E402

EN = "en"

# Keys whose existing value is replaced everywhere because the old value was
# incomplete, unnatural or used the wrong language name.
OVERWRITE = {
    "Dish Ends Calculator",
    "Engineering drawing of the selected dish end type with dimensions",
    "W = Weight (kg) · A = Developed surface area (mm²) · T = Thickness (mm) · ρ = Density (kg/m³)",
    "Japanese", "English", "Marathi", "Hindi", "German", "Spanish",
    "French", "Chinese", "Portuguese", "Arabic",
}

T = {
    "Open": {
        "mr": "उघडा", "hi": "खोलें", "de": "Öffnen", "es": "Abrir", "fr": "Ouvrir",
        "ja": "開く", "zh": "打开", "pt": "Abrir", "ar": "فتح",
    },
    "tools": {
        "mr": "टूल्स", "hi": "टूल्स", "de": "Tools", "es": "herramientas", "fr": "outils",
        "ja": "ツール", "zh": "工具", "pt": "ferramentas", "ar": "أدوات",
    },
    "Other engineering tools": {
        "mr": "इतर अभियांत्रिकी टूल्स", "hi": "अन्य इंजीनियरिंग टूल्स",
        "de": "Weitere Engineering-Tools", "es": "Otras herramientas de ingeniería",
        "fr": "Autres outils d'ingénierie", "ja": "その他のエンジニアリングツール",
        "zh": "其他工程工具", "pt": "Outras ferramentas de engenharia",
        "ar": "أدوات هندسية أخرى",
    },
    "Engineering tool": {
        "mr": "अभियांत्रिकी टूल", "hi": "इंजीनियरिंग टूल", "de": "Engineering-Tool",
        "es": "Herramienta de ingeniería", "fr": "Outil d'ingénierie",
        "ja": "エンジニアリングツール", "zh": "工程工具",
        "pt": "Ferramenta de engenharia", "ar": "أداة هندسية",
    },
    "Loading": {
        "mr": "लोड करत आहे", "hi": "लोड हो रहा है", "de": "Wird geladen", "es": "Cargando",
        "fr": "Chargement", "ja": "読み込み中", "zh": "加载中", "pt": "Carregando",
        "ar": "جارٍ التحميل",
    },
    "Scroll to previous material grades": {
        "mr": "मागील मटेरियल ग्रेडकडे स्क्रॉल करा", "hi": "पिछले मटेरियल ग्रेड पर स्क्रॉल करें",
        "de": "Zu den vorherigen Werkstoffgüten scrollen",
        "es": "Desplazarse a las calidades de material anteriores",
        "fr": "Faire défiler vers les nuances de matériau précédentes",
        "ja": "前の材料グレードへスクロール", "zh": "滚动到之前的材料牌号",
        "pt": "Rolar para as classes de material anteriores",
        "ar": "التمرير إلى درجات المواد السابقة",
    },
    "Scroll to next material grades": {
        "mr": "पुढील मटेरियल ग्रेडकडे स्क्रॉल करा", "hi": "अगले मटेरियल ग्रेड पर स्क्रॉल करें",
        "de": "Zu den nächsten Werkstoffgüten scrollen",
        "es": "Desplazarse a las siguientes calidades de material",
        "fr": "Faire défiler vers les nuances de matériau suivantes",
        "ja": "次の材料グレードへスクロール", "zh": "滚动到下一个材料牌号",
        "pt": "Rolar para as próximas classes de material",
        "ar": "التمرير إلى درجات المواد التالية",
    },
    "Close": {
        "mr": "बंद करा", "hi": "बंद करें", "de": "Schließen", "es": "Cerrar", "fr": "Fermer",
        "ja": "閉じる", "zh": "关闭", "pt": "Fechar", "ar": "إغلاق",
    },
    "Cancel": {
        "mr": "रद्द करा", "hi": "रद्द करें", "de": "Abbrechen", "es": "Cancelar", "fr": "Annuler",
        "ja": "キャンセル", "zh": "取消", "pt": "Cancelar", "ar": "إلغاء",
    },
    "Try Again": {
        "mr": "पुन्हा प्रयत्न करा", "hi": "फिर से प्रयास करें", "de": "Erneut versuchen",
        "es": "Intentar de nuevo", "fr": "Réessayer", "ja": "再試行", "zh": "重试",
        "pt": "Tentar novamente", "ar": "إعادة المحاولة",
    },
    "Dish Ends Calculator": {
        "mr": "डिश एंड कॅल्क्युलेटर", "hi": "डिश एंड कैलकुलेटर",
        "de": "Böden-Rechner", "es": "Calculadora de fondos", "fr": "Calculateur de fonds",
        "ja": "鏡板計算ツール", "zh": "封头计算器", "pt": "Calculadora de tampos",
        "ar": "حاسبة الرؤوس المقعرة",
    },
    "Engineering drawing of the selected dish end type with dimensions": {
        "mr": "निवडलेल्या डिश एंड प्रकाराचे परिमाणांसह अभियांत्रिकी रेखाचित्र",
        "hi": "चयनित डिश एंड प्रकार के आयामों सहित इंजीनियरिंग ड्राइंग",
        "de": "Technische Zeichnung des gewählten Bodentyps mit Abmessungen",
        "es": "Dibujo técnico del tipo de fondo seleccionado con dimensiones",
        "fr": "Dessin technique du type de fond sélectionné avec ses dimensions",
        "ja": "選択した皿形ヘッドの種類と寸法を示す設計図",
        "zh": "所选封头类型及尺寸的工程图",
        "pt": "Desenho técnico do tipo de tampo selecionado com dimensões",
        "ar": "رسم هندسي لنوع الرأس المقعر المحدد مع الأبعاد",
    },
    "W = Weight (kg) · A = Developed surface area (mm²) · T = Thickness (mm) · ρ = Density (kg/m³)": {
        "mr": "W = वजन (किलो) · A = विकसित पृष्ठभागाचे क्षेत्रफळ (मिमी²) · T = जाडी (मिमी) · ρ = घनता (किलो/मी³)",
        "hi": "W = वजन (किग्रा) · A = विकसित सतह क्षेत्र (मिमी²) · T = मोटाई (मिमी) · ρ = घनत्व (किग्रा/मी³)",
        "de": "W = Gewicht (kg) · A = Entwickelte Oberfläche (mm²) · T = Dicke (mm) · ρ = Dichte (kg/m³)",
        "es": "W = Peso (kg) · A = Superficie desarrollada (mm²) · T = Espesor (mm) · ρ = Densidad (kg/m³)",
        "fr": "W = Masse (kg) · A = Surface développée (mm²) · T = Épaisseur (mm) · ρ = Masse volumique (kg/m³)",
        "ja": "W = 重量 (kg) · A = 展開表面積 (mm²) · T = 厚さ (mm) · ρ = 密度 (kg/m³)",
        "zh": "W = 重量 (kg) · A = 展开表面积 (mm²) · T = 厚度 (mm) · ρ = 密度 (kg/m³)",
        "pt": "W = Peso (kg) · A = Área de superfície desenvolvida (mm²) · T = Espessura (mm) · ρ = Densidade (kg/m³)",
        "ar": "W = الوزن (كجم) · A = مساحة السطح المطوّر (مم²) · T = السماكة (مم) · ρ = الكثافة (كجم/م³)",
    },
    "Add Metal Weight Calculator Shortcut": {
        "mr": "मेटल वेट कॅल्क्युलेटरचा शॉर्टकट जोडा",
        "hi": "मेटल वेट कैलकुलेटर का शॉर्टकट जोड़ें",
        "de": "Metal Weight Calculator Verknüpfung hinzufügen",
        "es": "Añadir acceso directo de Metal Weight Calculator",
        "fr": "Ajouter le raccourci Metal Weight Calculator",
        "ja": "金属重量計算ツールのショートカットを追加",
        "zh": "添加金属重量计算器快捷方式",
        "pt": "Adicionar atalho do Metal Weight Calculator",
        "ar": "إضافة اختصار حاسبة أوزان المعادن",
    },
    "This copy of the site is open as a local file. Browsers can only add shortcuts to pages opened over HTTPS or http://localhost, and the browser menu offers no shortcut option for file:// pages. Open the website through its web address (or run a local server and open http://localhost) and try again.": {
        "mr": "ही साइट स्थानिक फाइल म्हणून उघडली आहे. ब्राउझर फक्त HTTPS किंवा http://localhost वर उघडलेल्या पानांसाठी शॉर्टकट जोडू शकतात; file:// पानांसाठी ब्राउझर मेन्यूमध्ये शॉर्टकट पर्याय नाही. वेब पत्त्याने साइट उघडा (किंवा स्थानिक सर्व्हर चालवा आणि http://localhost उघडा) आणि पुन्हा प्रयत्न करा.",
        "hi": "यह साइट स्थानीय फ़ाइल के रूप में खुली है। ब्राउज़र केवल HTTPS या http://localhost पर खोले गए पेजों के लिए शॉर्टकट जोड़ सकते हैं; file:// पेजों के लिए ब्राउज़र मेन्यू में शॉर्टकट विकल्प नहीं होता। वेब पते से साइट खोलें (या स्थानीय सर्वर चलाएँ और http://localhost खोलें) और फिर प्रयास करें।",
        "de": "Diese Kopie der Website ist als lokale Datei geöffnet. Browser können nur für Seiten über HTTPS oder http://localhost Verknüpfungen hinzufügen; für file://-Seiten bietet das Browser-Menü keine Verknüpfung an. Öffne die Website über ihre Webadresse (oder starte einen lokalen Server und öffne http://localhost) und versuche es erneut.",
        "es": "Esta copia del sitio está abierta como archivo local. Los navegadores solo pueden añadir accesos directos a páginas abiertas mediante HTTPS o http://localhost, y el menú del navegador no ofrece esa opción para páginas file://. Abre el sitio mediante su dirección web (o ejecuta un servidor local y abre http://localhost) e inténtalo de nuevo.",
        "fr": "Cette copie du site est ouverte comme un fichier local. Les navigateurs ne peuvent ajouter un raccourci que pour les pages ouvertes en HTTPS ou sur http://localhost ; le menu du navigateur ne propose pas cette option pour les pages file://. Ouvrez le site via son adresse web (ou lancez un serveur local et ouvrez http://localhost), puis réessayez.",
        "ja": "このサイトはローカルファイルとして開かれています。ブラウザーがショートカットを追加できるのは HTTPS または http://localhost で開いたページだけです。file:// ページではブラウザーのメニューにショートカット項目がありません。Web アドレスからサイトを開く（またはローカルサーバーを起動して http://localhost を開く）と、もう一度お試しください。",
        "zh": "此站点当前以本地文件方式打开。浏览器只能为通过 HTTPS 或 http://localhost 打开的页面添加快捷方式；file:// 页面的浏览器菜单中没有该选项。请通过网址打开站点（或启动本地服务器并打开 http://localhost）后重试。",
        "pt": "Esta cópia do site está aberta como arquivo local. Os navegadores só adicionam atalhos para páginas abertas via HTTPS ou http://localhost, e o menu do navegador não oferece essa opção para páginas file://. Abra o site pelo endereço web (ou execute um servidor local e abra http://localhost) e tente novamente.",
        "ar": "هذه النسخة من الموقع مفتوحة كملف محلي. يمكن للمتصفحات إضافة اختصارات فقط للصفحات المفتوحة عبر HTTPS أو http://localhost، ولا يوفر قائمة المتصفح خيار اختصار لصفحات file://. افتح الموقع من عنوانه على الويب (أو شغّل خادمًا محليًا وافتح http://localhost) ثم حاول مرة أخرى.",
    },
    "Shortcuts require a secure connection. This page is served over plain HTTP, so the browser will not offer its install or shortcut prompt. Open the HTTPS version of the website and try again.": {
        "mr": "शॉर्टकटसाठी सुरक्षित कनेक्शन आवश्यक आहे. हे पान साध्या HTTP वर दिले जात असल्याने ब्राउझर इंस्टॉल किंवा शॉर्टकट प्रॉम्प्ट दाखवणार नाही. साइटची HTTPS आवृत्ती उघडा आणि पुन्हा प्रयत्न करा.",
        "hi": "शॉर्टकट के लिए सुरक्षित कनेक्शन आवश्यक है। यह पेज सादे HTTP पर दिया जा रहा है, इसलिए ब्राउज़र इंस्टॉल या शॉर्टकट प्रॉम्प्ट नहीं दिखाएगा। वेबसाइट का HTTPS संस्करण खोलें और फिर प्रयास करें।",
        "de": "Verknüpfungen benötigen eine sichere Verbindung. Diese Seite wird über einfaches HTTP ausgeliefert, daher bietet der Browser weder Installation noch Verknüpfung an. Öffne die HTTPS-Version der Website und versuche es erneut.",
        "es": "Los accesos directos requieren una conexión segura. Esta página se sirve por HTTP simple, así que el navegador no ofrecerá la instalación ni el acceso directo. Abre la versión HTTPS del sitio e inténtalo de nuevo.",
        "fr": "Les raccourcis nécessitent une connexion sécurisée. Cette page est servie en HTTP simple : le navigateur ne proposera ni installation ni raccourci. Ouvrez la version HTTPS du site et réessayez.",
        "ja": "ショートカットには安全な接続が必要です。このページは平文 HTTP で配信されているため、ブラウザーはインストールやショートカットの案内を表示しません。サイトの HTTPS バージョンを開いて、もう一度お試しください。",
        "zh": "快捷方式需要安全连接。此页面通过明文 HTTP 提供，浏览器不会显示安装或快捷方式提示。请打开网站的 HTTPS 版本后重试。",
        "pt": "Os atalhos exigem uma conexão segura. Esta página é servida por HTTP simples, então o navegador não oferecerá o prompt de instalação nem de atalho. Abra a versão HTTPS do site e tente novamente.",
        "ar": "تتطلب الاختصارات اتصالًا آمنًا. تُقدَّم هذه الصفحة عبر HTTP عادي، لذلك لن يعرض المتصفح مطالبة التثبيت أو الاختصار. افتح إصدار HTTPS من الموقع ثم حاول مرة أخرى.",
    },
    "A shortcut for the Metal Weight Calculator website will be added to your browser or device, depending on browser support.": {
        "mr": "ब्राउझरच्या समर्थनानुसार मेटल वेट कॅल्क्युलेटर वेबसाइटचा शॉर्टकट आपल्या ब्राउझर किंवा डिव्हाइसवर जोडला जाईल.",
        "hi": "ब्राउज़र समर्थन के अनुसार मेटल वेट कैलकुलेटर वेबसाइट का शॉर्टकट आपके ब्राउज़र या डिवाइस पर जोड़ा जाएगा।",
        "de": "Je nach Browser-Unterstützung wird eine Verknüpfung zur Website Metal Weight Calculator zu deinem Browser oder Gerät hinzugefügt.",
        "es": "Según la compatibilidad del navegador, se añadirá un acceso directo al sitio Metal Weight Calculator a tu navegador o dispositivo.",
        "fr": "Selon la prise en charge par le navigateur, un raccourci vers le site Metal Weight Calculator sera ajouté à votre navigateur ou à votre appareil.",
        "ja": "ブラウザーの対応状況に応じて、金属重量計算ツールのサイトへのショートカットがブラウザーまたは端末に追加されます。",
        "zh": "根据浏览器支持情况，金属重量计算器网站的快捷方式将添加到您的浏览器或设备。",
        "pt": "Dependendo do suporte do navegador, um atalho para o site Metal Weight Calculator será adicionado ao seu navegador ou dispositivo.",
        "ar": "حسب دعم المتصفح، سيتم إضافة اختصار لموقع حاسبة أوزان المعادن إلى متصفحك أو جهازك.",
    },
    "The shortcut will open the website’s homepage directly.": {
        "mr": "शॉर्टकट थेट वेबसाइटच्या मुख्यपानावर उघडेल.",
        "hi": "शॉर्टकट सीधे वेबसाइट के होमपेज पर खुलेगा।",
        "de": "Die Verknüpfung öffnet direkt die Startseite der Website.",
        "es": "El acceso directo abrirá directamente la página de inicio del sitio.",
        "fr": "Le raccourci ouvrira directement la page d'accueil du site.",
        "ja": "ショートカットはサイトのホームページを直接開きます。",
        "zh": "该快捷方式将直接打开网站首页。",
        "pt": "O atalho abrirá diretamente a página inicial do site.",
        "ar": "سيفتح الاختصار الصفحة الرئيسية للموقع مباشرةً.",
    },
    "You can access the website quickly without manually entering the URL.": {
        "mr": "URL स्वत: टाइप न करता आपण वेबसाइट लवकर उघडू शकता.",
        "hi": "आप URL अपने आप दर्ज किए बिना वेबसाइट तुरंत खोल सकते हैं।",
        "de": "Du kannst die Website schnell öffnen, ohne die URL manuell einzugeben.",
        "es": "Puedes acceder al sitio rápidamente sin escribir la URL manualmente.",
        "fr": "Vous pouvez accéder rapidement au site sans saisir l'URL manuellement.",
        "ja": "URL を手動で入力せずに、サイトへすばやくアクセスできます。",
        "zh": "无需手动输入网址即可快速访问网站。",
        "pt": "Você pode acessar o site rapidamente sem digitar a URL manualmente.",
        "ar": "يمكنك الوصول إلى الموقع بسرعة دون إدخال العنوان يدويًا.",
    },
    "Add the shortcut from your browser menu": {
        "mr": "ब्राउझर मेन्यूमधून शॉर्टकट जोडा",
        "hi": "ब्राउज़र मेन्यू से शॉर्टकट जोड़ें",
        "de": "Verknüpfung über das Browser-Menü hinzufügen",
        "es": "Añade el acceso directo desde el menú del navegador",
        "fr": "Ajoutez le raccourci depuis le menu du navigateur",
        "ja": "ブラウザーのメニューからショートカットを追加",
        "zh": "从浏览器菜单添加快捷方式",
        "pt": "Adicione o atalho pelo menu do navegador",
        "ar": "أضف الاختصار من قائمة المتصفح",
    },
    "Chrome (desktop): click the install icon in the address bar (a small screen with a down arrow), or open the ⋮ menu → Cast, save, and share → Install page as app.": {
        "mr": "Chrome (डेस्कटॉप): पत्त्याच्या पट्टीतील इंस्टॉल आयकॉनवर क्लिक करा (खाली बाण असलेला छोटा स्क्रीन), किंवा ⋮ मेन्यू उघडा → Cast, save, and share → Install page as app.",
        "hi": "Chrome (डेस्कटॉप): एड्रेस बार में इंस्टॉल आइकन पर क्लिक करें (नीचे तीर वाली छोटी स्क्रीन), या ⋮ मेन्यू खोलें → Cast, save, and share → Install page as app.",
        "de": "Chrome (Desktop): klicke auf das Installationssymbol in der Adressleiste (ein kleiner Bildschirm mit Pfeil nach unten) oder öffne das ⋮-Menü → Cast, save, and share → Install page as app.",
        "es": "Chrome (escritorio): haz clic en el icono de instalación de la barra de direcciones (una pantalla pequeña con una flecha hacia abajo) o abre el menú ⋮ → Cast, save, and share → Install page as app.",
        "fr": "Chrome (ordinateur) : cliquez sur l'icône d'installation dans la barre d'adresse (un petit écran avec une flèche vers le bas) ou ouvrez le menu ⋮ → Cast, save, and share → Install page as app.",
        "ja": "Chrome（デスクトップ）：アドレスバーのインストールアイコン（下矢印付きの小さな画面）をクリックするか、⋮ メニュー → Cast, save, and share → Install page as app を開きます。",
        "zh": "Chrome（桌面版）：点击地址栏中的安装图标（带向下箭头的小屏幕），或打开 ⋮ 菜单 → Cast, save, and share → Install page as app。",
        "pt": "Chrome (desktop): clique no ícone de instalação na barra de endereço (uma tela pequena com uma seta para baixo) ou abra o menu ⋮ → Cast, save, and share → Install page as app.",
        "ar": "Chrome (سطح المكتب): انقر على أيقونة التثبيت في شريط العنوان (شاشة صغيرة مع سهم لأسفل)، أو افتح قائمة ⋮ ← Cast, save, and share ← Install page as app.",
    },
    "Microsoft Edge (desktop): click the install icon in the address bar, or open the ⋮ menu → Apps → Install this site as an app.": {
        "mr": "Microsoft Edge (डेस्कटॉप): पत्त्याच्या पट्टीतील इंस्टॉल आयकॉनवर क्लिक करा, किंवा ⋮ मेन्यू उघडा → Apps → Install this site as an app.",
        "hi": "Microsoft Edge (डेस्कटॉप): एड्रेस बार में इंस्टॉल आइकन पर क्लिक करें, या ⋮ मेन्यू खोलें → Apps → Install this site as an app.",
        "de": "Microsoft Edge (Desktop): klicke auf das Installationssymbol in der Adressleiste oder öffne das ⋮-Menü → Apps → Install this site as an app.",
        "es": "Microsoft Edge (escritorio): haz clic en el icono de instalación de la barra de direcciones o abre el menú ⋮ → Apps → Install this site as an app.",
        "fr": "Microsoft Edge (ordinateur) : cliquez sur l'icône d'installation dans la barre d'adresse ou ouvrez le menu ⋮ → Apps → Install this site as an app.",
        "ja": "Microsoft Edge（デスクトップ）：アドレスバーのインストールアイコンをクリックするか、⋮ メニュー → Apps → Install this site as an app を開きます。",
        "zh": "Microsoft Edge（桌面版）：点击地址栏中的安装图标，或打开 ⋮ 菜单 → Apps → Install this site as an app。",
        "pt": "Microsoft Edge (desktop): clique no ícone de instalação na barra de endereço ou abra o menu ⋮ → Apps → Install this site as an app.",
        "ar": "Microsoft Edge (سطح المكتب): انقر على أيقونة التثبيت في شريط العنوان، أو افتح قائمة ⋮ ← Apps ← Install this site as an app.",
    },
    "Other Chromium browsers: open the browser menu and choose Install app or Add to Home screen.": {
        "mr": "इतर Chromium ब्राउझर: ब्राउझर मेन्यू उघडा आणि Install app किंवा Add to Home screen निवडा.",
        "hi": "अन्य Chromium ब्राउज़र: ब्राउज़र मेन्यू खोलें और Install app या Add to Home screen चुनें।",
        "de": "Andere Chromium-Browser: öffne das Browser-Menü und wähle Install app oder Add to Home screen.",
        "es": "Otros navegadores Chromium: abre el menú del navegador y elige Install app o Add to Home screen.",
        "fr": "Autres navigateurs Chromium : ouvrez le menu du navigateur et choisissez Install app ou Add to Home screen.",
        "ja": "その他の Chromium ブラウザー：ブラウザーのメニューを開き、Install app または Add to Home screen を選択します。",
        "zh": "其他 Chromium 浏览器：打开浏览器菜单，选择 Install app 或 Add to Home screen。",
        "pt": "Outros navegadores Chromium: abra o menu do navegador e escolha Install app ou Add to Home screen.",
        "ar": "متصفحات Chromium الأخرى: افتح قائمة المتصفح واختر Install app أو Add to Home screen.",
    },
    "Android (Chrome or Edge): open the ⋮ menu and tap Add to Home screen or Install app.": {
        "mr": "Android (Chrome किंवा Edge): ⋮ मेन्यू उघडा आणि Add to Home screen किंवा Install app टॅप करा.",
        "hi": "Android (Chrome या Edge): ⋮ मेन्यू खोलें और Add to Home screen या Install app टैप करें।",
        "de": "Android (Chrome oder Edge): öffne das ⋮-Menü und tippe auf Add to Home screen oder Install app.",
        "es": "Android (Chrome o Edge): abre el menú ⋮ y toca Add to Home screen o Install app.",
        "fr": "Android (Chrome ou Edge) : ouvrez le menu ⋮ et touchez Add to Home screen ou Install app.",
        "ja": "Android（Chrome または Edge）：⋮ メニューを開き、Add to Home screen または Install app をタップします。",
        "zh": "Android（Chrome 或 Edge）：打开 ⋮ 菜单，点按 Add to Home screen 或 Install app。",
        "pt": "Android (Chrome ou Edge): abra o menu ⋮ e toque em Add to Home screen ou Install app.",
        "ar": "Android (Chrome أو Edge): افتح قائمة ⋮ واضغط Add to Home screen أو Install app.",
    },
    "iPhone / iPad (Safari): tap Share, then Add to Home Screen.": {
        "mr": "iPhone / iPad (Safari): Share टॅप करा, नंतर Add to Home Screen टॅप करा.",
        "hi": "iPhone / iPad (Safari): Share टैप करें, फिर Add to Home Screen टैप करें।",
        "de": "iPhone / iPad (Safari): tippe auf Share und dann auf Add to Home Screen.",
        "es": "iPhone / iPad (Safari): toca Share y después Add to Home Screen.",
        "fr": "iPhone / iPad (Safari) : touchez Share, puis Add to Home Screen.",
        "ja": "iPhone / iPad（Safari）：Share をタップし、次に Add to Home Screen をタップします。",
        "zh": "iPhone / iPad（Safari）：点按“共享”，然后点按“添加到主屏幕”。",
        "pt": "iPhone / iPad (Safari): toque em Share e depois em Add to Home Screen.",
        "ar": "iPhone / iPad (Safari): اضغط Share ثم Add to Home Screen.",
    },
    "Already installed but the shortcut is missing? Open chrome://apps (or edge://apps), remove the app, then add it again from this button.": {
        "mr": "आधीच इंस्टॉल आहे पण शॉर्टकट दिसत नाही? chrome://apps (किंवा edge://apps) उघडा, अॅप काढा, नंतर या बटणाने पुन्हा जोडा.",
        "hi": "पहले से इंस्टॉल है पर शॉर्टकट नहीं दिख रहा? chrome://apps (या edge://apps) खोलें, ऐप हटाएँ, फिर इस बटन से दोबारा जोड़ें।",
        "de": "Schon installiert, aber die Verknüpfung fehlt? Öffne chrome://apps (oder edge://apps), entferne die App und füge sie mit diesem Button erneut hinzu.",
        "es": "¿Ya está instalado pero falta el acceso directo? Abre chrome://apps (o edge://apps), quita la app y vuelve a añadirla con este botón.",
        "fr": "Déjà installé mais le raccourci manque ? Ouvrez chrome://apps (ou edge://apps), supprimez l'application, puis ajoutez-la de nouveau avec ce bouton.",
        "ja": "すでにインストール済みなのにショートカットがありませんか？chrome://apps（または edge://apps）を開いてアプリを削除し、このボタンからもう一度追加してください。",
        "zh": "已安装但快捷方式不见了？打开 chrome://apps（或 edge://apps），移除应用，然后通过此按钮重新添加。",
        "pt": "Já instalado, mas o atalho está faltando? Abra chrome://apps (ou edge://apps), remova o app e adicione-o novamente por este botão.",
        "ar": "مثبت بالفعل لكن الاختصار مفقود؟ افتح chrome://apps (أو edge://apps)، احذف التطبيق، ثم أضفه مرة أخرى من هذا الزر.",
    },
    "Metal Weight Calculator is already installed in this browser. Open it from the Start menu, your desktop, or chrome://apps (edge://apps in Edge). If its shortcut was removed, remove the app there and add it again with this button.": {
        "mr": "मेटल वेट कॅल्क्युलेटर या ब्राउझरमध्ये आधीच इंस्टॉल आहे. तो स्टार्ट मेन्यू, डेस्कटॉप किंवा chrome://apps (Edge मध्ये edge://apps) वरून उघडा. शॉर्टकट काढला असल्यास तेथून अॅप काढा आणि या बटणाने पुन्हा जोडा.",
        "hi": "मेटल वेट कैलकुलेटर इस ब्राउज़र में पहले से इंस्टॉल है। इसे स्टार्ट मेन्यू, डेस्कटॉप या chrome://apps (Edge में edge://apps) से खोलें। यदि शॉर्टकट हटाया गया है, तो वहाँ से ऐप हटाएँ और इस बटन से दोबारा जोड़ें।",
        "de": "Metal Weight Calculator ist in diesem Browser bereits installiert. Öffne es über das Startmenü, den Desktop oder chrome://apps (in Edge: edge://apps). Wurde die Verknüpfung entfernt, entferne die App dort und füge sie mit diesem Button erneut hinzu.",
        "es": "Metal Weight Calculator ya está instalado en este navegador. Ábrelo desde el menú Inicio, el escritorio o chrome://apps (edge://apps en Edge). Si se quitó el acceso directo, elimina la app allí y vuelve a añadirla con este botón.",
        "fr": "Metal Weight Calculator est déjà installé dans ce navigateur. Ouvrez-le depuis le menu Démarrer, le bureau ou chrome://apps (edge://apps dans Edge). Si le raccourci a été supprimé, désinstallez l'application là-bas et ajoutez-la de nouveau avec ce bouton.",
        "ja": "金属重量計算ツールはこのブラウザーにすでにインストールされています。スタートメニュー、デスクトップ、または chrome://apps（Edge では edge://apps）から開いてください。ショートカットが削除された場合は、そこでアプリを削除し、このボタンから再度追加してください。",
        "zh": "金属重量计算器已安装在此浏览器中。可从开始菜单、桌面或 chrome://apps（Edge 中为 edge://apps）打开。如果快捷方式被删除，请在该处卸载应用，然后通过此按钮重新添加。",
        "pt": "O Metal Weight Calculator já está instalado neste navegador. Abra-o pelo menu Iniciar, pela área de trabalho ou por chrome://apps (edge://apps no Edge). Se o atalho foi removido, remova o app lá e adicione-o novamente com este botão.",
        "ar": "حاسبة أوزان المعادن مثبتة بالفعل في هذا المتصفح. افتحها من قائمة البداية أو سطح المكتب أو chrome://apps (أو edge://apps في Edge). إذا أُزيل الاختصار، احذف التطبيق من هناك ثم أضفه مرة أخرى بهذا الزر.",
    },
    "The browser couldn't open its install prompt. Use the steps below to add the shortcut manually.": {
        "mr": "ब्राउझरला इंस्टॉल प्रॉम्प्ट उघडता आला नाही. शॉर्टकट स्वतः जोडण्यासाठी खालील पायऱ्या वापरा.",
        "hi": "ब्राउज़र अपना इंस्टॉल प्रॉम्प्ट नहीं खोल सका। शॉर्टकट मैन्युअली जोड़ने के लिए नीचे दिए चरणों का उपयोग करें।",
        "de": "Der Browser konnte seine Installationsaufforderung nicht öffnen. Nutze die folgenden Schritte, um die Verknüpfung manuell hinzuzufügen.",
        "es": "El navegador no pudo abrir su aviso de instalación. Usa los pasos siguientes para añadir el acceso directo manualmente.",
        "fr": "Le navigateur n'a pas pu ouvrir son invite d'installation. Suivez les étapes ci-dessous pour ajouter le raccourci manuellement.",
        "ja": "ブラウザーがインストールの案内を表示できませんでした。以下の手順でショートカットを手動で追加してください。",
        "zh": "浏览器无法打开安装提示。请按以下步骤手动添加快捷方式。",
        "pt": "O navegador não conseguiu abrir o aviso de instalação. Use as etapas abaixo para adicionar o atalho manualmente.",
        "ar": "لم يتمكن المتصفح من فتح مطالبة التثبيت. استخدم الخطوات أدناه لإضافة الاختصار يدويًا.",
    },
    "The install prompt couldn't be completed. Use the steps below to add the shortcut manually.": {
        "mr": "इंस्टॉल प्रॉम्प्ट पूर्ण होऊ शकला नाही. शॉर्टकट स्वतः जोडण्यासाठी खालील पायऱ्या वापरा.",
        "hi": "इंस्टॉल प्रॉम्प्ट पूरा नहीं हो सका। शॉर्टकट मैन्युअली जोड़ने के लिए नीचे दिए चरणों का उपयोग करें।",
        "de": "Die Installation konnte nicht abgeschlossen werden. Nutze die folgenden Schritte, um die Verknüpfung manuell hinzuzufügen.",
        "es": "No se pudo completar la instalación. Usa los pasos siguientes para añadir el acceso directo manualmente.",
        "fr": "L'installation n'a pas pu aboutir. Suivez les étapes ci-dessous pour ajouter le raccourci manuellement.",
        "ja": "インストールを完了できませんでした。以下の手順でショートカットを手動で追加してください。",
        "zh": "安装未能完成。请按以下步骤手动添加快捷方式。",
        "pt": "Não foi possível concluir a instalação. Use as etapas abaixo para adicionar o atalho manualmente.",
        "ar": "تعذّر إكمال التثبيت. استخدم الخطوات أدناه لإضافة الاختصار يدويًا.",
    },
    "Waiting for browser…": {
        "mr": "ब्राउझरची वाट पाहत आहे…", "hi": "ब्राउज़र की प्रतीक्षा कर रहा है…",
        "de": "Warte auf Browser…", "es": "Esperando al navegador…", "fr": "En attente du navigateur…",
        "ja": "ブラウザーを待機中…", "zh": "正在等待浏览器…", "pt": "Aguardando o navegador…",
        "ar": "في انتظار المتصفح…",
    },
    "Waiting for your browser to offer its install prompt. This usually takes a few seconds…": {
        "mr": "ब्राउझर इंस्टॉल प्रॉम्प्ट देईल तेव्हापर्यंत वाट पाहत आहे. यास सामान्यत: काही सेकंद लागतात…",
        "hi": "ब्राउज़र के इंस्टॉल प्रॉम्प्ट दिखाने की प्रतीक्षा कर रहा है। इसमें आमतौर पर कुछ सेकंड लगते हैं…",
        "de": "Warte darauf, dass der Browser die Installationsaufforderung anbietet. Das dauert meist einige Sekunden…",
        "es": "Esperando a que el navegador ofrezca su aviso de instalación. Suele tardar unos segundos…",
        "fr": "En attente que le navigateur propose son invite d'installation. Cela prend généralement quelques secondes…",
        "ja": "ブラウザーがインストールの案内を表示するのを待っています。通常は数秒かかります…",
        "zh": "正在等待浏览器显示安装提示，通常需要几秒钟…",
        "pt": "Aguardando o navegador oferecer o aviso de instalação. Isso costuma levar alguns segundos…",
        "ar": "في انتظار أن يعرض المتصفح مطالبة التثبيت. يستغرق ذلك عادةً بضع ثوانٍ…",
    },
    "Your browser didn't offer its automatic install prompt. Press Try Again, or add the shortcut from the browser menu using the steps below.": {
        "mr": "ब्राउझरने स्वयंचलित इंस्टॉल प्रॉम्प्ट दाखवला नाही. पुन्हा प्रयत्न करा दाबा, किंवा खालील पायऱ्यांनी ब्राउझर मेन्यूमधून शॉर्टकट जोडा.",
        "hi": "ब्राउज़र ने स्वतः इंस्टॉल प्रॉम्प्ट नहीं दिखाया। फिर से प्रयास करें दबाएँ, या नीचे दिए चरणों से ब्राउज़र मेन्यू में शॉर्टकट जोड़ें।",
        "de": "Der Browser hat keine automatische Installationsaufforderung angeboten. Drücke Erneut versuchen oder füge die Verknüpfung über das Browser-Menü mit den folgenden Schritten hinzu.",
        "es": "El navegador no ofreció su instalación automática. Pulsa Intentar de nuevo o añade el acceso directo desde el menú del navegador con los pasos siguientes.",
        "fr": "Le navigateur n'a pas proposé d'installation automatique. Appuyez sur Réessayer ou ajoutez le raccourci depuis le menu du navigateur avec les étapes ci-dessous.",
        "ja": "ブラウザーが自動インストールの案内を表示しませんでした。再試行を押すか、以下の手順でブラウザーのメニューからショートカットを追加してください。",
        "zh": "浏览器没有显示自动安装提示。请点击重试，或按以下步骤从浏览器菜单添加快捷方式。",
        "pt": "O navegador não ofereceu o aviso de instalação automática. Pressione Tentar novamente ou adicione o atalho pelo menu do navegador usando as etapas abaixo.",
        "ar": "لم يعرض المتصفح مطالبة التثبيت التلقائي. اضغط إعادة المحاولة، أو أضف الاختصار من قائمة المتصفح باستخدام الخطوات أدناه.",
    },
    "Add Metal Weight Calculator to Your Home Screen": {
        "mr": "मेटल वेट कॅल्क्युलेटर होम स्क्रीनवर जोडा",
        "hi": "मेटल वेट कैलकुलेटर को होम स्क्रीन पर जोड़ें",
        "de": "Metal Weight Calculator zum Startbildschirm hinzufügen",
        "es": "Añadir Metal Weight Calculator a tu pantalla de inicio",
        "fr": "Ajouter Metal Weight Calculator à votre écran d'accueil",
        "ja": "金属重量計算ツールをホーム画面に追加",
        "zh": "将金属重量计算器添加到主屏幕",
        "pt": "Adicionar Metal Weight Calculator à tela inicial",
        "ar": "إضافة حاسبة أوزان المعادن إلى الشاشة الرئيسية",
    },
    "Get quick access to every Metal Weight Calculator tool directly from your mobile home screen or desktop.": {
        "mr": "मोबाइल होम स्क्रीन किंवा डेस्कटॉपवरून थेट सर्व मेटल वेट कॅल्क्युलेटर टूल्समध्ये लवकर प्रवेश मिळवा.",
        "hi": "मोबाइल होम स्क्रीन या डेस्कटॉप से सीधे सभी मेटल वेट कैलकुलेटर टूल्स तक तुरंत पहुँचें।",
        "de": "Greife direkt von deinem mobilen Startbildschirm oder Desktop schnell auf alle Metal Weight Calculator Tools zu.",
        "es": "Accede rápidamente a todas las herramientas de Metal Weight Calculator desde tu pantalla de inicio móvil o el escritorio.",
        "fr": "Accédez rapidement à tous les outils Metal Weight Calculator depuis votre écran d'accueil mobile ou votre ordinateur.",
        "ja": "スマートフォンのホーム画面やデスクトップから、すべての金属重量計算ツールにすぐにアクセスできます。",
        "zh": "从移动设备主屏幕或桌面直接快速访问所有金属重量计算器工具。",
        "pt": "Acesse rapidamente todas as ferramentas do Metal Weight Calculator diretamente da tela inicial do celular ou do desktop.",
        "ar": "احصل على وصول سريع إلى جميع أدوات حاسبة أوزان المعادن مباشرةً من الشاشة الرئيسية للجوال أو سطح المكتب.",
    },
    "On iPhone/iPad (Safari):": {
        "mr": "iPhone/iPad (Safari) वर:", "hi": "iPhone/iPad (Safari) पर:",
        "de": "Auf iPhone/iPad (Safari):", "es": "En iPhone/iPad (Safari):",
        "fr": "Sur iPhone/iPad (Safari) :", "ja": "iPhone/iPad（Safari）の場合：",
        "zh": "在 iPhone/iPad（Safari）上：", "pt": "No iPhone/iPad (Safari):",
        "ar": "على iPhone/iPad (Safari):",
    },
    "Tap the Share button in Safari.": {
        "mr": "Safari मध्ये Share बटण टॅप करा.", "hi": "Safari में Share बटन टैप करें।",
        "de": "Tippe in Safari auf die Share-Taste.", "es": "Toca el botón Share en Safari.",
        "fr": "Touchez le bouton Share dans Safari.", "ja": "Safari で Share ボタンをタップします。",
        "zh": "在 Safari 中点按“共享”按钮。", "pt": "Toque no botão Share no Safari.",
        "ar": "اضغط زر Share في Safari.",
    },
    "Select Add to Home Screen.": {
        "mr": "Add to Home Screen निवडा.", "hi": "Add to Home Screen चुनें।",
        "de": "Wähle Add to Home Screen.", "es": "Selecciona Add to Home Screen.",
        "fr": "Sélectionnez Add to Home Screen.", "ja": "Add to Home Screen を選択します。",
        "zh": "选择“添加到主屏幕”。", "pt": "Selecione Add to Home Screen.",
        "ar": "اختر Add to Home Screen.",
    },
    "Tap Add to install.": {
        "mr": "इंस्टॉल करण्यासाठी Add टॅप करा.", "hi": "इंस्टॉल करने के लिए Add टैप करें।",
        "de": "Tippe auf Add, um zu installieren.", "es": "Toca Add para instalar.",
        "fr": "Touchez Add pour installer.", "ja": "Add をタップしてインストールします。",
        "zh": "点按“添加”完成安装。", "pt": "Toque em Add para instalar.",
        "ar": "اضغط Add للتثبيت.",
    },
    "Install from your browser:": {
        "mr": "ब्राउझरमधून इंस्टॉल करा:", "hi": "ब्राउज़र से इंस्टॉल करें:",
        "de": "Aus dem Browser installieren:", "es": "Instala desde tu navegador:",
        "fr": "Installez depuis votre navigateur :", "ja": "ブラウザーからインストール：",
        "zh": "从浏览器安装：", "pt": "Instale pelo navegador:",
        "ar": "التثبيت من المتصفح:",
    },
    "Android Chrome: open the three-dot menu, then choose Install app or Add to Home screen.": {
        "mr": "Android Chrome: तीन-बिंदू मेन्यू उघडा, नंतर Install app किंवा Add to Home screen निवडा.",
        "hi": "Android Chrome: तीन-बिंदु मेन्यू खोलें, फिर Install app या Add to Home screen चुनें।",
        "de": "Android Chrome: öffne das Menü mit drei Punkten und wähle Install app oder Add to Home screen.",
        "es": "Android Chrome: abre el menú de tres puntos y elige Install app o Add to Home screen.",
        "fr": "Android Chrome : ouvrez le menu à trois points, puis choisissez Install app ou Add to Home screen.",
        "ja": "Android Chrome：三点メニューを開き、Install app または Add to Home screen を選択します。",
        "zh": "Android Chrome：打开三点菜单，然后选择 Install app 或 Add to Home screen。",
        "pt": "Android Chrome: abra o menu de três pontos e escolha Install app ou Add to Home screen.",
        "ar": "Android Chrome: افتح قائمة النقاط الثلاث ثم اختر Install app أو Add to Home screen.",
    },
    "Desktop Chrome / Edge: use the install icon in the address bar, or open the browser menu and choose Install app.": {
        "mr": "डेस्कटॉप Chrome / Edge: पत्त्याच्या पट्टीतील इंस्टॉल आयकॉन वापरा, किंवा ब्राउझर मेन्यू उघडून Install app निवडा.",
        "hi": "डेस्कटॉप Chrome / Edge: एड्रेस बार में इंस्टॉल आइकन इस्तेमाल करें, या ब्राउज़र मेन्यू खोलकर Install app चुनें।",
        "de": "Desktop-Chrome / Edge: nutze das Installationssymbol in der Adressleiste oder öffne das Browser-Menü und wähle Install app.",
        "es": "Chrome / Edge de escritorio: usa el icono de instalación en la barra de direcciones o abre el menú del navegador y elige Install app.",
        "fr": "Chrome / Edge sur ordinateur : utilisez l'icône d'installation dans la barre d'adresse ou ouvrez le menu du navigateur et choisissez Install app.",
        "ja": "デスクトップの Chrome / Edge：アドレスバーのインストールアイコンを使うか、ブラウザーのメニューを開いて Install app を選択します。",
        "zh": "桌面版 Chrome / Edge：使用地址栏中的安装图标，或打开浏览器菜单选择 Install app。",
        "pt": "Chrome / Edge desktop: use o ícone de instalação na barra de endereço ou abra o menu do navegador e escolha Install app.",
        "ar": "Chrome / Edge لسطح المكتب: استخدم أيقونة التثبيت في شريط العنوان، أو افتح قائمة المتصفح واختر Install app.",
    },
    "Other browsers: open the browser menu and choose Install or Add to Home Screen.": {
        "mr": "इतर ब्राउझर: ब्राउझर मेन्यू उघडा आणि Install किंवा Add to Home Screen निवडा.",
        "hi": "अन्य ब्राउज़र: ब्राउज़र मेन्यू खोलें और Install या Add to Home Screen चुनें।",
        "de": "Andere Browser: öffne das Browser-Menü und wähle Install oder Add to Home Screen.",
        "es": "Otros navegadores: abre el menú del navegador y elige Install o Add to Home Screen.",
        "fr": "Autres navigateurs : ouvrez le menu du navigateur et choisissez Install ou Add to Home Screen.",
        "ja": "その他のブラウザー：ブラウザーのメニューを開き、Install または Add to Home Screen を選択します。",
        "zh": "其他浏览器：打开浏览器菜单，选择 Install 或 Add to Home Screen。",
        "pt": "Outros navegadores: abra o menu do navegador e escolha Install ou Add to Home Screen.",
        "ar": "متصفحات أخرى: افتح قائمة المتصفح واختر Install أو Add to Home Screen.",
    },
    "YES – Add to Home Screen": {
        "mr": "हो – होम स्क्रीनवर जोडा", "hi": "हाँ – होम स्क्रीन पर जोड़ें",
        "de": "JA – Zum Startbildschirm hinzufügen", "es": "SÍ – Añadir a la pantalla de inicio",
        "fr": "OUI – Ajouter à l'écran d'accueil", "ja": "はい – ホーム画面に追加",
        "zh": "是 – 添加到主屏幕", "pt": "SIM – Adicionar à tela inicial",
        "ar": "نعم – إضافة إلى الشاشة الرئيسية",
    },
    "NO – Maybe Later": {
        "mr": "नाही – नंतर पाहू", "hi": "नहीं – शायद बाद में",
        "de": "NEIN – Vielleicht später", "es": "NO – Quizá más tarde",
        "fr": "NON – Peut-être plus tard", "ja": "いいえ – 後で",
        "zh": "否 – 以后再说", "pt": "NÃO – Talvez depois",
        "ar": "لا – ربما لاحقًا",
    },
    "Automatic install isn't available in this browser. Use your browser menu to install or add a shortcut.": {
        "mr": "या ब्राउझरमध्ये स्वयंचलित इंस्टॉल उपलब्ध नाही. इंस्टॉल करण्यासाठी किंवा शॉर्टकट जोडण्यासाठी ब्राउझर मेन्यू वापरा.",
        "hi": "इस ब्राउज़र में स्वतः इंस्टॉल उपलब्ध नहीं है। इंस्टॉल करने या शॉर्टकट जोड़ने के लिए ब्राउज़र मेन्यू का उपयोग करें।",
        "de": "Automatische Installation ist in diesem Browser nicht verfügbar. Nutze das Browser-Menü, um zu installieren oder eine Verknüpfung hinzuzufügen.",
        "es": "La instalación automática no está disponible en este navegador. Usa el menú del navegador para instalar o añadir un acceso directo.",
        "fr": "L'installation automatique n'est pas disponible dans ce navigateur. Utilisez le menu du navigateur pour installer ou ajouter un raccourci.",
        "ja": "このブラウザーでは自動インストールを利用できません。ブラウザーのメニューからインストールまたはショートカットの追加を行ってください。",
        "zh": "此浏览器不支持自动安装。请使用浏览器菜单安装或添加快捷方式。",
        "pt": "A instalação automática não está disponível neste navegador. Use o menu do navegador para instalar ou adicionar um atalho.",
        "ar": "التثبيت التلقائي غير متاح في هذا المتصفح. استخدم قائمة المتصفح للتثبيت أو إضافة اختصار.",
    },
    "Installation couldn't be completed automatically. Please use your browser menu to install.": {
        "mr": "इंस्टॉल स्वयंचलितरीत्ये पूर्ण होऊ शकला नाही. कृपया ब्राउझर मेन्यू वापरून इंस्टॉल करा.",
        "hi": "इंस्टॉल स्वतः पूरा नहीं हो सका। कृपया ब्राउज़र मेन्यू से इंस्टॉल करें।",
        "de": "Die Installation konnte nicht automatisch abgeschlossen werden. Bitte nutze das Browser-Menü zur Installation.",
        "es": "No se pudo completar la instalación automáticamente. Usa el menú del navegador para instalar.",
        "fr": "L'installation n'a pas pu aboutir automatiquement. Veuillez utiliser le menu du navigateur pour installer.",
        "ja": "自動インストールを完了できませんでした。ブラウザーのメニューからインストールしてください。",
        "zh": "无法自动完成安装。请使用浏览器菜单进行安装。",
        "pt": "Não foi possível concluir a instalação automaticamente. Use o menu do navegador para instalar.",
        "ar": "تعذّر إكمال التثبيت تلقائيًا. يرجى استخدام قائمة المتصفح للتثبيت.",
    },
}

LANGUAGE_NAMES = {
    "en": {"Marathi": "Marathi", "Hindi": "Hindi", "English": "English", "German": "German", "Spanish": "Spanish", "French": "French", "Japanese": "Japanese", "Chinese": "Chinese", "Portuguese": "Portuguese", "Arabic": "Arabic"},
    "mr": {"Marathi": "मराठी", "Hindi": "हिंदी", "English": "इंग्रजी", "German": "जर्मन", "Spanish": "स्पॅनिश", "French": "फ्रेंच", "Japanese": "जपानी", "Chinese": "चिनी", "Portuguese": "पोर्तुगीज", "Arabic": "अरबी"},
    "hi": {"Marathi": "मराठी", "Hindi": "हिंदी", "English": "अंग्रेजी", "German": "जर्मन", "Spanish": "स्पैनिश", "French": "फ्रेंच", "Japanese": "जापानी", "Chinese": "चीनी", "Portuguese": "पुर्तगाली", "Arabic": "अरबी"},
    "de": {"Marathi": "Marathi", "Hindi": "Hindi", "English": "Englisch", "German": "Deutsch", "Spanish": "Spanisch", "French": "Französisch", "Japanese": "Japanisch", "Chinese": "Chinesisch", "Portuguese": "Portugiesisch", "Arabic": "Arabisch"},
    "es": {"Marathi": "Maratí", "Hindi": "Hindi", "English": "Inglés", "German": "Alemán", "Spanish": "Español", "French": "Francés", "Japanese": "Japonés", "Chinese": "Chino", "Portuguese": "Portugués", "Arabic": "Árabe"},
    "fr": {"Marathi": "Marathe", "Hindi": "Hindi", "English": "Anglais", "German": "Allemand", "Spanish": "Espagnol", "French": "Français", "Japanese": "Japonais", "Chinese": "Chinois", "Portuguese": "Portugais", "Arabic": "Arabe"},
    "ja": {"Marathi": "マラーティー語", "Hindi": "ヒンディー語", "English": "英語", "German": "ドイツ語", "Spanish": "スペイン語", "French": "フランス語", "Japanese": "日本語", "Chinese": "中国語", "Portuguese": "ポルトガル語", "Arabic": "アラビア語"},
    "zh": {"Marathi": "马拉地语", "Hindi": "印地语", "English": "英语", "German": "德语", "Spanish": "西班牙语", "French": "法语", "Japanese": "日语", "Chinese": "中文", "Portuguese": "葡萄牙语", "Arabic": "阿拉伯语"},
    "pt": {"Marathi": "Marata", "Hindi": "Hindi", "English": "Inglês", "German": "Alemão", "Spanish": "Espanhol", "French": "Francês", "Japanese": "Japonês", "Chinese": "Chinês", "Portuguese": "Português", "Arabic": "Árabe"},
    "ar": {"Marathi": "الماراثية", "Hindi": "الهندية", "English": "الإنجليزية", "German": "الألمانية", "Spanish": "الإسبانية", "French": "الفرنسية", "Japanese": "اليابانية", "Chinese": "الصينية", "Portuguese": "البرتغالية", "Arabic": "العربية"},
}


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass

    added = 0
    replaced = 0
    for code in language_codes():
        dictionary = load_dictionary(code)
        strings = dictionary.setdefault("strings", {})
        for key, values in T.items():
            if code == EN:
                value = key
            else:
                value = values[code]
            if key in strings:
                if key in OVERWRITE and strings[key] != value:
                    strings[key] = value
                    replaced += 1
                continue
            strings[key] = value
            added += 1
        for key, value in LANGUAGE_NAMES[code].items():
            if key in strings:
                if key in OVERWRITE and strings[key] != value:
                    strings[key] = value
                    replaced += 1
                continue
            strings[key] = value
            added += 1
        path = dictionary_path(code)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            __import__("json").dumps(dictionary, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8", newline="\n",
        )
    print(f"added {added} keys, replaced {replaced} unnatural translations across {len(language_codes())} dictionaries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
