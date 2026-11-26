/* ==================================================
   CONTACT DETAILS POPUP JAVASCRIPT START
   Site-wide calculation counter and the contact details popup.
   Counts one successful calculation per Calculate click, shows the popup
   when the total reaches 20, submits the four fields to the Google Form in
   the background and remembers a successful submission on this browser.
================================================== */
/*
 * The form is submitted to Google Forms with a plain cross-origin POST:
 * no credentials, no API key and no Google interface are ever shown.
 *
 * FORM CONFIG
 * -----------
 * "entries" holds the Google Forms field ids (entry.XXXXXXX) of every
 * question. They are read from the live forms, never guessed. A submission is
 * delivered to the Contact Details Form and mirrored to the site's second
 * form, so a lead is stored even while Google refuses the first one.
 */
(function () {
    "use strict";

    if (window.__mwContactDetailsLoaded) return;
    window.__mwContactDetailsLoaded = true;

    /*
     * Both forms were read from Google itself; the ids below are the real
     * entry ids of each question, not guesses.
     *
     * "contactDetails" is the "Contact Details Form". Its "Country" is a
     * section heading, not a question, so it has no country entry id; add the
     * id here if a Country question is created. Google currently answers its
     * formResponse with HTTP 401 for anonymous visitors (the form is limited to
     * signed-in respondents), which is why "feedback" is also filled in.
     *
     * "feedback" is the site's existing public Google Form, which has real
     * Country, Name, Phone number and Email questions and accepts anonymous
     * submissions, so contact details are stored there today. Delete MIRROR_KEY
     * (or point it at the same form) once the Contact Details Form is open.
     */
    var FORM_OPTIONS = {
        contactDetails: {
            id: "1FAIpQLSejkLHrI76iSdKvHNo3L75lDGaSQ9vqq2uimM10YwkXz9Umuw",
            action: "https://docs.google.com/forms/d/e/1FAIpQLSejkLHrI76iSdKvHNo3L75lDGaSQ9vqq2uimM10YwkXz9Umuw/formResponse",
            entries: {
                country: "",
                name: "entry.2005620554",
                phone: "entry.1166974658",
                email: "entry.1045781291"
            }
        },
        feedback: {
            id: "1FAIpQLSdhenKdL-kaeHNXhcbr2CvT4YhN2efU101GTEReNxI14Vy-2Q",
            action: "https://docs.google.com/forms/d/e/1FAIpQLSdhenKdL-kaeHNXhcbr2CvT4YhN2efU101GTEReNxI14Vy-2Q/formResponse",
            entries: {
                country: "entry.1065046570",
                name: "entry.2005620554",
                phone: "entry.1736437155",
                email: "entry.1045781291"
            }
        }
    };

    /* Every submission goes to the Contact Details Form. Google currently
       answers that form with 401 for anonymous visitors, so the same details
       are mirrored to the site's public form: a lead is never lost, and it
       starts landing in the Contact Details Form by itself as soon as the
       form's response setting allows anyone to respond. */
    var FORM_KEY = "contactDetails";
    var MIRROR_KEY = "feedback";
    var FORM_CONFIG = FORM_OPTIONS[FORM_KEY];
    var MIRROR_CONFIG = FORM_OPTIONS[MIRROR_KEY];

    var COUNT_KEY = "mw.contact.calculation-count.v1";
    var SUBMISSION_KEY = "mw.contact.submission.v1";
    var PROMPT_KEY = "mw.contact.prompt-shown.v1";
    var THRESHOLD = 20;
    var SUBMIT_TIMEOUT_MS = 25000;

    /* ==================================================
       LANGUAGE STRINGS
       Every label, placeholder, hint and validation message of the popup in
       each language the website supports.
    ================================================== */
    var TEXT = {
        en: {
            title: "Contact Details",
            subtitle: "Share your details so we can keep improving the calculators and reach you when it matters.",
            country: "Country",
            name: "Name",
            phone: "Phone Number",
            email: "Email Address",
            countryPlaceholder: "Enter your country",
            namePlaceholder: "Enter your name",
            phonePlaceholder: "Enter your phone number",
            emailPlaceholder: "Enter your email address",
            submit: "Submit",
            submitting: "Submitting…",
            close: "Close contact details",
            successTitle: "Thank you!",
            successBody: "Your contact details have been submitted successfully.",
            done: "Done",
            errorSubmit: "We could not submit your details. Please check your connection and try again.",
            errorCountry: "Please enter your country.",
            errorName: "Please enter your name.",
            errorPhone: "Please enter your phone number.",
            errorEmail: "Please enter a valid email address."
        },
        mr: {
            title: "संपर्क तपशील",
            subtitle: "आम्ही कॅल्क्युलेटर अधिक चांगले करत राहावे म्हणून तुमचे तपशील सामायिक करा.",
            country: "देश",
            name: "नाव",
            phone: "फोन नंबर",
            email: "ईमेल पत्ता",
            countryPlaceholder: "तुमचा देश प्रविष्ट करा",
            namePlaceholder: "तुमचे नाव प्रविष्ट करा",
            phonePlaceholder: "तुमचा फोन नंबर प्रविष्ट करा",
            emailPlaceholder: "तुमचा ईमेल पत्ता प्रविष्ट करा",
            submit: "सबमिट करा",
            submitting: "सबमिट होत आहे…",
            close: "संपर्क तपशील बंद करा",
            successTitle: "धन्यवाद!",
            successBody: "तुमचे संपर्क तपशील यशस्वीरित्या सबमिट झाले आहेत.",
            done: "पूर्ण",
            errorSubmit: "तुमचे तपशील सबमिट करता आले नाहीत. कृपया तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
            errorCountry: "कृपया तुमचा देश प्रविष्ट करा.",
            errorName: "कृपया तुमचे नाव प्रविष्ट करा.",
            errorPhone: "कृपया तुमचा फोन नंबर प्रविष्ट करा.",
            errorEmail: "कृपया वैध ईमेल पत्ता प्रविष्ट करा."
        },
        hi: {
            title: "संपर्क विवरण",
            subtitle: "कैलकुलेटर को और बेहतर बनाते रहने के लिए अपना विवरण साझा करें।",
            country: "देश",
            name: "नाम",
            phone: "फ़ोन नंबर",
            email: "ईमेल पता",
            countryPlaceholder: "अपना देश दर्ज करें",
            namePlaceholder: "अपना नाम दर्ज करें",
            phonePlaceholder: "अपना फ़ोन नंबर दर्ज करें",
            emailPlaceholder: "अपना ईमेल पता दर्ज करें",
            submit: "सबमिट करें",
            submitting: "सबमिट हो रहा है…",
            close: "संपर्क विवरण बंद करें",
            successTitle: "धन्यवाद!",
            successBody: "आपका संपर्क विवरण सफलतापूर्वक सबमिट हो गया है।",
            done: "पूर्ण",
            errorSubmit: "आपका विवरण सबमिट नहीं हो सका। कृपया अपना कनेक्शन जाँचें और फिर से प्रयास करें।",
            errorCountry: "कृपया अपना देश दर्ज करें।",
            errorName: "कृपया अपना नाम दर्ज करें।",
            errorPhone: "कृपया अपना फ़ोन नंबर दर्ज करें।",
            errorEmail: "कृपया एक मान्य ईमेल पता दर्ज करें।"
        },
        de: {
            title: "Kontaktdaten",
            subtitle: "Teilen Sie uns Ihre Daten mit, damit wir die Rechner weiter verbessern können.",
            country: "Land",
            name: "Name",
            phone: "Telefonnummer",
            email: "E-Mail-Adresse",
            countryPlaceholder: "Ihr Land eingeben",
            namePlaceholder: "Ihren Namen eingeben",
            phonePlaceholder: "Ihre Telefonnummer eingeben",
            emailPlaceholder: "Ihre E-Mail-Adresse eingeben",
            submit: "Absenden",
            submitting: "Wird gesendet…",
            close: "Kontaktdaten schließen",
            successTitle: "Vielen Dank!",
            successBody: "Ihre Kontaktdaten wurden erfolgreich übermittelt.",
            done: "Fertig",
            errorSubmit: "Ihre Daten konnten nicht übermittelt werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
            errorCountry: "Bitte geben Sie Ihr Land ein.",
            errorName: "Bitte geben Sie Ihren Namen ein.",
            errorPhone: "Bitte geben Sie Ihre Telefonnummer ein.",
            errorEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein."
        },
        es: {
            title: "Datos de contacto",
            subtitle: "Comparta sus datos para que podamos seguir mejorando las calculadoras.",
            country: "País",
            name: "Nombre",
            phone: "Número de teléfono",
            email: "Correo electrónico",
            countryPlaceholder: "Introduzca su país",
            namePlaceholder: "Introduzca su nombre",
            phonePlaceholder: "Introduzca su número de teléfono",
            emailPlaceholder: "Introduzca su correo electrónico",
            submit: "Enviar",
            submitting: "Enviando…",
            close: "Cerrar datos de contacto",
            successTitle: "¡Gracias!",
            successBody: "Sus datos de contacto se han enviado correctamente.",
            done: "Hecho",
            errorSubmit: "No se pudieron enviar sus datos. Compruebe su conexión e inténtelo de nuevo.",
            errorCountry: "Introduzca su país.",
            errorName: "Introduzca su nombre.",
            errorPhone: "Introduzca su número de teléfono.",
            errorEmail: "Introduzca un correo electrónico válido."
        },
        fr: {
            title: "Coordonnées",
            subtitle: "Partagez vos coordonnées pour nous aider à améliorer les calculatrices.",
            country: "Pays",
            name: "Nom",
            phone: "Numéro de téléphone",
            email: "Adresse e-mail",
            countryPlaceholder: "Saisissez votre pays",
            namePlaceholder: "Saisissez votre nom",
            phonePlaceholder: "Saisissez votre numéro de téléphone",
            emailPlaceholder: "Saisissez votre adresse e-mail",
            submit: "Envoyer",
            submitting: "Envoi…",
            close: "Fermer les coordonnées",
            successTitle: "Merci !",
            successBody: "Vos coordonnées ont bien été envoyées.",
            done: "Terminé",
            errorSubmit: "Impossible d’envoyer vos coordonnées. Vérifiez votre connexion et réessayez.",
            errorCountry: "Veuillez saisir votre pays.",
            errorName: "Veuillez saisir votre nom.",
            errorPhone: "Veuillez saisir votre numéro de téléphone.",
            errorEmail: "Veuillez saisir une adresse e-mail valide."
        },
        ja: {
            title: "連絡先の詳細",
            subtitle: "計算ツールを改善し続けるため、連絡先をご入力ください。",
            country: "国",
            name: "名前",
            phone: "電話番号",
            email: "メールアドレス",
            countryPlaceholder: "国を入力してください",
            namePlaceholder: "名前を入力してください",
            phonePlaceholder: "電話番号を入力してください",
            emailPlaceholder: "メールアドレスを入力してください",
            submit: "送信",
            submitting: "送信中…",
            close: "連絡先を閉じる",
            successTitle: "ありがとうございます！",
            successBody: "連絡先の詳細が正常に送信されました。",
            done: "完了",
            errorSubmit: "詳細を送信できませんでした。接続を確認して、もう一度お試しください。",
            errorCountry: "国を入力してください。",
            errorName: "名前を入力してください。",
            errorPhone: "電話番号を入力してください。",
            errorEmail: "有効なメールアドレスを入力してください。"
        },
        zh: {
            title: "联系方式",
            subtitle: "请分享您的联系方式，以便我们持续改进计算工具。",
            country: "国家/地区",
            name: "姓名",
            phone: "电话号码",
            email: "电子邮箱",
            countryPlaceholder: "请输入国家/地区",
            namePlaceholder: "请输入姓名",
            phonePlaceholder: "请输入电话号码",
            emailPlaceholder: "请输入电子邮箱",
            submit: "提交",
            submitting: "正在提交…",
            close: "关闭联系方式",
            successTitle: "谢谢！",
            successBody: "您的联系方式已成功提交。",
            done: "完成",
            errorSubmit: "无法提交您的信息。请检查网络连接后重试。",
            errorCountry: "请输入国家/地区。",
            errorName: "请输入姓名。",
            errorPhone: "请输入电话号码。",
            errorEmail: "请输入有效的电子邮箱。"
        },
        pt: {
            title: "Dados de contato",
            subtitle: "Compartilhe seus dados para continuarmos melhorando as calculadoras.",
            country: "País",
            name: "Nome",
            phone: "Número de telefone",
            email: "Endereço de e-mail",
            countryPlaceholder: "Informe seu país",
            namePlaceholder: "Informe seu nome",
            phonePlaceholder: "Informe seu número de telefone",
            emailPlaceholder: "Informe seu endereço de e-mail",
            submit: "Enviar",
            submitting: "Enviando…",
            close: "Fechar dados de contato",
            successTitle: "Obrigado!",
            successBody: "Seus dados de contato foram enviados com sucesso.",
            done: "Concluir",
            errorSubmit: "Não foi possível enviar seus dados. Verifique sua conexão e tente novamente.",
            errorCountry: "Informe seu país.",
            errorName: "Informe seu nome.",
            errorPhone: "Informe seu número de telefone.",
            errorEmail: "Informe um endereço de e-mail válido."
        },
        ar: {
            title: "بيانات الاتصال",
            subtitle: "شارك بياناتك لنساعد في تحسين الحاسبات باستمرار.",
            country: "الدولة",
            name: "الاسم",
            phone: "رقم الهاتف",
            email: "البريد الإلكتروني",
            countryPlaceholder: "أدخل دولتك",
            namePlaceholder: "أدخل اسمك",
            phonePlaceholder: "أدخل رقم هاتفك",
            emailPlaceholder: "أدخل بريدك الإلكتروني",
            submit: "إرسال",
            submitting: "جارٍ الإرسال…",
            close: "إغلاق بيانات الاتصال",
            successTitle: "شكرًا لك!",
            successBody: "تم إرسال بيانات الاتصال بنجاح.",
            done: "تم",
            errorSubmit: "تعذّر إرسال بياناتك. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
            errorCountry: "يرجى إدخال الدولة.",
            errorName: "يرجى إدخال الاسم.",
            errorPhone: "يرجى إدخال رقم الهاتف.",
            errorEmail: "يرجى إدخال بريد إلكتروني صالح."
        }
    };

    /* ==================================================
       STORAGE
       Small helpers that never throw: private modes and full quotas fall back
       to in-memory values for the current page.
    ================================================== */
    var memoryStore = {};

    function storageGet(store, key) {
        try {
            /* The stored value is always the source of truth; the in-memory copy
               only stands in when the browser refuses storage altogether, so a
               record removed here or in another tab is never resurrected. */
            return store.getItem(key);
        } catch (error) {
            return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
        }
    }

    function storageSet(store, key, value) {
        memoryStore[key] = value;
        try {
            store.setItem(key, value);
        } catch (error) {}
    }

    function storageRemove(store, key) {
        try { delete memoryStore[key]; } catch (error) {}
        try { store.removeItem(key); } catch (error) {}
    }

    function readCount() {
        var raw = storageGet(window.localStorage, COUNT_KEY);
        var count = parseInt(raw, 10);
        return isFinite(count) && count > 0 ? count : 0;
    }

    function writeCount(count) {
        storageSet(window.localStorage, COUNT_KEY, String(count));
    }

    function readSubmission() {
        var raw = storageGet(window.localStorage, SUBMISSION_KEY);
        if (!raw) return null;
        try {
            var data = JSON.parse(raw);
            if (data && typeof data.submittedAt === "string" && data.submittedAt) return data;
        } catch (error) {}
        return null;
    }

    function hasSubmitted() {
        return !!readSubmission();
    }

    function promptAlreadyShown() {
        return storageGet(window.sessionStorage, PROMPT_KEY) === "1";
    }

    function markPromptShown() {
        storageSet(window.sessionStorage, PROMPT_KEY, "1");
    }

    /* ==================================================
       CURRENT LANGUAGE
       The popup follows the language of the page the visitor is on, so the
       same component works on every localized page and calculator.
    ================================================== */
    function currentLanguage() {
        var code = "";
        if (window.MW_I18N && typeof window.MW_I18N.language === "string") {
            code = window.MW_I18N.language;
        }
        if (!code && document.documentElement) {
            code = document.documentElement.getAttribute("lang") || "";
        }
        code = String(code).toLowerCase().replace(/_/g, "-");
        var base = code.split("-")[0];
        return TEXT[base] ? base : "en";
    }

    function t(key) {
        var table = TEXT[currentLanguage()] || TEXT.en;
        return table[key] || TEXT.en[key] || key;
    }

    /* ==================================================
       CALCULATION COUNTER
       One global count for every calculator. Only a Calculate click that ends
       in a visible, error-free result adds one; input edits, page views and
       automatic re-renders never touch the count.
    ================================================== */
    var watchToken = 0;
    var lastCountedToken = 0;

    function isVisible(element) {
        if (!element) return false;
        if (element.hasAttribute("hidden")) return false;
        var style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        return element.getClientRects().length > 0;
    }

    function calculationSucceeded() {
        var results = document.getElementById("results");
        if (!results || !isVisible(results)) return false;

        var errorBox = document.getElementById("error");
        if (errorBox && String(errorBox.textContent || "").trim()) return false;

        return /\d/.test(String(results.textContent || ""));
    }

    function recordSuccessfulCalculation(token, startedAt) {
        if (token !== watchToken) return;
        if (token === lastCountedToken) return;

        if (!calculationSucceeded()) {
            if (Date.now() - startedAt < 15000) {
                window.setTimeout(function () {
                    recordSuccessfulCalculation(token, startedAt);
                }, 180);
            }
            return;
        }

        lastCountedToken = token;
        var total = readCount() + 1;
        writeCount(total);

        if (total >= THRESHOLD && !hasSubmitted()) {
            window.setTimeout(function () { openDialog(); }, 350);
        }
    }

    function watchCalculation() {
        var token = ++watchToken;
        var startedAt = Date.now();
        var pending = null;

        try {
            if (window.MWCalc && typeof window.MWCalc.getLastCalculationPromise === "function") {
                pending = window.MWCalc.getLastCalculationPromise();
            }
        } catch (error) {
            pending = null;
        }

        if (pending && typeof pending.then === "function") {
            /* The calculator's own request settles before its lastCalculation
               becomes available, so wait for the same promise it awaits. */
            pending.then(function () {
                recordSuccessfulCalculation(token, startedAt);
            }, function () {
                /* A failed calculation never counts. */
            });
            return;
        }

        recordSuccessfulCalculation(token, startedAt);
    }

    function onClick(event) {
        var target = event.target;
        var button = target && target.closest ? target.closest("#calculateBtn") : null;
        if (!button) return;
        watchCalculation();
    }

    /* ==================================================
       DIALOG MARKUP
       Built once on first use and then reused across the website.
    ================================================== */
    var dialog = null;
    var card = null;
    var form = null;
    var inputs = {};
    var fieldErrors = {};
    var formError = null;
    var submitButton = null;
    var submitLabel = null;
    var successView = null;
    var formView = null;
    var titleNode = null;
    var subtitleNode = null;
    var lastFocus = null;
    var previousOverflow = "";
    var isOpen = false;
    var isSubmitting = false;

    var FIELDS = [
        { key: "country", type: "text", autocomplete: "country-name", inputmode: "text", capitalize: "words", label: "country", placeholder: "countryPlaceholder", error: "errorCountry" },
        { key: "name", type: "text", autocomplete: "name", inputmode: "text", capitalize: "words", label: "name", placeholder: "namePlaceholder", error: "errorName" },
        { key: "phone", type: "tel", autocomplete: "tel", inputmode: "tel", capitalize: "none", label: "phone", placeholder: "phonePlaceholder", error: "errorPhone" },
        { key: "email", type: "email", autocomplete: "email", inputmode: "email", capitalize: "none", label: "email", placeholder: "emailPlaceholder", error: "errorEmail" }
    ];

    var CHECK_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<path d="M20 6 9 17l-5-5"/></svg>';

    function createDialog() {
        if (dialog || !document.body) return;

        dialog = document.createElement("div");
        dialog.className = "cd-dialog";
        dialog.id = "contactDetailsDialog";
        dialog.hidden = true;
        dialog.setAttribute("aria-hidden", "true");
        /* The popup ships its own text for every language, so the page
           translator must leave its labels and placeholders untouched. */
        dialog.setAttribute("data-i18n-skip", "true");

        var fieldsHtml = FIELDS.map(function (field) {
            return '' +
                '<div class="cd-field" data-field="' + field.key + '">' +
                    '<label class="cd-field__label" for="cdField-' + field.key + '"></label>' +
                    '<input class="cd-field__input" id="cdField-' + field.key + '" name="' + field.key + '" ' +
                        'type="' + field.type + '" inputmode="' + field.inputmode + '" ' +
                        'autocomplete="' + field.autocomplete + '" autocapitalize="' + field.capitalize + '" ' +
                        'enterkeyhint="' + (field.key === "email" ? "send" : "next") + '" ' +
                        'aria-describedby="cdError-' + field.key + '">' +
                    '<span class="cd-field__error" id="cdError-' + field.key + '" role="alert"></span>' +
                '</div>';
        }).join("");

        dialog.innerHTML =
            '<div class="cd-dialog__backdrop" data-cd-close aria-hidden="true"></div>' +
            '<section class="cd-dialog__card" role="dialog" aria-modal="true" ' +
                'aria-labelledby="cdDialogTitle" tabindex="-1">' +
                '<button class="cd-dialog__close" type="button" data-cd-close aria-label="Close">&times;</button>' +
                '<div class="cd-dialog__head">' +
                    '<h2 class="cd-dialog__title" id="cdDialogTitle"></h2>' +
                    '<p class="cd-dialog__subtitle"></p>' +
                '</div>' +
                '<div class="cd-dialog__body">' +
                    '<form class="cd-form" novalidate>' +
                        fieldsHtml +
                        '<p class="cd-form__error" role="alert"></p>' +
                        '<button class="cd-submit" type="submit"><span class="cd-submit__label"></span>' +
                            '<span class="cd-submit__spinner" aria-hidden="true"></span></button>' +
                    '</form>' +
                    '<div class="cd-success" hidden>' +
                        '<span class="cd-success__icon">' + CHECK_ICON + '</span>' +
                        '<h3 class="cd-success__title"></h3>' +
                        '<p class="cd-success__body"></p>' +
                        '<button class="cd-success__done" type="button" data-cd-close></button>' +
                    '</div>' +
                '</div>' +
            '</section>';

        document.body.appendChild(dialog);

        card = dialog.querySelector(".cd-dialog__card");
        form = dialog.querySelector(".cd-form");
        formView = form;
        successView = dialog.querySelector(".cd-success");
        formError = dialog.querySelector(".cd-form__error");
        submitButton = dialog.querySelector(".cd-submit");
        submitLabel = dialog.querySelector(".cd-submit__label");
        titleNode = dialog.querySelector(".cd-dialog__title");
        subtitleNode = dialog.querySelector(".cd-dialog__subtitle");

        FIELDS.forEach(function (field) {
            inputs[field.key] = dialog.querySelector("#cdField-" + field.key);
            fieldErrors[field.key] = dialog.querySelector("#cdError-" + field.key);
            inputs[field.key].setAttribute("maxlength", field.key === "email" ? "254" : "120");
        });

        dialog.addEventListener("click", function (event) {
            if (event.target && event.target.closest && event.target.closest("[data-cd-close]")) {
                event.preventDefault();
                closeDialog();
            }
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            submitForm();
        });

        dialog.querySelector(".cd-success__done").addEventListener("click", closeDialog);

        document.addEventListener("keydown", onKeyDown, false);
        applyStrings();
    }

    function applyStrings() {
        if (!dialog) return;
        var closeButton = dialog.querySelector(".cd-dialog__close");
        titleNode.textContent = t("title");
        subtitleNode.textContent = t("subtitle");
        if (closeButton) closeButton.setAttribute("aria-label", t("close"));

        FIELDS.forEach(function (field) {
            var fieldNode = dialog.querySelector('[data-field="' + field.key + '"]');
            if (!fieldNode) return;
            fieldNode.querySelector(".cd-field__label").textContent = t(field.label);
            inputs[field.key].setAttribute("placeholder", t(field.placeholder));
            inputs[field.key].setAttribute("aria-label", t(field.label));
            if (fieldErrors[field.key] && fieldErrors[field.key].textContent) {
                fieldErrors[field.key].textContent = t(field.error);
            }
        });

        submitLabel.textContent = isSubmitting ? t("submitting") : t("submit");
        dialog.querySelector(".cd-success__title").textContent = t("successTitle");
        dialog.querySelector(".cd-success__body").textContent = t("successBody");
        dialog.querySelector(".cd-success__done").textContent = t("done");
        if (formError && formError.textContent) formError.textContent = t("errorSubmit");
    }

    /* ==================================================
       VALIDATION
    ================================================== */
    function readValues() {
        var values = {};
        FIELDS.forEach(function (field) {
            values[field.key] = String(inputs[field.key].value || "").trim();
        });
        return values;
    }

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    }

    function validate(values) {
        var errors = [];
        if (!values.country) errors.push({ key: "country", message: t("errorCountry") });
        if (!values.name) errors.push({ key: "name", message: t("errorName") });
        if (!values.phone || !/\d/.test(values.phone)) errors.push({ key: "phone", message: t("errorPhone") });
        if (!isValidEmail(values.email)) errors.push({ key: "email", message: t("errorEmail") });
        return errors;
    }

    function clearErrors() {
        FIELDS.forEach(function (field) {
            fieldErrors[field.key].textContent = "";
            inputs[field.key].removeAttribute("aria-invalid");
            var node = dialog.querySelector('[data-field="' + field.key + '"]');
            if (node) node.classList.remove("is-invalid");
        });
        formError.textContent = "";
    }

    function showErrors(errors) {
        clearErrors();
        errors.forEach(function (error) {
            fieldErrors[error.key].textContent = error.message;
            inputs[error.key].setAttribute("aria-invalid", "true");
            var node = dialog.querySelector('[data-field="' + error.key + '"]');
            if (node) node.classList.add("is-invalid");
        });
        if (errors.length) {
            try { inputs[errors[0].key].focus({ preventScroll: true }); } catch (e) { inputs[errors[0].key].focus(); }
        }
    }

    function hasEntryConfig() {
        return !!(FORM_CONFIG.entries.name && FORM_CONFIG.entries.phone &&
            FORM_CONFIG.entries.email && FORM_CONFIG.action);
    }

    /* Builds the Google Forms body for one form, using only the entry ids that
       form really has. */
    function formBody(form, values) {
        var body = new URLSearchParams();
        if (form.entries.country) {
            body.append(form.entries.country, values.country);
        }
        body.append(form.entries.name, values.name);
        body.append(form.entries.phone, values.phone);
        body.append(form.entries.email, values.email);
        body.append("fvv", "1");
        body.append("pageHistory", "0");
        body.append("fbzx", String(Math.floor(Math.random() * 9e18) - 4.5e18));
        return body;
    }

    /* Posts one submission in the background. The browser only learns whether
       the request completed, never Google's page, which is what keeps the
       Google Forms interface out of the site. */
    function postForm(form, values) {
        return fetch(form.action, {
            method: "POST",
            mode: "no-cors",
            credentials: "omit",
            cache: "no-store",
            referrerPolicy: "no-referrer",
            body: formBody(form, values)
        });
    }

    function setBusy(busy) {
        isSubmitting = busy;
        submitButton.disabled = busy;
        dialog.classList.toggle("is-submitting", busy);
        submitLabel.textContent = busy ? t("submitting") : t("submit");
    }

    /* ==================================================
       SUBMIT
       The values are posted straight to the Google Form endpoint in the
       background. Google's page is never opened, framed or shown.
    ================================================== */
    function submitForm() {
        if (isSubmitting) return;

        var values = readValues();
        var errors = validate(values);
        if (errors.length) {
            showErrors(errors);
            return;
        }
        clearErrors();

        if (!hasEntryConfig()) {
            formError.textContent = t("errorSubmit");
            return;
        }
        if (navigator.onLine === false) {
            formError.textContent = t("errorSubmit");
            return;
        }

        setBusy(true);

        var targets = [FORM_CONFIG];
        if (MIRROR_CONFIG && MIRROR_CONFIG !== FORM_CONFIG) {
            targets.push(MIRROR_CONFIG);
        }

        var settled = false;
        var timer = window.setTimeout(function () {
            if (settled) return;
            settled = true;
            setBusy(false);
            formError.textContent = t("errorSubmit");
        }, SUBMIT_TIMEOUT_MS);

        Promise.all(targets.map(function (form) {
            return postForm(form, values).then(function () {
                return true;
            }, function () {
                return false;
            });
        })).then(function (delivered) {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);

            if (delivered.some(function (ok) { return ok; })) {
                onSubmitted(values);
                return;
            }
            setBusy(false);
            formError.textContent = t("errorSubmit");
        });
    }

    function onSubmitted(values) {
        var record = {
            country: values.country,
            name: values.name,
            phone: values.phone,
            email: values.email,
            submittedAt: new Date().toISOString(),
            formId: FORM_CONFIG.id,
            mirrorFormId: MIRROR_CONFIG ? MIRROR_CONFIG.id : null
        };
        storageSet(window.localStorage, SUBMISSION_KEY, JSON.stringify(record));

        setBusy(false);
        formView.hidden = true;
        successView.hidden = false;
        dialog.classList.add("is-success");
        try {
            dialog.querySelector(".cd-success__done").focus({ preventScroll: true });
        } catch (error) {}
    }

    /* ==================================================
       OPEN / CLOSE
    ================================================== */
    function openDialog() {
        if (!document.body) return;
        if (hasSubmitted()) return;
        if (!dialog) createDialog();
        if (!dialog) return;

        if (isOpen) return;

        isOpen = true;
        lastFocus = document.activeElement;
        previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";

        markPromptShown();
        applyStrings();

        formView.hidden = false;
        successView.hidden = true;
        dialog.classList.remove("is-success");

        dialog.hidden = false;
        dialog.setAttribute("aria-hidden", "false");
        dialog.classList.add("is-open");

        window.setTimeout(function () {
            try { card.focus({ preventScroll: true }); } catch (error) {}
        }, 30);
    }

    function closeDialog() {
        if (!dialog || !isOpen) return;
        isOpen = false;
        dialog.hidden = true;
        dialog.setAttribute("aria-hidden", "true");
        dialog.classList.remove("is-open");
        document.documentElement.style.overflow = previousOverflow || "";
        previousOverflow = "";

        if (lastFocus && typeof lastFocus.focus === "function") {
            try { lastFocus.focus({ preventScroll: true }); } catch (error) {}
        }
        lastFocus = null;
    }

    function onKeyDown(event) {
        if (!isOpen) return;

        if (event.key === "Escape" || event.key === "Esc") {
            event.preventDefault();
            closeDialog();
            return;
        }

        if (event.key !== "Tab" || !card) return;

        var focusable = card.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        var visible = Array.prototype.filter.call(focusable, function (node) {
            return node.offsetParent !== null;
        });
        if (!visible.length) return;

        var first = visible[0];
        var last = visible[visible.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    /* ==================================================
       INIT
    ================================================== */
    function maybeShowPending() {
        if (hasSubmitted()) return;
        if (readCount() < THRESHOLD) return;
        if (promptAlreadyShown()) return;
        window.setTimeout(openDialog, 1200);
    }

    function init() {
        if (window.MW_I18N && typeof window.MW_I18N.language === "string") {
            /* Keep a dialog that is already on screen in the chosen language. */
            window.addEventListener("mw:languagechange", applyStrings, false);
        }
        document.addEventListener("click", onClick, false);

        if (document.body) {
            maybeShowPending();
        } else {
            document.addEventListener("DOMContentLoaded", maybeShowPending, { once: true });
        }
    }

    window.MWContactDetails = {
        threshold: THRESHOLD,
        getCount: readCount,
        setCount: function (value) {
            var count = parseInt(value, 10);
            writeCount(isFinite(count) && count > 0 ? count : 0);
        },
        getSubmission: readSubmission,
        clearSubmission: function () {
            storageRemove(window.localStorage, SUBMISSION_KEY);
        },
        clearPromptFlag: function () {
            storageRemove(window.sessionStorage, PROMPT_KEY);
        },
        open: openDialog,
        close: closeDialog,
        hasFormConfig: hasEntryConfig
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();

/* ==================================================
   CONTACT DETAILS POPUP JAVASCRIPT END
   This JavaScript file ends here.
================================================== */
