# Adds the report / block / privacy-policy strings to en, fr and ar Localizable.strings.
# Safe to run again: existing keys are replaced, not duplicated.
import re, os
ROOT = os.path.join(os.path.dirname(__file__), '..', 'BoumerdesStays', 'Resources')
EMAIL = 'support@boumerdesstays.app'

T = {
"Report review": ("Report review", "Signaler l’avis", "بلّغ على هاد الرأي"),
"Block reviewer": ("Block reviewer", "Bloquer l’auteur", "بلوكي صاحب الرأي"),
"More options": ("More options", "Plus d’options", "خيارات أخرى"),
"Why are you reporting this review?": ("Why are you reporting this review?", "Pourquoi signalez-vous cet avis ?", "علاش راك تبلّغ على هاد الرأي؟"),
"Spam or fake": ("Spam or fake", "Spam ou faux avis", "سبام ولا رأي مزيّف"),
"Offensive or hateful": ("Offensive or hateful", "Injurieux ou haineux", "فيه سبّ ولا كراهية"),
"Shares personal information": ("Shares personal information", "Contient des infos personnelles", "فيه معلومات شخصية"),
"Not about this place": ("Not about this place", "Ne concerne pas ce lieu", "ماشي على هاد البلاصة"),
"Something else": ("Something else", "Autre chose", "حاجة أخرى"),
"Block this reviewer?": ("Block this reviewer?", "Bloquer cet auteur ?", "تبلوكي صاحب هاد الرأي؟"),
"Their review will be hidden on this phone. You can unblock in Settings.": (
    "Their review will be hidden on this phone. You can unblock in Settings.",
    "Son avis sera masqué sur ce téléphone. Vous pouvez le débloquer dans Réglages.",
    "الرأي تاعو يتخبّى في التيليفون تاعك. تقدر ترجّعو من الريغلاج."),
"Block": ("Block", "Bloquer", "بلوكي"),
"Review reported": ("Review reported", "Avis signalé", "وصلنا التبليغ"),
"Reviewer blocked": ("Reviewer blocked", "Auteur bloqué", "تبلوكى"),
"Support & privacy": ("Support & privacy", "Aide et confidentialité", "المساعدة والخصوصية"),
"Privacy policy": ("Privacy policy", "Politique de confidentialité", "سياسة الخصوصية"),
"Contact us": ("Contact us", "Nous contacter", "كلّمنا"),
"Blocked reviews": ("Blocked reviews", "Avis bloqués", "الآراء المبلوكية"),
"Unblock all": ("Unblock all", "Tout débloquer", "نحّي البلوك"),
"%d hidden": ("%d hidden", "%d masqués", "%d مخبّيين"),
"Last updated %@": ("Last updated %@", "Dernière mise à jour : %@", "آخر تحديث: %@"),

# Privacy policy (Arabic is plain standard Arabic: it is a legal text, not UI copy)
"privacy.summary.title": ("In short", "En bref", "باختصار"),
"privacy.summary.body": (
    "Boumerdès Stays doesn’t ask you to create an account and doesn’t collect, sell or share your personal data. There are no ads, no analytics and no tracking.",
    "Boumerdès Stays ne vous demande pas de créer de compte et ne collecte, ne vend ni ne partage vos données personnelles. Pas de publicité, pas de statistiques d’usage, pas de pistage.",
    "لا يطلب منك تطبيق Boumerdès Stays إنشاء حساب، ولا يجمع بياناتك الشخصية ولا يبيعها ولا يشاركها. لا توجد إعلانات ولا أدوات تحليل ولا تتبّع."),
"privacy.device.title": ("What stays on your phone", "Ce qui reste sur votre téléphone", "ما يبقى على هاتفك"),
"privacy.device.body": (
    "Your saved stays, search filters, language and appearance choices, and the reviews you reported or blocked are stored only on your device. Deleting the app deletes them.",
    "Vos hébergements favoris, vos filtres, vos choix de langue et d’apparence, ainsi que les avis signalés ou bloqués, sont stockés uniquement sur votre appareil. Supprimer l’application les supprime.",
    "تُحفظ أماكن الإقامة المفضلة، وفلاتر البحث، واختيارات اللغة والمظهر، والآراء التي أبلغت عنها أو حظرتها على جهازك فقط، وتُحذف بحذف التطبيق."),
"privacy.content.title": ("Photos and maps", "Photos et cartes", "الصور والخرائط"),
"privacy.content.body": (
    "To show photos and maps, the app downloads them from content servers (photo hosting and map providers). Like any website, these servers receive your device’s IP address and basic technical details needed to deliver the files. We send them nothing else about you.",
    "Pour afficher les photos et les cartes, l’application les télécharge depuis des serveurs de contenu (hébergement de photos et fournisseurs de cartes). Comme tout site web, ces serveurs reçoivent l’adresse IP de votre appareil et les informations techniques nécessaires à l’envoi des fichiers. Nous ne leur transmettons rien d’autre vous concernant.",
    "لعرض الصور والخرائط، يحمّلها التطبيق من خوادم محتوى (استضافة الصور ومزوّدو الخرائط). وكأي موقع إلكتروني، تتلقى هذه الخوادم عنوان IP لجهازك والمعلومات التقنية اللازمة لإرسال الملفات. لا نرسل إليها أي شيء آخر عنك."),
"privacy.apps.title": ("Calls, directions and websites", "Appels, itinéraires et sites web", "الاتصال والاتجاهات والمواقع"),
"privacy.apps.body": (
    "When you tap Call, Directions, Website or Email, the app opens your phone’s dialer, maps app, browser or mail app. What happens next is covered by those apps’ own privacy policies.",
    "Lorsque vous touchez Appeler, Itinéraire, Site web ou E-mail, l’application ouvre le téléphone, l’application de cartes, le navigateur ou la messagerie de votre appareil. La suite relève des politiques de confidentialité de ces applications.",
    "عند الضغط على الاتصال أو الاتجاهات أو الموقع أو البريد، يفتح التطبيق تطبيق الهاتف أو الخرائط أو المتصفح أو البريد في جهازك، وتخضع الخطوات التالية لسياسات الخصوصية الخاصة بتلك التطبيقات."),
"privacy.reports.title": ("Reports and messages", "Signalements et messages", "البلاغات والرسائل"),
"privacy.reports.body": (
    "If you report a review or contact us, your mail app sends us an email with your email address and the details you choose to include. We use it only to handle your report or reply to you, review reports within 24 hours, and delete the message once it’s no longer needed.",
    "Si vous signalez un avis ou nous contactez, votre messagerie nous envoie un e-mail contenant votre adresse et les informations que vous choisissez d’inclure. Nous l’utilisons uniquement pour traiter votre signalement ou vous répondre, examinons les signalements sous 24 heures et supprimons le message lorsqu’il n’est plus utile.",
    "إذا أبلغت عن رأي أو تواصلت معنا، يرسل تطبيق البريد إلينا رسالة تتضمن بريدك الإلكتروني والتفاصيل التي تختار إضافتها. نستخدمها فقط لمعالجة البلاغ أو الرد عليك، ونراجع البلاغات خلال 24 ساعة، ونحذف الرسالة عندما لا تعود ضرورية."),
"privacy.listings.title": ("About the listings", "À propos des fiches", "حول بيانات أماكن الإقامة"),
"privacy.listings.body": (
    "Names, addresses, phone numbers, ratings and reviews of places come from publicly available business information. Reviews are shown without reviewer names. If you run a listed place or wrote a review and want something corrected or removed, contact us.",
    "Les noms, adresses, numéros, notes et avis proviennent d’informations publiques sur les établissements. Les avis sont affichés sans le nom de leur auteur. Si vous gérez un établissement listé ou avez écrit un avis et souhaitez une correction ou un retrait, contactez-nous.",
    "الأسماء والعناوين وأرقام الهاتف والتقييمات والآراء مأخوذة من معلومات عامة عن المؤسسات، وتُعرض الآراء دون أسماء كاتبيها. إذا كنت تدير مكاناً مدرجاً أو كتبت رأياً وتريد تصحيحه أو حذفه، فتواصل معنا."),
"privacy.children.title": ("Children", "Enfants", "الأطفال"),
"privacy.children.body": (
    "The app is meant for a general audience and doesn’t knowingly collect information from children.",
    "L’application s’adresse au grand public et ne collecte sciemment aucune information concernant des enfants.",
    "التطبيق موجّه لعامة الناس ولا يجمع عن قصد أي معلومات عن الأطفال."),
"privacy.changes.title": ("Changes", "Modifications", "التعديلات"),
"privacy.changes.body": (
    "If this policy changes, we’ll update it here and change the date at the top.",
    "Si cette politique change, nous la mettrons à jour ici et modifierons la date en haut.",
    "إذا تغيّرت هذه السياسة، سنحدّثها هنا ونغيّر التاريخ في أعلاها."),
"privacy.contact.title": ("Contact", "Contact", "التواصل"),
"privacy.contact.body": (
    "Questions about privacy or a request to remove information:",
    "Questions sur la confidentialité ou demande de retrait d’informations :",
    "للأسئلة حول الخصوصية أو لطلب حذف معلومات:"),
}

def esc(s): return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

for idx, lang in enumerate(['en', 'fr', 'ar']):
    p = os.path.join(ROOT, f'{lang}.lproj', 'Localizable.strings')
    text = open(p, encoding='utf-8').read()
    for k in T:
        text = re.sub(r'^"' + re.escape(esc(k)) + r'" = .*\n', '', text, flags=re.M)
    text = text.rstrip('\n') + '\n\n/* Report, block, privacy policy */\n'
    for k, v in T.items():
        text += f'"{esc(k)}" = "{esc(v[idx])}";\n'
    open(p, 'w', encoding='utf-8').write(text)
    print(lang, 'ok')
